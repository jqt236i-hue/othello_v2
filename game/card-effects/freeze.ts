declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file freeze.js
 * @description Freeze Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');
const PendingCoordinator = _require('../turn/pending-coordinator');

function wasSelectionApplied(result: any, rawEventType: string): boolean {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}

async function handleFreezeSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'FREEZE_WILL',
        actionPayload: PendingCoordinator.buildPendingSelectionTargetPayload('FREEZE_WILL', row, col),
        invalidMessage: '凍結するマスを選んでください',
        validateResult: ({ result }: any) => wasSelectionApplied(result, 'freeze_selected'),
        buildPlaybackMeta: () => ({ cause: 'FREEZE_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleFreezeSelection };
}

export {};
