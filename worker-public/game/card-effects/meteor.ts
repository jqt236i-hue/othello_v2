declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file meteor.js
 * @description Meteor card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');

function wasSelectionApplied(result: any, rawEventType: string): boolean {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}

async function handleMeteorSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'METEOR_WILL',
        actionPayload: { meteorTarget: { row, col } },
        invalidMessage: '破壊するマスを選んでください',
        validateResult: ({ result }: any) => wasSelectionApplied(result, 'meteor_selected'),
        buildPlaybackMeta: () => ({ cause: 'METEOR_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleMeteorSelection };
}

export {};
