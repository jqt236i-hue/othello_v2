/**
 * @file shrink.ts
 * @description Board Shrink effects wrapper (delegates to game/logic/cards/shrink.js)
 */

import ShrinkModule = require('../../logic/cards/shrink');

const _exports: any = {
  applyBoardShrinkWill: ShrinkModule.applyBoardShrinkWill,
  applyBoardShrinkGod: ShrinkModule.applyBoardShrinkGod,
  BOARD_SHRINK_SELECTION_COUNT: ShrinkModule.BOARD_SHRINK_SELECTION_COUNT
};

export = _exports;
