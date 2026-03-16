/**
 * @file sacrifice.js
 * @description Sacrifice Will card handlers
 */

var PendingSelectionFlow;
if (typeof require === 'function') {
    try { PendingSelectionFlow = require('./selection-flow'); } catch (e) { /* ignore */ }
}
if (!PendingSelectionFlow && typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow) {
    PendingSelectionFlow = globalThis.PendingSelectionFlow;
}

function getSacrificeSelectedEvent(result) {
    return result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === 'sacrifice_selected')
        : null;
}

async function handleSacrificeSelection(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'SACRIFICE_WILL',
        actionPayload: { sacrificeTarget: { row, col } },
        invalidMessage: '自分の石を選んでください',
        validateResult: ({ result }) => {
            const selected = getSacrificeSelectedEvent(result);
            return !!(selected && selected.applied);
        },
        buildPlaybackMeta: () => ({ cause: 'SACRIFICE_WILL', target: { row, col } }),
        afterStateChange: ({ result, cardState }) => {
            if (typeof emitLogAdded !== 'function') return;
            const selected = getSacrificeSelectedEvent(result);
            if (!selected) return;
            const playerLabel = playerKey === 'black' ? '黒' : '白';
            emitLogAdded(`${playerLabel}が生贄の意志で ${posToNotation(row, col)} を破壊（+${selected.gained || 0}）`);
            if (selected.completed) {
                emitLogAdded(`${playerLabel}の生贄の意志を終了`);
                return;
            }
            const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
            if (pending && pending.type === 'SACRIFICE_WILL') {
                const remain = Math.max(0, (pending.maxSelections || 3) - (pending.selectedCount || 0));
                emitLogAdded(`生贄の意志: あと${remain}回選択できます`);
            }
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleSacrificeSelection };
}
