declare const __non_webpack_require__: NodeRequire | undefined;
declare const LOG_MESSAGES: any;
declare const emitLogAdded: (...args: any[]) => void;
declare const posToNotation: (row: number, col: number) => string;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file capture.js
 * @description Capture Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');

function wasSelectionApplied(result: any, rawEventType: string): boolean {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}

async function handleCaptureSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'CAPTURE_WILL',
        actionPayload: { captureTarget: { row, col } },
        invalidMessage: () => LOG_MESSAGES.captureSelectPrompt(),
        validateResult: ({ result }: any) => wasSelectionApplied(result, 'capture_selected'),
        buildPlaybackMeta: () => ({ cause: 'CAPTURE_WILL', target: { row, col } }),
        afterStateChange: ({ result }: any) => {
            if (typeof emitLogAdded !== 'function') return;
            const rawEvent = result && Array.isArray(result.rawEvents)
                ? result.rawEvents.find((event: any) => event && event.type === 'capture_selected')
                : null;
            const cardName = rawEvent && rawEvent.capturedCardName ? rawEvent.capturedCardName : 'カード';
            emitLogAdded(LOG_MESSAGES.captureApplied(playerKey === 'black' ? '黒' : '白', posToNotation(row, col), cardName));
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleCaptureSelection };
}

export {};
