declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file swap.js
 * @description Swap With Enemy card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');
declare const emitLogAdded: any;

function getSwapSelectedEvent(result: any) {
    return result && Array.isArray(result.rawEvents)
    ? result.rawEvents.find((event: any) => event && event.type === 'swap_selected' && event.swapped)
        : null;
}

function getSwapSelectionPrompt(): string {
    if (typeof LOG_MESSAGES !== 'undefined' && LOG_MESSAGES && typeof LOG_MESSAGES.swapSelectPrompt === 'function') {
        return LOG_MESSAGES.swapSelectPrompt();
    }
    return '交換する敵石を選んでください';
}

function emitSwapAppliedLog(playerKey: string, selected: any): void {
    if (typeof emitLogAdded !== 'function' || !selected) return;
    if (typeof LOG_MESSAGES !== 'undefined' && LOG_MESSAGES && typeof LOG_MESSAGES.swapApplied === 'function') {
        emitLogAdded(LOG_MESSAGES.swapApplied(playerKey === 'black' ? '黒' : '白', posToNotation(selected.row, selected.col), selected.withCard));
        return;
    }
    emitLogAdded(`${playerKey === 'black' ? '黒' : '白'}が${posToNotation(selected.row, selected.col)}と手札を交換`);
}

async function handleSwapSelection(row: number, col: number, playerKey: string) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'SWAP_WITH_ENEMY',
        actionPayload: { swapTarget: { row, col } },
        invalidMessage: getSwapSelectionPrompt,
        validateResult: ({ result }: any) => !!getSwapSelectedEvent(result),
        buildPlaybackMeta: () => ({ cause: 'SWAP_WITH_ENEMY', target: { row, col } }),
        afterStateChange: ({ result }: any) => {
            emitSwapAppliedLog(playerKey, getSwapSelectedEvent(result));
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleSwapSelection };
}

export {};
