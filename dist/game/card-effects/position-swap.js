"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file position-swap.js
 * @description Position Swap Will card handlers
 */
var PendingSelectionFlow;
if (typeof require === 'function') {
    try {
        PendingSelectionFlow = require('./selection-flow');
    }
    catch (e) { /* ignore */ }
}
if (!PendingSelectionFlow && typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow) {
    PendingSelectionFlow = globalThis.PendingSelectionFlow;
}
function getPositionSwapFirstSelectedEvent(result) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === 'position_swap_first_selected')
        : null;
}
function getPositionSwapCompletedEvent(result) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === 'position_swap_selected' && event.applied && event.completed)
        : null;
}
async function handlePositionSwapSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'POSITION_SWAP_WILL',
        actionPayload: { positionSwapTarget: { row, col } },
        invalidMessage: '入替対象の石を選んでください',
        validateResult: ({ result }) => !!(getPositionSwapFirstSelectedEvent(result) || getPositionSwapCompletedEvent(result)),
        buildPlaybackMeta: () => ({ cause: 'POSITION_SWAP_WILL', target: { row, col } }),
        afterStateChange: ({ result }) => {
            if (typeof emitLogAdded !== 'function')
                return;
            const swapped = getPositionSwapCompletedEvent(result);
            if (swapped) {
                emitLogAdded(`${playerKey === 'black' ? '黒' : '白'}が入替の意志で${posToNotation(swapped.from.row, swapped.from.col)}と${posToNotation(swapped.to.row, swapped.to.col)}を入替`);
                return;
            }
            emitLogAdded('入替の意志: 2つ目の石を選んでください');
        }
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handlePositionSwapSelection };
}
//# sourceMappingURL=position-swap.js.map