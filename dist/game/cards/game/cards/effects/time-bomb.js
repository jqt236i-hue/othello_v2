"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
"use strict";
/**
 * @file time-bomb.ts
 * @description Time Bomb effects wrapper (delegates to game/logic/cards/time_bomb.js)
 */
const TimeBombModule = require("../../logic/cards/time_bomb");
const exports = {
    applyTimeBombWill: TimeBombModule.applyTimeBombWill,
    tickBombs: TimeBombModule.tickBombs,
    tickBombAt: TimeBombModule.tickBombAt
};
module.exports = exports;
//# sourceMappingURL=time-bomb.js.map