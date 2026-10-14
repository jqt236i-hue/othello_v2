declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file teleport.js
 * @description Teleport Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');
const PendingCoordinator = _require('../turn/pending-coordinator');

function getTeleportSelectedEvent(result: any) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'teleport_selected')
        : null;
}

async function handleTeleportSelection(row: number, col: number, playerKey: string) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'TELEPORT_WILL',
        actionPayload: PendingCoordinator.buildPendingSelectionTargetPayload('TELEPORT_WILL', row, col),
        invalidMessage: 'テレポートさせる石を選んでください',
        validateResult: ({ result }: any) => {
            const selected = getTeleportSelectedEvent(result);
            return !!(selected && selected.applied);
        },
        buildPlaybackMeta: () => ({ cause: 'TELEPORT_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleTeleportSelection };
}

export {};
