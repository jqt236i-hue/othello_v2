/**
 * @file capture.js
 * @description Capture Will card handlers
 */

var PendingSelectionFlow;
if (typeof require === 'function') {
    try { PendingSelectionFlow = require('./selection-flow'); } catch (e) { /* ignore */ }
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

async function handleCaptureSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'CAPTURE_WILL',
        actionPayload: { captureTarget: { row, col } },
        invalidMessage: () => LOG_MESSAGES.captureSelectPrompt(),
        validateResult: ({ result }) => wasSelectionApplied(result, 'capture_selected'),
        buildPlaybackMeta: () => ({ cause: 'CAPTURE_WILL', target: { row, col } }),
        afterStateChange: ({ result }) => {
            if (typeof emitLogAdded !== 'function') return;
            const rawEvent = result && Array.isArray(result.rawEvents)
                ? result.rawEvents.find((event) => event && event.type === 'capture_selected')
                : null;
            const cardName = rawEvent && rawEvent.capturedCardName ? rawEvent.capturedCardName : 'カード';
            emitLogAdded(LOG_MESSAGES.captureApplied(playerKey === 'black' ? '黒' : '白', posToNotation(row, col), cardName));
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleCaptureSelection };
}
