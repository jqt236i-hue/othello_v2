declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

const PendingSelectionFlow = _require('./selection-flow');
const ControllerEvents = _require('../controller-events');

function emitReverseWillLog(message: string): void {
    if (ControllerEvents && typeof ControllerEvents.emitLogAdded === 'function') {
        ControllerEvents.emitLogAdded(message);
    }
}

function getReverseWillSelectedEvent(result: any): any {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'reverse_will_flipped')
        : null;
}

async function handleReverseWillSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;

    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'REVERSE_WILL',
        actionPayload: { reverseWillTarget: { row, col } },
        invalidMessage: '反転できる石を選んでください',
        validateResult: ({ result }: any) => {
            const selected = getReverseWillSelectedEvent(result);
            return !!(selected && selected.applied);
        },
        buildPlaybackMeta: () => ({ cause: 'REVERSE_WILL', target: { row, col } }),
        afterStateChange: ({ result }: any) => {
            const selected = getReverseWillSelectedEvent(result);
            if (!selected) return;
            const count = Array.isArray(selected.details) ? selected.details.length : 0;
            if (count <= 0 && selected.blockedByGhost === true) {
                emitReverseWillLog('反転の意志: 幽体に受け流された（0枚反転）');
                return;
            }
            emitReverseWillLog(`反転の意志: ${count}枚反転`);
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleReverseWillSelection };
}

export {};
