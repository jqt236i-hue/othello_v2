declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file living-will.js
 * @description Living Will card handler
 */

const PendingSelectionFlow = _require('./selection-flow');
const PendingCoordinator = _require('../turn/pending-coordinator');

function wasLivingWillSelectionApplied(result: any): boolean {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'living_will_selected')
        : null;
    return !!(selected && selected.applied);
}

async function handleLivingWillSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'LIVING_WILL',
        actionPayload: PendingCoordinator.buildPendingSelectionTargetPayload('LIVING_WILL', row, col),
        invalidMessage: '生きる意志を付与する自分の石を選んでください',
        validateResult: ({ result }: { result: any }) => wasLivingWillSelectionApplied(result),
        buildPlaybackMeta: () => ({ cause: 'LIVING_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleLivingWillSelection };
}

export {};
