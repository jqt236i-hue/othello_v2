/**
 * @file move-generator.js
 * @description 合法手生成モジュール
 * 
 * CoreLogic を使用して合法手を生成する。
 * CPU評価関数は別ファイル (game/ai/level-system.js) に移行予定。
 */

if (typeof CoreLogic === 'undefined') {
    console.error('CoreLogic is not loaded.');
}

const MoveGeneratorBoardOps = (() => {
    if (typeof require === 'function') {
        try {
            return require('./logic/board_ops');
        } catch (e) {
            return null;
        }
    }
    if (typeof globalThis !== 'undefined' && globalThis.BoardOps) return globalThis.BoardOps;
    return null;
})();
const MoveGeneratorSharedBoardUtils = (() => {
    if (typeof require === 'function') {
        try {
            return require('../shared/shared-board-utils');
        } catch (e) {
            return null;
        }
    }
    if (typeof globalThis !== 'undefined' && globalThis.SharedBoardUtils) return globalThis.SharedBoardUtils;
    return null;
})();

const MoveGeneratorMarkersAdapter = (() => {
    if (typeof require === 'function') {
        try {
            return require('./logic/markers_adapter');
        } catch (e) {
            return null;
        }
    }
    if (typeof globalThis !== 'undefined' && globalThis.MarkersAdapter) return globalThis.MarkersAdapter;
    return null;
})();

function isSpecialOrBombMarkerForMoveGeneration(marker) {
    if (!marker) return false;
    if (MoveGeneratorMarkersAdapter && typeof MoveGeneratorMarkersAdapter.isBombCategoryMarker === 'function') {
        if (MoveGeneratorMarkersAdapter.isBombCategoryMarker(marker)) return true;
    }
    return marker.kind === 'specialStone';
}

// ===== Move Generation & Legal Move Lookup =====

/**
 * 合法手リストを取得
 * @param {Object} state - ゲーム状態
 * @param {Array} protectedStones - 保護石リスト
 * @param {Array} permaProtectedStones - 永久保護石リスト
 * @returns {Array} 合法手リスト
 */
