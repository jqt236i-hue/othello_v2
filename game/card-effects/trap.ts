// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file trap.js
 * @description Trap Will card handlers
 */

let __uiImpl_trap = {};

function setUIImpl(obj) {
    __uiImpl_trap = Object.assign({}, __uiImpl_trap || {}, obj || {});
}

var PendingSelectionFlow;
if (typeof require === 'function') {
    try { PendingSelectionFlow = require('./selection-flow'); } catch (e) { /* ignore */ }
}
if (!PendingSelectionFlow && typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow) {
    PendingSelectionFlow = globalThis.PendingSelectionFlow;
}

function getTrapSelectedEvent(result) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === 'trap_selected' && event.applied)
        : null;
}

async function handleTrapSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'TRAP_WILL',
        actionPayload: { trapTarget: { row, col } },
        invalidMessage: '罠石にする自分の石を選んでください',
        validateResult: ({ result }) => !!getTrapSelectedEvent(result),
        buildPlaybackMeta: () => ({ cause: 'TRAP_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleTrapSelection, setUIImpl };
}

export {};
