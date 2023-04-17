import * as SFC_CONFIG from "./sfc-config.js";
import { CoinConfig } from "./coin-config.js";
import { Utils } from "./utils.js";

export function registerSettings() {

    Utils.registerSetting(SFC_CONFIG.SETTING_KEYS.coinMap, {
        name: "Coin map",
        hint: "Map of the different coins we use",
        scope: "world",
        type: Object,
        default: {},
        onChange: async coinMap => {
            // Save the active coin map to a convenience property
            if (game.sfc) {
                game.sfc.coinMap = coinMap;
            }
        }
    });

    Utils.registerSetting(SFC_CONFIG.SETTING_KEYS.defaultCoinMap, {
        name: "Default coin map",
        hint: "Contains the default coin config for SFC",
        scope: "world",
        type: Object,
        default: {}
    });

    Utils.registerMenu('setting-config', {
        name: 'SFC.CoinConfig.Name',
        label: 'SFC.CoinConfig.Label',
        hint: 'SFC.CoinConfig.Hint',
        icon: 'fa-solid fa-coins',
        type: CoinConfig,
        restricted: true,
    });
}