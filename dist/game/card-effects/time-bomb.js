"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file time-bomb.js
 * @description Time Bomb card handlers
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
function wasSelectionApplied(result, rawEventType) {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}
async function handleTimeBombSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'TIME_BOMB',
        actionPayload: { bombTarget: { row, col } },
        invalidMessage: '時限爆弾にする自分の石を選んでください',
        validateResult: ({ result }) => wasSelectionApplied(result, 'time_bomb_selected'),
        buildPlaybackMeta: () => ({ cause: 'TIME_BOMB', target: { row, col } })
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleTimeBombSelection };
}
//# sourceMappingURL=time-bomb.js.map