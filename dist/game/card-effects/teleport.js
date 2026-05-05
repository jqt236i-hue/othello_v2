"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file teleport.js
 * @description Teleport Will card handlers
 */
const PendingSelectionFlow = _require('./selection-flow');
function getTeleportSelectionPrompt(pendingType) {
    return pendingType === 'CELL_TELEPORT_WILL'
        ? 'マステレポートさせるマスを選んでください'
        : 'テレポートさせる石を選んでください';
}
function getTeleportSelectedEvent(result) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === 'teleport_selected')
        : null;
}
async function handleTeleportSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingTypes: ['TELEPORT_WILL', 'CELL_TELEPORT_WILL'],
        actionPayload: { teleportTarget: { row, col } },
        invalidMessage: ({ pendingType }) => getTeleportSelectionPrompt(pendingType),
        validateResult: ({ result }) => {
            const selected = getTeleportSelectedEvent(result);
            return !!(selected && selected.applied);
        },
        buildPlaybackMeta: ({ pendingType }) => ({ cause: pendingType, target: { row, col } })
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleTeleportSelection };
}
//# sourceMappingURL=teleport.js.map