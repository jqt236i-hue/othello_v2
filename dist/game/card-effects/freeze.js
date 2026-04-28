"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file freeze.js
 * @description Freeze Will card handlers
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
async function handleFreezeSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'FREEZE_WILL',
        actionPayload: { freezeTarget: { row, col } },
        invalidMessage: '凍結するマスを選んでください',
        validateResult: ({ result }) => wasSelectionApplied(result, 'freeze_selected'),
        buildPlaybackMeta: () => ({ cause: 'FREEZE_WILL', target: { row, col } })
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleFreezeSelection };
}
//# sourceMappingURL=freeze.js.map