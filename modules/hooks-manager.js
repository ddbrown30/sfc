import { Utils } from "./utils.js";
import { registerSettings } from "./settings.js";
import { Coins } from "./coins.js";

export class HooksManager {
    /**
     * Registers hooks
     */
    static registerHooks() {

        /* ------------------- Init/Ready ------------------- */

        Hooks.on("init", () => {
            game.sfc = game.sfc ?? {};

            Utils.loadTemplates();
            registerSettings();
        });

        Hooks.on("ready", () => {
            Coins.onReady();
        });

        /* -------------------------------------------- */
        /*                    Render                    */
        /* -------------------------------------------- */

        Hooks.on("renderActorSheet", (sheet) => {
            sheet.activateTab("inventory")
        })

        Hooks.on("renderActorSheet", (app, html, data) => {
            Coins.onRenderActorSheet(app, html, data);
        });

        Hooks.on('renderSettingsConfig', (app, el, data) => {
            Coins.onRenderSettingsConfig(app, el, data);
        });

        /* -------------------------------------------- */
        /*                    Updates                   */
        /* -------------------------------------------- */

        Hooks.on("preUpdateActor", (doc, updateData, options, userId) => {
            Coins.onPreUpdateActor(doc, updateData, options, userId);
        });

        Hooks.on("updateItem", (doc, change, options, userId) => {
            Coins.onUpdateItem(doc, change, options, userId);
        });

        Hooks.on("deleteItem", (doc, options, userId) => {
            Coins.onDeleteItem(doc, options, userId);
        });

    }
}