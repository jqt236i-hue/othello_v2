declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

// Globals injected at runtime by browser scripts
declare const CoreLogic: any;
declare const CardLogic: any;
declare const MarkersAdapter: any;
declare const cardState: any;

// game-core-logic.js
// Wrapper for CoreLogic (Shared between Browser and Headless)
// This file maintains the legacy global function interface for browser compatibility.

let __uiImpl_game_core_logic: any = {};

function setUIImpl(obj: any): void {
    __uiImpl_game_core_logic = (obj && typeof obj === 'object') ? obj : {};
}

function isGameCoreDebugLogAvailable(): boolean {
    try {
        return __uiImpl_game_core_logic
            && typeof __uiImpl_game_core_logic.isDebugLogAvailable === 'function'
            && __uiImpl_game_core_logic.isDebugLogAvailable() === true;
    } catch (e: any) { /* ignore */ }
    return false;
}

function emitGameCoreDebugLog(message: string, level: string, meta: any): void {
    if (!isGameCoreDebugLogAvailable()) return;
    try {
        if (__uiImpl_game_core_logic && typeof __uiImpl_game_core_logic.debugLog === 'function') {
            __uiImpl_game_core_logic.debugLog(message, level, meta);
        }
    } catch (e: any) { /* ignore */ }
}

function requireGameCoreLogicModuleOrNull(id: string): any {
    if (typeof _require !== 'function') return null;
    try {
        return _require(id);
    } catch (e: any) {
        /* ignore */
    }
    return null;
}

const GameCoreLogicCore = (() => {
    try {
        if (typeof CoreLogic !== 'undefined' && CoreLogic) return CoreLogic;
    } catch (e: any) { /* ignore */ }
    return requireGameCoreLogicModuleOrNull('./logic/core');
})();

// Check if CoreLogic is loaded
if (!GameCoreLogicCore) {
    console.error('CoreLogic is not loaded. Please include game/logic/core.js');
}

// ===== Game State Management =====

function createGameState(boardConfig: any) {
    return GameCoreLogicCore.createGameState(boardConfig);
}

function copyGameState(state: any) {
    return GameCoreLogicCore.copyGameState(state);
}

// ===== Move Logic =====

// Legacy signature support: splits context params into arguments and global lookups
function getFlips(state: any, row: any, col: any, player: any, protectedStones: any, permaProtectedStones: any) {
    // Prefer centralized helper to obtain card-related context when available
    let context: any = null;
    try {
        const ctxHelper = (typeof require === 'function') ? require('./logic/context') : null;
        if (ctxHelper && typeof ctxHelper.getSafeCardContext === 'function') {
            context = ctxHelper.getSafeCardContext(typeof cardState !== 'undefined' ? cardState : undefined, protectedStones, permaProtectedStones);
        }
    } catch (e: any) { /* ignore and fallback */ }

    if (!context) {
        try {
            if (typeof CardLogic !== 'undefined' && typeof CardLogic.getCardContext === 'function' && typeof cardState !== 'undefined') {
                context = CardLogic.getCardContext(cardState);
            }
        } catch (e: any) { /* ignore */ }
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

    return GameCoreLogicCore.getFlipsWithContext(state, row, col, player, context);
}

function applyMove(state: any, move: any) {
    return GameCoreLogicCore.applyMove(state, move);
}

function applyPass(state: any) {
    const newState = GameCoreLogicCore.applyPass(state);

    // Maintain logging side-effect
    emitGameCoreDebugLog(`[MOVE] Pass applied`, 'debug', {
        passedPlayer: state.currentPlayer === 1 ? 'black' : 'white',
        nextPlayer: newState.currentPlayer === 1 ? 'black' : 'white',
        consecutivePasses: newState.consecutivePasses
    });

    return newState;
}

function isGameOver(state: any) {
    return GameCoreLogicCore.isGameOver(state);
}

function countDiscs(state: any) {
    return GameCoreLogicCore.countDiscs(state);
}

export = {
    setUIImpl,
    createGameState,
    copyGameState,
    getFlips,
    applyMove,
    applyPass,
    isGameOver,
    countDiscs
};
