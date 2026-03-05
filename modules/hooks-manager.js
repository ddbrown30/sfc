import { Utils } from "./utils.js";
import { registerSettings } from "./settings.js";
import { Coins } from "./coins.js";
import { CoinsAPI } from "./coins-api.js";

export class HooksManager {
    /**
     * Registers hooks
     */
    static registerHooks() {

        /* ------------------- Init/Ready ------------------- */

        Hooks.on("init", () => {
            game.sfc = game.sfc ?? {};

            // Expose API methods
            game.sfc.awardCoins = CoinsAPI.awardCoins;

            Utils.loadTemplates();
            registerSettings();
        });

        Hooks.on("ready", () => {
            Coins.onReady();
        });

        /* -------------------------------------------- */
        /*                    Render                    */
        /* -------------------------------------------- */

        Hooks.on("renderActorSheetV2", (app, html, data, options) => {
            Coins.onRenderActorSheet(app, html, data, options);
        });

        Hooks.on("renderGroupSheet", (app, html, data) => {
            Coins.onRenderGroupSheet(app, html, data);
        });

        Hooks.on('renderSettingsConfig', (app, html, data, options) => {
            Coins.onRenderSettingsConfig(app, html, data);
        });

        /* -------------------------------------------- */
        /*                    Updates                   */
        /* -------------------------------------------- */

        Hooks.on("updateActor", (doc, updateData, options, userId) => {
            Coins.onUpdateActor(doc, updateData, options, userId);
        });

        Hooks.on("createItem", (doc, options, userId) => {
            Coins.onCreateItem(doc, options, userId);
        });

        Hooks.on("updateItem", (doc, change, options, userId) => {
            Coins.onUpdateItem(doc, change, options, userId);
        });

        Hooks.on("deleteItem", (doc, options, userId) => {
            Coins.onDeleteItem(doc, options, userId);
        });

    }
}