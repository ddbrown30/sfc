import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";

export class Coins {

    /* -------------------------------------------- */
    /*                   Handlers                   */
    /* -------------------------------------------- */

    static async onReady() {
        game.sfc.coinMap = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.coinMap);

        if (!Object.values(game.sfc.coinMap).length) {
            const defaultMap = Coins.createDefaultCoinMap();
            Utils.setSetting(SFC_CONFIG.SETTING_KEYS.coinMap, duplicate(defaultMap));
        }
    }
    
    static async onRenderSettingsConfig(app, el, data) {
        //Add the init actors button
        const button = $(await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.initActorsButton, {}));
        const dialogContent = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.initActorsDialog, {});


        button.find('[data-key="init-actors-button"]').click(ev => {
            const dialog = new Dialog({
                title: game.i18n.localize("SFC.InitActors.Title"),
                content: dialogContent,
                buttons: {
                    yes: {
                        icon: `<i class="fa fa-check"></i>`,
                        label: game.i18n.localize("WORDS._Yes"),
                        callback: async (html) => {
                            const behaviour = html.find(`#behaviour`)[0].value;
                            const keepCurrency = behaviour == "keep-coins" ? false  : true;
                            await Coins.initActorInventories(keepCurrency);
                        }
                    },
                    no: {
                        icon: `<i class="fa fa-times"></i>`,
                        label: game.i18n.localize("WORDS._No"),
                        callback: event => { }
                    }
                },
                default: "no"
            });
            dialog.render(true);
        })

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
        let coinArray = Object.values(game.sfc.coinMap);
        coinArray.sort((a, b) => {
            return b.flags.sfc.value - a.flags.sfc.value;
        });

        //Create an array of processed data for handlebars to use
        let coinData = [];
        for (const coin of coinArray) {
            if (coin.flags.sfc.enabled) {
                coinData.push({
                    name: coin.name,
                    img: coin.img,
                    count: actor.flags.sfc ? actor.flags.sfc[coin.flags.sfc.countFlagName] : 0,
                    countFlagName: coin.flags.sfc.countFlagName
                });
            }
        }

        let currencyName = game.settings.get("swade", "currencyName");
        const templateData = {actor, currencyName, coinData};
        const content = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.coinsDisplay, templateData);
        
        //Find the existing currency section and replace it with ours
        const currencySection = html[0].querySelector("div.form-group.currency");
        currencySection.parentNode.insertAdjacentHTML("afterend", content);
        currencySection.remove();
    }

    static async onPreUpdateActor(actor, updateData, options, userId) {
        if (!Utils.hasModuleFlags(updateData)) {
            //We don't care about this update
            return;
        }

        for (const coin of Object.values(game.sfc.coinMap)) {
            const count = Utils.getFlag(updateData, coin.flags.sfc.countFlagName);
            if ((typeof count !== "undefined")) {
                //This is an update to the count of one of our coins. Find the coin item and update it
                let coinItem = actor.items.find(item => Utils.getFlag(item, "type") == Utils.getFlag(coin, "type"));
                if (!coinItem) {
                    //The actor doesn't have this coin item. Create it if needed
                    if (count == 0) {
                        //Our count is 0 so no need to make a new item
                        continue;
                    }

                    coinItem = await Coins.addCoinItem(actor, coin);
                }

                if (coinItem.system.quantity != count) {
                    await coinItem.update({ "system.quantity": count });
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
        for (const coin of Object.values(game.sfc.coinMap)) {
            let coinItem = actor.items.find(item => item.flags?.sfc?.type == coin.flags.sfc.type);
            if (coinItem) {
                totalCurrency += coinItem.system.quantity * coin.flags.sfc.value;
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
        let remainingCurrencyInt = Math.floor(actor.system.details.currency * 1000); //This converts us to an int so we don't have to deal with float issues
        let createData = [];
        let updateData = [];
        let deleteData = [];
        let countData = [];

        //Sort the coins by highest to lowest value so that we convert currency to the fewest total coins
        let coinArray = duplicate(Object.values(game.sfc.coinMap));
        coinArray.sort((a, b) => {
            return b.flags.sfc.value - a.flags.sfc.value;
        });

        for (const coin of coinArray) {
            let coinItem = actor.items.find(item => item.flags?.sfc?.type == coin.flags.sfc.type);
            if (!coin.flags.sfc.enabled) {
                if (coinItem) {
                    deleteData.push(coinItem.id);
                }
                continue;
            }

            let numCoins = 0;
            if (keepCurrency) {
                //If we're keeping currency, we want to make as many coins as will divide evenly into our remaining currency
                const valueInt = Math.floor(coin.flags.sfc.value * 1000);
                numCoins = Math.floor(remainingCurrencyInt / valueInt);

                //Subtract the value of the coins we just created from the remaining currency
                remainingCurrencyInt -= numCoins * valueInt;
            } else {
                //If we're keeping coins, either grab the current quantity if we have the coin or 0 if we don't
                numCoins = coinItem ? coinItem.system.quantity : 0;
            }

            if (coinItem) {
                await coinItem.updateSource({
                    "name": coin.name,
                    "img": coin.img,
                    "system.quantity": numCoins,
                    "system.weight": coin.system.weight
                });
                await coinItem.setFlag(SFC_CONFIG.NAME, "value", coin.flags.sfc.value);
                updateData.push(coinItem);
            } else {
                coin.system.quantity = numCoins;
                createData.push(coin);
            }

            //Set the count flag for this coin type on the actor, as the UI doesn't use the items directly
            //We push it here and actually set it later because this will trigger an update in the actor before we're ready to handle it
            countData.push({flagName: coin.flags.sfc.countFlagName, numCoins: numCoins});
        }
        
        if (createData.length) await actor.createEmbeddedDocuments("Item", createData);
        if (updateData.length) await actor.updateEmbeddedDocuments("Item", updateData);
        if (deleteData.length) await actor.deleteEmbeddedDocuments("Item", deleteData);

        for (let cd of countData ) {            
            await actor.setFlag(SFC_CONFIG.NAME, cd.flagName, cd.numCoins);
        }

        await Coins.refreshCurrency(actor);
        if (actor.sheet.rendered) {
            actor.sheet.render();
        }
    }

    static async addCoinItem(actor, coin) {
        const createdItems = await actor.createEmbeddedDocuments("Item", [coin]);
        return createdItems[0];
    }

    static createDefaultCoinMap() {
        let defaultMap = {};

        defaultMap["copper"] = {
            name: SFC_CONFIG.DEFAULT_CONFIG.coins.names.copper,
            type: 'gear',
            img: SFC_CONFIG.DEFAULT_CONFIG.coins.icons.copper,
            flags: {
                sfc: {
                    value: SFC_CONFIG.DEFAULT_CONFIG.coins.values.copper,
                    type: "copper",
                    countFlagName: SFC_CONFIG.FLAGS.copperCount,
                    enabled: true
                }
            },
            system: {
                quantity: 0,
                weight: SFC_CONFIG.DEFAULT_CONFIG.coins.weight
            }
        };
        
        defaultMap["silver"] = {
            name: SFC_CONFIG.DEFAULT_CONFIG.coins.names.silver,
            type: 'gear',
            img: SFC_CONFIG.DEFAULT_CONFIG.coins.icons.silver,
            flags: {
                sfc: {
                    value: SFC_CONFIG.DEFAULT_CONFIG.coins.values.silver,
                    type: "silver",
                    countFlagName: SFC_CONFIG.FLAGS.silverCount,
                    enabled: true
                }
            },
            system: {
                quantity: 0,
                weight: SFC_CONFIG.DEFAULT_CONFIG.coins.weight
            }
        };
        
        defaultMap["gold"] = {
            name: SFC_CONFIG.DEFAULT_CONFIG.coins.names.gold,
            type: 'gear',
            img: SFC_CONFIG.DEFAULT_CONFIG.coins.icons.gold,
            flags: {
                sfc: {
                    value: SFC_CONFIG.DEFAULT_CONFIG.coins.values.gold,
                    type: "gold",
                    countFlagName: SFC_CONFIG.FLAGS.goldCount,
                    enabled: true
                }
            },
            system: {
                quantity: 0,
                weight: SFC_CONFIG.DEFAULT_CONFIG.coins.weight
            }
        };
        
        defaultMap["plat"] = {
            name: SFC_CONFIG.DEFAULT_CONFIG.coins.names.plat,
            type: 'gear',
            img: SFC_CONFIG.DEFAULT_CONFIG.coins.icons.plat,
            flags: {
                sfc: {
                    value: SFC_CONFIG.DEFAULT_CONFIG.coins.values.plat,
                    type: "plat",
                    countFlagName: SFC_CONFIG.FLAGS.platCount,
                    enabled: true
                }
            },
            system: {
                quantity: 0,
                weight: SFC_CONFIG.DEFAULT_CONFIG.coins.weight
            }
        };

        Utils.setSetting(SFC_CONFIG.SETTING_KEYS.defaultCoinMap, defaultMap);
        return defaultMap;
    }
}