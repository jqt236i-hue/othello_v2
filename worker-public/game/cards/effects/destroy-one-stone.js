/**
 * @file destroy-one-stone.js
 * @description Destroy One Stone effects wrapper (delegates to game/logic/effects/destroy_one_stone.js)
 */

'use strict';

const DestroyOneStoneModule = require('../../logic/effects/destroy_one_stone');

module.exports = {
    applyDestroyOneStone: DestroyOneStoneModule.applyDestroyOneStone
};
