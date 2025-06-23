import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";
import { Coins } from "./coins.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class CoinConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: 'coin-config',
        tag: "form",
        form: {
            handler: CoinConfig.formHandler,
            submitOnChange: false,
            closeOnSubmit: true
        },
        window: { title: "SFC.CoinConfig.Name", resizable: false, },
        classes:["sfc-form"],
        position: { width: 600, height: 820 },
        actions: {
            reset: function () { this.restoreDefaults(); },
            save: function () { this.save(); },
            filePicker: function (event, target) { this.onOpenFilePicker(target); },
        },
    };

    static coinConfigTemplates = SFC_CONFIG.DEFAULT_CONFIG.templates.coinConfig;
    static PARTS = {
        form: { template: this.coinConfigTemplates.form },
        footer: { template: this.coinConfigTemplates.footer },
    };

    constructor() {
        super();
        this.initialDataMap = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap);
        this.workingCoinDataMap = foundry.utils.duplicate(this.initialDataMap);
        this.restoredMap = false;
    }

    async _prepareContext(options) {
        return { coinDataMap: this.workingCoinDataMap };
    }

    static async formHandler(event, form, formData) {
        await Utils.setSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap, this.workingCoinDataMap);
        Coins.buildItemDescriptionText();

        if (game.modules.get('item-piles')?.active &&
            Utils.getSetting(SFC_CONFIG.SETTING_KEYS.itemPilesConfig)) {
                Coins.itemPilesConfig();
        }
    }

    save() {
        if (this.form.checkValidity()) {
            const hasCoins = this.hasAnyActiveCoins();
            const dataChanged = this.restoredMap || !foundry.utils.isEmpty(foundry.utils.diffObject(this.initialDataMap, this.workingCoinDataMap));
            if (!hasCoins || !dataChanged) {
                this.submit();
                this.close();
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
                app.close();

                foundry.applications.api.DialogV2.confirm({
                    window: { title: "SFC.CoinConfig.Dialog.RefreshDataTitle" },
                    content: game.i18n.localize("SFC.CoinConfig.Dialog.RefreshDataContent"),
                    yes: { callback: () => Coins.refreshAllActorItems() },
                });
            }

            if (valueChanged) {
                foundry.applications.api.DialogV2.prompt({
                    window: { title: "SFC.CoinConfig.Dialog.ValueChangedTitle" },
                    content: game.i18n.localize("SFC.CoinConfig.Dialog.ValueChangedContent"),
                    ok: { callback: () => showRefreshPrompt(this) },
                });
            } else {
                showRefreshPrompt(this);
            }
        } else {
            this.form.reportValidity();
        }
    }

    restoreDefaults() {
        foundry.applications.api.DialogV2.confirm({
            title: game.i18n.localize("SFC.CoinConfig.RestoreDefaultsTitle"),
            content: game.i18n.localize("SFC.CoinConfig.RestoreDefaultsContents"),
            yes: {
                callback: () => {
                    const defaultMap = Utils.getSetting(SFC_CONFIG.SETTING_KEYS.defaultCoinDataMap);
                    this.initialDataMap = defaultMap;
                    this.workingCoinDataMap = foundry.utils.duplicate(this.initialDataMap);
                    this.restoredMap = true;
                    this.render();
                }
            },
        });
    }
    async onOpenFilePicker(target) {
        const inputField = this.element.querySelector(`input[name="${target.dataset.target}"`);
        new FilePicker.implementation({
            type: target.dataset.type,
            current: inputField.value,
            allowUpload: true,
            callback: (src) => {
                if (inputField.value != src) {
                    inputField.value = src;
                    inputField.dispatchEvent(new Event('change', { 'bubbles': true }));
                }
            }
        }).browse();
    }

    async _onChangeForm(formConfig, event) {
        super._onChangeForm(formConfig, event);
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