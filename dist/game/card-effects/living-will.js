"use strict";
/**
 * @file living-will.js
 * @description Living Will card handler
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
function wasLivingWillSelectionApplied(result) {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === 'living_will_selected')
        : null;
    return !!(selected && selected.applied);
}
async function handleLivingWillSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'LIVING_WILL',
        actionPayload: { livingWillTarget: { row, col } },
        invalidMessage: '生きる意志を付与する自分の石を選んでください',
        validateResult: ({ result }) => wasLivingWillSelectionApplied(result),
        buildPlaybackMeta: () => ({ cause: 'LIVING_WILL', target: { row, col } })
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleLivingWillSelection };
}
//# sourceMappingURL=living-will.js.map