/**
 * @file sacrifice.js
 * @description Sacrifice Will card handlers
 */

async function handleSacrificeSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const res = CardLogic.applySacrificeWill(cardState, gameState, playerKey, row, col);
        if (!res || !res.applied) {
            if (typeof emitLogAdded === 'function') emitLogAdded(res && res.reason ? res.reason : '自分の石を選んでください');
            return;
        }

        const playerLabel = playerKey === 'black' ? '黒' : '白';
        if (typeof emitLogAdded === 'function') {
            emitLogAdded(`${playerLabel}が生贄の意志で ${posToNotation(row, col)} を破壊（+${res.gained || 0}）`);
            if (res.completed) {
                emitLogAdded(`${playerLabel}の生贄の意志を終了`);
            } else {
                const remain = Math.max(0, (res.maxSelections || 3) - (res.selectedCount || 0));
                emitLogAdded(`生贄の意志: あと${remain}回選択できます`);
            }
        }

        if (typeof emitCardStateChange === 'function') emitCardStateChange();
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        if (typeof emitGameStateChange === 'function') emitGameStateChange();
        shouldCheckAutoPass = true;
    } finally {
        isProcessing = false;
        isCardAnimating = false;
        if (shouldCheckAutoPass && typeof ensureCurrentPlayerCanActOrPass === 'function') {
            try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (e) { /* ignore */ }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleSacrificeSelection };
}
