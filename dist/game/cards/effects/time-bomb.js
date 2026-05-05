"use strict";
/**
 * @file time-bomb.ts
 * @description Time Bomb effects wrapper (delegates to game/logic/cards/time_bomb.js)
 */
const TimeBombModule = require('../../logic/cards/time_bomb');
const _exports = {
    applyTimeBombWill: TimeBombModule.applyTimeBombWill,
    tickBombs: TimeBombModule.tickBombs,
    tickBombAt: TimeBombModule.tickBombAt
};
module.exports = _exports;
//# sourceMappingURL=time-bomb.js.map