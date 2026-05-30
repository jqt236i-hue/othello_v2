declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file capture.js
 * @description Capture Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');
const ControllerEvents = _require('../controller-events');
const LOG_MESSAGES = _require('../log-messages');
const GameControllerSlim = _require('../game-controller-slim');

function emitCaptureLog(message: string): void {
    if (ControllerEvents && typeof ControllerEvents.emitLogAdded === 'function') {
        ControllerEvents.emitLogAdded(message);
    }
}

function posToNotation(row: number, col: number): string {
    return GameControllerSlim && typeof GameControllerSlim.posToNotation === 'function'
        ? GameControllerSlim.posToNotation(row, col)
        : `${row},${col}`;
}

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
        afterStateChange: (context: any = {}) => {
            const result = context && context.result;
            const rawEvent = result && Array.isArray(result.rawEvents)
                ? result.rawEvents.find((event: any) => event && event.type === 'capture_selected')
                : null;
            if (rawEvent && rawEvent.blockedByGhost) {
                const blockedMessage = LOG_MESSAGES && typeof LOG_MESSAGES.captureGhostBlocked === 'function'
                    ? LOG_MESSAGES.captureGhostBlocked(playerKey === 'black' ? '黒' : '白', posToNotation(row, col))
                    : `${playerKey === 'black' ? '黒' : '白'}が捕獲の意志を使ったが幽体に受け流された`;
                emitCaptureLog(blockedMessage);
                return;
            }
            const cardName = rawEvent && rawEvent.capturedCardName ? rawEvent.capturedCardName : 'カード';
            emitCaptureLog(LOG_MESSAGES.captureApplied(playerKey === 'black' ? '黒' : '白', posToNotation(row, col), cardName));
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleCaptureSelection };
}

export {};