function getLegalMoves(state, protectedStones, permaProtectedStones) {
    // Use centralized safe context helper when available
    let context = null;
    try {
        const ctxHelper = (typeof require === 'function') ? require('./logic/context') : (typeof globalThis !== 'undefined' ? globalThis.GameLogicContext : null);
        if (ctxHelper && typeof ctxHelper.getSafeCardContext === 'function') {
            context = ctxHelper.getSafeCardContext(typeof cardState !== 'undefined' ? cardState : undefined, protectedStones, permaProtectedStones);
        }
    } catch (e) { /* ignore and fall back below */ }

    if (!context) {
        // Fallback to CardLogic if available, else construct a minimal safe context
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

    return CoreLogic.getLegalMoves(state, state.currentPlayer, context);
}

// ===== Shared Move Helpers =====

/**
 * 保護セルのセットを作成
 */
function createProtectedCellSet(protection, perma) {
    const set = new Set();
    if (protection && protection.length) {
        protection.forEach(p => set.add(p.row + ',' + p.col));
    }
    if (perma && perma.length) {
        perma.forEach(p => set.add(p.row + ',' + p.col));
    }
    return set;
}

function getExpansionCellsForMoveGeneration(state) {
    if (MoveGeneratorBoardOps && typeof MoveGeneratorBoardOps.getExpansionDescriptors === 'function') {
        return MoveGeneratorBoardOps.getExpansionDescriptors(state);
    }

    const expansion = (state && state.boardExpansion && typeof state.boardExpansion === 'object')
        ? state.boardExpansion
        : null;
    if (!expansion) return [];

    const cells = [];
    const boardBounds = (MoveGeneratorSharedBoardUtils && typeof MoveGeneratorSharedBoardUtils.resolveBoardBounds === 'function')
        ? MoveGeneratorSharedBoardUtils.resolveBoardBounds(state && state.board)
        : null;
    const pushCell = (cellLike) => {
        if (!cellLike || typeof cellLike !== 'object') return;
        const side = cellLike.side;
        const row = Number(cellLike.row);
        let col = Number.isInteger(cellLike.col) ? cellLike.col : null;
        if (!Number.isInteger(col)) {
            if (side === 'left') col = -1;
            else if (side === 'right' && boardBounds) col = boardBounds.maxCol + 1;
        }
        if (!Number.isInteger(row) || !Number.isInteger(col)) return;
        if (boardBounds) {
            if (row < -1 || row > (boardBounds.maxRow + 1) || col < -1 || col > (boardBounds.maxCol + 1)) return;
            if (row >= boardBounds.minRow && row <= boardBounds.maxRow && col >= boardBounds.minCol && col <= boardBounds.maxCol) return;
        }
        if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
        cells.push({ row, col, side, owner: Number(cellLike.owner) });
    };

    if (Array.isArray(expansion.cells)) {
        for (const cell of expansion.cells) {
            if (!cell || typeof cell !== 'object') continue;
            pushCell(cell);
        }
    }
    if (cells.length === 0 && expansion.active === true) {
        pushCell(expansion);
    }
    return cells;
}

function setCellValueForMoveGeneration(state, row, col, value) {
    if (!state || !Array.isArray(state.board)) return false;
    const boardBounds = (MoveGeneratorSharedBoardUtils && typeof MoveGeneratorSharedBoardUtils.resolveBoardBounds === 'function')
        ? MoveGeneratorSharedBoardUtils.resolveBoardBounds(state.board)
        : null;
    if (
        boardBounds &&
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        row >= boardBounds.minRow &&
        row <= boardBounds.maxRow &&
        col >= boardBounds.minCol &&
        col <= boardBounds.maxCol
    ) {
        state.board[row][col] = value;
        return true;
    }
    if (MoveGeneratorBoardOps && typeof MoveGeneratorBoardOps.setCellValue === 'function') {
        return !!MoveGeneratorBoardOps.setCellValue(state, row, col, value);
    }

    const expansion = (state.boardExpansion && typeof state.boardExpansion === 'object')
        ? state.boardExpansion
        : null;
    if (!expansion) return false;

    const cells = Array.isArray(expansion.cells)
        ? expansion.cells
        : [];
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!cell || typeof cell !== 'object') continue;
        const cellRow = Number(cell.row);
        const cellCol = Number.isInteger(cell.col)
            ? cell.col
            : (cell.side === 'left' ? -1 : (cell.side === 'right' && boardBounds ? boardBounds.maxCol + 1 : null));
        if (!Number.isInteger(cellRow) || !Number.isInteger(cellCol)) continue;
        if (cellRow !== row || cellCol !== col) continue;
        cells[i] = { ...cell, owner: Number(value) };
        return true;
    }
    return false;
}

function isFreePlacementPendingTypeForMoveGeneration(pendingType) {
    if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.isFreePlacementPendingType === 'function') {
        return CardLogic.isFreePlacementPendingType(pendingType);
    }
    return pendingType === 'FREE_PLACEMENT' || pendingType === 'SNIPER_WILL' || pendingType === 'LAST_RESORT';
}

/**
 * プレイヤーの手を生成（カード効果考慮）
 */
function generateMovesForPlayer(player, pending, protection, perma) {
    const legal = getLegalMoves(gameState, protection, perma);
    if (!pending) {
        return legal.map(m => ({ ...m, effectUsed: null, player, playerValue: player }));
    }

    const pendingType = pending.type;
    // Target-selection cards must be resolved BEFORE any placement can happen.
    if (pending.stage === 'selectTarget') {
        return [];
    }
    if (isFreePlacementPendingTypeForMoveGeneration(pendingType)) {
        return generateFreePlacementMoves(player, protection, perma, pendingType);
    }
    if (pendingType === 'TABOO_REVERSE_WILL') {
        return generateTabooReverseMoves(player, legal);
    }
    if (pendingType === 'SWAP_WITH_ENEMY') {
        return generateSwapMoves(player, legal, protection, perma);
    }

    return legal.map(m => ({ ...m, effectUsed: pendingType, player, playerValue: player }));
}

