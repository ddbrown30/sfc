import * as SFC_CONFIG from "./sfc-config.js";
import { Coins } from "./coins.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialog for triggering an init of actors' coins
 */
export class InitAllActorsDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "init-all-actors-dialog",
        tag: "form",
        window: { title: "SFC.InitActors.AllLabel", contentClasses: ["dialog", "init-dialog"] },
        position: { width: 400 },
        actions: {
            currency: async function (event, button) {
                let keepCurrency = true;
                await this.handleConfirm(keepCurrency);
            },
            coins: async function (event, button) {
                let keepCurrency = false;
                await this.handleConfirm(keepCurrency);
            },
            cancel: function (event, button) { this.close(); }
        },
    };

    static PARTS = {
        form: {
            template: SFC_CONFIG.DEFAULT_CONFIG.templates.initAllActorsDialog,
        }
    };

    async _prepareContext(_options) {
        this.folders = [];

        for (let folder of game.folders) {
            if (folder.type == "Actor") {
                this.folders.push(folder);
            }
        }

        if (this.folders.length) {
            this.folders.sort((a, b) => a.name.localeCompare(b.name));
            this.folders.unshift({name: ""});
        }

        return {
            folders: this.folders
        };
    };

    async handleConfirm(keepCurrency) {
        let folderChoice = this.element.querySelector("select[name='folder'");
        folderChoice = folderChoice.selectedIndex > 0 ? this.folders[folderChoice.selectedIndex] : undefined;
        await Coins.initAllActorInventories(keepCurrency, folderChoice);
        this.close();
    }
}