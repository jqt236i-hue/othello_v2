"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
"use strict";
/**
 * @file teleport.ts
 * @description Teleport effects wrapper (delegates to game/logic/cards/teleport.js)
 */
const TeleportModule = require("../../logic/cards/teleport");
const exports = {
    applyTeleportWill: TeleportModule.applyTeleportWill,
    applyCellTeleportWill: TeleportModule.applyCellTeleportWill
};
module.exports = exports;
//# sourceMappingURL=teleport.js.map