function generateTabooReverseMoves(player, legal) {
    const effectUsed = 'TABOO_REVERSE_WILL';
    const moveMap = new Map();

    for (const m of (legal || [])) {
        if (!m || !Number.isInteger(m.row) || !Number.isInteger(m.col)) continue;
        const key = `${m.row},${m.col}`;
        moveMap.set(key, { ...m, effectUsed, player, playerValue: player });
    }

    if (typeof CardLogic === 'undefined' || !CardLogic || typeof CardLogic.getTabooReverseCandidates !== 'function') {
        return Array.from(moveMap.values());
    }
    const currentCardState = (typeof cardState !== 'undefined') ? cardState : null;
    const playerKey = (player === 'white' || player === -1 || player === '-1') ? 'white' : 'black';

    const upsertMoveIfTabooValid = (row, col) => {
        const key = `${row},${col}`;
        const candidates = CardLogic.getTabooReverseCandidates(currentCardState, gameState, playerKey, row, col);
        if (!Array.isArray(candidates) || candidates.length === 0) return;

        const maxScore = candidates.reduce((max, one) => Math.max(max, Number(one && one.score) || 0), 0);
        const topCandidates = candidates.filter((one) => (Number(one && one.score) || 0) === maxScore);
        const best = topCandidates[0] || candidates[0];
        const flips = Array.isArray(best && best.flips)
            ? best.flips.map(p => [p.row, p.col])
            : [];
        moveMap.set(key, { row, col, flips, effectUsed, player, playerValue: player });
    };

    for (let r = 0; r < gameState.board.length; r++) {
        const boardRow = gameState.board[r];
        if (!Array.isArray(boardRow)) continue;
        for (let c = 0; c < boardRow.length; c++) {
            if (boardRow[c] !== EMPTY) continue;
            upsertMoveIfTabooValid(r, c);
        }
    }

    const expansionCells = getExpansionCellsForMoveGeneration(gameState);
    for (const expansion of expansionCells) {
        if (!expansion || Number(expansion.owner) !== EMPTY) continue;
        upsertMoveIfTabooValid(expansion.row, expansion.col);
    }

    return Array.from(moveMap.values());
}

/**
 * 自由配置モードの手を生成
 */
function generateFreePlacementMoves(player, protection, perma, effectType) {
    const effectUsed = effectType || 'FREE_PLACEMENT';
    const moves = [];
    for (let r = 0; r < gameState.board.length; r++) {
        const boardRow = gameState.board[r];
        if (!Array.isArray(boardRow)) continue;
        for (let c = 0; c < boardRow.length; c++) {
            if (boardRow[c] !== EMPTY) continue;
            if (typeof CardLogic !== 'undefined' && typeof CardLogic.isBlockedCell === 'function' && typeof cardState !== 'undefined') {
                if (CardLogic.isBlockedCell(cardState, r, c, gameState)) continue;
            }
            const flips = getFlips(gameState, r, c, player, protection, perma);
            moves.push({ row: r, col: c, flips, effectUsed, player, playerValue: player });
        }
    }
    const expansionCells = getExpansionCellsForMoveGeneration(gameState);
    for (const expansion of expansionCells) {
        if (!expansion || Number(expansion.owner) !== EMPTY) continue;
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.isBlockedCell === 'function' && typeof cardState !== 'undefined') {
            if (CardLogic.isBlockedCell(cardState, expansion.row, expansion.col, gameState)) {
                continue;
            }
        }
        const flips = getFlips(gameState, expansion.row, expansion.col, player, protection, perma);
        moves.push({ row: expansion.row, col: expansion.col, flips, effectUsed, player, playerValue: player });
    }
    return moves;
}

/**
 * スワップモードの手を生成
 */
