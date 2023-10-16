import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";
import { Coins } from "./coins.js";

/**
 * API functions for interacting with Coins
 */
export class CoinsAPI {

    /* -------------------------------------------- */
    /*                      API                     */
    /* -------------------------------------------- */

    static async awardCoins() {
        let targets = [];
        for (const token of canvas.tokens.controlled) {
            if (Utils.isSupportedActorType(token.actor.type)) {
                targets.push({
                    name: token.name,
                    id: token.actor.id,
                    actor: token.actor
                })
            }
        }

        if (targets.length == 0) {
            Utils.showNotification("error", game.i18n.localize("SFC.AwardCoinsDialog.SelectTokensError"));
            return;
        }

        targets.sort((a, b) => {
            if (a.name.toUpperCase() < b.name.toUpperCase()) {
                return -1;
            }
            if (a.name.toUpperCase() > b.name.toUpperCase()) {
                return 1;
            }
            return 0;
        });

        let coinTemplateData = [];

        for (const coinData of Object.values(game.sfc.coinDataMap)) {
            if (coinData.enabled) {
                coinTemplateData.push({
                    type: coinData.type,
                    name: coinData.name,
                    shortNameUpper: coinData.shortName.toUpperCase(),
                    img: coinData.img,
                    valueInt: coinData.value * 1000
                });
            }
        };

        //Sort the coins from highest value to lowest
        coinTemplateData.sort((a, b) => {
            return b.valueInt - a.valueInt;
        });
        
        const templateData = {coinTemplateData, targets};
        const content = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.awardCoinsDialog, templateData);

        new Dialog({
            title: game.i18n.localize("SFC.AwardCoinsDialog.AwardCoinsTitle"),
            content: content,
            buttons: {
                award: {
                    label: game.i18n.localize("SFC.AwardCoinsDialog.AwardButtonName"),
                    callback: async (html) => {
                        let selectedTargets = [];
                        let targetId = html.find("#targetId")[0].value;
                        if (targetId === "all-targets") {
                            selectedTargets = targets;
                        } else {
                            selectedTargets.push(targets.find(target => target.id == targetId));
                        }

                        for (const coinData of Object.values(game.sfc.coinDataMap)) {
                            if (coinData.enabled) {
                                let inputName = "#coin-" + coinData.type;
                                const coinAmount = Number(html.find(inputName)[0].value);
                                if (coinAmount > 0) {
                                    for (const target of selectedTargets) {
                                        await Coins.addCoinAmount(target.actor, coinData, coinAmount);
                                    }
                                }
                            }
                        };
                    }
                },
                cancel: {
                    label: game.i18n.localize("SFC.AwardCoinsDialog.CancelButtonName")
                }
            }
        }).render(true)
    }
}