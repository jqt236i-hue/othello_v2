"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file meteor.js
 * @description Meteor card handlers
 */
const PendingSelectionFlow = _require('./selection-flow');
function wasSelectionApplied(result, rawEventType) {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}
async function handleMeteorSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
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
//# sourceMappingURL=meteor.js.map