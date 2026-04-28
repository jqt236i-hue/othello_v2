"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file blockade.js
 * @description Blockade Will card handlers
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
function wasSelectionApplied(result, rawEventType) {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}
async function handleBlockadeSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'BLOCKADE_WILL',
        actionPayload: { blockadeTarget: { row, col } },
        invalidMessage: '封鎖する空きマスを選んでください',
        validateResult: ({ result }) => wasSelectionApplied(result, 'blockade_selected'),
        buildPlaybackMeta: () => ({ cause: 'BLOCKADE_WILL', target: { row, col } })
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleBlockadeSelection };
}
//# sourceMappingURL=blockade.js.map