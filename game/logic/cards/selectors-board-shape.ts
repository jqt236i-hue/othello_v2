import type { GameState } from '../../../src/types';

interface BoardConfig {
    rows: number;
    cols: number;
    baseBounds: { minRow: number; maxRow: number; minCol: number; maxCol: number };
    outerBounds: { minRow: number; maxRow: number; minCol: number; maxCol: number };
}

interface ExpansionCell {
    side: string | null;
    row: number;
    col: number;
    owner: number;
}

interface SelectorsBoardShapeDeps {
    SharedBoardUtils?: any;
    SharedConstants?: any;
    P_EMPTY?: number;
}

function resolveBoardConfig(gameState: GameState, deps?: SelectorsBoardShapeDeps): BoardConfig {
    const sharedBoardUtils = deps && deps.SharedBoardUtils;
    if (sharedBoardUtils && typeof sharedBoardUtils.resolveBoardConfig === 'function') {
        return sharedBoardUtils.resolveBoardConfig(gameState);
    }
    const gs = gameState as any;
    const board = gs && Array.isArray(gs.board) ? gs.board : null;
    const rows = Array.isArray(board) && board.length > 0 ? board.length : 8;
    const cols = Array.isArray(board) && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
    return {
        rows,
        cols,
        baseBounds: { minRow: 0, maxRow: rows - 1, minCol: 0, maxCol: cols - 1 },
        outerBounds: { minRow: -1, maxRow: rows, minCol: -1, maxCol: cols }
    };
}

function isMainBoardCell(row: number, col: number, gameState: GameState, deps?: SelectorsBoardShapeDeps): boolean {
    const sharedBoardUtils = deps && deps.SharedBoardUtils;
    if (sharedBoardUtils && typeof sharedBoardUtils.isMainBoardCell === 'function') {
        return sharedBoardUtils.isMainBoardCell(row, col, gameState);
    }
    const config = resolveBoardConfig(gameState, deps);
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < config.rows && col >= 0 && col < config.cols;
}

function resolveExpansionSide(side: string | null, row: number, col: number, gameState: GameState, deps?: SelectorsBoardShapeDeps): string | null {
    const sharedBoardUtils = deps && deps.SharedBoardUtils;
    if (sharedBoardUtils && typeof sharedBoardUtils.resolveExpansionSide === 'function') {
        return sharedBoardUtils.resolveExpansionSide(side, row, col, gameState);
    }
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    const config = resolveBoardConfig(gameState, deps);
    if (col === config.outerBounds.minCol) return 'left';
    if (col === config.outerBounds.maxCol) return 'right';
    if (row === config.outerBounds.minRow) return 'top';
    if (row === config.outerBounds.maxRow) return 'bottom';
    return null;
}

function getExpansionCells(gameState: GameState, deps?: SelectorsBoardShapeDeps): ExpansionCell[] {
    const sharedConstants = (deps && deps.SharedConstants) || {};
    const pEmpty = (deps && deps.P_EMPTY !== undefined) ? deps.P_EMPTY : 0;
    const sharedBoardUtils = deps && deps.SharedBoardUtils;
    if (sharedBoardUtils && typeof sharedBoardUtils.collectExpansionDescriptors === 'function') {
        return sharedBoardUtils.collectExpansionDescriptors(
            (gameState as any)?.boardExpansion,
            gameState
        ).map((cell: any) => ({
            side: resolveExpansionSide(cell.side || null, cell.row, cell.col, gameState, deps),
            row: cell.row,
            col: cell.col,
            owner: cell.owner === sharedConstants.BLACK || cell.owner === sharedConstants.WHITE
                ? cell.owner
                : pEmpty
        }));
    }
    const gs = gameState as any;
    const expansion = (gs && gs.boardExpansion && typeof gs.boardExpansion === 'object')
        ? gs.boardExpansion
        : null;
    if (!expansion) return [];
    const config = resolveBoardConfig(gameState, deps);

    const cells: ExpansionCell[] = [];
    const pushCell = (source: any, legacyRow?: number, legacyOwner?: any) => {
        let side: string | null = null;
        let row: number | null = null;
        let col: number | null = null;
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
            row = legacyRow !== undefined ? legacyRow : null;
            if (side === 'left') col = config.outerBounds.minCol;
            if (side === 'right') col = config.outerBounds.maxCol;
        }

        if (!Number.isInteger(row) || !Number.isInteger(col)) return;
        const r = row as number;
        const c = col as number;
        if (r < config.outerBounds.minRow || r > config.outerBounds.maxRow) return;
        if (c < config.outerBounds.minCol || c > config.outerBounds.maxCol) return;
        if (isMainBoardCell(r, c, gameState, deps)) return;
        if (cells.some((cell) => cell && cell.row === r && cell.col === c)) return;
        const normalizedOwner = (owner === sharedConstants.BLACK || owner === sharedConstants.WHITE)
            ? owner
            : pEmpty;
        cells.push({
            side: resolveExpansionSide(side, r, c, gameState, deps),
            row: r,
            col: c,
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

function getCellValue(gameState: GameState, row: number, col: number, deps?: SelectorsBoardShapeDeps): any {
    if (isMainBoardCell(row, col, gameState, deps)) {
        const gs = gameState as any;
        return (gs && Array.isArray(gs.board) && Array.isArray(gs.board[row]))
            ? gs.board[row][col]
            : null;
    }
    for (const expansion of getExpansionCells(gameState, deps)) {
        if (!expansion) continue;
        if (expansion.row === row && expansion.col === col) {
            return Number(expansion.owner);
        }
    }
    return null;
}

function hasBoardShapeCell(gameState: GameState, row: number, col: number, deps?: SelectorsBoardShapeDeps): boolean {
    return getCellValue(gameState, row, col, deps) !== null;
}

function forEachBoardShapeCell(gameState: GameState, visitor: (r: number, c: number, owner: number) => void, deps?: SelectorsBoardShapeDeps): void {
    if (typeof visitor !== 'function') return;
    const sharedBoardUtils = deps && deps.SharedBoardUtils;
    if (sharedBoardUtils && typeof sharedBoardUtils.forEachBoardShapeCell === 'function') {
        sharedBoardUtils.forEachBoardShapeCell(gameState, visitor);
        return;
    }
    const gs = gameState as any;
    if (!gs || !Array.isArray(gs.board)) return;
    const config = resolveBoardConfig(gameState, deps);

    for (let row = 0; row < config.rows; row++) {
        for (let col = 0; col < config.cols; col++) {
            visitor(row, col, gs.board[row][col]);
        }
    }

    for (const expansion of getExpansionCells(gameState, deps)) {
        if (!expansion) continue;
        visitor(expansion.row, expansion.col, Number(expansion.owner));
    }
}

const CardSelectorsBoardShape = {
    resolveBoardConfig,
    isMainBoardCell,
    resolveExpansionSide,
    getExpansionCells,
    getCellValue,
    hasBoardShapeCell,
    forEachBoardShapeCell
};

const selectorsBoardShapeRoot = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);
if (selectorsBoardShapeRoot && !selectorsBoardShapeRoot.CardSelectorsBoardShape) {
    selectorsBoardShapeRoot.CardSelectorsBoardShape = CardSelectorsBoardShape;
}

export = CardSelectorsBoardShape;
