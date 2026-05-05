"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file board-shrink.js
 * @description Board Shrink card handlers
 */
const PendingSelectionFlow = _require('./selection-flow');
function wasBoardShrinkSelectionApplied(result) {
    const rawEvents = result && Array.isArray(result.rawEvents) ? result.rawEvents : [];
    return rawEvents.some((event) => event && event.type === 'board_shrink_selected' && event.applied);
}
async function handleBoardShrinkSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingTypes: ['BOARD_SHRINK_WILL', 'BOARD_SHRINK_GOD'],
        actionPayload: { shrinkTarget: { row, col } },
        invalidMessage: ({ pendingType, pending }) => {
            if (pendingType === 'BOARD_SHRINK_GOD') {
                return pending && pending.firstTarget
                    ? '角から伸ばす辺方向を選んでください'
                    : '縮小する辺の角マスを選んでください';
            }
            return '外周のマスを3つ選んで盤面を縮小してください';
        },
        validateResult: ({ result }) => wasBoardShrinkSelectionApplied(result),
        buildPlaybackMeta: ({ pendingType, pending }) => ({
            cause: pendingType,
            target: { row, col },
            firstTarget: pending && pending.firstTarget
                ? { row: pending.firstTarget.row, col: pending.firstTarget.col }
                : null
        })
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleBoardShrinkSelection };
}
//# sourceMappingURL=board-shrink.js.map