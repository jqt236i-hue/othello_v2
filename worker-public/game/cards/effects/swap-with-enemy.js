/**
 * @file swap-with-enemy.js
 * @description Swap With Enemy effects wrapper (delegates to game/logic/effects/swap_with_enemy.js)
 */

'use strict';

const SwapWithEnemyModule = require('../../logic/effects/swap_with_enemy');

module.exports = {
    applySwapWithEnemy: SwapWithEnemyModule.applySwapWithEnemy
};
