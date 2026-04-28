"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file extend-life.js
 * @description 延命系カード UI handler — selection -> pipeline adapter
 */
var PendingSelectionFlow;
if (typeof require === 'function') {
    try {
        PendingSelectionFlow = require('./selection-flow');
    }
    catch (e) { /* ignore */ }
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
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingTypes: ['EXTEND_LIFE_WILL', 'EXTEND_LIFE_GOD'],
        actionPayload: { extendTarget: { row, col } },
        invalidMessage: ({ pendingType }) => pendingType === 'EXTEND_LIFE_GOD'
            ? '延命神の対象となる自分の特殊石を選んでください'
            : '延命の対象となる自分の特殊石を選んでください',
        validateResult: ({ result }) => {
            const selected = getExtendLifeSelectedEvent(result);
            return !!(selected && selected.applied);
        },
        buildPlaybackMeta: ({ pendingType }) => ({ cause: pendingType, target: { row, col } })
    });
}
async function handleCorrosionSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
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
//# sourceMappingURL=extend-life.js.map