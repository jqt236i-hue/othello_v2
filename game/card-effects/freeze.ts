// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file freeze.js
 * @description Freeze Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');

function wasSelectionApplied(result, rawEventType) {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}

async function handleFreezeSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'FREEZE_WILL',
        actionPayload: { freezeTarget: { row, col } },
        invalidMessage: '凍結するマスを選んでください',
        validateResult: ({ result }) => wasSelectionApplied(result, 'freeze_selected'),
        buildPlaybackMeta: () => ({ cause: 'FREEZE_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleFreezeSelection };
}

export {};
