/**
 * @file destroy_one_stone.js
 * @description DESTROY_ONE_STONE helper - UMD module for browser and Node.js
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../board_ops'));
    } else {
        root.DestroyOneStone = factory(root.BoardOps);
    }
}(typeof self !== 'undefined' ? self : this, function (BoardOpsModule) {
    'use strict';

    function isMainBoardCell(row, col) {
        return Number.isInteger(row) && row >= 0 && row < 8 && Number.isInteger(col) && col >= 0 && col < 8;
    }

    function resolveExpansionSide(side, row, col) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (col === -1) return 'left';
        if (col === 8) return 'right';
        if (row === -1) return 'top';
        if (row === 8) return 'bottom';
        return null;
    }

    function isExpansionCoordinate(row, col) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (row < -1 || row > 8 || col < -1 || col > 8) return false;
        if (isMainBoardCell(row, col)) return false;
        return true;
    }

    function normalizeExpansionOwner(owner) {
        return (owner === 1 || owner === -1) ? owner : 0;
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

            if (!isExpansionCoordinate(row, col)) return;
            if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
            cells.push({
                side: resolveExpansionSide(side, row, col),
                row,
                col,
                owner: normalizeExpansionOwner(owner)
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

    function syncLegacyExpansionFields(expansion) {
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col) : null;
        expansion.row = latest ? latest.row : null;
        expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : 0;
    }

    function getCellValue(gameState, row, col) {
        if (!gameState || !Array.isArray(gameState.board)) return null;
        if (isMainBoardCell(row, col)) {
            return gameState.board[row][col];
        }

        for (const cell of getExpansionCells(gameState)) {
            if (!cell) continue;
            if (cell.row === row && cell.col === col) {
                return normalizeExpansionOwner(cell.owner);
            }
        }

        return null;
    }

    function applyDestroyOneStone(cardState, gameState, playerKey, row, col, deps = {}) {
        const result = { destroyed: false, evaded: false };
        if (!gameState) return result;

        const BoardOps = deps.BoardOps || BoardOpsModule;
        const destroyAtFn = deps.destroyAt;

        // Prefer BoardOps.destroyAt to ensure unified behavior and presentation event emission
        if (BoardOps && typeof BoardOps.destroyAt === 'function') {
            const res = BoardOps.destroyAt(cardState, gameState, row, col, 'DESTROY_ONE_STONE', 'destroy_one_stone');
            if (res && (res.destroyed || res.evaded)) {
                cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
                cardState.pendingEffectByPlayer[playerKey] = null;
                result.destroyed = !!res.destroyed;
                result.evaded = !!res.evaded;
                return result;
            }
            // If BoardOps rejected destroy (e.g. guard protection), do not bypass with fallback paths.
            if (res && res.destroyed === false) {
                return result;
            }
        }

        // If destroyAt function provided
        if (typeof destroyAtFn === 'function') {
            if (getCellValue(gameState, row, col) === 0) return result;
            const destroyed = destroyAtFn(cardState, gameState, row, col);
            if (destroyed) {
                cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
                cardState.pendingEffectByPlayer[playerKey] = null;
                result.destroyed = true;
                return result;
            }
        }

        // Fallback: original inline behavior
        if (getCellValue(gameState, row, col) === 0) return result;
        if (cardState && cardState.markers) {
            cardState.markers = cardState.markers.filter(m => !(m.row === row && m.col === col));
        }
        if (Number.isInteger(row) && row >= 0 && row < 8 && Number.isInteger(col) && col >= 0 && col < 8) {
            gameState.board[row][col] = 0;
        } else if (gameState.boardExpansion && typeof gameState.boardExpansion === 'object') {
            const expansion = gameState.boardExpansion;
            const cells = getExpansionCells(gameState).map((cell) => ({ ...cell }));
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                if (!cell || typeof cell !== 'object') continue;
                if (cell.row === row && cell.col === col) {
                    cells[i] = Object.assign({}, cell, { owner: 0 });
                }
            }
            expansion.cells = cells.map((cell) => ({
                side: cell.side,
                row: cell.row,
                col: cell.col,
                owner: normalizeExpansionOwner(cell.owner)
            }));
            syncLegacyExpansionFields(expansion);
        }
        cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
        cardState.pendingEffectByPlayer[playerKey] = null;
        result.destroyed = true;
        return result;
    }

    return {
        applyDestroyOneStone
    };
}));
