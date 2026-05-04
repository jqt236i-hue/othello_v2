declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file hyperactive-inherit.js
 * @description 多動の継承 (HYPERACTIVE_INHERIT_WILL) UI handler
 */

const PendingSelectionFlow = _require('./selection-flow');

function wasSelectionApplied(result: any, rawEventType: string): boolean {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === rawEventType)
        : null;
    return !!(selected && selected.applied);
}

async function handleHyperactiveInheritSelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'HYPERACTIVE_INHERIT_WILL',
        actionPayload: { hyperactiveInheritTarget: { row, col } },
        invalidMessage: '多動を継承する自分の石を選んでください',
        validateResult: ({ result }: { result: any }) => wasSelectionApplied(result, 'hyperactive_inherit_selected'),
        buildPlaybackMeta: () => ({ cause: 'HYPERACTIVE_INHERIT_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleHyperactiveInheritSelection };
}

export {};
