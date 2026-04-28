"use strict";
/**
 * Player-related type definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.playerKeyToValue = playerKeyToValue;
exports.playerValueToKey = playerValueToKey;
exports.opponentOf = opponentOf;
function playerKeyToValue(key) {
    return key === 'black' ? 1 : -1;
}
function playerValueToKey(value) {
    return value === 1 ? 'black' : 'white';
}
function opponentOf(key) {
    return key === 'black' ? 'white' : 'black';
}
//# sourceMappingURL=player.js.map