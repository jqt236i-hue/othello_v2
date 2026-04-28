"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
"use strict";
/**
 * @file flips.ts
 * @description Flip helpers wrapper (delegates to game/logic/cards/flips.js)
 */
const FlipsModule = require("../../logic/cards/flips");
const exports = {
    getDirectionalChainFlips: FlipsModule.getDirectionalChainFlips,
    getFlipsWithContext: FlipsModule.getFlipsWithContext
};
module.exports = exports;
//# sourceMappingURL=flips.js.map