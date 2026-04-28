"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
"use strict";
/**
 * @file living-will.ts
 * @description Living Will effects wrapper (delegates to game/logic/cards/living_will.js)
 */
const LivingWillModule = require("../../logic/cards/living_will");
const exports = {
    applyLivingWill: LivingWillModule.applyLivingWill,
    applyLivingWillAfterFlips: LivingWillModule.applyLivingWillAfterFlips
};
module.exports = exports;
//# sourceMappingURL=living-will.js.map