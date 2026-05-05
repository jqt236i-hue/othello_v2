"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file hyperactive-inherit.js
 * @description 多動の継承 (HYPERACTIVE_INHERIT_WILL) UI handler
 */
const PendingSelectionFlow = _require('./selection-flow');
function wasSelectionApplied(result, rawEventType) {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}
async function handleHyperactiveInheritSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'HYPERACTIVE_INHERIT_WILL',
        actionPayload: { hyperactiveInheritTarget: { row, col } },
        invalidMessage: '多動を継承する自分の石を選んでください',
        validateResult: ({ result }) => wasSelectionApplied(result, 'hyperactive_inherit_selected'),
        buildPlaybackMeta: () => ({ cause: 'HYPERACTIVE_INHERIT_WILL', target: { row, col } })
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleHyperactiveInheritSelection };
}
//# sourceMappingURL=hyperactive-inherit.js.map