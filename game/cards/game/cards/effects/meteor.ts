// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file meteor.ts
 * @description Meteor Will effects wrapper (delegates to game/logic/cards/meteor.js)
 */
const MeteorModule = require("../../logic/cards/meteor");
const exports = {
    applyMeteorWill: MeteorModule.applyMeteorWill
};
module.exports = exports;

export {};
