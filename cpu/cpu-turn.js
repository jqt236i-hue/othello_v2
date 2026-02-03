// CPU行動制御モジュール
// CPUの思考と行動実行を担当

/**
 * CPU (白) のターン処理
 */
// Delegate CPU turn orchestration to game/cpu-turn-handler to centralize timers and UI side effects.
let cpuHandler = null;
if (typeof require === 'function') {
    try { cpuHandler = require('../game/cpu-turn-handler.js'); } catch (e) { /* handler not available */ }
}

function processCpuTurn() {
    if (cpuHandler && typeof cpuHandler.processCpuTurn === 'function') {
        return cpuHandler.processCpuTurn();
    }

    // Fallback (minimal, side-effect free as possible)
    const action = (typeof computeCpuAction === 'function') ? computeCpuAction('white') : null;
    if (!action) return;

    if (action.type === 'pass') {
        // minimal pass handling without UI/timers
        gameState = applyPass(gameState);
        clearExpiredProtectionsSafe(gameState.currentPlayer);
        return;
    }

    if (action.type === 'useCard') {
        const cardId = action.cardId;
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCardUsage === 'function') {
            CardLogic.applyCardUsage(cardState, gameState, 'white', cardId);
        }
        return;
    }

    if (action.type === 'move') {
        const move = action.move;
        // Execute move synchronously; UI orchestration should be handled by handler when available
        executeMove(move);
        return;
    }
}

/**
 * 自動プレイ時の黒（プレイヤー側）のターン処理
 */
function processAutoBlackTurn() {
    if (cpuHandler && typeof cpuHandler.processAutoBlackTurn === 'function') {
        return cpuHandler.processAutoBlackTurn();
    }

    // Fallback minimal handling
    const action = (typeof computeCpuAction === 'function') ? computeCpuAction('black') : null;
    if (!action) return;

    if (action.type === 'pass') {
        gameState = applyPass(gameState);
        clearExpiredProtectionsSafe(gameState.currentPlayer);
        return;
    }

    if (action.type === 'useCard') {
        const cardId = action.cardId;
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCardUsage === 'function') {
            CardLogic.applyCardUsage(cardState, gameState, 'black', cardId);
        }
        return;
    }

    if (action.type === 'move') {
        const move = action.move;
        executeMove(move);
        return;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { processCpuTurn, processAutoBlackTurn };
}

/**
 * Safely clear expired protections if the helper exists.
 * Some build targets may not bundle the protection module; avoid ReferenceError.
 */
function clearExpiredProtectionsSafe(player) {
    try {
        if (typeof clearExpiredProtections === 'function') {
            clearExpiredProtections(player);
        } else if (typeof processExpiredProtectionsAtTurnEnd === 'function') {
            // Fallback to newer handler name
            processExpiredProtectionsAtTurnEnd(player);
        }
    } catch (e) {
        console.warn('[CPU] clearExpiredProtectionsSafe failed', e);
    }
}
