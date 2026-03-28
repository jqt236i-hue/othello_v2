/**
 * @file targets.js
 * @description Card target selection helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardTargets = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { EMPTY } = SharedConstants || {};

    if (EMPTY === undefined) {
        throw new Error('SharedConstants not loaded');
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

    function getExpansionCells(gameState) {
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];

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
            const normalizedOwner = (owner === SharedConstants.BLACK || owner === SharedConstants.WHITE)
                ? owner
                : EMPTY;
            cells.push({
                side: resolveExpansionSide(side, row, col),
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
        if (isMainBoardCell(row, col)) {
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
        if (!gameState || !Array.isArray(gameState.board) || gameState.board.length !== 8) return;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                visitor(row, col, gameState.board[row][col]);
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
