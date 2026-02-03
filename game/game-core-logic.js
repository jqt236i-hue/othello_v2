// game-core-logic.js
// Wrapper for CoreLogic (Shared between Browser and Headless)
// This file maintains the legacy global function interface for browser compatibility.

// Check if CoreLogic is loaded
if (typeof CoreLogic === 'undefined') {
    console.error('CoreLogic is not loaded. Please include game/logic/core.js');
}

// ===== Game State Management =====

function createGameState() {
    return CoreLogic.createGameState();
}

function copyGameState(state) {
    return CoreLogic.copyGameState(state);
}

// ===== Move Logic =====

// Legacy signature support: splits context params into arguments and global lookups
function getFlips(state, row, col, player, protectedStones, permaProtectedStones) {
    // Prefer centralized helper to obtain card-related context when available
    let context = null;
    try {
        const ctxHelper = (typeof require === 'function') ? require('./logic/context') : (typeof globalThis !== 'undefined' ? globalThis.GameLogicContext : null);
        if (ctxHelper && typeof ctxHelper.getSafeCardContext === 'function') {
            context = ctxHelper.getSafeCardContext(typeof cardState !== 'undefined' ? cardState : undefined, protectedStones, permaProtectedStones);
        }
    } catch (e) { /* ignore and fallback */ }

    if (!context) {
        try {
            if (typeof CardLogic !== 'undefined' && typeof CardLogic.getCardContext === 'function' && typeof cardState !== 'undefined') {
                context = CardLogic.getCardContext(cardState);
            }
        } catch (e) { /* ignore */ }
    }

    if (!context) {
        const bombMarkers = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function' && typeof cardState !== 'undefined')
            ? MarkersAdapter.getBombMarkers(cardState).map(m => ({
                row: m.row,
                col: m.col,
                remainingTurns: m.data ? m.data.remainingTurns : undefined,
                owner: m.owner,
                placedTurn: m.data ? m.data.placedTurn : undefined,
                createdSeq: m.createdSeq
            }))
            : [];
        context = {
            protectedStones: protectedStones || [],
            permaProtectedStones: permaProtectedStones || [],
            bombs: bombMarkers
        };
    }

    return CoreLogic.getFlipsWithContext(state, row, col, player, context);
}

function applyMove(state, move) {
    return CoreLogic.applyMove(state, move);
}

function applyPass(state) {
    const newState = CoreLogic.applyPass(state);

    // Maintain logging side-effect
    if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
        debugLog(`[MOVE] Pass applied`, 'debug', {
            passedPlayer: state.currentPlayer === 1 ? 'black' : 'white',
            nextPlayer: newState.currentPlayer === 1 ? 'black' : 'white',
            consecutivePasses: newState.consecutivePasses
        });
    }

    return newState;
}

function isGameOver(state) {
    return CoreLogic.isGameOver(state);
}

function countDiscs(state) {
    return CoreLogic.countDiscs(state);
}
