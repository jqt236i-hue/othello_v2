/**
 * @file game-controller-slim.js
 * @description ゲームコントローラーのコアモジュール（スリム版）
 * Core game controller orchestrating all modules
 * 
 * このファイルは他のモジュールを統合し、グローバルAPIを提供します。
 * Integrates all modules and provides global game API
 */

// ===== Constants & Type Mappings =====
const CARD_TYPE_BY_ID = CARD_DEFS.reduce((acc, c) => {
    acc[c.id] = c.type;
    return acc;
}, {});

// ===== Utility Functions =====

/**
 * 座標を表記法に変換
 * Convert coordinates to algebraic notation (e.g., a1, h8)
 * @param {number} row - 行 (0-7)
 * @param {number} col - 列 (0-7)
 * @returns {string} 表記 (例: 'a1', 'h8')
 */
function posToNotation(row, col) {
    const cols = 'abcdefgh';
    return cols[col] + (row + 1);
}

// ===== Module Integration Note =====
// This controller relies on the following modules being loaded:
// - game/special-effects-handler.js  (processBombs, processUltimateReverseDragonsAtTurnStart, etc.)
// - game/card-effects-applier.js     (applyProtectionAfterMove, handleDestroySelection, etc.)
// - game/cpu-decision.js             (cpuMaybeUseCardWithPolicy, selectCpuMoveWithPolicy, etc.)
// - game/turn-manager.js             (executeMove, processCpuTurn, resetGame, etc.)
// - game/game-controller-core.js     (onTurnStart, emitBoardUpdate, etc.)
// - game/game-core-logic.js          (applyMove, getLegalMoves, isGameOver, etc.)
// - game/move-generator.js           (getFlips, getLegalMoves, etc.)

// ===== Event Emission Helpers =====
// (Already defined in game/controller-events.js, but referenced here for completeness)

// emitBoardUpdate()
// emitGameStateChange()  
// emitCardStateChange()
// emitStatusUpdate()

// ===== Initialization =====

/**
 * ゲーム初期化
 * Initialize game on page load
 */
function initializeGame() {
    // Ensure all required modules are loaded
    if (typeof createGameState === 'undefined') {
        console.error('[Game Controller] game-core-logic.js not loaded');
        return;
    }
    if (typeof processBombs === 'undefined') {
        console.error('[Game Controller] special-effects-handler.js not loaded');
        return;
    }
    if (typeof applyProtectionAfterMove === 'undefined') {
        console.error('[Game Controller] card-effects-applier.js not loaded');
        return;
    }
    if (typeof cpuMaybeUseCardWithPolicy === 'undefined') {
        console.error('[Game Controller] cpu-decision.js not loaded');
        return;
    }
    if (typeof executeMove === 'undefined') {
        console.error('[Game Controller] turn-manager.js not loaded');
        return;
    }
    
    console.log('[Game Controller] All modules loaded successfully');
    
    // Initialize game state (UI should not be relied on for global state)
    if (typeof gameState === 'undefined') {
        gameState = createGameState();
    }

    // Load MCCFR policy if available and store locally
    if (typeof CpuPolicy !== 'undefined' && typeof CpuPolicy.loadPolicyForLevel === 'function') {
        CpuPolicy.loadPolicyForLevel(1)
            .then(policy => {
                mccfrPolicy = policy;
                console.log('[Game Controller] MCCFR policy loaded');
            })
            .catch(err => {
                console.warn('[Game Controller] Failed to load MCCFR policy:', err);
            });
    }
}

// ===== Exports (for potential module usage) =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeGame,
        posToNotation,
        CARD_TYPE_BY_ID
    };
}

// Expose resetGame to UI layer when available to support legacy click handlers
try {
    // Prefer canonical registration via UIBootstrap
    try {
        const uiBootstrap = require('../shared/ui-bootstrap-shared');
        if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') {
            // If turn-manager exposes resetGame via require, register it
            try {
                const turnManager = require('./turn-manager');
                if (turnManager && typeof turnManager.resetGame === 'function') {
                    uiBootstrap.registerUIGlobals({ resetGame: turnManager.resetGame });
                }
            } catch (e) { /* ignore */ }
        }
    } catch (e) { /* ignore */ }

    // Fallback: attach to globalThis for direct calls
    try {
        if (typeof require === 'function') {
            const turnManager = require('./turn-manager');
            if (turnManager && typeof turnManager.resetGame === 'function' && typeof globalThis !== 'undefined') {
                try { globalThis.resetGame = turnManager.resetGame; } catch (e) { /* ignore */ }
            }
        }
    } catch (e) { /* ignore */ }
} catch (e) { /* ignore */ }

// NOTE: Auto-initialization is handled by the UI layer. The UI should call `initializeGame()` when
// it is ready (e.g., via a browser-ready helper). This avoids game/ performing UI-side effects.

