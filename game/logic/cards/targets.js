/**
 * @file targets.js
 * @description Card target selection helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'), require('../../../shared/shared-board-utils'));
    } else {
        root.CardTargets = factory(root.SharedConstants, root.SharedBoardUtils || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, SharedBoardUtils) {
    'use strict';

    const { EMPTY } = SharedConstants || {};
    const BoardUtils = SharedBoardUtils || null;

    if (EMPTY === undefined) {
        throw new Error('SharedConstants not loaded');
    }

    function resolveBoardConfig(gameState) {
        if (BoardUtils && typeof BoardUtils.resolveBoardConfig === 'function') {
            return BoardUtils.resolveBoardConfig(gameState);
        }
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
        const rows = Array.isArray(board) && board.length > 0 ? board.length : 8;
        const cols = Array.isArray(board) && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
        return {
            rows,
            cols,
            baseBounds: {
                minRow: 0,
                maxRow: rows - 1,
                minCol: 0,
                maxCol: cols - 1
            },
            outerBounds: {
                minRow: -1,
                maxRow: rows,
                minCol: -1,
                maxCol: cols
            }
        };
    }

    function isMainBoardCell(row, col, gameState) {
        if (BoardUtils && typeof BoardUtils.isMainBoardCell === 'function') {
            return BoardUtils.isMainBoardCell(row, col, gameState);
        }
        const config = resolveBoardConfig(gameState);
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < config.rows && col >= 0 && col < config.cols;
    }

    function resolveExpansionSide(side, row, col, gameState) {
        if (BoardUtils && typeof BoardUtils.resolveExpansionSide === 'function') {
            return BoardUtils.resolveExpansionSide(side, row, col, gameState);
        }
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        const config = resolveBoardConfig(gameState);
        if (col === config.outerBounds.minCol) return 'left';
        if (col === config.outerBounds.maxCol) return 'right';
        if (row === config.outerBounds.minRow) return 'top';
        if (row === config.outerBounds.maxRow) return 'bottom';
        return null;
    }

    function getExpansionCells(gameState) {
        if (BoardUtils && typeof BoardUtils.collectExpansionDescriptors === 'function') {
            return BoardUtils.collectExpansionDescriptors(gameState && gameState.boardExpansion, gameState);
        }
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];
        const config = resolveBoardConfig(gameState);

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
                if (!Number.isInteger(col) && side === 'left') col = config.outerBounds.minCol;
                if (!Number.isInteger(col) && side === 'right') col = config.outerBounds.maxCol;
            } else {
                side = source;
                row = legacyRow;
                if (side === 'left') col = config.outerBounds.minCol;
                if (side === 'right') col = config.outerBounds.maxCol;
            }

            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            if (
                row < config.outerBounds.minRow ||
                row > config.outerBounds.maxRow ||
                col < config.outerBounds.minCol ||
                col > config.outerBounds.maxCol
            ) return;
            if (isMainBoardCell(row, col, gameState)) return;
            if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
            const normalizedOwner = (owner === SharedConstants.BLACK || owner === SharedConstants.WHITE)
                ? owner
                : EMPTY;
            cells.push({
                side: resolveExpansionSide(side, row, col, gameState),
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
        if (isMainBoardCell(row, col, gameState)) {
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
        if (!gameState || !Array.isArray(gameState.board)) return;
        const config = resolveBoardConfig(gameState);

        for (let row = 0; row < config.rows; row++) {
            const boardRow = Array.isArray(gameState.board[row]) ? gameState.board[row] : [];
            for (let col = 0; col < config.cols; col++) {
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
