import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";
import { Coins } from "./coins.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class CoinManager extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        classes: ["sheet", "sfc"],
        window: {
            title: "SFC.CoinManager.Name",
            minimizable: false,
            resizable: false,
        },
        position: { width: 600, height: 450 },
        actions: {
            add: function () {
                if (this.form.checkValidity()) {
                    foundry.applications.api.DialogV2.confirm({
                        window: { title: "SFC.CoinManager.Dialog.AddConfirmTitle" },
                        content: game.i18n.localize("SFC.CoinManager.Dialog.AddConfirmContent"),
                        yes: { callback: () => this.addCoins() },
                    });
                } else {
                    this.form.reportValidity();
                }
            },
            remove: function () {
                if (this.form.checkValidity()) {
                    foundry.applications.api.DialogV2.confirm({
                        window: { title: "SFC.CoinManager.Dialog.RemoveConfirmTitle" },
                        content: game.i18n.localize("SFC.CoinManager.Dialog.RemoveConfirmContent"),
                        yes: { callback: () => this.removeCoins() },
                    });
                } else {
                    this.form.reportValidity();
                }
            },
            exchange: function () {
                if (this.form.checkValidity()) {
                    foundry.applications.api.DialogV2.confirm({
                        window: { title: "SFC.CoinManager.Dialog.ExchangeConfirmTitle" },
                        content: game.i18n.localize("SFC.CoinManager.Dialog.ExchangeConfirmContent"),
                        yes: { callback: () => this.exchange() },
                    });
                } else {
                    this.form.reportValidity();
                }
            },
            exchangeAll: function () {
                foundry.applications.api.DialogV2.confirm({
                    window: { title: "SFC.CoinManager.Dialog.ExchangeAllConfirmTitle" },
                    content: game.i18n.localize("SFC.CoinManager.Dialog.ExchangeAllConfirmContent"),
                    yes: { callback: () => this.exchangeAll() },
                });
            },
            initActor: function () { this.initActor(); },
            refreshItems: function () {
                foundry.applications.api.DialogV2.confirm({
                    window: { title: "SFC.RefreshCoinItems.AllLabel" },
                    content: game.i18n.localize("SFC.RefreshCoinItems.AllContent"),
                    yes: { callback: () => Coins.refreshAllActorItems() },
                });
            },
        },
    };

    static coinManagerTemplates = SFC_CONFIG.DEFAULT_CONFIG.templates.coinManager;
    static PARTS = {
        tabs: { template: 'templates/generic/tab-navigation.hbs' },
        addRemove: { template: this.coinManagerTemplates.addRemove },
        exchange: { template: this.coinManagerTemplates.exchange },
        system: { template: this.coinManagerTemplates.system },
    };

    static TABS = {
        addRemove: {
            id: 'add-remove',
            group: 'primary',
            label: 'SFC.CoinManager.AddRemoveTab',
        },
        exchange: {
            id: 'exchange',
            group: 'primary',
            label: 'SFC.CoinManager.ExchangeTab',
        },
        system: {
            id: 'system',
            group: 'primary',
            label: 'SFC.CoinManager.SystemTab',
        },
    };

    constructor(actor, parentApp, options) {
        options ??= {};
        options.id = 'coin-manager' + actor.id;

        //TODO: Possibly bring this back once swade has updated their sheets to V2
        // options.classes = ['sheet', 'actor'];
        // if (parentApp?.options.classes.includes("swpf-sheet")) {
        //     options.classes.push("swpf-sheet");
        // } else {
        //     options.classes.push("swade-official");
        // }

        super(options);

        this.actor = actor;
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

    _getTabs() {
        return Object.values(this.constructor.TABS).reduce(
            (acc, v) => {
                const isActive = this.tabGroups[v.group] === v.id;
                acc[v.id] = {
                    ...v,
                    active: isActive,
                    cssClass: isActive ? 'active' : '',
                    tabCssClass: isActive ? 'tab active' : 'tab',
                };
                return acc;
            },
            {},
        );
    }

    async _prepareContext(options) {
        await super._prepareContext(options);

        return {
            behaviour: this.behaviour,
            coinData: this.coinDataArray,
            actor: this.actor,
            tabs: this._getTabs(),
        };
    }

    _onRender(context, options) {
        this.element.querySelector("select[id='behaviour']").addEventListener("change", event => this.onChangeBehaviour(event));
    }

    getFormData() {
        const fd = new foundry.applications.ux.FormDataExtended(this.form, { editors: this.editors });
        return fd.object;
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
        const actor = this.actor;
        const formData = this.getFormData();

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
        const actor = this.actor;
        const formData = this.getFormData();
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

    _onChangeForm(formConfig, event) {
        event.target.blur();
        event.target.reportValidity();
    }

    async exchange() {
        let actor = this.actor;
        const formData = this.getFormData();
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
        let actor = this.actor;
        const convertedCoins = this.convertCurrencyToCoins(actor.system.details.currency);

        const updateData = {};
        for (const coinData of this.coinDataArray) {
            const quantity = convertedCoins[coinData.type] ? convertedCoins[coinData.type].quantity : 0;
            foundry.utils.setProperty(updateData, `flags.${SFC_CONFIG.NAME}.${coinData.countFlagName}`, quantity);
        }

        await actor.update(updateData);
    }

    async initActor() {
        const actor = this.actor;
        const dialogContent = await foundry.applications.handlebars.renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.initSingleActorDialog, {});
        new foundry.applications.api.DialogV2({
            window: { title: "SFC.InitActors.SingleLabel" },
            content: dialogContent,
            classes: ["init-dialog-form", "init-dialog"],
            position: { width: 400 },
            buttons: [
                {
                    icon: "fas fa-dollar-sign",
                    label: game.i18n.localize("SFC.InitActors.Dialog.InitKeepCurrency"),
                    action: "currency",
                    callback: async (html) => {
                        let keepCurrency = true;
                        await Coins.initActorInventory(actor, keepCurrency);
                    }
                },
                {
                    icon: "fas fa-coins",
                    label: game.i18n.localize("SFC.InitActors.Dialog.InitKeepCoins"),
                    action: "coins",
                    callback: async (html) => {
                        let keepCurrency = false;
                        await Coins.initActorInventory(actor, keepCurrency);
                    }
                },
                {
                    icon: "fas fa-times",
                    label: game.i18n.localize("SFC.InitActors.Dialog.Cancel"),
                    action: "cancel",
                }
            ]
        }).render(true);
    }
}