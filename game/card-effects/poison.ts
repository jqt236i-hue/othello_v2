declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined') ? __non_webpack_require__ : require;
const PendingSelectionFlow = _require('./selection-flow');
const PendingCoordinator = _require('../turn/pending-coordinator');

function wasSelectionApplied(result: any): boolean {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'poison_selected')
        : null;
    return !!(selected && selected.applied);
}

async function handlePoisonSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'POISON_WILL',
        actionPayload: PendingCoordinator.buildPendingSelectionTargetPayload('POISON_WILL', row, col),
        invalidMessage: '毒マスにするマスを選んでください',
        validateResult: ({ result }: any) => wasSelectionApplied(result),
        buildPlaybackMeta: () => ({ cause: 'POISON_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { handlePoisonSelection };
export {};
