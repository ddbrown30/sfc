import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";
import { CoinManager } from "./coin-manager.js"

export class Coins {

    /* -------------------------------------------- */
    /*                   Handlers                   */
    /* -------------------------------------------- */

    static async onReady() {
        const defaultMap = Coins.createDefaultCoinDataMap();

        game.sfc.coinDataMap = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap);
        if (!Object.values(game.sfc.coinDataMap).length) {
            Utils.setSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap, duplicate(defaultMap));
        }

        //Migration of old coin map to the new one
        if ((typeof game.sfc.coinDataMap["copper"].enabled === "undefined")) {
            let newMap = duplicate(defaultMap);
            for (const oldCoinData of Object.values(game.sfc.coinDataMap)) {
                let newCoinData = newMap[oldCoinData.flags.sfc.type];
                newCoinData.enabled = oldCoinData.flags.sfc.enabled;
                newCoinData.img = oldCoinData.img;
                newCoinData.name = oldCoinData.name;
                newCoinData.shortName = oldCoinData.flags.sfc.shortName;
                newCoinData.value = oldCoinData.flags.sfc.value;
                newCoinData.weight = oldCoinData.system.weight;
            }
            game.sfc.coinDataMap = newMap;
        }

        Coins.buildItemDescriptionText();
    }
    
    static async onRenderSettingsConfig(app, el, data) {
        //Add the init actors button
        const button = $(await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.initAllActorsButton, {}));
        const dialogContent = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.initAllActorsDialog, {});

        button.find('[data-key="init-actors-button"]').click(ev => {
            const dialog = new Dialog({
                title: game.i18n.localize("SFC.InitActors.AllLabel"),
                content: dialogContent,
                buttons: {
                    yes: {
                        icon: `<i class="fa fa-check"></i>`,
                        label: game.i18n.localize("SFC.Yes"),
                        callback: async (html) => {
                            const behaviour = html.find(`#behaviour`)[0].value;
                            const keepCurrency = behaviour == "keep-coins" ? false  : true;
                            await Coins.initActorInventories(keepCurrency);
                        }
                    },
                    no: {
                        icon: `<i class="fa fa-times"></i>`,
                        label: game.i18n.localize("SFC.No"),
                        callback: event => { }
                    }
                },
                default: "no"
            });
            dialog.render(true);
        });

        //Find the start of the SFC section and add the button there
        el.find('[data-tab="sfc"] h2').after(button);
    }
    
    static async onRenderActorSheet(app, html, data) {
        let actor = app.actor;

        //When rendering a player character sheet, we replace the normal currency section with the SFC display
        if (actor.type != "character") {
            return;
        }
        
        //Sort the coins from highest value to lowest
        let coinDataArray = Object.values(game.sfc.coinDataMap);
        coinDataArray.sort((a, b) => {
            return b.value - a.value;
        });

        //Create an array of processed data for handlebars to use
        let coinTemplateData = [];
        for (const coinData of coinDataArray) {
            if (coinData.enabled) {
                coinTemplateData.push({
                    name: coinData.name,
                    img: coinData.img,
                    count: actor.flags.sfc ? actor.flags.sfc[coinData.countFlagName] : 0,
                    countFlagName: coinData.countFlagName
                });
            }
        }

        const showCurrency = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.showCurrency);
        const currencyName = game.settings.get("swade", "currencyName");
        const currencyAmount = actor.system.details.currency ? actor.system.details.currency : 0;
        const templateData = {currencyAmount, currencyName, coinTemplateData, showCurrency};
        const content = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.coinsDisplay, templateData);
        
        //Find the existing currency section and replace it with ours
        const currencySection = html[0].querySelector("div.form-group.currency");
        currencySection.parentNode.insertAdjacentHTML("afterend", content);
        currencySection.remove();

        //Respond to the init actor button
        html.find('[id="manager-button"]').click(ev => {
            new CoinManager(actor, app).render(true);
        });
    }

    static async onPreUpdateActor(actor, updateData, options, userId) {
        if (!Utils.hasModuleFlags(updateData)) {
            //We don't care about this update
            return;
        }

        for (const coinData of Object.values(game.sfc.coinDataMap)) {
            const count = Utils.getModuleFlag(updateData, coinData.countFlagName);
            if ((typeof count !== "undefined")) {
                //This is an update to the count of one of our coins. Find the coin item and update it
                let coinItem = actor.items.find(item => Utils.getModuleFlag(item, "type") == coinData.type);
                if (!coinItem) {
                    //The actor doesn't have this coin item. Create it if needed
                    if (count == 0) {
                        //Our count is 0 so no need to make a new item
                        continue;
                    }

                    coinItem = await Coins.addCoinItem(actor, coinData);
                }

                if (coinItem.system.quantity != count) {
                    await coinItem.update({"system.quantity": count});
                }
            }
        }
    }
    
    static async onUpdateItem(doc, updateData, options, userId) {
        let type = doc.getFlag("sfc", "type"); //We grab the type from this item just to confirm that this is a coin
        let quantity = updateData.system?.quantity;
        let actor = doc.actor;
        if ((typeof quantity !== "undefined") && type && actor) {
            this.refreshCurrency(actor);
            await actor.setFlag(SFC_CONFIG.NAME, doc.flags.sfc.countFlagName, quantity);
        }
    }
    
    static async onDeleteItem(doc, options, userId) {
        let type = doc.getFlag("sfc", "type"); //We grab the type from this item just to confirm that this is a coin
        let actor = doc.actor;
        if (type && actor) {
            //The user just deleted a coin item from their inventory
            //Update our currency value and set the count to 0 for the relevant coin count
            this.refreshCurrency(actor);
            await actor.setFlag(SFC_CONFIG.NAME, doc.flags.sfc.countFlagName, 0);
        }
    }

    /* -------------------------------------------- */
    /*             Inventory & Currency             */
    /* -------------------------------------------- */

    static async refreshCurrency(actor) {
        //Loop over all the coins in our inventory to calculate our total currency
        let totalCurrency = 0;
        for (const coinData of Object.values(game.sfc.coinDataMap)) {
            let coinItem = actor.items.find(item => item.flags?.sfc?.type == coinData.type);
            if (coinItem) {
                totalCurrency += coinItem.system.quantity * coinData.value;
            }
        }
        
        actor.update({"system.details.currency": Number(totalCurrency.toFixed(2))});
    }

    static async initActorInventories(keepCurrency) {
        for (const actor of game.actors) {
            if (actor.type !== "character") {
                //Only player characters use coins
                continue;
            }

            await this.initActorInventory(actor, keepCurrency);
        }
    }

    static async initActorInventory(actor, keepCurrency) {
        const currencyAmount = actor.system.details.currency ? actor.system.details.currency : 0;
        let remainingCurrencyInt = Math.floor(currencyAmount * 1000); //This converts us to an int so we don't have to deal with float issues
        let createData = [];
        let updateData = [];
        let deleteData = [];
        let countData = [];

        //Sort the coins by highest to lowest value so that we convert currency to the fewest total coins
        let coinDataArray = duplicate(Object.values(game.sfc.coinDataMap));
        coinDataArray.sort((a, b) => {
            return b.value - a.value;
        });

        for (const coinData of coinDataArray) {
            let coinItem = actor.items.find(item => item.flags?.sfc?.type == coinData.type);
            if (!coinData.enabled) {
                if (coinItem) {
                    deleteData.push(coinItem.id);
                }
                continue;
            }

            let numCoins = 0;
            if (keepCurrency) {
                //If we're keeping currency, we want to make as many coins as will divide evenly into our remaining currency
                const valueInt = Math.floor(coinData.value * 1000);
                numCoins = Math.floor(remainingCurrencyInt / valueInt);

                //Subtract the value of the coins we just created from the remaining currency
                remainingCurrencyInt -= numCoins * valueInt;
            } else {
                //If we're keeping coins, either grab the current quantity if we have the coin or 0 if we don't
                numCoins = coinItem ? coinItem.system.quantity : 0;
            }

            if (coinItem) {
                updateData.push({
                    _id: coinItem.id,
                    "name": coinData.name,
                    "img": coinData.img,
                    "system.quantity": numCoins,
                    "system.weight": coinData.weight,
                    "system.description": game.sfc.itemDescription
                });
            } else {
                const itemData = this.buildItemDataFromCoinData(coinData);
                createData.push(itemData);
            }

            //Set the count flag for this coin type on the actor, as the UI doesn't use the items directly
            //We push it here and actually set it later because this will trigger an update in the actor before we're ready to handle it
            countData.push({flagName: coinData.countFlagName, numCoins: numCoins});
        }
        
        if (createData.length) await actor.createEmbeddedDocuments("Item", createData);
        if (updateData.length) await actor.updateEmbeddedDocuments("Item", updateData);
        if (deleteData.length) await actor.deleteEmbeddedDocuments("Item", deleteData);

        for (let cd of countData) {
            await actor.setFlag(SFC_CONFIG.NAME, cd.flagName, cd.numCoins);
        }

        await Coins.refreshCurrency(actor);
        if (actor.sheet.rendered) {
            actor.sheet.render();
        }
    }

    static buildItemDataFromCoinData(coinData) {
        return {
            type: 'gear',
            name: coinData.name,
            img: coinData.img,
            flags: {
                sfc: {
                    type: coinData.type,
                    countFlagName: coinData.countFlagName
                }
            },
            system: {
                quantity: 0,
                weight: coinData.weight,
                description: game.sfc.itemDescription
            }
        };
    }

    static async addCoinItem(actor, coinData) {
        const itemData = this.buildItemDataFromCoinData(coinData);
        const createdItems = await actor.createEmbeddedDocuments("Item", [itemData]);
        return createdItems[0];
    }

    static createDefaultCoinDataMap() {
        let defaultMap = {};

        defaultMap[SFC_CONFIG.DEFAULT_CONFIG.coins.types.copper] = {
            enabled: true,
            name: SFC_CONFIG.DEFAULT_CONFIG.coins.names.copper,
            img: SFC_CONFIG.DEFAULT_CONFIG.coins.icons.copper,
            value: SFC_CONFIG.DEFAULT_CONFIG.coins.values.copper,
            shortName: SFC_CONFIG.DEFAULT_CONFIG.coins.shortNames.copper,
            type: SFC_CONFIG.DEFAULT_CONFIG.coins.types.copper,
            countFlagName: SFC_CONFIG.FLAGS.copperCount,
            weight: SFC_CONFIG.DEFAULT_CONFIG.coins.weight
        };

        defaultMap[SFC_CONFIG.DEFAULT_CONFIG.coins.types.silver] = {
            enabled: true,
            name: SFC_CONFIG.DEFAULT_CONFIG.coins.names.silver,
            img: SFC_CONFIG.DEFAULT_CONFIG.coins.icons.silver,
            value: SFC_CONFIG.DEFAULT_CONFIG.coins.values.silver,
            shortName: SFC_CONFIG.DEFAULT_CONFIG.coins.shortNames.silver,
            type: SFC_CONFIG.DEFAULT_CONFIG.coins.types.silver,
            countFlagName: SFC_CONFIG.FLAGS.silverCount,
            weight: SFC_CONFIG.DEFAULT_CONFIG.coins.weight
        };

        defaultMap[SFC_CONFIG.DEFAULT_CONFIG.coins.types.gold] = {
            enabled: true,
            name: SFC_CONFIG.DEFAULT_CONFIG.coins.names.gold,
            img: SFC_CONFIG.DEFAULT_CONFIG.coins.icons.gold,
            value: SFC_CONFIG.DEFAULT_CONFIG.coins.values.gold,
            shortName: SFC_CONFIG.DEFAULT_CONFIG.coins.shortNames.gold,
            type: SFC_CONFIG.DEFAULT_CONFIG.coins.types.gold,
            countFlagName: SFC_CONFIG.FLAGS.goldCount,
            weight: SFC_CONFIG.DEFAULT_CONFIG.coins.weight
        };

        defaultMap[SFC_CONFIG.DEFAULT_CONFIG.coins.types.plat] = {
            enabled: true,
            name: SFC_CONFIG.DEFAULT_CONFIG.coins.names.plat,
            img: SFC_CONFIG.DEFAULT_CONFIG.coins.icons.plat,
            value: SFC_CONFIG.DEFAULT_CONFIG.coins.values.plat,
            shortName: SFC_CONFIG.DEFAULT_CONFIG.coins.shortNames.plat,
            type: SFC_CONFIG.DEFAULT_CONFIG.coins.types.plat,
            countFlagName: SFC_CONFIG.FLAGS.platCount,
            weight: SFC_CONFIG.DEFAULT_CONFIG.coins.weight
        };

        Utils.setSetting(SFC_CONFIG.SETTING_KEYS.defaultCoinDataMap, defaultMap);
        return defaultMap;
    }

    static decimalToFraction(decimal) {
        var gcd = function(a, b) {
            if (!b) return a;
              a = parseInt(a);
              b = parseInt(b);
            return gcd(b, a % b);
          };
          
          var len = decimal.toString().length - 2;
          len = len > 1 ? len : 1; //If decimal is a whole number, we don't want to shift the denominator
          
          var denominator = Math.pow(10, len);
          var numerator = decimal * denominator;
          
          var divisor = gcd(numerator, denominator);          
          numerator /= divisor;
          denominator /= divisor;
          
          return numerator.toFixed() + '/' + denominator.toFixed();
    }

    static async buildItemDescriptionText() {
        //Sort the coins from lowest value to highest
        let coinDataArray = Object.values(duplicate(game.sfc.coinDataMap));
        coinDataArray.sort((a, b) => {
            return a.value - b.value;
        });

        let coinDescriptionDatas = [];
        for (let i = 0; i < coinDataArray.length; ++i) {
            const coinData = coinDataArray[i];
            if (coinData.enabled) {
                let coinDescriptionData = {
                    name: coinData.name,
                    shortName: coinData.shortName,
                    shortNameUpper: coinData.shortName.toUpperCase(),
                    columns: []
                };

                for (let j = 0; j < coinDataArray.length; ++j) {
                    if (!coinDataArray[j].enabled) {
                        continue;
                    }

                    if (i == j) {
                        coinDescriptionData.columns[j] = "1";
                        continue;
                    }
                    
                    const decimal = (coinData.value * 1000) / (coinDataArray[j].value * 1000);
                    const fraction = this.decimalToFraction(decimal);
                    coinDescriptionData.columns[j] = fraction;
                }

                coinDescriptionDatas.push(coinDescriptionData);
            }
        }

        const templateData = {coinDescriptionDatas};
        const content = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.itemDescription, templateData);
        game.sfc.itemDescription = content;
    }
}