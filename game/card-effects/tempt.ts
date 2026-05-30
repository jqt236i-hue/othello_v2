declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file tempt.js
 * @description Tempt Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');
const ControllerEvents = _require('../controller-events');
const LOG_MESSAGES = _require('../log-messages');
const GameControllerSlim = _require('../game-controller-slim');

function emitTemptLog(message: string): void {
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

async function handleTemptSelection(row: number, col: number, playerKey: string) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'TEMPT_WILL',
        actionPayload: { temptTarget: { row, col } },
        invalidMessage: () => LOG_MESSAGES.temptSelectPrompt(),
        validateResult: ({ result }: any) => wasSelectionApplied(result, 'tempt_selected'),
        buildPlaybackMeta: () => ({ cause: 'TEMPT_WILL', target: { row, col } }),
        afterStateChange: (context: any = {}) => {
            const result = context && context.result;
            const rawEvent = result && Array.isArray(result.rawEvents)
                ? result.rawEvents.find((event: any) => event && event.type === 'tempt_selected')
                : null;
            if (rawEvent && rawEvent.blockedByGhost) {
                const blockedMessage = LOG_MESSAGES && typeof LOG_MESSAGES.temptGhostBlocked === 'function'
                    ? LOG_MESSAGES.temptGhostBlocked(playerKey === 'black' ? '黒' : '白', posToNotation(row, col))
                    : `${playerKey === 'black' ? '黒' : '白'}が誘惑の意志を使ったが幽体に受け流された`;
                emitTemptLog(blockedMessage);
                return;
            }
            emitTemptLog(LOG_MESSAGES.temptApplied(playerKey === 'black' ? '黒' : '白', posToNotation(row, col)));
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleTemptSelection };
}

export {};
