declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file board-expansion.js
 * @description Board Expansion Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');
const PendingCoordinator = _require('../turn/pending-coordinator');

function isBoardExpansionSelectionApplied(result: any) {
    const rawEvents = result && Array.isArray(result.rawEvents) ? result.rawEvents : [];
    const firstSelected = rawEvents.find((event: any) => event && event.type === 'board_expansion_first_selected' && event.applied);
    const selected = rawEvents.find((event: any) => event && event.type === 'board_expansion_selected' && event.applied && event.completed !== false);
    return !!(firstSelected || selected);
}

async function handleBoardExpansionSelection(row: number, col: number, playerKey: string) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingTypes: ['BOARD_EXPANSION_WILL', 'BOARD_EXPANSION_GOD'],
        actionPayload: PendingCoordinator.buildPendingSelectionTargetPayload(['BOARD_EXPANSION_WILL', 'BOARD_EXPANSION_GOD'], row, col),
        invalidMessage: ({ pendingType }: { pendingType: any }) => pendingType === 'BOARD_EXPANSION_GOD'
            ? '角マスを選んで盤面を拡張してください'
            : '左右端マスを選んで盤面を拡張してください',
        validateResult: ({ result }: { result: any }) => isBoardExpansionSelectionApplied(result),
        buildPlaybackMeta: ({ pendingType }: { pendingType: any }) => ({ cause: pendingType, target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleBoardExpansionSelection };
}

export {};