function generateSwapMoves(player, legal, protection, perma) {
    const moves = [];
    const legalSet = new Set(legal.map(m => m.row + ',' + m.col));
    const protectedCells = createProtectedCellSet(protection, perma);
    const markers = (typeof cardState !== 'undefined' && cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];

    const deepCloneState = (s) => (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') ? globalThis.structuredClone(s) : JSON.parse(JSON.stringify(s));

    for (let r = 0; r < gameState.board.length; r++) {
        const boardRow = gameState.board[r];
        if (!Array.isArray(boardRow)) continue;
        for (let c = 0; c < boardRow.length; c++) {
            const cellVal = boardRow[c];
            const key = r + ',' + c;

            if (cellVal === -player && !protectedCells.has(key)) {
                const hasSpecialOrBomb = markers.some(m => (m.row === r && m.col === c) && isSpecialOrBombMarkerForMoveGeneration(m));
                if (hasSpecialOrBomb) continue;
                const clonedState = deepCloneState(gameState);
                setCellValueForMoveGeneration(clonedState, r, c, EMPTY);
                const swapFlips = getFlips(clonedState, r, c, player, protection, perma);
                moves.push({ row: r, col: c, flips: swapFlips, effectUsed: 'SWAP_WITH_ENEMY', player, playerValue: player });
            }
        }
    }

    const expansionCells = getExpansionCellsForMoveGeneration(gameState);
    for (const expansion of expansionCells) {
        if (!expansion) continue;
        const key = expansion.row + ',' + expansion.col;
        if (Number(expansion.owner) !== -player || protectedCells.has(key)) continue;

        const hasSpecialOrBomb = markers.some((marker) => (
            marker &&
            marker.row === expansion.row &&
            marker.col === expansion.col &&
            isSpecialOrBombMarkerForMoveGeneration(marker)
        ));
        if (hasSpecialOrBomb) continue;

        const clonedState = deepCloneState(gameState);
        if (!setCellValueForMoveGeneration(clonedState, expansion.row, expansion.col, EMPTY)) continue;
        const swapFlips = getFlips(clonedState, expansion.row, expansion.col, player, protection, perma);
        moves.push({ row: expansion.row, col: expansion.col, flips: swapFlips, effectUsed: 'SWAP_WITH_ENEMY', player, playerValue: player });
    }

    return moves;
}

/**
 * 特定セルの手を検索
 */
function findMoveForCell(player, row, col, pending, protection, perma) {
    const moves = generateMovesForPlayer(player, pending, protection, perma);
    return moves.find(m => m.row === row && m.col === col) || null;
}

// ===== Utility Functions =====

/**
 * 座標を表記法に変換
 */
function posToNotation(row, col) {
    if (MoveGeneratorSharedBoardUtils && typeof MoveGeneratorSharedBoardUtils.posToNotation === 'function') {
        return MoveGeneratorSharedBoardUtils.posToNotation(row, col);
    }
    const cols = 'abcdefgh';
    return cols[col] + (row + 1);
}

/**
 * 角かどうか判定
 */
function isCorner(row, col, boardOrRows) {
    if (MoveGeneratorSharedBoardUtils && typeof MoveGeneratorSharedBoardUtils.isCorner === 'function') {
        if (Array.isArray(boardOrRows)) return MoveGeneratorSharedBoardUtils.isCorner(row, col, boardOrRows);
        return MoveGeneratorSharedBoardUtils.isCorner(row, col, 8, 8);
    }
    return (row === 0 || row === 7) && (col === 0 || col === 7);
}

/**
 * 辺かどうか判定
 */
function isEdge(row, col, boardOrRows) {
    if (MoveGeneratorSharedBoardUtils && typeof MoveGeneratorSharedBoardUtils.isEdge === 'function') {
        if (Array.isArray(boardOrRows)) return MoveGeneratorSharedBoardUtils.isEdge(row, col, boardOrRows);
        return MoveGeneratorSharedBoardUtils.isEdge(row, col, 8, 8);
    }
    return row === 0 || row === 7 || col === 0 || col === 7;
}

// ===== Exports =====

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getLegalMoves,
        generateMovesForPlayer,
        generateFreePlacementMoves,
        generateSwapMoves,
        findMoveForCell,
        posToNotation,
        isCorner,
        isEdge
    };
}
