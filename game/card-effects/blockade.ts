declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file blockade.js
 * @description Blockade Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');
const PendingCoordinator = _require('../turn/pending-coordinator');

function wasSelectionApplied(result: any, rawEventType: string) {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}

async function handleBlockadeSelection(row: number, col: number, playerKey: string) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'BLOCKADE_WILL',
        actionPayload: PendingCoordinator.buildPendingSelectionTargetPayload('BLOCKADE_WILL', row, col),
        invalidMessage: '封鎖する空きマスを選んでください',
        validateResult: ({ result }: { result: any }) => wasSelectionApplied(result, 'blockade_selected'),
        buildPlaybackMeta: () => ({ cause: 'BLOCKADE_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleBlockadeSelection };
}

export {};
