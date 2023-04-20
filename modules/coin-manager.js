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
        this.coinArray = [];

        for (const coin of Object.values(game.sfc.coinMap)) {
            if (coin.flags.sfc.enabled) {
                coin.count = 0;
                this.coinArray.push({
                    type: coin.flags.sfc.type,
                    name: coin.name,
                    img: coin.img,
                    count: coin.count,
                    valueInt: coin.flags.sfc.value * 1000
                });
            }
        };

        //Sort the coins from highest value to lowest
        this.coinArray.sort((a, b) => {
            return b.valueInt - a.valueInt;
        });
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
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
        data.coinData = this.coinArray;
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
    }

    async _updateObject(event, formData) {
    }

    async removeCurrencyFromInventory(currency, actor) {
        let sortedCoinArray = duplicate(this.coinArray);//coinArray is sorted high to low in the constructor
        sortedCoinArray.sort((a, b) => {
            return a.valueInt - b.valueInt;
        });

        for (const coin of sortedCoinArray) {
            let coinItem = actor.items.find(item => Utils.getFlag(item, "type") == coin.type);
            coin.count = coinItem ? coinItem.system.quantity : 0;
            coin.item = coinItem;
        }

        //To remove the currency, we'll focus on removing the lowest value coins
        //When we run out of those, we'll start converting higher value coins into smaller value coins
        let remainingLowestCoin = Math.ceil(currency / sortedCoinArray[0].valueInt);
        while (true) {
            if (remainingLowestCoin <= sortedCoinArray[0].count) {
                sortedCoinArray[0].count -= remainingLowestCoin;
                remainingLowestCoin = 0;
                break;
            }

            remainingLowestCoin -= sortedCoinArray[0].count;
            sortedCoinArray[0].count = 0;

            //In this loop, we move up higher values until we find at least one coin and then we convert that coin back downwards
            //This will give us more of the lowest value coin to work with in the next pass
            for (let i = 1; i < sortedCoinArray.length; ++i) {
                if (sortedCoinArray[i].count > 0) {
                    for (let j = i; j > 0; --j) {
                        --sortedCoinArray[j].count;
                        sortedCoinArray[j - 1].count += Math.floor(sortedCoinArray[j].valueInt / sortedCoinArray[j - 1].valueInt);
                    }
                    break;
                }
            }

            if (sortedCoinArray[0].count == 0) {
                //We have no more coins to convert. We can't afford this
                Utils.showNotification("error", game.i18n.localize("SFC.Errors.CannotAfford"));
                return;
            }
        }

        for (const coin of sortedCoinArray) {
            if (!coin.item) {
                if (coin.count <= 0) {
                    continue;
                }

                coin.item = await Coins.addCoinItem(actor, game.sfc.coinMap[coin.type]);
            }

            await coin.item.update({ "system.quantity": coin.count });
        }
    }

    convertCurrencyToCoins(currency) {
        let sortedCoinArray = duplicate(this.coinArray);//coinArray is sorted high to low in the constructor

        let coins = {};
        let remainingCurrencyInt = Math.floor(currency * 1000);
        for (const coin of sortedCoinArray) {
            //We want to add as many coins as will divide evenly into our remaining currency
            let numCoins = Math.floor(remainingCurrencyInt / coin.valueInt);

            if (numCoins == 0) {
                continue;
            }

            coins[coin.type] = {
                count: numCoins,
                type: coin.type
            };

            //Subtract the value of the coins we just added from the remaining currency
            remainingCurrencyInt -= numCoins * coin.valueInt;

            if (remainingCurrencyInt <= 0) {
                break;
            }
        }

        return coins;
    }

    async addCoins() {
        const actor = this.object;
        const formData = this._getSubmitData();
        if (this.behaviour == "currency") {
            if (formData.currency > 0) {
                const coinsToAdd = this.convertCurrencyToCoins(formData.currency);
                for (const coin of Object.values(coinsToAdd)) {
                    let coinItem = actor.items.find(item => Utils.getFlag(item, "type") == coin.type);
                    if (!coinItem) {
                        coinItem = await Coins.addCoinItem(actor, game.sfc.coinMap[coin.type]);
                    }

                    await coinItem.update({ "system.quantity": coinItem.system.quantity + coin.count });
                }
            }
        } else {
            for (const coin of this.coinArray) {
                const inputName = "coin-" + coin.type;
                const coinAmount = formData[inputName];
                if (coinAmount > 0) {
                    let coinItem = actor.items.find(item => Utils.getFlag(item, "type") == coin.type);
                    if (!coinItem) {
                        coinItem = await Coins.addCoinItem(actor, game.sfc.coinMap[coin.type]);
                    }

                    await coinItem.update({ "system.quantity": coinItem.system.quantity + coinAmount });
                }
            }
        }
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
            for (const coin of this.coinArray) {
                const inputName = "coin-" + coin.type;
                const coinAmount = formData[inputName];
                if (coinAmount > 0) {
                    totalCurrency += coinAmount * (game.sfc.coinMap[coin.type].flags.sfc.value * 1000);
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
        let blah = this._getSubmitData();
        blah = null;
    }

    async exchange() {
        let actor = this.object;
        const formData = this._getSubmitData();
        let exchangeAmount = formData["exchange-amount"];
        if (exchangeAmount <= 0) {
            return;
        }

        const fromSelect = formData["exchange-from"];
        const toSelect = formData["exchange-to"];
        if (fromSelect == toSelect) {
            //Exchanging the same type. Nothing to do
            return;
        }

        const fromType = fromSelect.split("-").pop();
        const toType = toSelect.split("-").pop();

        let fromCoinItem = actor.items.find(item => Utils.getFlag(item, "type") == fromType);
        let toCoinItem = actor.items.find(item => Utils.getFlag(item, "type") == toType);
        if (!fromCoinItem) {
            //We don't have the from item so there's nothing to exchange
            return;
        }

        exchangeAmount = exchangeAmount < fromCoinItem.system.quantity ? exchangeAmount : fromCoinItem.system.quantity;

        const fromValueInt = Math.floor(game.sfc.coinMap[fromType].flags.sfc.value * 1000);
        const toValueInt = Math.floor(game.sfc.coinMap[toType].flags.sfc.value * 1000);

        let fromTotalAmountCurrency = fromValueInt * exchangeAmount;

        let newCoinValues = {};
        const amountToAdded = Math.floor(fromTotalAmountCurrency / toValueInt);
        if (amountToAdded <= 0) {
            //Nothing exchanged
            return;
        }

        const toCoinsQuantity = toCoinItem ? toCoinItem.system.quantity : 0;
        const newToCoins = toCoinsQuantity + amountToAdded;
        newCoinValues[toType] = {
            type: toType,
            count: newToCoins
        };

        fromTotalAmountCurrency -= amountToAdded * toValueInt;
        const amountFromRemaining = fromTotalAmountCurrency <= 0 ? 0 : (fromTotalAmountCurrency / fromValueInt);
        const amountFromRemoved = exchangeAmount - amountFromRemaining;
        const newFromCoins = fromCoinItem.system.quantity - amountFromRemoved;
        newCoinValues[fromType] = {
            type: fromType,
            count: newFromCoins
        };

        if (!toCoinItem) {
            toCoinItem = await Coins.addCoinItem(actor, game.sfc.coinMap[toType]);
        }

        await fromCoinItem.update({ "system.quantity": newCoinValues[fromType].count });
        await toCoinItem.update({ "system.quantity": newCoinValues[toType].count });
    }

    async exchangeAll() {
        let actor = this.object;
        const convertedCoins = this.convertCurrencyToCoins(actor.system.details.currency);
        for (const coin of this.coinArray) {
            const count = convertedCoins[coin.type] ? convertedCoins[coin.type].count : 0;
            let coinItem = actor.items.find(item => Utils.getFlag(item, "type") == coin.type);
            if (!coinItem) {
                if (count <= 0) {
                    continue;
                }

                coinItem = await Coins.addCoinItem(actor, game.sfc.coinMap[coin.type]);
            }

            await coinItem.update({ "system.quantity": count });
        }
    }

    async initActor() {
        const actor = this.object;
        const dialogContent = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.initSingleActorDialog, {});
        const dialog = new Dialog({
            title: game.i18n.localize("SFC.InitActors.SingleLabel"),
            content: dialogContent,
            buttons: {
                yes: {
                    icon: `<i class="fa fa-check"></i>`,
                    label: game.i18n.localize("SFC.Yes"),
                    callback: async (html) => {
                        const behaviour = html.find(`#behaviour`)[0].value;
                        const keepCurrency = behaviour == "keep-coins" ? false : true;
                        await Coins.initActorInventory(actor, keepCurrency);
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
    }
}