/**
 * @file targets.js
 * @description Card target selection helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../../../shared-constants'),
            require('../../../shared/shared-board-utils')
        );
    } else {
        root.CardTargets = factory(root.SharedConstants, root.SharedBoardUtils);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, SharedBoardUtils) {
    'use strict';

    const { EMPTY } = SharedConstants || {};
    const BoardUtils = SharedBoardUtils || null;

    if (EMPTY === undefined) {
        throw new Error('SharedConstants not loaded');
    }

    function resolveBoardConfigSource(gameState) {
        if (!gameState || typeof gameState !== 'object') return null;
        if (gameState.boardConfig && typeof gameState.boardConfig === 'object') return gameState.boardConfig;
        return Array.isArray(gameState.board) ? gameState.board : null;
    }

    function getBoardExtents(gameState) {
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : [];
        const rows = board.length;
        let cols = 0;
        for (const row of board) {
            if (Array.isArray(row)) cols = Math.max(cols, row.length);
        }
        return { rows, cols };
    }

    function resolveBoardShapeBoard(gameState) {
        if (!gameState || !Array.isArray(gameState.board)) return null;
        if (!BoardUtils || typeof BoardUtils.attachBoardShape !== 'function') return gameState.board;
        return BoardUtils.attachBoardShape(gameState.board, {
            boardConfig: resolveBoardConfigSource(gameState) || gameState.board,
            boardExpansion: gameState.boardExpansion
        });
    }

    function isMainBoardCell(gameState, row, col) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (BoardUtils && typeof BoardUtils.isMainBoardCell === 'function') {
            return BoardUtils.isMainBoardCell(row, col, resolveBoardConfigSource(gameState));
        }
        const extents = getBoardExtents(gameState);
        return row >= 0 && row < extents.rows && col >= 0 && col < extents.cols;
    }

    function resolveExpansionSide(gameState, side, row, col) {
        if (BoardUtils && typeof BoardUtils.resolveExpansionSide === 'function') {
            return BoardUtils.resolveExpansionSide(side, row, col, resolveBoardConfigSource(gameState));
        }
        const extents = getBoardExtents(gameState);
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (col === -1) return 'left';
        if (col === extents.cols) return 'right';
        if (row === -1) return 'top';
        if (row === extents.rows) return 'bottom';
        return null;
    }

    function getExpansionCells(gameState) {
        if (BoardUtils && typeof BoardUtils.collectExpansionDescriptors === 'function') {
            return BoardUtils.collectExpansionDescriptors(
                gameState && gameState.boardExpansion,
                resolveBoardConfigSource(gameState) || (gameState && gameState.board)
            );
        }

        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];

        const extents = getBoardExtents(gameState);
        const cells = [];
        const pushCell = (source, legacyRow, legacyOwner) => {
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
                if (!Number.isInteger(col) && side === 'right') col = extents.cols;
            } else {
                side = source;
                row = legacyRow;
                if (side === 'left') col = -1;
                if (side === 'right') col = extents.cols;
            }

            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            if (row < -1 || row > extents.rows || col < -1 || col > extents.cols) return;
            if (isMainBoardCell(gameState, row, col)) return;
            if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
            const normalizedOwner = (owner === SharedConstants.BLACK || owner === SharedConstants.WHITE)
                ? owner
                : EMPTY;
            cells.push({
                side: resolveExpansionSide(gameState, side, row, col),
                row,
                col,
                owner: normalizedOwner
            });
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

    function getCellValue(gameState, row, col) {
        const board = resolveBoardShapeBoard(gameState);
        if (board && BoardUtils && typeof BoardUtils.getCellValue === 'function') {
            return BoardUtils.getCellValue(board, row, col);
        }
        if (isMainBoardCell(gameState, row, col)) {
            return (gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]))
                ? gameState.board[row][col]
                : null;
        }
        for (const cell of getExpansionCells(gameState)) {
            if (!cell) continue;
            if (cell.row === row && cell.col === col) {
                return Number(cell.owner);
            }
        }
        return null;
    }

    function forEachBoardShapeCell(gameState, visitor) {
        if (typeof visitor !== 'function') return;
        const board = resolveBoardShapeBoard(gameState);
        if (board && BoardUtils && typeof BoardUtils.collectBoardCoordinates === 'function' && typeof BoardUtils.getCellValue === 'function') {
            for (const cell of BoardUtils.collectBoardCoordinates(board)) {
                visitor(cell.row, cell.col, BoardUtils.getCellValue(board, cell.row, cell.col));
            }
            return;
        }
        if (!gameState || !Array.isArray(gameState.board)) return;

        for (let row = 0; row < gameState.board.length; row++) {
            const boardRow = Array.isArray(gameState.board[row]) ? gameState.board[row] : [];
            for (let col = 0; col < boardRow.length; col++) {
                visitor(row, col, boardRow[col]);
            }
        }

        for (const cell of getExpansionCells(gameState)) {
            if (!cell) continue;
            visitor(cell.row, cell.col, Number(cell.owner));
        }
    }

    function getTemptWillTargets(cardState, gameState, playerKey) {
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const res = [];
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const isGuarded = (r, c) => markers.some(m =>
            m &&
            m.kind === 'specialStone' &&
            m.row === r &&
            m.col === c &&
            m.data &&
            m.data.type === 'GUARD'
        );
        // Prefer CardUtils if available (handles bombs and special stones uniformly)
        const CardUtils = (typeof require === 'function') ? require('./utils') : (typeof globalThis !== 'undefined' ? globalThis.CardUtils : null);
        forEachBoardShapeCell(gameState, (r, c) => {
            if (isGuarded(r, c)) return;
            // Must be a special stone or bomb owned by opponent and not an empty cell
            if (CardUtils && typeof CardUtils.isSpecialStoneAt === 'function') {
                if (!CardUtils.isSpecialStoneAt(cardState, r, c)) return;
                if (CardUtils.getSpecialOwnerAt(cardState, r, c) !== opponentKey) return;
                if (getCellValue(gameState, r, c) === EMPTY) return;
                res.push({ row: r, col: c });
                return;
            }

            const marker = (cardState.markers || []).find(m => m.kind === 'specialStone' && m.row === r && m.col === c);
            if (!marker) return;
            if (marker.owner !== opponentKey) return;
            if (getCellValue(gameState, r, c) === EMPTY) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getCaptureWillTargets(cardState, gameState, playerKey) {
        return getTemptWillTargets(cardState, gameState, playerKey);
    }

    return {
        getTemptWillTargets,
        getCaptureWillTargets
    };
}));
