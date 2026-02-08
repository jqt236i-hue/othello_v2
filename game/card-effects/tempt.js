/**
 * @file tempt.js
 * @description Tempt Will card handlers
 */

async function handleTemptSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'TEMPT_WILL' || pending.stage !== 'selectTarget') return;

        // Get info of the stone being tempted BEFORE logic clears it or changes it
        const marker = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.findSpecialMarkerAt === 'function')
            ? MarkersAdapter.findSpecialMarkerAt(cardState, row, col)
            : (cardState.markers || []).find(m => m.kind === 'specialStone' && m.row === row && m.col === col);
        if (!marker || !marker.data) return;
        const effectKey = getEffectKeyForType(marker.data.type);
        const newColor = playerKey === 'black' ? 1 : -1;

        const res = CardLogic.applyTemptWill(cardState, gameState, playerKey, row, col);
        if (!res || !res.applied) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.temptSelectPrompt());
            return;
        }

        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.temptApplied(playerKey === 'black' ? '黒' : '白', posToNotation(row, col)));

        // Visuals are driven by presentationEvents populated by BoardOps/changeAt. UI should
        // perform crossfade animations. Just trigger update hooks here.
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
    module.exports = { handleTemptSelection };
}
