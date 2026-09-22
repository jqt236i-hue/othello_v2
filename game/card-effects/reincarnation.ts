declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file reincarnation.ts
 * @description Reincarnation Will target-selection handler
 */

const PendingSelectionFlow = _require('./selection-flow');
const PendingCoordinator = _require('../turn/pending-coordinator');

function wasReincarnationSelectionApplied(result: any): boolean {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'reincarnation_selected')
        : null;
    return !!(selected && selected.applied);
}

async function handleReincarnationSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'REINCARNATION_WILL',
        actionPayload: PendingCoordinator.buildPendingSelectionTargetPayload('REINCARNATION_WILL', row, col),
        invalidMessage: '転生させる自分の特殊石を選んでください',
        validateResult: ({ result }: { result: any }) => wasReincarnationSelectionApplied(result),
        buildPlaybackMeta: () => ({ cause: 'REINCARNATION_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleReincarnationSelection };
}

export {};
