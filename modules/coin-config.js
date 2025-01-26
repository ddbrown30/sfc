import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";
import { Coins } from "./coins.js";

export class CoinConfig extends FormApplication {
    constructor() {
        super();
        this.initialDataMap = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap);
        this.workingCoinDataMap = foundry.utils.duplicate(this.initialDataMap);
        this.restoredMap = false;
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
                const hasCoins = this.hasAnyActiveCoins();
                const dataChanged = this.restoredMap || !foundry.utils.isEmpty(foundry.utils.diffObject(this.initialDataMap, this.workingCoinDataMap));
                if (!hasCoins || !dataChanged) {
                    this.submit();
                    return;
                }

                let valueChanged = false;
                for (let coinData of Object.values(this.initialDataMap)) {
                    if (this.workingCoinDataMap[coinData.type].value != coinData.value) {
                        valueChanged = true;
                        break;
                    }
                }

                function showRefreshPrompt(app) {
                    app.submit();

                    Dialog.confirm({
                        title: game.i18n.localize("SFC.CoinConfig.Dialog.RefreshDataTitle"),
                        content: game.i18n.localize("SFC.CoinConfig.Dialog.RefreshDataContent"),
                        yes: () => Coins.refreshAllActorItems(),
                    });
                }

                if (valueChanged) {
                    Dialog.prompt({
                        title: game.i18n.localize("SFC.CoinConfig.Dialog.ValueChangedTitle"),
                        content: game.i18n.localize("SFC.CoinConfig.Dialog.ValueChangedContent"),
                        callback: () => showRefreshPrompt(this)
                    });
                } else {
                    showRefreshPrompt(this);
                }
            } else {
                this.form.reportValidity();
            }
        });
    }

    async _updateObject(event, formData) {
        await Utils.setSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap, this.workingCoinDataMap);
        Coins.buildItemDescriptionText();

        if (game.modules.get('item-piles')?.active &&
            Utils.getSetting(SFC_CONFIG.SETTING_KEYS.itemPilesConfig)) {
                Coins.itemPilesConfig();
        }
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
                        this.workingCoinDataMap = foundry.utils.duplicate(this.initialDataMap);
                        this.restoredMap = true;
                        this.render();
                    }
                },
                no: {
                    icon: `<i class="fa fa-times"></i>`,
                    label: game.i18n.localize("SFC.No"),
                    callback: event => { }
                }
            },
            default: "no"
        }).render(true);
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
        this.render(true);
    }

    //Searches through all the actors and checks if any of them contain coin data
    hasAnyActiveCoins() {
        let countFlags = []

        for (let coinData of Object.values(game.sfc.coinDataMap)) {
            countFlags.push(coinData.countFlagName);
        }

        for (const actor of game.actors) {
            if (actor.type !== "character") {
                //Only player characters use coins
                continue;
            }

            for (let countFlag of countFlags) {
                if (Utils.getModuleFlag(actor, countFlag) > 0) {
                    //We have some coins on this actor
                    return true;
                }
            }
        }

        return false;
    }
}