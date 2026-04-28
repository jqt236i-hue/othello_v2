"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file tempt.js
 * @description Tempt Will card handlers
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
async function handleTemptSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'TEMPT_WILL',
        actionPayload: { temptTarget: { row, col } },
        invalidMessage: () => LOG_MESSAGES.temptSelectPrompt(),
        validateResult: ({ result }) => wasSelectionApplied(result, 'tempt_selected'),
        buildPlaybackMeta: () => ({ cause: 'TEMPT_WILL', target: { row, col } }),
        afterStateChange: () => {
            if (typeof emitLogAdded !== 'function')
                return;
            emitLogAdded(LOG_MESSAGES.temptApplied(playerKey === 'black' ? '黒' : '白', posToNotation(row, col)));
        }
    });
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleTemptSelection };
}
//# sourceMappingURL=tempt.js.map