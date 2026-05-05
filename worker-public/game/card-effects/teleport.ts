declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file teleport.js
 * @description Teleport Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');

function getTeleportSelectionPrompt(pendingType: string): string {
    return pendingType === 'CELL_TELEPORT_WILL'
        ? 'マステレポートさせるマスを選んでください'
        : 'テレポートさせる石を選んでください';
}

function getTeleportSelectedEvent(result: any): any {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'teleport_selected')
        : null;
}

async function handleTeleportSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingTypes: ['TELEPORT_WILL', 'CELL_TELEPORT_WILL'],
        actionPayload: { teleportTarget: { row, col } },
        invalidMessage: ({ pendingType }: any) => getTeleportSelectionPrompt(pendingType),
        validateResult: ({ result }: any) => {
            const selected = getTeleportSelectedEvent(result);
            return !!(selected && selected.applied);
        },
        buildPlaybackMeta: ({ pendingType }: any) => ({ cause: pendingType, target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleTeleportSelection };
}

export {};
