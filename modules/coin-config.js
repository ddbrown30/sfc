import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";
import { Coins } from "./coins.js";

export class CoinConfig extends FormApplication {
    constructor() {
        super();
        this.initialMap = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.coinMap);
        this.workingCoinMap = duplicate(this.initialMap);
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
        const coinMap = this.workingCoinMap;
        const data = {
            coinMap
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
        await Utils.setSetting(SFC_CONFIG.SETTING_KEYS.coinMap, this.workingCoinMap);
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
                        const defaultMap = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.defaultCoinMap);
                        this.initialMap = defaultMap;
                        this.workingCoinMap = duplicate(this.initialMap);
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
        
        let coin = this.workingCoinMap[row];

        if (name.startsWith("icon-path")) {
            coin.img = event.target.value;
        } else if (name.startsWith("coin-name")) {
            coin.name = event.target.value;
        } else if (name.startsWith("coin-shortname")) {
            coin.flags.sfc.shortName = event.target.value;
        } else if (name.startsWith("coin-value")) {
            coin.flags.sfc.value = event.target.value;
        } else if (name.startsWith("coin-weight")) {
            coin.system.weight = event.target.value;
        } else if (name.startsWith("coin-enabled")) {
            coin.flags.sfc.enabled = event.target.checked;
        }

        event.target.blur();
        event.target.reportValidity();
    }
}