// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
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

export {};
