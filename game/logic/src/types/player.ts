declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * Player-related type definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.playerKeyToValue = playerKeyToValue;
exports.playerValueToKey = playerValueToKey;
exports.opponentOf = opponentOf;
function playerKeyToValue(key: any) {
    return key === 'black' ? 1 : -1;
}
function playerValueToKey(value: any) {
    return value === 1 ? 'black' : 'white';
}
function opponentOf(key: any) {
    return key === 'black' ? 'white' : 'black';
}

export {};
