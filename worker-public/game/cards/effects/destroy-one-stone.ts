/**
 * @file destroy-one-stone.ts
 * @description Destroy One Stone effects wrapper (delegates to game/logic/effects/destroy_one_stone.js)
 */

import DestroyOneStoneModule = require('../../logic/effects/destroy_one_stone');

const effectExports: any = {
  applyDestroyOneStone: DestroyOneStoneModule.applyDestroyOneStone
};

export = effectExports;
