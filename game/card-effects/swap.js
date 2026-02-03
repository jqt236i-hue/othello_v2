/**
 * @file swap.js
 * @description Swap With Enemy card handlers
 */

async function handleSwapSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;

    try {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'SWAP_WITH_ENEMY' || pending.stage !== 'selectTarget') return;

        // The stone at (row, col) will be swapped. 
        // In Swap logic, the enemy stone at (row, col) usually changes color to current player.
        const newColor = playerKey === 'black' ? 1 : -1;

        const ok = CardLogic.applySwapEffect(cardState, gameState, playerKey, row, col);
        if (!ok) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.swapSelectPrompt());
            return;
        }

        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.swapApplied(playerKey === 'black' ? '黒' : '白', posToNotation(row, col)));

        // Visuals are driven by presentationEvents populated by BoardOps.changeAt.
        // UI should observe presentationEvents and perform crossfade animations there.
        if (typeof emitCardStateChange === 'function') emitCardStateChange();
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        if (typeof emitGameStateChange === 'function') emitGameStateChange();
    } finally {
        isProcessing = false;
        isCardAnimating = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleSwapSelection };
}
