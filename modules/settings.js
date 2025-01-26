import * as SFC_CONFIG from "./sfc-config.js";
import { CoinConfig } from "./coin-config.js";
import { Coins } from "./coins.js";
import { Utils } from "./utils.js";

export function registerSettings() {

    Utils.registerSetting(SFC_CONFIG.SETTING_KEYS.coinDataMap, {
        name: "Coin map",
        hint: "Map of the different coins we use",
        scope: "world",
        type: Object,
        default: {},
        onChange: async coinDataMap => {
            // Save the active coin map to a convenience property
            if (game.sfc) {
                game.sfc.coinDataMap = coinDataMap;
            }
        }
    });

    Utils.registerSetting(SFC_CONFIG.SETTING_KEYS.defaultCoinDataMap, {
        name: "Default coin data map",
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

    Utils.registerSetting(SFC_CONFIG.SETTING_KEYS.showCurrency, {
        name: "SFC.Settings.ShowCurrencyName",
        hint: "SFC.Settings.ShowCurrencyHint",
        scope: "world",
        type: Boolean,
        config: true,
        default: SFC_CONFIG.DEFAULT_CONFIG.defaultShowCurrency
    });

    Utils.registerSetting(SFC_CONFIG.SETTING_KEYS.useCoinItems, {
        name: "SFC.Settings.UseCoinItemsName",
        hint: "SFC.Settings.UseCoinItemsHint",
        scope: "world",
        type: Boolean,
        config: true,
        default: SFC_CONFIG.DEFAULT_CONFIG.defaultUseCoinItems
    });

    Utils.registerSetting(SFC_CONFIG.SETTING_KEYS.enableNpcCoins, {
        name: "SFC.Settings.NpcCoinsName",
        hint: "SFC.Settings.NpcCoinsHint",
        scope: "world",
        type: Boolean,
        config: true,
        default: SFC_CONFIG.DEFAULT_CONFIG.defaultEnableNpcCoins,
        onChange: async enableNpcCoins => {
            if (enableNpcCoins) {
                await Dialog.prompt({
                    title: game.i18n.localize("SFC.Settings.Dialog.EnableNpcWarningTitle"),
                    content: game.i18n.localize("SFC.Settings.Dialog.EnableNpcWarningContent")
                });
            }
        }
    });

    if (game.modules.get('item-piles')?.active) {
        Utils.registerSetting(SFC_CONFIG.SETTING_KEYS.itemPilesConfig, {
            name: "SFC.Settings.ItemPilesConfigName",
            hint: "SFC.Settings.ItemPilesConfigHint",
            scope: "world",
            type: Boolean,
            config: true,
            default: SFC_CONFIG.DEFAULT_CONFIG.defaultItemPilesConfig,
            onChange: async itemPilesConfig => {
                if (itemPilesConfig) {
                    await Dialog.confirm({
                        title: game.i18n.localize("SFC.Settings.Dialog.ItemPilesTitle"),
                        content: game.i18n.localize("SFC.Settings.Dialog.ItemPilesContent"),
                        yes: () => Coins.itemPilesConfig(),
                        no: () => Utils.setSetting(SFC_CONFIG.SETTING_KEYS.itemPilesConfig, false)
                    });
                }
            }
        });
    }

}