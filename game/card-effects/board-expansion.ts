// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file board-expansion.js
 * @description Board Expansion Will card handlers
 */

var PendingSelectionFlow;
if (typeof require === 'function') {
    try { PendingSelectionFlow = require('./selection-flow'); } catch (e) { /* ignore */ }
}
if (!PendingSelectionFlow && typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow) {
    PendingSelectionFlow = globalThis.PendingSelectionFlow;
}

function isBoardExpansionSelectionApplied(result) {
    const rawEvents = result && Array.isArray(result.rawEvents) ? result.rawEvents : [];
    const firstSelected = rawEvents.find((event) => event && event.type === 'board_expansion_first_selected' && event.applied);
    const selected = rawEvents.find((event) => event && event.type === 'board_expansion_selected' && event.applied && event.completed !== false);
    return !!(firstSelected || selected);
}

async function handleBoardExpansionSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingTypes: ['BOARD_EXPANSION_WILL', 'BOARD_EXPANSION_GOD'],
        actionPayload: { expansionTarget: { row, col } },
        invalidMessage: ({ pendingType }) => pendingType === 'BOARD_EXPANSION_GOD'
            ? '角マスを選んで盤面を拡張してください'
            : '左右端マスを選んで盤面を拡張してください',
        validateResult: ({ result }) => isBoardExpansionSelectionApplied(result),
        buildPlaybackMeta: ({ pendingType }) => ({ cause: pendingType, target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleBoardExpansionSelection };
}

export {};
