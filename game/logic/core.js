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

    function normalizeExpansionOwner(owner) {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function isMainBoardCell(row, col) {
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    function resolveExpansionSide(side, row, col) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (col === -1) return 'left';
        if (col === 8) return 'right';
        if (row === -1) return 'top';
        if (row === 8) return 'bottom';
        return null;
    }

    function appendExpansionCell(cells, source, legacyRow, legacyOwner) {
        if (!Array.isArray(cells)) return;

        let side = null;
        let row = null;
        let col = null;
        let owner = legacyOwner;

        if (source && typeof source === 'object') {
            side = source.side;
            row = source.row;
            col = source.col;
            owner = source.owner;
            if (!Number.isInteger(col) && side === 'left') col = -1;
            if (!Number.isInteger(col) && side === 'right') col = 8;
        } else {
            side = source;
            row = legacyRow;
            if (side === 'left') col = -1;
            if (side === 'right') col = 8;
        }

        if (!Number.isInteger(row) || !Number.isInteger(col)) return;
        if (row < -1 || row > 8 || col < -1 || col > 8) return;
        if (isMainBoardCell(row, col)) return;
        if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;

        cells.push({
            side: resolveExpansionSide(side, row, col),
            row,
            col,
            owner: normalizeExpansionOwner(owner)
        });
    }

    function normalizeExpansionCells(expansion) {
        const cells = [];
        if (expansion && Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object') continue;
                appendExpansionCell(cells, cell);
            }
        }
        if (cells.length === 0 && expansion && expansion.active === true) {
            appendExpansionCell(cells, expansion);
        }
        return cells;
    }

    function syncLegacyExpansionFields(expansion) {
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col) : null;
        expansion.row = latest ? latest.row : null;
        expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
    }

    function createBoardExpansionState(sourceExpansion) {
        const usedByPlayer = {
            black: !!(sourceExpansion && sourceExpansion.usedByPlayer && sourceExpansion.usedByPlayer.black),
            white: !!(sourceExpansion && sourceExpansion.usedByPlayer && sourceExpansion.usedByPlayer.white)
        };
        const cells = normalizeExpansionCells(sourceExpansion);
        const out = {
            active: false,
            side: null,
            row: null,
            owner: EMPTY,
            usedByPlayer,
            cells
        };
        syncLegacyExpansionFields(out);
        return out;
    }

    function ensureBoardExpansionState(state) {
        if (!state.boardExpansion || typeof state.boardExpansion !== 'object') {
            state.boardExpansion = createBoardExpansionState(null);
            return state.boardExpansion;
        }
        const expansion = state.boardExpansion;
        if (!expansion.usedByPlayer || typeof expansion.usedByPlayer !== 'object') {
            expansion.usedByPlayer = { black: false, white: false };
        } else {
            expansion.usedByPlayer.black = !!expansion.usedByPlayer.black;
            expansion.usedByPlayer.white = !!expansion.usedByPlayer.white;
        }
        expansion.cells = normalizeExpansionCells(expansion);
        syncLegacyExpansionFields(expansion);
        return expansion;
    }

    function normalizeRoundNumber(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 1;
        const roundNumber = Math.trunc(numeric);
        return roundNumber >= 1 ? roundNumber : 1;
    }

    function normalizeRoundPlayerKey(player) {
        if (player === BLACK || player === 'black' || player === 1 || player === '1' || player === '+1') return 'black';
        if (player === WHITE || player === 'white' || player === -1 || player === '-1') return 'white';
        return null;
    }

    function createRoundCompletionByPlayer(source) {
        const value = (source && typeof source === 'object') ? source : {};
        return {
            black: !!value.black,
            white: !!value.white
        };
    }

    function clonePendingRoundBonus(source) {
        if (!source || typeof source !== 'object') return null;
        const roundNumber = normalizeRoundNumber(source.roundNumber);
        const amountValue = Number(source.amount);
        const amount = Number.isFinite(amountValue) ? Math.max(0, Math.trunc(amountValue)) : 0;
        if (!(amount > 0)) return null;
        return { roundNumber, amount };
    }

    function ensureRoundState(state) {
        if (!state || typeof state !== 'object') return state;
        state.roundNumber = normalizeRoundNumber(state.roundNumber);
        state.roundCompletionByPlayer = createRoundCompletionByPlayer(state.roundCompletionByPlayer);
        state.pendingRoundBonus = clonePendingRoundBonus(state.pendingRoundBonus);
        return state;
    }

    function resolveRoundBonusAmount(roundNumber) {
        const normalizedRound = normalizeRoundNumber(roundNumber);
        if (normalizedRound % 10 !== 0) return 0;
        return Math.max(0, Math.floor(normalizedRound / 2));
    }

    function advanceRoundAfterCompletedTurn(state, player, options) {
        const targetState = ensureRoundState(state);
        const playerKey = normalizeRoundPlayerKey(player);
        const opts = (options && typeof options === 'object') ? options : {};
        if (!targetState || !playerKey) {
            return {
                advanced: false,
                roundNumber: targetState ? targetState.roundNumber : 1,
                pendingRoundBonus: clonePendingRoundBonus(targetState && targetState.pendingRoundBonus)
            };
        }

        targetState.roundCompletionByPlayer[playerKey] = true;
        const completedBlack = !!targetState.roundCompletionByPlayer.black;
        const completedWhite = !!targetState.roundCompletionByPlayer.white;
        if (!completedBlack || !completedWhite) {
            return {
                advanced: false,
                roundNumber: targetState.roundNumber,
                pendingRoundBonus: clonePendingRoundBonus(targetState.pendingRoundBonus)
            };
        }

        const nextRoundNumber = normalizeRoundNumber(targetState.roundNumber + 1);
        targetState.roundNumber = nextRoundNumber;
        targetState.roundCompletionByPlayer = createRoundCompletionByPlayer(null);
        if (opts.scheduleBonus !== false) {
            const amount = resolveRoundBonusAmount(nextRoundNumber);
            targetState.pendingRoundBonus = amount > 0
                ? { roundNumber: nextRoundNumber, amount }
                : null;
        }
        return {
            advanced: true,
            roundNumber: targetState.roundNumber,
            pendingRoundBonus: clonePendingRoundBonus(targetState.pendingRoundBonus)
        };
    }

    function consumePendingRoundBonus(state) {
        const targetState = ensureRoundState(state);
        if (!targetState) return null;
        const pending = clonePendingRoundBonus(targetState.pendingRoundBonus);
        targetState.pendingRoundBonus = null;
        return pending;
    }

    function getExpansionCells(state) {
        if (!state || !state.boardExpansion || typeof state.boardExpansion !== 'object') return [];
        return normalizeExpansionCells(state.boardExpansion);
    }

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
            turnNumber: 0,
            roundNumber: 1,
            roundCompletionByPlayer: createRoundCompletionByPlayer(null),
            pendingRoundBonus: null,
            boardExpansion: createBoardExpansionState(null)
        };
    }

    /**
     * Deep copy game state
     * @param {Object} state - Original game state
     * @returns {Object} Copied game state
     */
    function copyGameState(state) {
        const newBoard = state.board.map(row => row.slice());
        const sourceExpansion = (state && state.boardExpansion && typeof state.boardExpansion === 'object')
            ? state.boardExpansion
            : null;
        return {
            board: newBoard,
            currentPlayer: state.currentPlayer,
            consecutivePasses: state.consecutivePasses,
            turnNumber: state.turnNumber || 0,
            roundNumber: normalizeRoundNumber(state && state.roundNumber),
            roundCompletionByPlayer: createRoundCompletionByPlayer(state && state.roundCompletionByPlayer),
            pendingRoundBonus: clonePendingRoundBonus(state && state.pendingRoundBonus),
            boardExpansion: createBoardExpansionState(sourceExpansion)
        };
    }

    function getExpansionCell(state) {
        const cells = getExpansionCells(state);
        return cells.length > 0 ? cells[0] : null;
    }

    function getCellValue(state, row, col) {
        if (isMainBoardCell(row, col)) {
            return state.board[row][col];
        }
        const expansionCells = getExpansionCells(state);
        for (const expansion of expansionCells) {
            if (expansion && expansion.row === row && expansion.col === col) {
                return expansion.owner;
            }
        }
        return null;
    }

    function setCellValue(state, row, col, value) {
        if (isMainBoardCell(row, col)) {
            state.board[row][col] = value;
            return true;
        }
        const expansion = ensureBoardExpansionState(state);
        if (!Array.isArray(expansion.cells)) return false;
        const owner = normalizeExpansionOwner(value);
        for (let i = 0; i < expansion.cells.length; i++) {
            const cell = expansion.cells[i];
            if (!cell) continue;
            if (cell.row === row && cell.col === col) {
                expansion.cells[i] = {
                    side: resolveExpansionSide(cell.side, cell.row, cell.col),
                    row: cell.row,
                    col: cell.col,
                    owner
                };
                syncLegacyExpansionFields(expansion);
                return true;
            }
        }
        return false;
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
        if (getCellValue(state, row, col) !== EMPTY) return [];

        const protectedStones = context.protectedStones || [];
        const permaProtectedStones = context.permaProtectedStones || [];
        const blockedCells = context.blockedCells || [];
        const protectedSet = protectedStones.length
            ? new Set(protectedStones.map(p => `${p.row},${p.col}`))
            : null;
        const permaSet = permaProtectedStones.length
            ? new Set(permaProtectedStones.map(p => `${p.row},${p.col}`))
            : null;
        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map(p => `${p.row},${p.col}`))
            : null;
        if (blockedSet && blockedSet.has(`${row},${col}`)) return [];

        const allFlips = [];
        for (const [dr, dc] of DIRECTIONS) {
            const flips = [];
            let r = row + dr;
            let c = col + dc;
            while (getCellValue(state, r, c) === -player) {
                if (blockedSet && blockedSet.has(`${r},${c}`)) {
                    flips.length = 0;
                    break;
                }
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
            if (blockedSet && blockedSet.has(`${r},${c}`)) continue;
            if (flips.length > 0 && getCellValue(state, r, c) === player) {
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
        setCellValue(newState, move.row, move.col, state.currentPlayer);
        for (const [r, c] of move.flips) {
            setCellValue(newState, r, c, state.currentPlayer);
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
        advanceRoundAfterCompletedTurn(newState, state.currentPlayer);
        return newState;
    }

    /**
     * Check if game over
     * @param {Object} state 
     * @returns {boolean}
     */
    function isGameOver(state) {
        if (state.consecutivePasses >= 2) return true;

        const discs = countDiscs(state);
        const totalDiscs = (discs.black || 0) + (discs.white || 0);
        if (totalDiscs > 0 && (discs.black === 0 || discs.white === 0)) return true;

        let emptyCount = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (state.board[r][c] === EMPTY) emptyCount++;
            }
        }
        const expansionCells = getExpansionCells(state);
        for (const expansion of expansionCells) {
            if (expansion && expansion.owner === EMPTY) emptyCount++;
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
        const expansionCells = getExpansionCells(state);
        for (const expansion of expansionCells) {
            if (!expansion) continue;
            if (expansion.owner === BLACK) black++;
            else if (expansion.owner === WHITE) white++;
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
        const blockedCells = context.blockedCells || [];
        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map(p => `${p.row},${p.col}`))
            : null;
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (state.board[r][c] === EMPTY) {
                    if (blockedSet && blockedSet.has(`${r},${c}`)) continue;
                    const flips = getFlipsWithContext(state, r, c, player, context);
                    if (flips.length > 0) {
                        moves.push({ row: r, col: c, flips });
                    }
                }
            }
        }
        const expansionCells = getExpansionCells(state);
        for (const expansion of expansionCells) {
            if (!expansion || expansion.owner !== EMPTY) continue;
            if (blockedSet && blockedSet.has(`${expansion.row},${expansion.col}`)) continue;
            const flips = getFlipsWithContext(state, expansion.row, expansion.col, player, context);
            if (flips.length > 0) {
                moves.push({ row: expansion.row, col: expansion.col, flips });
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
        const blockedCells = context.blockedCells || [];
        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map(p => `${p.row},${p.col}`))
            : null;
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (state.board[r][c] === EMPTY) {
                    if (blockedSet && blockedSet.has(`${r},${c}`)) continue;
                    const flips = getFlipsWithContext(state, r, c, player, context);
                    moves.push({ row: r, col: c, flips });
                }
            }
        }
        const expansionCells = getExpansionCells(state);
        for (const expansion of expansionCells) {
            if (!expansion || expansion.owner !== EMPTY) continue;
            if (blockedSet && blockedSet.has(`${expansion.row},${expansion.col}`)) continue;
            const flips = getFlipsWithContext(state, expansion.row, expansion.col, player, context);
            moves.push({ row: expansion.row, col: expansion.col, flips });
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
        const expansionCells = getExpansionCells(state);
        for (const expansion of expansionCells) {
            if (!expansion || expansion.owner !== EMPTY) continue;
            const flips = getFlipsWithContext(state, expansion.row, expansion.col, player, context);
            if (flips.length > 0) return true;
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
        ensureRoundState,
        resolveRoundBonusAmount,
        advanceRoundAfterCompletedTurn,
        consumePendingRoundBonus,
        getExpansionCells,

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
