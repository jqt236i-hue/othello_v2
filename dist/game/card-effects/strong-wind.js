"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file strong-wind.js
 * @description Strong Wind Will card handlers
 */
var PendingSelectionFlow;
if (typeof require === 'function') {
    try {
        PendingSelectionFlow = require('./selection-flow');
    }
    catch (e) { /* ignore */ }
}
if (!PendingSelectionFlow && typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow) {
    PendingSelectionFlow = globalThis.PendingSelectionFlow;
}
function getPlayerLabel(playerKey) {
    return playerKey === 'black' ? '黒' : '白';
}
async function handleMovementSelection(row, col, playerKey, options) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    const opts = options || {};
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: opts.pendingType,
        actionPayload: { [opts.actionField]: { row, col } },
        invalidMessage: opts.invalidMessage,
        validateResult: ({ result }) => {
            const selected = result && Array.isArray(result.rawEvents)
                ? result.rawEvents.find((event) => event && event.type === opts.rawEventType && event.applied)
                : null;
            return !!selected;
        },
        buildPlaybackMeta: () => ({ cause: opts.cause, target: { row, col } }),
        afterStateChange: () => {
            if (typeof emitLogAdded === 'function') {
                emitLogAdded(`${getPlayerLabel(playerKey)}が${opts.activationName}を発動`);
            }
        }
    });
}
async function handleStrongWindSelection(row, col, playerKey) {
    return handleMovementSelection(row, col, playerKey, {
        pendingType: 'STRONG_WIND_WILL',
        actionField: 'strongWindTarget',
        rawEventType: 'strong_wind_selected',
        invalidMessage: '移動可能な石を選んでください',
        activationName: '強風の意志',
        cause: 'STRONG_WIND_WILL'
    });
}
async function handleSuperBuoyancySelection(row, col, playerKey) {
    return handleMovementSelection(row, col, playerKey, {
        pendingType: 'SUPER_BUOYANCY_WILL',
        actionField: 'superBuoyancyTarget',
        rawEventType: 'super_buoyancy_selected',
        invalidMessage: '上へ移動させる石を選んでください',
        activationName: '超浮力',
        cause: 'SUPER_BUOYANCY_WILL'
    });
}
async function handleSuperGravitySelection(row, col, playerKey) {
    return handleMovementSelection(row, col, playerKey, {
        pendingType: 'SUPER_GRAVITY_WILL',
        actionField: 'superGravityTarget',
        rawEventType: 'super_gravity_selected',
        invalidMessage: '下へ移動させる石を選んでください',
        activationName: '超重力',
        cause: 'SUPER_GRAVITY_WILL'
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleStrongWindSelection,
        handleSuperBuoyancySelection,
        handleSuperGravitySelection
    };
}
//# sourceMappingURL=strong-wind.js.map