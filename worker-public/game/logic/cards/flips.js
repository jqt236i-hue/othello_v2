/**
 * @file flips.js
 * @description Flip calculation helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardFlips = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};

    if (DIRECTIONS === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing DIRECTIONS/EMPTY');
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
            cells.push({
                side: resolveExpansionSide(side, row, col),
                row,
                col,
                owner: (owner === BLACK || owner === WHITE) ? owner : EMPTY
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

    function getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context) {
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

        const [dr, dc] = dir;
        const flips = [];
        let r = row + dr;
        let c = col + dc;
        while (getCellValue(gameState, r, c) === -ownerVal) {
            const key = `${r},${c}`;
            if (blockedSet && blockedSet.has(key)) {
                return [];
            }
            if ((protectedSet && protectedSet.has(key)) ||
                (permaSet && permaSet.has(key))) {
                flips.length = 0;
                break;
            }
            flips.push({ row: r, col: c });
            r += dr;
            c += dc;
        }

        if (flips.length === 0) return [];
        if (blockedSet && blockedSet.has(`${r},${c}`)) return [];
        if (getCellValue(gameState, r, c) !== ownerVal) return [];
        return flips;
    }

    function getFlipsWithContext(state, row, col, player, context = {}) {
        if (getCellValue(state, row, col) !== EMPTY) return [];
        const blockedCells = context.blockedCells || [];
        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map(p => `${p.row},${p.col}`))
            : null;
        if (blockedSet && blockedSet.has(`${row},${col}`)) return [];

        const allFlips = [];
        for (const dir of (DIRECTIONS || [])) {
            const flips = getDirectionalChainFlips(state, row, col, player, dir, context);
            if (flips && flips.length) {
                // convert {row,col} objects to [r,c] tuples to match legacy callers
                for (const f of flips) allFlips.push([f.row, f.col]);
            }
        }
        return allFlips;
    }

    return {
        getDirectionalChainFlips,
        getFlipsWithContext
    };
}));