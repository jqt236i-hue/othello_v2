"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
"use strict";
/**
 * @file udg.ts
 * @description Ultimate Destroy God (UDG) effects wrapper (delegates to game/logic/cards/udg.js)
 */
const UdgModule = require("../../logic/cards/udg");
const exports = {
    processUltimateDestroyGodEffects: UdgModule.processUltimateDestroyGodEffects,
    processUltimateDestroyGodEffectsAtAnchor: UdgModule.processUltimateDestroyGodEffectsAtAnchor,
    processUltimateDestroyGodEffectsAtTurnStartAnchor: UdgModule.processUltimateDestroyGodEffectsAtTurnStartAnchor
};
module.exports = exports;
//# sourceMappingURL=udg.js.map