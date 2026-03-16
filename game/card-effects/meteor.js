/**
 * @file meteor.js
 * @description Meteor card handlers
 */

var PendingSelectionFlow;
if (typeof require === 'function') {
    try { PendingSelectionFlow = require('./selection-flow'); } catch (e) { /* ignore */ }
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

async function handleMeteorSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'METEOR_WILL',
        actionPayload: { meteorTarget: { row, col } },
        invalidMessage: '破壊するマスを選んでください',
        validateResult: ({ result }) => wasSelectionApplied(result, 'meteor_selected'),
        buildPlaybackMeta: () => ({ cause: 'METEOR_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleMeteorSelection };
}
