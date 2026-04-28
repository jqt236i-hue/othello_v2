// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file clone.js
 * @description Clone Will card handlers
 */

var PendingSelectionFlow;
if (typeof require === 'function') {
    try { PendingSelectionFlow = require('./selection-flow'); } catch (e) { /* ignore */ }
}
if (!PendingSelectionFlow && typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow) {
    PendingSelectionFlow = globalThis.PendingSelectionFlow;
}

function getCloneSelectedEvent(result, rawEventType) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === rawEventType)
        : null;
}

async function handleCloneLikeSelection(row, col, playerKey, config) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;

    const cfg = config || {};
    const pendingType = String(cfg.pendingType || 'CLONE_WILL');
    const actionTargetKey = String(cfg.actionTargetKey || 'cloneTarget');
    const selectedEventType = String(cfg.selectedEventType || 'clone_selected');
    const selectionFailLog = String(cfg.selectionFailLog || '周囲に空きがある自分の石を選んでください');
    const playbackCause = String(cfg.playbackCause || pendingType);
    const successLogBuilder = typeof cfg.successLogBuilder === 'function'
        ? cfg.successLogBuilder
        : ((spawnedCount) => `複製の意志: ${spawnedCount}個を生成`);

    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType,
        actionPayload: {
            [actionTargetKey]: { row, col }
        },
        invalidMessage: selectionFailLog,
        validateResult: ({ result }) => {
            const selected = getCloneSelectedEvent(result, selectedEventType);
            return !!(selected && selected.applied);
        },
        buildPlaybackMeta: () => ({ cause: playbackCause, target: { row, col } }),
        afterStateChange: ({ result }) => {
            const selected = getCloneSelectedEvent(result, selectedEventType);
            if (!selected || typeof emitLogAdded !== 'function') return;
            const spawnedCount = Array.isArray(selected.spawned) ? selected.spawned.length : 0;
            emitLogAdded(successLogBuilder(spawnedCount, selected));
        }
    });
}

async function handleCloneSelection(row, col, playerKey) {
    return handleCloneLikeSelection(row, col, playerKey, {
        pendingType: 'CLONE_WILL',
        actionTargetKey: 'cloneTarget',
        selectedEventType: 'clone_selected',
        selectionFailLog: '周囲に空きがある自分の石を選んでください',
        playbackCause: 'CLONE_WILL',
        successLogBuilder: (spawnedCount) => `複製の意志: ${spawnedCount}個を生成`
    });
}

async function handleSplitSelection(row, col, playerKey) {
    return handleCloneLikeSelection(row, col, playerKey, {
        pendingType: 'SPLIT_WILL',
        actionTargetKey: 'splitTarget',
        selectedEventType: 'split_selected',
        selectionFailLog: '周囲に空きがある自分の石を選んでください',
        playbackCause: 'SPLIT_WILL',
        successLogBuilder: (spawnedCount) => `分裂の意志: ${spawnedCount}個を生成（持続ターン半減）`
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleCloneSelection, handleSplitSelection };
}

export {};
