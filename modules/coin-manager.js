import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";
import { Coins } from "./coins.js";

export class CoinManager extends FormApplication {
    constructor(object, parentApp, options) {
        options = options ? options : {};
        options.title = object.name;
        options.id = 'coin-manager' + object.id;

        options.classes = ['sheet', 'actor'];
        if (parentApp?.options.classes.includes("swpf-sheet")) {
            options.classes.push("swpf-sheet");
        } else {
            options.classes.push("swade-official");
        }

        super(object, options);

        this.behaviour = "coins";
        this.coinDataArray = [];

        for (const coinData of Object.values(game.sfc.coinDataMap)) {
            if (coinData.enabled) {
                this.coinDataArray.push({
                    type: coinData.type,
                    name: coinData.name,
                    img: coinData.img,
                    countFlagName: coinData.countFlagName,
                    quantity: 0,
                    valueInt: coinData.value * 1000
                });
            }
        };

        //Sort the coins from highest value to lowest
        this.coinDataArray.sort((a, b) => {
            return b.valueInt - a.valueInt;
        });
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: SFC_CONFIG.DEFAULT_CONFIG.templates.coinManager,
            tabs: [
                {
                    navSelector: '.tabs',
                    contentSelector: '.sheet-body',
                    initial: 'add-remove',
                },
            ],
            width: 600,
            height: 400,
            resizable: false,
            closeOnSubmit: false
        });
    }

    getData() {
        const data = super.getData();

        data.behaviour = this.behaviour;
        data.coinData = this.coinDataArray;
        data.actor = this.object;

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find("select[id='behaviour']").on("change", event => this.onChangeBehaviour(event));
        html.find("button[id='add']").click(() => {
            if (this.form.checkValidity()) {
                Dialog.confirm({
                    title: game.i18n.localize("SFC.CoinManager.Dialog.AddConfirmTitle"),
                    content: game.i18n.localize("SFC.CoinManager.Dialog.AddConfirmContent"),
                    yes: () => this.addCoins(),
                    no: () => { },
                    defaultYes: false
                });
            } else {
                this.form.reportValidity();
            }
        });
        html.find("button[id='remove']").click(() => {
            if (this.form.checkValidity()) {
                Dialog.confirm({
                    title: game.i18n.localize("SFC.CoinManager.Dialog.RemoveConfirmTitle"),
                    content: game.i18n.localize("SFC.CoinManager.Dialog.RemoveConfirmContent"),
                    yes: () => this.removeCoins(),
                    no: () => { },
                    defaultYes: false
                });
            } else {
                this.form.reportValidity();
            }
        });
        html.find("button[id='exchange-all-button']").click(() => {
            Dialog.confirm({
                title: game.i18n.localize("SFC.CoinManager.Dialog.ExchangeAllConfirmTitle"),
                content: game.i18n.localize("SFC.CoinManager.Dialog.ExchangeAllConfirmContent"),
                yes: () => this.exchangeAll(),
                no: () => { },
                defaultYes: false
            });
        });
        html.find("button[id='exchange-button']").click(() => {
            if (this.form.checkValidity()) {
                Dialog.confirm({
                    title: game.i18n.localize("SFC.CoinManager.Dialog.ExchangeConfirmTitle"),
                    content: game.i18n.localize("SFC.CoinManager.Dialog.ExchangeConfirmContent"),
                    yes: () => this.exchange(),
                    no: () => { },
                    defaultYes: false
                });
            } else {
                this.form.reportValidity();
            }
        });
        html.find("button[id='init-actor-button']").click(() => this.initActor());
        html.find("button[id='refresh-coin-items-button']").click(ev => {
            Dialog.confirm({
                title: game.i18n.localize("SFC.RefreshCoinItems.AllLabel"),
                content: game.i18n.localize("SFC.RefreshCoinItems.AllContent"),
                yes: () => Coins.refreshAllActorItems(),
            });
        });
    }

    async _updateObject(event, formData) {
    }

    async removeCurrencyFromInventory(currency, actor) {
        let sortedCoinDataArray = foundry.utils.duplicate(this.coinDataArray); //coinDataArray is sorted high to low in the constructor
        sortedCoinDataArray.sort((a, b) => {
            return a.valueInt - b.valueInt;
        });

        for (const coinData of sortedCoinDataArray) {
            let quantity = Utils.getModuleFlag(actor, coinData.countFlagName);
            coinData.quantity = quantity ?? 0;
        }

        //To remove the currency, we'll focus on removing the lowest value coins
        //When we run out of those, we'll start converting higher value coins into smaller value coins
        let remainingLowestCoin = Math.ceil(currency / sortedCoinDataArray[0].valueInt);
        while (true) {
            if (remainingLowestCoin <= sortedCoinDataArray[0].quantity) {
                sortedCoinDataArray[0].quantity -= remainingLowestCoin;
                remainingLowestCoin = 0;
                break;
            }

            remainingLowestCoin -= sortedCoinDataArray[0].quantity;
            sortedCoinDataArray[0].quantity = 0;

            //In this loop, we move up higher values until we find at least one coin and then we convert that coin back downwards
            //This will give us more of the lowest value coin to work with in the next pass
            for (let i = 1; i < sortedCoinDataArray.length; ++i) {
                if (sortedCoinDataArray[i].quantity > 0) {
                    for (let j = i; j > 0; --j) {
                        --sortedCoinDataArray[j].quantity;
                        sortedCoinDataArray[j - 1].quantity += Math.floor(sortedCoinDataArray[j].valueInt / sortedCoinDataArray[j - 1].valueInt);
                    }
                    break;
                }
            }

            if (sortedCoinDataArray[0].quantity == 0) {
                //We have no more coins to convert. We can't afford this
                Utils.showNotification("error", game.i18n.localize("SFC.Errors.CannotAfford"));
                return;
            }
        }

        const updateData = {};
        for (const coinData of sortedCoinDataArray) {
            foundry.utils.setProperty(updateData, `flags.${SFC_CONFIG.NAME}.${coinData.countFlagName}`, coinData.quantity);
        }

        await actor.update(updateData);
    }

    convertCurrencyToCoins(currency) {
        let sortedCoinDataArray = foundry.utils.duplicate(this.coinDataArray); //coinDataArray is sorted high to low in the constructor

        let covertedCoins = {};
        let remainingCurrencyInt = Math.floor(currency * 1000);
        for (const coinData of sortedCoinDataArray) {
            //We want to add as many coins as will divide evenly into our remaining currency
            let numCoins = Math.floor(remainingCurrencyInt / coinData.valueInt);

            if (numCoins == 0) {
                continue;
            }

            covertedCoins[coinData.type] = {
                quantity: numCoins,
                countFlagName: coinData.countFlagName
            };

            //Subtract the value of the coins we just added from the remaining currency
            remainingCurrencyInt -= numCoins * coinData.valueInt;

            if (remainingCurrencyInt <= 0) {
                break;
            }
        }

        return covertedCoins;
    }

    async addCoins() {
        const actor = this.object;
        const formData = this._getSubmitData();

        const updateData = {};
        if (this.behaviour == "currency") {
            if (formData.currency > 0) {
                const coinsToAdd = this.convertCurrencyToCoins(formData.currency);
                for (const coinData of Object.values(coinsToAdd)) {
                    let quantity = Utils.getModuleFlag(actor, coinData.countFlagName);
                    foundry.utils.setProperty(updateData, `flags.${SFC_CONFIG.NAME}.${coinData.countFlagName}`, quantity + coinData.quantity);
                }
            }
        } else {
            for (const coinData of this.coinDataArray) {
                const inputName = "coin-" + coinData.type;
                const coinAmount = formData[inputName];
                if (coinAmount > 0) {
                    let quantity = Utils.getModuleFlag(actor, coinData.countFlagName);
                    foundry.utils.setProperty(updateData, `flags.${SFC_CONFIG.NAME}.${coinData.countFlagName}`, quantity + coinAmount);
                }
            }
        }

        await actor.update(updateData);
    }

    async removeCoins() {
        const actor = this.object;
        const formData = this._getSubmitData();
        if (this.behaviour == "currency") {
            if (formData.currency > 0) {
                if (formData.currency > actor.system.details.currency) {
                    Utils.showNotification("error", game.i18n.localize("SFC.Errors.CannotAfford"));
                    return;
                }

                this.removeCurrencyFromInventory(formData.currency * 1000, actor);
            }
        } else {
            let totalCurrency = 0;
            for (const coinData of this.coinDataArray) {
                const inputName = "coin-" + coinData.type;
                const coinAmount = formData[inputName];
                if (coinAmount > 0) {
                    totalCurrency += coinAmount * coinData.valueInt;
                }
            }

            if (totalCurrency <= 0) {
                return;
            }

            if (totalCurrency > (actor.system.details.currency * 1000)) {
                Utils.showNotification("error", game.i18n.localize("SFC.Errors.CannotAfford"));
                return;
            }

            this.removeCurrencyFromInventory(totalCurrency, actor);
        }
    }

    async onChangeBehaviour(event) {
        this.behaviour = event.target.value;
        return this.render();
    }

    async _onChangeInput(event) {
        event.target.blur();
        event.target.reportValidity();
    }

    async exchange() {
        let actor = this.object;
        const formData = this._getSubmitData();
        let exchangeAmount = formData["exchange-amount"];
        if (exchangeAmount <= 0) {
            return;
        }

        const fromSelect = formData["exchange-from"];
        const destSelect = formData["exchange-to"];
        if (fromSelect == destSelect) {
            //Exchanging the same type. Nothing to do
            return;
        }

        const fromType = fromSelect.split("-").pop();
        const destType = destSelect.split("-").pop();

        const fromCoinData = game.sfc.coinDataMap[fromType];
        const destCoinData = game.sfc.coinDataMap[destType];

        let fromQuantity = Utils.getModuleFlag(actor, fromCoinData.countFlagName);
        let destQuantity = Utils.getModuleFlag(actor, destCoinData.countFlagName);
        if (!fromQuantity) {
            //We don't have any from so there's nothing to exchange
            return;
        }

        exchangeAmount = exchangeAmount < fromQuantity ? exchangeAmount : fromQuantity;

        const fromValueInt = Math.floor(fromCoinData.value * 1000);
        const destValueInt = Math.floor(destCoinData.value * 1000);

        let fromTotalAmountCurrency = fromValueInt * exchangeAmount;

        const amountDestAdded = Math.floor(fromTotalAmountCurrency / destValueInt);
        if (amountDestAdded <= 0) {
            //Nothing exchanged
            return;
        }

        const newDestCoins = destQuantity + amountDestAdded;

        fromTotalAmountCurrency -= amountDestAdded * destValueInt;
        const amountFromRemaining = fromTotalAmountCurrency <= 0 ? 0 : (fromTotalAmountCurrency / fromValueInt);
        const amountFromRemoved = exchangeAmount - amountFromRemaining;
        const newFromCoins = fromQuantity - amountFromRemoved;
        
        const updateData = {};
        foundry.utils.setProperty(updateData, `flags.${SFC_CONFIG.NAME}.${fromCoinData.countFlagName}`, newFromCoins);
        foundry.utils.setProperty(updateData, `flags.${SFC_CONFIG.NAME}.${destCoinData.countFlagName}`, newDestCoins);

        await actor.update(updateData);
    }

    async exchangeAll() {
        let actor = this.object;
        const convertedCoins = this.convertCurrencyToCoins(actor.system.details.currency);
        
        const updateData = {};
        for (const coinData of this.coinDataArray) {
            const quantity = convertedCoins[coinData.type] ? convertedCoins[coinData.type].quantity : 0;
            foundry.utils.setProperty(updateData, `flags.${SFC_CONFIG.NAME}.${coinData.countFlagName}`, quantity);
        }

        await actor.update(updateData);
    }

    async initActor() {
        const actor = this.object;
        const dialogContent = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.initSingleActorDialog, {});
        const dialog = new Dialog({
            title: game.i18n.localize("SFC.InitActors.SingleLabel"),
            content: dialogContent,
            buttons: {
                currency: {
                    icon: `<i class="fas fa-dollar-sign"></i>`,
                    label: game.i18n.localize("SFC.InitActors.Dialog.InitKeepCurrency"),
                    callback: async (html) => {
                        let keepCurrency = true;
                        await Coins.initActorInventory(actor, keepCurrency);
                    }
                },
                coins: {
                    icon: `<i class="fas fa-coins"></i>`,
                    label: game.i18n.localize("SFC.InitActors.Dialog.InitKeepCoins"),
                    callback: async (html) => {
                        let keepCurrency = false;
                        await Coins.initActorInventory(actor, keepCurrency);
                    }
                },
                cancel: {
                    icon: `<i class="fas fa-times"></i>`,
                    label: game.i18n.localize("SFC.InitActors.Dialog.Cancel"),
                    callback: event => { }
                }
            }
        }, { classes: ["dialog", "init-dialog"] });
        dialog.render(true);
    }
}