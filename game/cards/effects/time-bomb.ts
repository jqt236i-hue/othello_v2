/**
 * @file time-bomb.ts
 * @description Time Bomb effects wrapper (delegates to game/logic/cards/time_bomb.js)
 */

const TimeBombModule: any = require('../../logic/cards/time_bomb');

const _exports: Record<string, any> = {
  applyTimeBombWill: TimeBombModule.applyTimeBombWill,
  tickBombs: TimeBombModule.tickBombs,
  tickBombAt: TimeBombModule.tickBombAt
};

export = _exports;
