/**
 * @file extend-life.js
 * @description 延命の意志 (EXTEND_LIFE_WILL) UI handler — selection -> pipeline adapter
 */

var PendingSelectionFlow;
if (typeof require === 'function') {
    try { PendingSelectionFlow = require('./selection-flow'); } catch (e) { /* ignore */ }
}
if (!PendingSelectionFlow && typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow) {
    PendingSelectionFlow = globalThis.PendingSelectionFlow;
}

function getExtendLifeSelectedEvent(result) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === 'extend_life_selected')
        : null;
}

function getCorrosionResolvedEvent(result) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === 'corrosion_will_resolved')
        : null;
}

async function handleExtendLifeSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'EXTEND_LIFE_WILL',
        actionPayload: { extendTarget: { row, col } },
        invalidMessage: '延命の対象となる自分の特殊石を選んでください',
        validateResult: ({ result }) => {
            const selected = getExtendLifeSelectedEvent(result);
            return !!(selected && selected.applied);
        },
        buildPlaybackMeta: () => ({ cause: 'EXTEND_LIFE_WILL', target: { row, col } })
    });
}

async function handleCorrosionSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'CORROSION_WILL',
        actionPayload: { corrosionTarget: { row, col } },
        invalidMessage: '腐食の対象となる特殊石を選んでください',
        validateResult: ({ result }) => {
            const resolved = getCorrosionResolvedEvent(result);
            return !!(resolved && Number(resolved.affectedCount) > 0);
        },
        buildPlaybackMeta: () => ({ cause: 'CORROSION_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleExtendLifeSelection, handleCorrosionSelection };
}
