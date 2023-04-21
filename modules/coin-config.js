import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";
import { Coins } from "./coins.js";

export class CoinConfig extends FormApplication {
    constructor() {
        super();
        this.initialDataMap = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap);
        this.workingCoinDataMap = duplicate(this.initialDataMap);
    }
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'coin-config',
            title: game.i18n.localize('SFC.CoinConfig.Name'),
            template: SFC_CONFIG.DEFAULT_CONFIG.templates.coinConfig,
            width: 600,
            height: 700,
            resizable: false
        });
    }

    getData() {
        const coinDataMap = this.workingCoinDataMap;
        const data = {
            coinDataMap
        };
        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('#reset').click(() => this.restoreDefaults());
        html.find('#save').click(() => {
            if (this.form.checkValidity()) {
                this.submit();
            } else {
                this.form.reportValidity();
            }
        });
    }

    async _updateObject(event, formData) {
        await Utils.setSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap, this.workingCoinDataMap);
        Coins.buildItemDescriptionText();
    }

    async restoreDefaults() {
        const dialog = new Dialog({
            title: game.i18n.localize("SFC.CoinConfig.RestoreDefaultsTitle"),
            content: game.i18n.localize("SFC.CoinConfig.RestoreDefaultsContents"),
            buttons: {
                yes: {
                    icon: `<i class="fa fa-check"></i>`,
                    label: game.i18n.localize("SFC.Yes"),
                    callback: async event => {
                        const defaultMap = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.defaultCoinDataMap);
                        this.initialDataMap = defaultMap;
                        this.workingCoinDataMap = duplicate(this.initialDataMap);
                        this.render();
                    }
                },
                no :{
                    icon: `<i class="fa fa-times"></i>`,
                    label: game.i18n.localize("SFC.No"),
                    callback: event => {}
                }
            },
            default: "no"
        });
        dialog.render(true);
        this.render(true);
    }

    async _onChangeInput(event) {
        const name = event.target.name;
        const row = event.target.name.split("-").pop();
        if (!row) {
            return;
        }
        
        let coinData = this.workingCoinDataMap[row];

        if (name.startsWith("icon-path")) {
            coinData.img = event.target.value;
        } else if (name.startsWith("coin-name")) {
            coinData.name = event.target.value;
        } else if (name.startsWith("coin-shortname")) {
            coinData.shortName = event.target.value;
        } else if (name.startsWith("coin-value")) {
            coinData.value = event.target.value;
        } else if (name.startsWith("coin-weight")) {
            coinData.weight = event.target.value;
        } else if (name.startsWith("coin-enabled")) {
            coinData.enabled = event.target.checked;
        }

        event.target.blur();
        event.target.reportValidity();
    }
}