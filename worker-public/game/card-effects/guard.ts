declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file guard.js
 * @description Guard Will card handlers
 */

const PendingSelectionFlow = _require('./selection-flow');

function wasSelectionApplied(result: any, rawEventType: string): boolean {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}

async function handleGuardSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingTypes: ['GUARD_WILL', 'GUARDIAN_GOD'],
        actionPayload: { guardTarget: { row, col } },
        invalidMessage: '守る石にする自分の石を選んでください',
        validateResult: ({ result }: any) => wasSelectionApplied(result, 'guard_selected'),
        buildPlaybackMeta: ({ pendingType }: any) => ({ cause: pendingType, target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleGuardSelection };
}

export {};
