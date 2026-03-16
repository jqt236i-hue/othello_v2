/**
 * @file trap.js
 * @description Trap Will card handlers
 */

let __uiImpl_trap = {};

function setUIImpl(obj) {
    __uiImpl_trap = Object.assign({}, __uiImpl_trap || {}, obj || {});
}

function playTrapPlacementFlashViaUI(row, col, playerKey) {
    try {
        if (__uiImpl_trap && typeof __uiImpl_trap.playTrapPlacementFlash === 'function') {
            __uiImpl_trap.playTrapPlacementFlash(row, col, playerKey);
            return;
        }
    } catch (e) { /* ignore */ }
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.__uiImpl_trap &&
            typeof globalThis.__uiImpl_trap.playTrapPlacementFlash === 'function'
        ) {
            globalThis.__uiImpl_trap.playTrapPlacementFlash(row, col, playerKey);
        }
    } catch (e) { /* ignore */ }
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
        buildPlaybackMeta: () => ({ cause: 'TRAP_WILL', target: { row, col } }),
        afterStateChange: () => {
            playTrapPlacementFlashViaUI(row, col, playerKey);
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleTrapSelection, setUIImpl };
}
