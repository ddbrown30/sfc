
This module for Foundry VTT adds fantasy style currencies to Savage Worlds.

- [Installation](#installation)
- [Initialization](#initialization)
- [Usage Instructions](#usage-instructions)
- [Configuration](#configuration)
- [Feedback](#feedback)


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
3. Click the Initialize All Characters button
4. Click the Initialize and preserve currency value button

This will then grab all character actors in your game (skipping npcs and vehicles) and will do the following:
- Add a coin item to the actor's inventory for each coin defined in the Coin Config. By default, this will be Copper Coins, Silver Coins, Gold Coins, and Platinum Coins.
- Using the actor's current amount of currency, it will give a quantity of coins that adds up to that amount using the largest denominations possible. For example, if the actor had $5.27, they will be awarded 0 platinum, 5 gold, 2 silver, and 7 copper coins.

You might notice the other button in the initialize dialog. You should always use the preserve currency button for the first time you run this process. The preserve coins option is useful for initializing characters after you have been using SFC for awhile. Instead of using the actor's currency to calculate the number of coins they should have, it instead will keep the quantity of coins the same and will calculate the currency based on the value of the coins the actor has. This is important because if, for instance, an actor has 1000 copper coins (which is equal to $10 of currency) preserving currency would convert those coins to 10 gold coins.

If processing all the characters in your game makes you nervous, you can instead use the Coin Manager, accessible from the Gear tab of the character sheet. From there, go to the System tab and select Initialize Character. You can do this one by one for each character you would like to initialize.

# Usage Instructions

Using SFC is simple. On the gear tab of the character sheet, the normal currency display has been replaced by the coin display. To change the number of coins the actor has, just enter the new value in the field next to the coin and the coin inventory will update to match. The actor's total currency value will update automatically based on the value of the coins. You can also edit the coins directly in the inventory, if you prefer, and everything will work the same.

Deleting coins from the inventory is also supported and will be equivalent to setting the amount to 0. A coin item will be automatically created if the coin value is set again later.

![Preview](./sheet_view.jpg?raw=true)

# Coin Manager

For more complex interaction with the coins, you can use the Coin Manager. The manager is accessed by clicking the Manage button to the right side of the coin display on the Gear tab.

All of the examples below are assumed to be using the default coin configuration.

#### Add/Remove Tab
The Add/Remove tab allows you to add and remove coins or currency from the character's coins.

When adding currency, the system will try to add the fewest possible coins to satisfy the provided value. For example, if you added $12.13, it would add 10 platinum, 2 gold, 1 silver, and 3 copper.

When adding coins, whatever coins are entered are what is added to the actor's inventory without any exchange i.e. if you add 10 gold, it will just increase the number of gold coins by 10.

When removing either currency or coins, the system will remove lower value coins first. For example, if you had 10 silver and 15 copper and removed 2 silver, you would end up with 9 silver and 5 copper, as 10 of the copper would have been exchanged to pay for 1 of the silver.

If you attempt to remove more currency or coins than you have in your inventory, the operation will be aborted and an error message will be displayed.

#### Exchange Tab
The Exchange tab allows you to convert coins from one type to another.

The Exchange All button will reduce your coins to the minimum number possible. For example, if you have 1 gold, 21 silver, and 15 copper, you will end up with 3 gold, 2 silver, and 5 copper as each is converter to the higher value.

The Exchange section allows you to input a value and convert that many coins of one type into another. For example, if you exchange 2 platinum into silver, you would add 200 silver to your inventory. The system will only exchange what fits and leave the rest, so if you were to attempt to exchange 15 silver into gold, you would only get 1 gold and the remaining 5 silver would be left intact.

#### System Tab
The System tab is where you can reinitialize the character. This should only be needed if the properties of the coins were changed in the coin config. If something seems out of sync, this is probably where you need to be.
If you already have coins and are just trying to update something, such as the icon or the name, make sure to use the Keep Coins option or it may end up affecting your total number of coins.

# Configuration

If your world has different types of coins than the standard fantasy RPG denominations or if you just want to tweak the appearance, you can configure your coins from the Coin Config menu in the SFC settings.

From here, you can set the name, icon, value, and weight for each coin. Note that if you change the value of coins, you'll need to run the Initialize Characters step again in order to have the coins and currency match. If you set your coin values such that it's no longer possible to evenly divide the currency among your coins, the extra currency will be lost during the init process.

You can also choose to disable coins that you don't want. Disabled coins will no longer affect the currency or appear in the coin display. Disabled coins will be removed from the inventory the next time Initialize Characters is run.

![Preview](./coin_config.jpg?raw=true)

# Feedback

Suggestions and feedback are appreciated. You can contact me on Discord at TheChemist#6059 if you have any questions or comments.

To report a bug, please open a new issue [in the tracker](https://github.com/ddbrown30/sfc/issues) or use the [Bug Reporter module](https://www.foundryvtt-hub.com/package/bug-reporter/)
