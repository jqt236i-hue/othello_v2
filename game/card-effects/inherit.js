/**
 * @file inherit.js
 * @description Inherit Will card handlers
 */

async function handleInheritSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const res = CardLogic.applyInheritWill(cardState, gameState, playerKey, row, col);
        if (!res || !res.applied) {
            if (typeof emitLogAdded === 'function') emitLogAdded(res && res.reason ? res.reason : LOG_MESSAGES.normalStoneSelectPrompt());
            return;
        }

        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.inheritApplied(playerKey === 'black' ? '黒' : '白', posToNotation(row, col)));
        if (typeof emitCardStateChange === 'function') emitCardStateChange();

        // Visuals are handled by presentationEvents (BoardOps); just trigger updates
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
    module.exports = { handleInheritSelection };
}
