declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

declare function computeCpuAction(playerKey: PlayerKey): CpuAction | null | undefined;
declare let gameState: any;
declare const cardState: any;
declare const CardLogic: { applyCardUsage?: (cardState: any, gameState: any, playerKey: PlayerKey, cardId: any) => any } | undefined;
declare function applyPass(gameState: any): any;
declare function executeMove(move: any): any;
declare function clearExpiredProtections(player: any): void;
declare function processExpiredProtectionsAtTurnEnd(player: any): void;

type PlayerKey = 'black' | 'white';

type CpuAction =
    | { type: 'pass' }
    | { type: 'useCard'; cardId: any }
    | { type: 'move'; move: any };

interface CpuTurnHandler {
    processCpuTurn?: () => any;
    processAutoBlackTurn?: () => any;
}

// CPU行動制御モジュール
// CPUの思考と行動実行を担当

/**
 * CPU (白) のターン処理
 */
// Delegate CPU turn orchestration to game/cpu-turn-handler to centralize timers and UI side effects.
let cpuHandler: CpuTurnHandler | null = null;
if (typeof _require === 'function') {
    try { cpuHandler = _require('../game/cpu-turn-handler.js') as CpuTurnHandler; } catch (e) { /* handler not available */ }
}

function processCpuTurn() {
    if (cpuHandler && typeof cpuHandler.processCpuTurn === 'function') {
        return cpuHandler.processCpuTurn();
    }

    // Fallback (minimal, side-effect free as possible)
    return runFallbackCpuAction('white');
}

/**
 * 自動プレイ時の黒（プレイヤー側）のターン処理
 */
function processAutoBlackTurn() {
    if (cpuHandler && typeof cpuHandler.processAutoBlackTurn === 'function') {
        return cpuHandler.processAutoBlackTurn();
    }

    // Fallback minimal handling
    return runFallbackCpuAction('black');
}

function runFallbackCpuAction(playerKey: PlayerKey) {
    const safePlayerKey = playerKey === 'black' ? 'black' : 'white';
    const action = (typeof computeCpuAction === 'function') ? computeCpuAction(safePlayerKey) : null;
    if (!action) return;

    if (action.type === 'pass') {
        gameState = applyPass(gameState);
        clearExpiredProtectionsSafe(gameState.currentPlayer);
        return;
    }

    if (action.type === 'useCard') {
        const cardId = action.cardId;
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.applyCardUsage === 'function') {
            CardLogic.applyCardUsage(cardState, gameState, safePlayerKey, cardId);
        }
        return;
    }

    if (action.type === 'move') {
        const move = action.move;
        executeMove(move);
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
function clearExpiredProtectionsSafe(player: any) {
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

export {};
