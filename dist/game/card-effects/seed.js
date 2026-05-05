"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file seed.js
 * @description Seed Will card handlers
 */
const PendingSelectionFlow = _require('./selection-flow');
function wasSelectionApplied(result, rawEventType) {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}
async function handleSeedSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'SEED_WILL',
        actionPayload: { seedTarget: { row, col } },
        invalidMessage: '種をまくマスを選んでください',
        validateResult: ({ result }) => wasSelectionApplied(result, 'seed_selected'),
        buildPlaybackMeta: () => ({ cause: 'SEED_WILL', target: { row, col } })
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleSeedSelection };
}
//# sourceMappingURL=seed.js.map