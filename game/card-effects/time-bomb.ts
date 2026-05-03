// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file time-bomb.js
 * @description Time Bomb card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');

function wasSelectionApplied(result, rawEventType) {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}

async function handleTimeBombSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
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

export {};
