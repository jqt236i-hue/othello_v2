"use strict";
/**
 * @file core.ts
 * @description Core Othello Logic (Shared between Browser and Headless)
 * Pure functions only. No UI dependencies.
 */
function _require(id) {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}
const SharedConstants = (typeof module === 'object' && module.exports)
    ? _require('../../shared-constants')
    : (typeof self !== 'undefined' ? self.SharedConstants : undefined);
const SharedBoardUtils = (typeof module === 'object' && module.exports)
    ? _require('../../shared/shared-board-utils')
    : (typeof self !== 'undefined' ? (self.SharedBoardUtils || null) : null);
const BoardUtilsModule = (typeof module === 'object' && module.exports)
    ? _require('../../shared/board-utils')
    : null;
const { BLACK, WHITE, EMPTY, DIRECTIONS } = SharedConstants || {};
const BoardUtils = SharedBoardUtils || null;
const NewBoardUtils = BoardUtilsModule || null;
if (BLACK === undefined) {
    throw new Error('SharedConstants not loaded');
}
function normalizeExpansionOwner(owner) {
    return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
}
function resolveGameBoardConfig(boardOrConfig) {
    if (BoardUtils && typeof BoardUtils.resolveBoardConfig === 'function') {
        return BoardUtils.resolveBoardConfig(boardOrConfig);
    }
    const board = Array.isArray(boardOrConfig)
        ? boardOrConfig
        : (boardOrConfig && Array.isArray(boardOrConfig.board) ? boardOrConfig.board : null);
    const rows = Array.isArray(board) && board.length > 0 ? board.length : 8;
    const cols = Array.isArray(board) && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
    return {
        rows,
        cols,
        standard8x8: rows === 8 && cols === 8,
        baseBounds: { minRow: 0, maxRow: rows - 1, minCol: 0, maxCol: cols - 1 },
        outerBounds: { minRow: -1, maxRow: rows, minCol: -1, maxCol: cols }
    };
}
function isMainBoardCell(row, col, boardOrConfig) {
    if (BoardUtils && typeof BoardUtils.isMainBoardCell === 'function') {
        return BoardUtils.isMainBoardCell(row, col, boardOrConfig);
    }
    const config = resolveGameBoardConfig(boardOrConfig);
    return (Number.isInteger(row) &&
        Number.isInteger(col) &&
        row >= 0 &&
        row < config.rows &&
        col >= 0 &&
        col < config.cols);
}
function isExpansionCoordinate(row, col, boardOrConfig) {
    if (BoardUtils && typeof BoardUtils.isExpansionCoordinate === 'function') {
        return BoardUtils.isExpansionCoordinate(row, col, boardOrConfig);
    }
    const config = resolveGameBoardConfig(boardOrConfig);
    if (!Number.isInteger(row) || !Number.isInteger(col))
        return false;
    if (row < config.outerBounds.minRow || row > config.outerBounds.maxRow)
        return false;
    if (col < config.outerBounds.minCol || col > config.outerBounds.maxCol)
        return false;
    return !isMainBoardCell(row, col, config);
}
function resolveExpansionSide(side, row, col, boardOrConfig) {
    if (BoardUtils && typeof BoardUtils.resolveExpansionSide === 'function') {
        return BoardUtils.resolveExpansionSide(side, row, col, boardOrConfig);
    }
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom')
        return side;
    const config = resolveGameBoardConfig(boardOrConfig);
    if (col === config.outerBounds.minCol)
        return 'left';
    if (col === config.outerBounds.maxCol)
        return 'right';
    if (row === config.outerBounds.minRow)
        return 'top';
    if (row === config.outerBounds.maxRow)
        return 'bottom';
    return null;
}
function createBoardMatrix(boardOrConfig) {
    if (BoardUtils && typeof BoardUtils.createEmptyBoard === 'function') {
        return BoardUtils.createEmptyBoard(resolveGameBoardConfig(boardOrConfig), EMPTY);
    }
    const config = resolveGameBoardConfig(boardOrConfig);
    return Array.from({ length: config.rows }, () => Array.from({ length: config.cols }, () => EMPTY));
}
function getOpeningAnchor(boardOrConfig) {
    if (BoardUtils && typeof BoardUtils.getOpeningAnchor === 'function') {
        return BoardUtils.getOpeningAnchor(boardOrConfig);
    }
    const config = resolveGameBoardConfig(boardOrConfig);
    return {
        row: Math.floor((config.rows - 2) / 2),
        col: Math.floor((config.cols - 2) / 2)
    };
}
function getOpeningPlacements(boardOrConfig) {
    if (BoardUtils && typeof BoardUtils.getOpeningPlacements === 'function') {
        return BoardUtils.getOpeningPlacements(boardOrConfig);
    }
    const config = resolveGameBoardConfig(boardOrConfig);
    const anchor = getOpeningAnchor(config);
    if (config.rows === 7 && config.cols === 7) {
        const placements = [];
        for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
            for (let colOffset = 0; colOffset < 3; colOffset += 1) {
                if (rowOffset === 1 && colOffset === 1)
                    continue;
                placements.push({
                    row: anchor.row + rowOffset,
                    col: anchor.col + colOffset,
                    owner: ((rowOffset + colOffset) % 2 === 0) ? WHITE : BLACK
                });
            }
        }
        return placements;
    }
    return [
        { row: anchor.row, col: anchor.col, owner: WHITE },
        { row: anchor.row, col: anchor.col + 1, owner: BLACK },
        { row: anchor.row + 1, col: anchor.col, owner: BLACK },
        { row: anchor.row + 1, col: anchor.col + 1, owner: WHITE }
    ];
}
function forEachMainBoardCell(state, visitor) {
    if (!state || !Array.isArray(state.board) || typeof visitor !== 'function')
        return;
    for (let row = 0; row < state.board.length; row++) {
        const line = Array.isArray(state.board[row]) ? state.board[row] : [];
        for (let col = 0; col < line.length; col++) {
            visitor(row, col, line[col]);
        }
    }
}
function appendExpansionCell(cells, source, legacyRow, legacyOwner, boardOrConfig) {
    if (!Array.isArray(cells))
        return;
    let side = null;
    let row = null;
    let col = null;
    let owner = legacyOwner;
    const boardConfig = resolveGameBoardConfig(boardOrConfig);
    if (source && typeof source === 'object') {
        side = source.side;
        row = source.row;
        col = source.col;
        owner = source.owner;
        if (!Number.isInteger(col) && side === 'left')
            col = boardConfig.outerBounds.minCol;
        if (!Number.isInteger(col) && side === 'right')
            col = boardConfig.outerBounds.maxCol;
    }
    else {
        side = source;
        row = legacyRow;
        if (side === 'left')
            col = boardConfig.outerBounds.minCol;
        if (side === 'right')
            col = boardConfig.outerBounds.maxCol;
    }
    if (!Number.isInteger(row) || !Number.isInteger(col))
        return;
    if (!isExpansionCoordinate(row, col, boardConfig))
        return;
    if (cells.some((cell) => cell && cell.row === row && cell.col === col))
        return;
    cells.push({
        side: resolveExpansionSide(side, row, col, boardConfig),
        row: row,
        col: col,
        owner: normalizeExpansionOwner(owner)
    });
}
function normalizeExpansionCells(expansion, boardOrConfig) {
    const cells = [];
    if (expansion && Array.isArray(expansion.cells)) {
        for (const cell of expansion.cells) {
            if (!cell || typeof cell !== 'object')
                continue;
            appendExpansionCell(cells, cell, null, null, boardOrConfig);
        }
    }
    if (cells.length === 0 && expansion && expansion.active === true) {
        appendExpansionCell(cells, expansion, null, null, boardOrConfig);
    }
    return cells;
}
function syncLegacyExpansionFields(expansion, boardOrConfig) {
    if (!expansion || typeof expansion !== 'object')
        return;
    if (!Array.isArray(expansion.cells))
        expansion.cells = [];
    const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
    expansion.active = !!latest;
    expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, boardOrConfig) : null;
    expansion.row = latest ? latest.row : null;
    expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
}
function createBoardExpansionState(sourceExpansion, boardOrConfig) {
    const usedByPlayer = {
        black: !!(sourceExpansion && sourceExpansion.usedByPlayer && sourceExpansion.usedByPlayer.black),
        white: !!(sourceExpansion && sourceExpansion.usedByPlayer && sourceExpansion.usedByPlayer.white)
    };
    const cells = normalizeExpansionCells(sourceExpansion, boardOrConfig);
    const out = {
        active: false,
        side: null,
        row: null,
        owner: EMPTY,
        usedByPlayer,
        cells
    };
    syncLegacyExpansionFields(out, boardOrConfig);
    return out;
}
function ensureBoardExpansionState(state) {
    if (!state.boardExpansion || typeof state.boardExpansion !== 'object') {
        state.boardExpansion = createBoardExpansionState(null, state);
        return state.boardExpansion;
    }
    const expansion = state.boardExpansion;
    if (!expansion.usedByPlayer || typeof expansion.usedByPlayer !== 'object') {
        expansion.usedByPlayer = { black: false, white: false };
    }
    else {
        expansion.usedByPlayer.black = !!expansion.usedByPlayer.black;
        expansion.usedByPlayer.white = !!expansion.usedByPlayer.white;
    }
    expansion.cells = normalizeExpansionCells(expansion, state);
    syncLegacyExpansionFields(expansion, state);
    return expansion;
}
function normalizeRoundNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return 1;
    const roundNumber = Math.trunc(numeric);
    return roundNumber >= 1 ? roundNumber : 1;
}
function normalizeRoundPlayerKey(player) {
    if (player === BLACK || player === 'black' || player === 1 || player === '1' || player === '+1')
        return 'black';
    if (player === WHITE || player === 'white' || player === -1 || player === '-1')
        return 'white';
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
    if (!source || typeof source !== 'object')
        return null;
    const roundNumber = normalizeRoundNumber(source.roundNumber);
    const amountValue = Number(source.amount);
    const amount = Number.isFinite(amountValue) ? Math.max(0, Math.trunc(amountValue)) : 0;
    if (!(amount > 0))
        return null;
    return { roundNumber, amount };
}
function ensureRoundState(state) {
    if (!state || typeof state !== 'object')
        return state;
    state.roundNumber = normalizeRoundNumber(state.roundNumber);
    state.roundCompletionByPlayer = createRoundCompletionByPlayer(state.roundCompletionByPlayer);
    state.pendingRoundBonus = clonePendingRoundBonus(state.pendingRoundBonus);
    return state;
}
function resolveRoundBonusAmount(roundNumber) {
    const normalizedRound = normalizeRoundNumber(roundNumber);
    if (normalizedRound % 10 !== 0)
        return 0;
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
    if (!targetState)
        return null;
    const pending = clonePendingRoundBonus(targetState.pendingRoundBonus);
    targetState.pendingRoundBonus = null;
    return pending;
}
function getExpansionCells(state) {
    if (!state || !state.boardExpansion || typeof state.boardExpansion !== 'object')
        return [];
    return normalizeExpansionCells(state.boardExpansion, state);
}
function createGameState(boardConfigInput) {
    const boardConfig = resolveGameBoardConfig(boardConfigInput);
    const board = createBoardMatrix(boardConfig);
    const openingPlacements = getOpeningPlacements(boardConfig);
    for (const stone of openingPlacements) {
        board[stone.row][stone.col] = stone.owner;
    }
    return {
        board: board,
        boardConfig,
        currentPlayer: BLACK,
        consecutivePasses: 0,
        turnNumber: 0,
        roundNumber: 1,
        roundCompletionByPlayer: createRoundCompletionByPlayer(null),
        pendingRoundBonus: null,
        boardExpansion: createBoardExpansionState(null, boardConfig)
    };
}
function copyGameState(state) {
    const newBoard = state.board.map((row) => row.slice());
    const boardConfig = resolveGameBoardConfig(state);
    const sourceExpansion = (state && state.boardExpansion && typeof state.boardExpansion === 'object')
        ? state.boardExpansion
        : null;
    return {
        board: newBoard,
        boardConfig,
        currentPlayer: state.currentPlayer,
        consecutivePasses: state.consecutivePasses,
        turnNumber: state.turnNumber || 0,
        roundNumber: normalizeRoundNumber(state && state.roundNumber),
        roundCompletionByPlayer: createRoundCompletionByPlayer(state && state.roundCompletionByPlayer),
        pendingRoundBonus: clonePendingRoundBonus(state && state.pendingRoundBonus),
        boardExpansion: createBoardExpansionState(sourceExpansion, boardConfig)
    };
}
function getExpansionCell(state) {
    const cells = getExpansionCells(state);
    return cells.length > 0 ? cells[0] : null;
}
function getCellValue(state, row, col) {
    if (isMainBoardCell(row, col, state)) {
        return (Array.isArray(state.board[row]) && Number.isInteger(col) && col >= 0 && col < state.board[row].length)
            ? state.board[row][col]
            : null;
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
    if (isMainBoardCell(row, col, state)) {
        if (!Array.isArray(state.board[row]) || col < 0 || col >= state.board[row].length)
            return false;
        state.board[row][col] = value;
        return true;
    }
    const expansion = ensureBoardExpansionState(state);
    if (!Array.isArray(expansion.cells))
        return false;
    const owner = normalizeExpansionOwner(value);
    for (let i = 0; i < expansion.cells.length; i++) {
        const cell = expansion.cells[i];
        if (!cell)
            continue;
        if (cell.row === row && cell.col === col) {
            expansion.cells[i] = {
                side: resolveExpansionSide(cell.side, cell.row, cell.col, state),
                row: cell.row,
                col: cell.col,
                owner
            };
            syncLegacyExpansionFields(expansion, state);
            return true;
        }
    }
    return false;
}
function getFlipsWithContext(state, row, col, player, context = {}) {
    if (getCellValue(state, row, col) !== EMPTY)
        return [];
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
    if (blockedSet && blockedSet.has(`${row},${col}`))
        return [];
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
            if ((protectedSet && protectedSet.has(`${r},${c}`)) ||
                (permaSet && permaSet.has(`${r},${c}`))) {
                flips.length = 0;
                break;
            }
            flips.push([r, c]);
            r += dr;
            c += dc;
        }
        if (blockedSet && blockedSet.has(`${r},${c}`))
            continue;
        if (flips.length > 0 && getCellValue(state, r, c) === player) {
            allFlips.push(...flips);
        }
    }
    return allFlips;
}
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
function applyPass(state) {
    const newState = copyGameState(state);
    newState.currentPlayer = -newState.currentPlayer;
    newState.consecutivePasses = state.consecutivePasses + 1;
    newState.turnNumber = (state.turnNumber || 0) + 1;
    advanceRoundAfterCompletedTurn(newState, state.currentPlayer);
    return newState;
}
function isGameOver(state) {
    if (state.consecutivePasses >= 2)
        return true;
    const discs = countDiscs(state);
    const totalDiscs = (discs.black || 0) + (discs.white || 0);
    if (totalDiscs > 0 && (discs.black === 0 || discs.white === 0))
        return true;
    let emptyCount = 0;
    forEachMainBoardCell(state, (row, col, value) => {
        if (value === EMPTY)
            emptyCount += 1;
    });
    const expansionCells = getExpansionCells(state);
    for (const expansion of expansionCells) {
        if (expansion && expansion.owner === EMPTY)
            emptyCount++;
    }
    return emptyCount === 0;
}
function countDiscs(state) {
    let black = 0, white = 0;
    if (NewBoardUtils && typeof NewBoardUtils.countDiscs === 'function') {
        const counts = NewBoardUtils.countDiscs(state.board);
        black = counts.black;
        white = counts.white;
    }
    else {
        forEachMainBoardCell(state, (row, col, value) => {
            if (value === BLACK)
                black += 1;
            else if (value === WHITE)
                white += 1;
        });
    }
    const expansionCells = getExpansionCells(state);
    for (const expansion of expansionCells) {
        if (!expansion)
            continue;
        if (expansion.owner === BLACK)
            black++;
        else if (expansion.owner === WHITE)
            white++;
    }
    return { black, white };
}
function getLegalMoves(state, player, context = {}) {
    const blockedCells = context.blockedCells || [];
    const blockedSet = blockedCells.length
        ? new Set(blockedCells.map(p => `${p.row},${p.col}`))
        : null;
    const moves = [];
    forEachMainBoardCell(state, (row, col, value) => {
        if (value !== EMPTY)
            return;
        if (blockedSet && blockedSet.has(`${row},${col}`))
            return;
        const flips = getFlipsWithContext(state, row, col, player, context);
        if (flips.length > 0) {
            moves.push({ row, col, flips });
        }
    });
    const expansionCells = getExpansionCells(state);
    for (const expansion of expansionCells) {
        if (!expansion || expansion.owner !== EMPTY)
            continue;
        if (blockedSet && blockedSet.has(`${expansion.row},${expansion.col}`))
            continue;
        const flips = getFlipsWithContext(state, expansion.row, expansion.col, player, context);
        if (flips.length > 0) {
            moves.push({ row: expansion.row, col: expansion.col, flips });
        }
    }
    return moves;
}
function getFreePlacementMoves(state, player, context = {}) {
    const blockedCells = context.blockedCells || [];
    const blockedSet = blockedCells.length
        ? new Set(blockedCells.map(p => `${p.row},${p.col}`))
        : null;
    const moves = [];
    forEachMainBoardCell(state, (row, col, value) => {
        if (value !== EMPTY)
            return;
        if (blockedSet && blockedSet.has(`${row},${col}`))
            return;
        const flips = getFlipsWithContext(state, row, col, player, context);
        moves.push({ row, col, flips });
    });
    const expansionCells = getExpansionCells(state);
    for (const expansion of expansionCells) {
        if (!expansion || expansion.owner !== EMPTY)
            continue;
        if (blockedSet && blockedSet.has(`${expansion.row},${expansion.col}`))
            continue;
        const flips = getFlipsWithContext(state, expansion.row, expansion.col, player, context);
        moves.push({ row: expansion.row, col: expansion.col, flips });
    }
    return moves;
}
function hasLegalMove(state, player, context = {}) {
    let found = false;
    forEachMainBoardCell(state, (row, col, value) => {
        if (found || value !== EMPTY)
            return;
        const flips = getFlipsWithContext(state, row, col, player, context);
        if (flips.length > 0) {
            found = true;
        }
    });
    if (found)
        return true;
    const expansionCells = getExpansionCells(state);
    for (const expansion of expansionCells) {
        if (!expansion || expansion.owner !== EMPTY)
            continue;
        const flips = getFlipsWithContext(state, expansion.row, expansion.col, player, context);
        if (flips.length > 0)
            return true;
    }
    return false;
}
module.exports = {
    BLACK,
    WHITE,
    EMPTY,
    DIRECTIONS,
    createGameState,
    copyGameState,
    ensureRoundState,
    resolveRoundBonusAmount,
    advanceRoundAfterCompletedTurn,
    consumePendingRoundBonus,
    getExpansionCells,
    getFlipsWithContext,
    applyMove,
    applyPass,
    isGameOver,
    countDiscs,
    getLegalMoves,
    getFreePlacementMoves,
    hasLegalMove
};
//# sourceMappingURL=core.js.map