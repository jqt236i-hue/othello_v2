declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file trap.js
 * @description Trap Will card handlers
 */

let __uiImpl_trap: any = {};

function setUIImpl(obj: any): void {
    __uiImpl_trap = Object.assign({}, __uiImpl_trap || {}, obj || {});
}

const PendingSelectionFlow = _require('./selection-flow');

function getTrapSelectedEvent(result: any) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'trap_selected' && event.applied)
        : null;
}

async function handleTrapSelection(row: number, col: number, playerKey: string) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'TRAP_WILL',
        actionPayload: { trapTarget: { row, col } },
        invalidMessage: '罠石にする自分の石を選んでください',
        validateResult: ({ result }: any) => !!getTrapSelectedEvent(result),
        buildPlaybackMeta: () => ({ cause: 'TRAP_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleTrapSelection, setUIImpl };
}

export {};
