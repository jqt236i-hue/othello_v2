/**
 * @file flips.ts
 * @description Flip calculation helpers (Shared between Browser and Headless)
 */

import { GameState } from '../../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const SharedConstants = ((typeof module === 'object' && module.exports)
    ? safeRequire('../../../shared-constants')
    : null) || (typeof self !== 'undefined' ? (self as any).SharedConstants : undefined);

const SharedBoardUtils = ((typeof module === 'object' && module.exports)
    ? safeRequire('../../../shared/shared-board-utils')
    : null) || (typeof self !== 'undefined' ? (self as any).SharedBoardUtils : null);

const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};

if (DIRECTIONS === undefined || EMPTY === undefined) {
    throw new Error('SharedConstants missing DIRECTIONS/EMPTY');
}

interface Bounds {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
}

interface ExpansionCell {
    side: string | null;
    row: number;
    col: number;
    owner: number;
}

function resolveBoardBounds(gameState: GameState): Bounds | null {
    if (SharedBoardUtils && typeof SharedBoardUtils.resolveBoardBounds === 'function') {
        return SharedBoardUtils.resolveBoardBounds(gameState && gameState.board);
    }
    const board = gameState && gameState.board;
    if (!Array.isArray(board) || board.length <= 0) return null;
    let maxCol = -1;
    for (const row of board) {
        if (Array.isArray(row) && row.length > 0) {
            maxCol = Math.max(maxCol, row.length - 1);
        }
    }
    if (maxCol < 0) return null;
    return { minRow: 0, maxRow: board.length - 1, minCol: 0, maxCol };
}

function isMainBoardCell(gameState: GameState, row: number, col: number): boolean {
    const bounds = resolveBoardBounds(gameState);
    return !!(
        bounds &&
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        row >= bounds.minRow &&
        row <= bounds.maxRow &&
        col >= bounds.minCol &&
        col <= bounds.maxCol
    );
}

function resolveExpansionSide(side: string | null, row: number, col: number, gameState: GameState): string | null {
    const bounds = resolveBoardBounds(gameState);
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    if (!bounds) return null;
    if (col === -1) return 'left';
    if (col === (bounds.maxCol + 1)) return 'right';
    if (row === -1) return 'top';
    if (row === (bounds.maxRow + 1)) return 'bottom';
    return null;
}

function getExpansionCells(gameState: GameState): ExpansionCell[] {
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion as any
        : null;
    if (!expansion) return [];

    const cells: ExpansionCell[] = [];
    const pushCell = (source: any, legacyRow?: number, legacyOwner?: number) => {
        let side: string | null = null;
        let row: any = null;
        let col: any = null;
        let owner = legacyOwner;

        if (source && typeof source === 'object') {
            side = source.side;
            row = source.row;
            col = source.col;
            owner = source.owner;
        if (!Number.isInteger(col) && side === 'left') col = -1;
        if (!Number.isInteger(col) && side === 'right') col = ((resolveBoardBounds(gameState) || { maxCol: 7 }).maxCol + 1);
        } else {
            side = source;
            row = legacyRow as number;
            if (side === 'left') col = -1;
            if (side === 'right') col = ((resolveBoardBounds(gameState) || { maxCol: 7 }).maxCol + 1);
        }

        if (!Number.isInteger(row) || !Number.isInteger(col)) return;
        const bounds = resolveBoardBounds(gameState);
        if (!bounds) return;
        if (row < -1 || row > (bounds.maxRow + 1) || col < -1 || col > (bounds.maxCol + 1)) return;
        if (isMainBoardCell(gameState, row, col)) return;
        if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
        cells.push({
            side: resolveExpansionSide(side, row, col, gameState),
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

function getCellValue(gameState: GameState, row: number, col: number): number | null {
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

function getDirectionalChainFlips(gameState: GameState, row: number, col: number, ownerVal: number, dir: number[], context: any): Array<{row: number; col: number}> {
    const protectedStones = context.protectedStones || [];
    const permaProtectedStones = context.permaProtectedStones || [];
    const blockedCells = context.blockedCells || [];

    const protectedSet = protectedStones.length
        ? new Set(protectedStones.map((p: any) => `${p.row},${p.col}`))
        : null;
    const permaSet = permaProtectedStones.length
        ? new Set(permaProtectedStones.map((p: any) => `${p.row},${p.col}`))
        : null;
    const blockedSet = blockedCells.length
        ? new Set(blockedCells.map((p: any) => `${p.row},${p.col}`))
        : null;

    const [dr, dc] = dir;
    const flips: Array<{row: number; col: number}> = [];
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

function getFlipsWithContext(state: GameState, row: number, col: number, player: number, context: any = {}): number[][] {
    if (getCellValue(state, row, col) !== EMPTY) return [];
    const blockedCells = context.blockedCells || [];
    const blockedSet = blockedCells.length
        ? new Set(blockedCells.map((p: any) => `${p.row},${p.col}`))
        : null;
    if (blockedSet && blockedSet.has(`${row},${col}`)) return [];

    const allFlips: number[][] = [];
    for (const dir of (DIRECTIONS || [])) {
        const flips = getDirectionalChainFlips(state, row, col, player, dir, context);
        if (flips && flips.length) {
            // convert {row,col} objects to [r,c] tuples to match legacy callers
            for (const f of flips) allFlips.push([f.row, f.col]);
        }
    }
    return allFlips;
}

export = {
    getDirectionalChainFlips,
    getFlipsWithContext
};
