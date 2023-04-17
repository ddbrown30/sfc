This module for Foundry VTT adds fantasy style currencies to Savage Worlds.

[[_TOC_]]

# Installation

To install, search for "SWADE Fantasy Currencies" in your module browser inside Foundry VTT.

Alternatively, you can manually install the module by following these steps:

1.  Inside Foundry, select the Add-On Modules tab in the Configuration and Setup menu.
2.  Click the Install Module button and enter the following URL: https://github.com/ddbrown30/sfc/releases/latest/download/module.json
3.  Click Install and wait for installation to complete.

# Initialization

When you first start using SWADE Fantasy Currencies (SFC), it's recommended to run the initialize step to set up all the characters in your game. This is not required but you will lose an actor's current currency if you change any coin values on their sheet before running this step.

To do this, follow these steps:
1. Open the Configure Settings menu from the Game Configuration tab
2. Select SWADE Fantasy Currencies on the left
3. Click the Initialize All Characters button and press Yes to confirm

This will then grab all character actors in your game (skipping npcs and vehicles) and will do the following:
- Add a coin item to the actor's inventory for each coin defined in the Coin Config. By default, this will be Copper Coins, Silver Coins, Gold Coins, and Platinum Coins.
- Using the actor's current amount of currency, it will give a quantity of coins that adds up to that amount using the largest denominations possible. For example, if the actor had $5.27, they will be awarded 0 platinum, 5 gold, 2 silver, and 7 copper coins.

You might notice the behaviour dropdown on the confirmation dropdown. You should leave that on the default value of Keep Currency for the first time you run it. The Keep Coins option is useful for initializing characters after you have been using SFC for awhile. Instead of using the actor's currency to calculate the number of coins they should have, it instead will keep the quantity of coins the same and will calculate the currency based on the value of the coins the actor has. This is important because if, for instance, an actor has 1000 copper coins (which is equal to $10 of currency) running the init step with Keep Currency would convert those coins to 10 gold coins.

# Usage Instructions

Using SFC is simple. On the gear tab of the character sheet, the normal currency display has been replaced by the coin display. To change the number of coins the actor has, just enter the new value in the field next to the coin and the coin inventory will update to match. The actor's total currency value will update automatically based on the value of the coins. You can also edit the coins directly in the inventory, if you prefer, and everything will work the same.

Deleting coins from the inventory is also supported and will be equivalent to setting the amount to 0. A coin item will be automatically created if the coin value is set again later.

![Preview](./sheet_view.jpg?raw=true)

# Configuration

If your world has different types of coins than the standard fantasy RPG denominations or if you just want to tweak the appearance, you can configure your coins from the Coin Config menu in the SFC settings.

From here, you can set the name, icon, value, and weight for each coin. Note that if you change the value of coins, you'll need to run the Initialize Characters step again in order to have the coins and currency match. If you set your coin values such that it's no longer possible to evenly divide the currency among your coins, the extra currency will be lost during the init process.

You can also choose to disable coins that you don't want. Disabled coins will no longer affect the currency or appear in the coin display. Disabled coins will be removed from the inventory the next time that Initialize Characters is run.

![Preview](./coin_config.jpg?raw=true)


# Feedback

Suggestions and feedback are appreciated. You can contact me on Discord at TheChemist#6059 if you have any questions or comments.

To report a bug, please open a new issue [in the tracker](https://github.com/ddbrown30/sfc/issues) or use the [Bug Reporter module](https://www.foundryvtt-hub.com/package/bug-reporter/)
