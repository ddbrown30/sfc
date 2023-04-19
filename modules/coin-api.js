import * as SFC_CONFIG from "./sfc-config.js";
import { Utils } from "./utils.js";
import { PurchaseDialog } from "./purchase-dialog.js";

export class CoinAPI {
    
    static async registerAPIFunctions() {
        game.sfc.makePurchase = this.makePurchase;
    }

    static async makePurchase() {
        var behaviour = "currency";
        let templateData = {behaviour};
        const dialogContent = await renderTemplate(SFC_CONFIG.DEFAULT_CONFIG.templates.purchaseDialog, templateData);

        function handleRender(html) {
            html.find("select[id='behaviour']").on("change", event =>{
                behaviour = event.target.value;
                dialog.render();
            });
          }

        const dialog = new PurchaseDialog({
            title: game.i18n.localize("SFC.InitActors.AllLabel"),
            buttons: {
                yes: {
                    icon: `<i class="fa fa-check"></i>`,
                    label: game.i18n.localize("Confirm"),
                    callback: async (html) => {
                        const behaviour = html.find(`#behaviour`)[0].value;
                        const keepCurrency = behaviour == "keep-coins" ? false  : true;
                        await Coins.initActorInventories(keepCurrency);
                    }
                },
                no: {
                    icon: `<i class="fa fa-times"></i>`,
                    label: game.i18n.localize("Cancel"),
                    callback: event => { }
                }
            },
            default: "no",
            closeOnSubmit: false
        });
        dialog.render(true);
    }
}