import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";
import { Coins } from "./coins.js";

export class PurchaseDialog extends FormApplication {
    constructor(data, options = {}) {
        super(data, options);
        this.behaviour = "currency";
        this.cost = 0;
        this.coinArray = [];

        for (const coin of Object.values(game.sfc.coinMap)) {
            if (coin.flags.sfc.enabled) {
                coin.count = 0;
                this.coinArray.push({
                    type: coin.flags.sfc.type,
                    name: coin.name,
                    img: coin.img,
                    count: coin.count,
                    value: coin.flags.sfc.value
                });
            }
        };

        //Sort the coins from highest value to lowest
        this.coinArray.sort((a, b) => {
            return b.value - a.value;
        });
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            template: SFC_CONFIG.DEFAULT_CONFIG.templates.purchaseDialog,
            id: 'purchase-dialog',
            title: game.i18n.localize('SFC.CoinConfig.Name'),
            classes: ['setting-config', 'sheet'],
            tabs: [
                {
                    navSelector: '.tabs',
                    contentSelector: '.sheet-body',
                    initial: 'basics',
                },
            ],
            scrollY: ['.sheet-body .tab'],
            width: 600,
            height: 700,
            resizable: false,
            closeOnSubmit: false
        });
    }

    getData() {
        const data = super.getData();

        let actor = game.actors.find(a => a.name == "player");

        //Create an array of processed data for handlebars to use
        let coinData = this.coinArray;

        data.behaviour = this.behaviour;
        data.cost = this.cost;
        data.coinData = coinData;

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find("select[id='behaviour']").on("change", event => this.onChangeBehaviour(event));
        html.find("input").on("change", event => this.onChangeInputs(event));
    }

    async onChangeBehaviour(event) {
        const name = event.target.name;
        this.behaviour = event.target.value;

        return this.render();
    }

    async onChangeInputs(event) {
        const name = event.target.name;
        const row = event.target.name.split("-").pop();
        if (!row) {
            return;
        }

        event.preventDefault();

        // let coin = this.workingCoinMap[row];

        // if (name.startsWith("icon-path")) {
        //     coin.img = event.target.value;
        // } else if (name.startsWith("coin-name")) {
        //     coin.name = event.target.value;
        // } else if (name.startsWith("coin-shortname")) {
        //     coin.flags.sfc.shortName = event.target.value;
        // } else if (name.startsWith("coin-value")) {
        //     if (event.target.value < 0) {
        //         Utils.showNotification("error", game.i18n.localize("SFC.Errors.NegativeValues"));
        //         return this.render();
        //     }
        //     coin.flags.sfc.value = event.target.value;
        // } else if (name.startsWith("coin-weight")) {
        //     coin.system.weight = event.target.value;
        // } else if (name.startsWith("coin-enabled")) {
        //     coin.flags.sfc.enabled = event.target.checked;
        // }

        return this.render();
    }
}