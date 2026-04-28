"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
"use strict";
/**
 * @file destroy-dragon.ts
 * @description Destroy Dragon effects wrapper (delegates to game/logic/cards/destroy_dragon.js)
 */
const DestroyDragonModule = require("../../logic/cards/destroy_dragon");
const exports = {
    processDestroyDragonEffects: DestroyDragonModule.processDestroyDragonEffects,
    processDestroyDragonEffectsAtAnchor: DestroyDragonModule.processDestroyDragonEffectsAtAnchor,
    processDestroyDragonEffectsAtTurnStartAnchor: DestroyDragonModule.processDestroyDragonEffectsAtTurnStartAnchor
};
module.exports = exports;
//# sourceMappingURL=destroy-dragon.js.map