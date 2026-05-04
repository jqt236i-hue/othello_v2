declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

// Globals injected at runtime by browser scripts
declare const CoreLogic: any;
declare const CardLogic: any;
declare const MarkersAdapter: any;
declare const cardState: any;
declare function isDebugLogAvailable(): boolean;
declare function debugLog(message: string, level: string, meta: any): void;

// game-core-logic.js
// Wrapper for CoreLogic (Shared between Browser and Headless)
// This file maintains the legacy global function interface for browser compatibility.

// Check if CoreLogic is loaded
if (typeof CoreLogic === 'undefined') {
    console.error('CoreLogic is not loaded. Please include game/logic/core.js');
}

// ===== Game State Management =====

function createGameState(boardConfig: any): any {
    return CoreLogic.createGameState(boardConfig);
}

function copyGameState(state: any): any {
    return CoreLogic.copyGameState(state);
}

// ===== Move Logic =====

// Legacy signature support: splits context params into arguments and global lookups
function getFlips(state: any, row: any, col: any, player: any, protectedStones: any, permaProtectedStones: any): any {
    // Prefer centralized helper to obtain card-related context when available
    let context: any = null;
    try {
        const ctxHelper = (typeof require === 'function') ? require('./logic/context') : (typeof globalThis !== 'undefined' ? (globalThis as any).GameLogicContext : null);
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
            ? MarkersAdapter.getBombMarkers(cardState).map((m: any) => ({
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

function applyMove(state: any, move: any): any {
    return CoreLogic.applyMove(state, move);
}

function applyPass(state: any): any {
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

function isGameOver(state: any): any {
    return CoreLogic.isGameOver(state);
}

function countDiscs(state: any): any {
    return CoreLogic.countDiscs(state);
}

export {};
