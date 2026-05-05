"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file guard.js
 * @description Guard Will card handlers
 */
const PendingSelectionFlow = _require('./selection-flow');
function wasSelectionApplied(result, rawEventType) {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}
async function handleGuardSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingTypes: ['GUARD_WILL', 'GUARDIAN_GOD'],
        actionPayload: { guardTarget: { row, col } },
        invalidMessage: '守る石にする自分の石を選んでください',
        validateResult: ({ result }) => wasSelectionApplied(result, 'guard_selected'),
        buildPlaybackMeta: ({ pendingType }) => ({ cause: pendingType, target: { row, col } })
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleGuardSelection };
}
//# sourceMappingURL=guard.js.map