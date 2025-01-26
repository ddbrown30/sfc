export const NAME = "sfc";

export const TITLE = "SWADE Fantasy Currencies";
export const SHORT_TITLE = "SFC";

export const PATH = "modules/sfc";


export const DEFAULT_CONFIG = {
    templates: {
        coinsDisplay: `${PATH}/templates/coins-display.hbs`,
        coinConfig: `${PATH}/templates/coin-config.hbs`,
        initAllActorsButton: `${PATH}/templates/init-all-actors-button.hbs`,
        initAllActorsDialog: `${PATH}/templates/init-all-actors-dialog.hbs`,
        initSingleActorDialog: `${PATH}/templates/init-single-actor-dialog.hbs`,
        refreshAllCoinItemsButton: `${PATH}/templates/refresh-all-coin-items-button.hbs`,
        itemDescription: `${PATH}/templates/coin-item-description.hbs`,
        coinManager: `${PATH}/templates/coin-manager.hbs`,
        awardCoinsDialog: `${PATH}/templates/award-coins-dialog.hbs`,
    },
    coins: {
        types: {
            copper: "copper",
            silver: "silver",
            gold: "gold",
            plat: "plat"
        },
        icons: {
            copper: "icons/commodities/currency/coins-wheat-stack-copper.webp",
            silver: "icons/commodities/currency/coins-shield-sword-stack-silver.webp",
            gold: "icons/commodities/currency/coins-crown-stack-gold.webp",
            plat: "icons/commodities/currency/coins-assorted-mix-platinum.webp"
        },
        names: {
            copper: "Copper coins",
            silver: "Silver coins",
            gold: "Gold coins",
            plat: "Platinum coins"
        },
        shortNames: {
            copper: "cp",
            silver: "sp",
            gold: "gp",
            plat: "pp"
        },
        values: {
            copper: 0.01,
            silver: 0.1,
            gold: 1,
            plat: 10
        },
        weight: 0.02
    },
    defaultShowCurrency: true,
    defaultUseCoinItems: true,
    defaultEnableNpcCoins: false
}

export const FLAGS = {
    copperCount: "copperCount",
    silverCount: "silverCount",
    goldCount: "goldCount",
    platCount: "platCount",
}

export const SETTING_KEYS = {
    coinDataMap: "coinMap",
    defaultCoinDataMap: "defaultCoinMap",
    showCurrency: "showCurrency",
    useCoinItems: "useCoinItems",
    enableNpcCoins: "enableNpcCoins",
    itemPilesConfig: "itemPilesConfig",
}

