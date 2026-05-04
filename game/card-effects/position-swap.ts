declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

declare function emitLogAdded(message: any, kind?: string): void;
declare function posToNotation(row: number, col: number): string;

/**
 * @file position-swap.js
 * @description Position Swap Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');

function getPositionSwapFirstSelectedEvent(result: any) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'position_swap_first_selected')
        : null;
}

function getPositionSwapCompletedEvent(result: any) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'position_swap_selected' && event.applied && event.completed)
        : null;
}

async function handlePositionSwapSelection(row: number, col: number, playerKey: string) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'POSITION_SWAP_WILL',
        actionPayload: { positionSwapTarget: { row, col } },
        invalidMessage: '入替対象の石を選んでください',
        validateResult: ({ result }: { result: any }) => !!(getPositionSwapFirstSelectedEvent(result) || getPositionSwapCompletedEvent(result)),
        buildPlaybackMeta: () => ({ cause: 'POSITION_SWAP_WILL', target: { row, col } }),
        afterStateChange: ({ result }: { result: any }) => {
            if (typeof emitLogAdded !== 'function') return;
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

export {};
