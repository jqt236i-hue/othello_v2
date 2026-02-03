/**
 * @file inherit.js
 * @description Inherit Will card handlers
 */

async function handleInheritSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;

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
    } finally {
        isProcessing = false;
        isCardAnimating = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleInheritSelection };
}
