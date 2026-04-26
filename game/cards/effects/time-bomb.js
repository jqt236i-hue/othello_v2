/**
 * @file time-bomb.js
 * @description Time Bomb effects wrapper (delegates to game/logic/cards/time_bomb.js)
 */

'use strict';

const TimeBombModule = require('../../logic/cards/time_bomb');

module.exports = {
    applyTimeBombWill: TimeBombModule.applyTimeBombWill,
    tickBombs: TimeBombModule.tickBombs,
    tickBombAt: TimeBombModule.tickBombAt
};
