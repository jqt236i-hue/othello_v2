/**
 * @file core.js
 * @description Core Othello Logic (Shared between Browser and Headless)
 * Pure functions only. No UI dependencies.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node.js: Assume shared-constants is up two levels
        module.exports = factory(require('../../shared-constants'));
    } else {
        // Browser: Assume SharedConstants is global
        const core = factory(root.SharedConstants);
        // Expose both modern and legacy global names for compatibility
        root.CoreLogic = core;
        if (typeof root.Core === 'undefined') {
            root.Core = core;
        }
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, EMPTY, DIRECTIONS } = SharedConstants || {};

    // Check if constants are loaded
    if (BLACK === undefined) {
        throw new Error('SharedConstants not loaded');
    }

    // ===== Game State Management =====

    /**
     * Create initial game state
     * @returns {Object} gameState
     */
    function createGameState() {
        const board = [];
        for (let i = 0; i < 8; i++) {
            board.push([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
        }
        board[3][3] = WHITE;
        board[3][4] = BLACK;
        board[4][3] = BLACK;
        board[4][4] = WHITE;
        return {
            board: board,
            currentPlayer: BLACK,
            consecutivePasses: 0,
            turnNumber: 0
        };
    }

    /**
     * Deep copy game state
     * @param {Object} state - Original game state
     * @returns {Object} Copied game state
     */
    function copyGameState(state) {
        const newBoard = state.board.map(row => row.slice());
        return {
            board: newBoard,
            currentPlayer: state.currentPlayer,
            consecutivePasses: state.consecutivePasses,
            turnNumber: state.turnNumber || 0
        };
    }

    // ===== Move Logic =====

    /**
     * Get list of flips for a move
     * @param {Object} state - Game state
     * @param {number} row 
     * @param {number} col 
     * @param {number} player - BLACK or WHITE
     * @param {Object} context - Card effect context
     * @returns {Array} List of [r, c] to flip
     */
    function getFlipsWithContext(state, row, col, player, context = {}) {
        if (state.board[row][col] !== EMPTY) return [];

        const protectedStones = context.protectedStones || [];
        const permaProtectedStones = context.permaProtectedStones || [];
        const protectedSet = protectedStones.length
            ? new Set(protectedStones.map(p => `${p.row},${p.col}`))
            : null;
        const permaSet = permaProtectedStones.length
            ? new Set(permaProtectedStones.map(p => `${p.row},${p.col}`))
            : null;

        const allFlips = [];
        for (const [dr, dc] of DIRECTIONS) {
            const flips = [];
            let r = row + dr;
            let c = col + dc;
            while (r >= 0 && r < 8 && c >= 0 && c < 8 && state.board[r][c] === -player) {
                // Protection block
                if ((protectedSet && protectedSet.has(`${r},${c}`)) ||
                    (permaSet && permaSet.has(`${r},${c}`))) {
                    flips.length = 0;
                    break;
                }
                flips.push([r, c]);
                r += dr;
                c += dc;
            }
            if (flips.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && state.board[r][c] === player) {
                allFlips.push(...flips);
            }
        }
        return allFlips;
    }

    /**
     * Apply move (Pure function)
     * @param {Object} state 
     * @param {Object} move 
     * @returns {Object} New state
     */
    function applyMove(state, move) {
        const newState = copyGameState(state);
        newState.board[move.row][move.col] = state.currentPlayer;
        for (const [r, c] of move.flips) {
            newState.board[r][c] = state.currentPlayer;
        }
        newState.currentPlayer = -state.currentPlayer;
        newState.consecutivePasses = 0;
        newState.turnNumber = (state.turnNumber || 0) + 1;
        return newState;
    }

    /**
     * Apply pass (Pure function)
     * @param {Object} state 
     * @returns {Object} New state
     */
    function applyPass(state) {
        const newState = copyGameState(state);
        newState.currentPlayer = -newState.currentPlayer;
        newState.consecutivePasses = state.consecutivePasses + 1;
        newState.turnNumber = (state.turnNumber || 0) + 1;
        return newState;
    }

    /**
     * Check if game over
     * @param {Object} state 
     * @returns {boolean}
     */
    function isGameOver(state) {
        if (state.consecutivePasses >= 2) return true;
        let emptyCount = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (state.board[r][c] === EMPTY) emptyCount++;
            }
        }
        return emptyCount === 0;
    }

    /**
     * Count discs
     * @param {Object} state 
     * @returns {{black: number, white: number}}
     */
    function countDiscs(state) {
        let black = 0, white = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (state.board[r][c] === BLACK) black++;
                else if (state.board[r][c] === WHITE) white++;
            }
        }
        return { black, white };
    }

    /**
     * Get legal moves
     * @param {Object} state 
     * @param {number} player 
     * @param {Object} context 
     * @returns {Array} List of moves
     */
    function getLegalMoves(state, player, context = {}) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (state.board[r][c] === EMPTY) {
                    const flips = getFlipsWithContext(state, r, c, player, context);
                    if (flips.length > 0) {
                        moves.push({ row: r, col: c, flips });
                    }
                }
            }
        }
        return moves;
    }

    /**
     * Get moves for FREE_PLACEMENT (allows placement anywhere empty, still calculates flips if any)
     * @param {Object} state 
     * @param {number} player 
     * @param {Object} context 
     * @returns {Array} List of moves
     */
    function getFreePlacementMoves(state, player, context = {}) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (state.board[r][c] === EMPTY) {
                    const flips = getFlipsWithContext(state, r, c, player, context);
                    moves.push({ row: r, col: c, flips });
                }
            }
        }
        return moves;
    }

    /**
     * Check if has legal move
     * @param {Object} state 
     * @param {number} player 
     * @param {Object} context 
     * @returns {boolean}
     */
    function hasLegalMove(state, player, context = {}) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (state.board[r][c] === EMPTY) {
                    const flips = getFlipsWithContext(state, r, c, player, context);
                    if (flips.length > 0) return true;
                }
            }
        }
        return false;
    }

    return {
        // Constants
        BLACK,
        WHITE,
        EMPTY,
        DIRECTIONS,

        // State management
        createGameState,
        copyGameState,

        // Move logic
        getFlipsWithContext,
        applyMove,
        applyPass,

        // Game status
        isGameOver,
        countDiscs,

        // Move generation
        getLegalMoves,
        getFreePlacementMoves,
        hasLegalMove
    };
}));
