import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";
import { CoinManager } from "./coin-manager.js";
import { InitAllActorsDialog } from "./init-all-actors-dialog.js";

export class Coins {

    /* -------------------------------------------- */
    /*                   Handlers                   */
    /* -------------------------------------------- */

    static async onReady() {
        const defaultMap = await Coins.createDefaultCoinDataMap();

        game.sfc.coinDataMap = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap);
        if (!Object.values(game.sfc.coinDataMap).length) {
            await Utils.setSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap, foundry.utils.duplicate(defaultMap));
        }

        //Migration of old coin map to the new one
        if ((typeof game.sfc?.coinDataMap["copper"]?.enabled === "undefined")) {
            let newMap = foundry.utils.duplicate(defaultMap);
            for (const oldCoinData of Object.values(game.sfc.coinDataMap)) {
                let newCoinData = newMap[oldCoinData.flags.sfc.type];
                newCoinData.enabled = oldCoinData.flags.sfc.enabled;
                newCoinData.img = oldCoinData.img;
                newCoinData.name = oldCoinData.name;
                newCoinData.shortName = oldCoinData.flags.sfc.shortName;
                newCoinData.value = oldCoinData.flags.sfc.value;
                newCoinData.weight = oldCoinData.system.weight;
            }
            await Utils.setSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap, newMap);
        }

        Coins.validateAndRepairCoinMap();
        Coins.buildItemDescriptionText();
    }

    static async onRenderSettingsConfig(app, el, data) {
        //Add the init actors button
        const initButton = $(await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.initAllActorsButton, {}));

        initButton.find('[data-key="init-actors-button"]').click(ev => {
            new InitAllActorsDialog().render(true);
        });

        const refreshButton = $(await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.refreshAllCoinItemsButton, {}));

        refreshButton.find('[data-key="refresh-coin-items-button"]').click(ev => {
            Dialog.confirm({
                title: game.i18n.localize("SFC.RefreshCoinItems.AllLabel"),
                content: game.i18n.localize("SFC.RefreshCoinItems.AllContent"),
                yes: () => Coins.refreshAllActorItems(),
            });
        });

        //Find the start of the SFC section and add the buttons there
        el.find('[data-tab="sfc"] h2').after(refreshButton);
        el.find('[data-tab="sfc"] h2').after(initButton);
    }

    static async onRenderActorSheet(app, html, data) {
        let actor = app.actor;

        if (actor.sheet.options.classes.includes("swade-official") == false) {
            //We only support showing the currency on swade-official sheets
            //Note: This includes the Fantasy Companion, Pathfinder, and Deadlands sheets and likely more
            return;
        }

        //When rendering a player character sheet, we replace the normal currency section with the SFC display
        if (actor.isOwner && Utils.isSupportedActorType(actor.type)) {

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
            const templateData = { currencyAmount, currencyName, coinTemplateData, showCurrency };
            const content = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.coinsDisplay, templateData);

            //Find the existing currency section and replace it with ours
            const currencySection = html[0].querySelector("div.form-group.currency");
            currencySection.parentNode.insertAdjacentHTML("afterend", content);
            currencySection.remove();

            //Respond to the init actor button
            const button = html.find('[id="manager-button"]');
            button.click(ev => {
                new CoinManager(actor, app).render(true);
            });
        }
    }

    static async onRenderGroupSheet(app, html, data) {
        let actor = app.actor;

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
        const currencyAmount = actor.system.currency ? actor.system.currency : 0;
        const templateData = { currencyAmount, currencyName, coinTemplateData, showCurrency };
        const content = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.coinsDisplay, templateData);

        //Find the existing currency section and replace it with ours
        const currencyInput = html.querySelector("input#currency");
        const currencyFormGroup = currencyInput.parentNode;
        const currencySection = currencyFormGroup.parentNode;
        currencyFormGroup.insertAdjacentHTML("afterend", content);
        currencyFormGroup.remove();

        //Respond to the manage button
        currencySection.querySelector('.manager-button').addEventListener("click", (ev => {
            new CoinManager(actor, app).render(true);
        }));
    }

    static async onUpdateActor(actor, updateData, options, userId) {
        if (game.user.id !== userId) {
            // return because we're not the user making the change
            return;
        }
        if (!Utils.hasModuleFlags(updateData)) {
            //We don't care about this update
            return;
        }

        this.refreshCurrency(actor);

        const useCoinItems = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.useCoinItems);
        if (useCoinItems) {
            let itemUpdateData = [];
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
                        itemUpdateData.push({ _id: coinItem.id, "system.quantity": count });
                    }
                }
            }
            
            if (itemUpdateData.length) await actor.updateEmbeddedDocuments("Item", itemUpdateData);
        }
    }

    static async onCreateItem(doc, options, userId) {
        if (game.user.id !== userId) {
            // return because we're not the user making the change
            return;
        }

        const useCoinItems = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.useCoinItems);
        if (!useCoinItems) {
            return;
        }

        let type = doc.getFlag("sfc", "type"); //We grab the type from this item just to confirm that this is a coin
        let quantity = doc.system?.quantity;
        let actor = doc.actor;
        if ((typeof quantity !== "undefined") && type && actor) {
            //We just added a new coin item so we need to update the coin counts to match
            this.refreshCurrency(actor);
            await actor.setFlag(SFC_CONFIG.NAME, doc.flags.sfc.countFlagName, quantity);
        }
    }

    static async onUpdateItem(doc, updateData, options, userId) {
        if (game.user.id !== userId) {
            // return because we're not the user making the change
            return;
        }
        
        const useCoinItems = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.useCoinItems);
        if (!useCoinItems) {
            return;
        }
        
        let type = doc.getFlag("sfc", "type"); //We grab the type from this item just to confirm that this is a coin
        let quantity = updateData.system?.quantity;
        let actor = doc.actor;
        if ((typeof quantity !== "undefined") && type && actor) {
            //We just updated an existing coin item so we need to update the coin counts to match
            this.refreshCurrency(actor);
            await actor.setFlag(SFC_CONFIG.NAME, doc.flags.sfc.countFlagName, quantity);
        }
    }

    static async onDeleteItem(doc, options, userId) {
        if (game.user.id !== userId) {
            // return because we're not the user making the change
            return;
        }
        
        const useCoinItems = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.useCoinItems);
        if (!useCoinItems) {
            return;
        }
        
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
            let quantity = Utils.getModuleFlag(actor, coinData.countFlagName);
            if (quantity) {
                totalCurrency += quantity * coinData.value;
            }
        }

        actor.update({ "system.details.currency": Number(totalCurrency.toFixed(2)) });
    }

    static async initAllActorInventories(keepCurrency, folder) {
        for (const actor of game.actors) {
            if (folder && actor.folder != folder) { continue; }
            if (Utils.isSupportedActorType(actor.type)) {
                await this.initActorInventory(actor, keepCurrency);
            }
        }
    }

    static async initActorInventory(actor, keepCurrency) {
        const currencyAmount = actor.system.details.currency ? actor.system.details.currency : 0;
        let remainingCurrencyInt = Math.floor(currencyAmount * 1000); //This converts us to an int so we don't have to deal with float issues
        const flagUpdateData = {}
        let createData = [];
        let updateData = [];
        let deleteData = [];
        let countData = [];

        //Sort the coins by highest to lowest value so that we convert currency to the fewest total coins
        let coinDataArray = foundry.utils.duplicate(Object.values(game.sfc.coinDataMap));
        coinDataArray.sort((a, b) => {
            return b.value - a.value;
        });

        for (const coinData of coinDataArray) {
            if (!coinData.enabled) {
                await actor.unsetFlag(SFC_CONFIG.NAME, coinData.countFlagName);
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
                let quantity = Utils.getModuleFlag(actor, coinData.countFlagName);
                numCoins = quantity ?? 0;
            }
            
            countData[coinData.countFlagName] = numCoins;
            foundry.utils.setProperty(flagUpdateData, `flags.${SFC_CONFIG.NAME}.${coinData.countFlagName}`, numCoins);
        }
        
        await actor.update(flagUpdateData);

        const useCoinItems = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.useCoinItems);
        if (useCoinItems) {
            for (const coinData of coinDataArray) {
                let coinItem = actor.items.find(item => item.flags?.sfc?.type == coinData.type);
                if (!coinData.enabled) {
                    if (coinItem) {
                        deleteData.push(coinItem.id);
                    }
                    continue;
                }

                if (coinItem) {
                    updateData.push({
                        _id: coinItem.id,
                        "name": coinData.name,
                        "img": coinData.img,
                        "system.quantity": countData[coinData.countFlagName],
                        "system.weight": coinData.weight,
                        "system.description": game.sfc.itemDescription
                    });
                } else {
                    const itemData = this.buildItemDataFromCoinData(coinData);
                    createData.push(itemData);
                }
            }
            
            if (createData.length) await actor.createEmbeddedDocuments("Item", createData);
            if (updateData.length) await actor.updateEmbeddedDocuments("Item", updateData);
            if (deleteData.length) await actor.deleteEmbeddedDocuments("Item", deleteData);
        }

        await Coins.refreshCurrency(actor);
        if (actor.sheet.rendered) {
            actor.sheet.render();
        }
    }

    static async refreshAllActorItems() {
        for (const actor of game.actors) {
            if (Utils.isSupportedActorType(actor.type)) {
                await this.refreshActorItems(actor);
            }
        }
    }

    static async refreshActorItems(actor) {
        let updateData = [];
        for (const coinData of Object.values(game.sfc.coinDataMap)) {
            let coinItem = actor.items.find(item => item.flags?.sfc?.type == coinData.type);
            if (!coinItem) {
                continue;
            }

            if (coinItem) {
                updateData.push({
                    _id: coinItem.id,
                    "name": coinData.name,
                    "img": coinData.img,
                    "system.weight": coinData.weight,
                    "system.description": game.sfc.itemDescription
                });
            }
        }

        if (updateData.length) await actor.updateEmbeddedDocuments("Item", updateData);

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

    static async addCoinAmount(actor, coinData, coinAmount) {
        let quantity = Utils.getModuleFlag(actor, coinData.countFlagName);
        await actor.setFlag(SFC_CONFIG.NAME, coinData.countFlagName, quantity + Number(coinAmount));
    }

    static async createDefaultCoinDataMap() {
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

        await Utils.setSetting(SFC_CONFIG.SETTING_KEYS.defaultCoinDataMap, defaultMap);
        return defaultMap;
    }

    static decimalToFraction(decimal) {
        var gcd = function (a, b) {
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
        let coinDataArray = Object.values(foundry.utils.duplicate(game.sfc.coinDataMap));
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

        const templateData = { coinDescriptionDatas };
        const content = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.itemDescription, templateData);
        game.sfc.itemDescription = content;
    }

    static validateAndRepairCoinMap() {
        const defaultMap = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.defaultCoinDataMap);
        for (let coinData of Object.values(game.sfc.coinDataMap)) {
            coinData.enabled = (typeof coinData.enabled === "undefined") ? defaultMap[coinData.type].enabled : coinData.enabled;
            coinData.img = (typeof coinData.img === "undefined") ? defaultMap[coinData.type].img : coinData.img;
            coinData.name = (typeof coinData.name === "undefined") ? defaultMap[coinData.type].name : coinData.name;
            coinData.shortName = (typeof coinData.shortName === "undefined") ? defaultMap[coinData.type].shortName : coinData.shortName;
            coinData.value = (typeof coinData.value === "undefined") ? defaultMap[coinData.type].value : coinData.value;
            coinData.weight = (typeof coinData.weight === "undefined") ? defaultMap[coinData.type].weight : coinData.weight;
            coinData.countFlagName = (typeof coinData.countFlagName === "undefined") ? defaultMap[coinData.type].countFlagName : coinData.countFlagName;
        }
    }

    static itemPilesConfig() {
        const newItemPileCurrencies = [];
        for (const coinData of Object.values(game.sfc.coinDataMap)) {
            if (coinData.enabled) {
                const itemPileCurrency = {
                    primary: coinData.value === 1,
                    secondary: false,
                    name: coinData.name,
                    img: coinData.img,
                    abbreviation: `{#} ${coinData.shortName}`,
                    exchangeRate: coinData.value,
                    type: 'item',
                    data: {
                        item: this.buildItemDataFromCoinData(coinData),
                        uuid: null,
                    }
                };
                newItemPileCurrencies.push(itemPileCurrency);
            }
        }
        game.itempiles.API.setCurrencies(newItemPileCurrencies);
    }
}
