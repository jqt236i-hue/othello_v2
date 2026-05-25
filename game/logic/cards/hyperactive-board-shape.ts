import type { GameState } from '../../../src/types';

interface BoardConfig {
    rows: number;
    cols: number;
    baseBounds: {
        minRow: number;
        maxRow: number;
        minCol: number;
        maxCol: number;
    };
    outerBounds: {
        minRow: number;
        maxRow: number;
        minCol: number;
        maxCol: number;
    };
}

interface ExpansionCellRef {
    expansion: any;
    index: number;
    cell: any;
    legacy: boolean;
}

interface BoardShapeDeps {
    BoardUtils?: any;
    BLACK?: number;
    WHITE?: number;
    EMPTY?: number;
}

function resolveBoardConfig(gameState: GameState, deps?: BoardShapeDeps): BoardConfig {
    const boardUtils = deps && deps.BoardUtils;
    if (boardUtils && typeof boardUtils.resolveBoardConfig === 'function') {
        return boardUtils.resolveBoardConfig(gameState);
    }
    const board = gameState && Array.isArray((gameState as any).board) ? (gameState as any).board : null;
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

function isMainBoardCell(row: number, col: number, gameState: GameState, deps?: BoardShapeDeps): boolean {
    const boardUtils = deps && deps.BoardUtils;
    if (boardUtils && typeof boardUtils.isMainBoardCell === 'function') {
        return boardUtils.isMainBoardCell(row, col, gameState);
    }
    const config = resolveBoardConfig(gameState, deps);
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < config.rows && col >= 0 && col < config.cols;
}

function resolveExpansionSide(side: string | null, row: number, col: number, gameState: GameState, deps?: BoardShapeDeps): string | null {
    const boardUtils = deps && deps.BoardUtils;
    if (boardUtils && typeof boardUtils.resolveExpansionSide === 'function') {
        return boardUtils.resolveExpansionSide(side, row, col, gameState);
    }
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    const config = resolveBoardConfig(gameState, deps);
    if (col === config.outerBounds.minCol) return 'left';
    if (col === config.outerBounds.maxCol) return 'right';
    if (row === config.outerBounds.minRow) return 'top';
    if (row === config.outerBounds.maxRow) return 'bottom';
    return null;
}

function getExpansionCellRef(gameState: GameState, row: number, col: number, deps?: BoardShapeDeps): ExpansionCellRef | null {
    const expansion = ((gameState as any).boardExpansion && typeof (gameState as any).boardExpansion === 'object')
        ? (gameState as any).boardExpansion
        : null;
    if (!expansion) return null;
    const config = resolveBoardConfig(gameState, deps);

    if (Array.isArray(expansion.cells)) {
        for (let index = 0; index < expansion.cells.length; index++) {
            const cell = expansion.cells[index];
            if (!cell || typeof cell !== 'object') continue;
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? config.outerBounds.minCol : (cell.side === 'right' ? config.outerBounds.maxCol : null));
            if (!Number.isInteger(cellCol)) continue;
            if (cell.row === row && cellCol === col) {
                return { expansion, index, cell, legacy: false };
            }
        }
    }

    if (expansion.active === true) {
        const legacyCol = Number.isInteger(expansion.col)
            ? expansion.col
            : (expansion.side === 'left' ? config.outerBounds.minCol : (expansion.side === 'right' ? config.outerBounds.maxCol : null));
        if (expansion.row === row && legacyCol === col) {
            return { expansion, index: -1, cell: expansion, legacy: true };
        }
    }

    return null;
}

function getExpansionCells(gameState: GameState, deps?: BoardShapeDeps): any[] {
    const boardUtils = deps && deps.BoardUtils;
    const black = (deps && deps.BLACK) ?? 1;
    const white = (deps && deps.WHITE) ?? -1;
    const empty = (deps && deps.EMPTY) ?? 0;
    if (boardUtils && typeof boardUtils.collectExpansionDescriptors === 'function') {
        return boardUtils.collectExpansionDescriptors((gameState as any).boardExpansion, gameState);
    }
    const expansion = ((gameState as any).boardExpansion && typeof (gameState as any).boardExpansion === 'object')
        ? (gameState as any).boardExpansion
        : null;
    if (!expansion) return [];
    const config = resolveBoardConfig(gameState, deps);

    const seen = new Set<string>();
    const cells: any[] = [];
    const pushCell = (source: any, legacyRow?: number, legacyOwner?: number) => {
        let side = null;
        let normalizedRow: number | null = null;
        let normalizedCol: number | null = null;
        let owner = legacyOwner;

        if (source && typeof source === 'object') {
            side = source.side;
            normalizedRow = source.row;
            normalizedCol = source.col;
            owner = source.owner;
            if (!Number.isInteger(normalizedCol) && side === 'left') normalizedCol = config.outerBounds.minCol;
            if (!Number.isInteger(normalizedCol) && side === 'right') normalizedCol = config.outerBounds.maxCol;
        } else {
            side = source;
            normalizedRow = legacyRow ?? null;
            if (side === 'left') normalizedCol = config.outerBounds.minCol;
            if (side === 'right') normalizedCol = config.outerBounds.maxCol;
        }

        if (!Number.isInteger(normalizedRow) || !Number.isInteger(normalizedCol)) return;
        if (
            (normalizedRow as number) < config.outerBounds.minRow ||
            (normalizedRow as number) > config.outerBounds.maxRow ||
            (normalizedCol as number) < config.outerBounds.minCol ||
            (normalizedCol as number) > config.outerBounds.maxCol
        ) return;
        if (isMainBoardCell(normalizedRow as number, normalizedCol as number, gameState, deps)) return;
        const key = `${normalizedRow},${normalizedCol}`;
        if (seen.has(key)) return;
        seen.add(key);
        cells.push({
            side: resolveExpansionSide(side, normalizedRow as number, normalizedCol as number, gameState, deps),
            row: normalizedRow,
            col: normalizedCol,
            owner: (owner === black || owner === white) ? owner : empty
        });
    };

    if (Array.isArray(expansion.cells)) {
        for (const cell of expansion.cells) {
            if (!cell || typeof cell !== 'object') continue;
            pushCell(cell);
        }
    }

    if (seen.size === 0 && expansion.active === true) {
        pushCell(expansion);
    }

    return cells;
}

function forEachBoardShapeCell(gameState: GameState, visitor: (row: number, col: number, value: any, side?: string) => void, deps?: BoardShapeDeps): void {
    if (typeof visitor !== 'function') return;
    if (!gameState || !Array.isArray((gameState as any).board)) return;
    const config = resolveBoardConfig(gameState, deps);

    for (let row = 0; row < config.rows; row++) {
        const boardRow = Array.isArray((gameState as any).board[row]) ? (gameState as any).board[row] : [];
        for (let col = 0; col < config.cols; col++) {
            visitor(row, col, boardRow[col]);
        }
    }

    for (const cell of getExpansionCells(gameState, deps)) {
        if (!cell) continue;
        visitor(cell.row, cell.col, Number(cell.owner), cell.side);
    }
}

function getBoardCell(gameState: GameState, row: number, col: number, deps?: BoardShapeDeps): number | null {
    if (isMainBoardCell(row, col, gameState, deps)) {
        if (!gameState || !Array.isArray((gameState as any).board)) return null;
        const boardRow = (gameState as any).board[row];
        if (!Array.isArray(boardRow)) return null;
        return boardRow[col];
    }
    const ref = getExpansionCellRef(gameState, row, col, deps);
    return ref ? Number(ref.cell.owner) : null;
}

function setBoardCell(gameState: GameState, row: number, col: number, value: number, deps?: BoardShapeDeps): boolean {
    const black = (deps && deps.BLACK) ?? 1;
    const white = (deps && deps.WHITE) ?? -1;
    const empty = (deps && deps.EMPTY) ?? 0;
    if (isMainBoardCell(row, col, gameState, deps)) {
        if (!gameState || !Array.isArray((gameState as any).board)) return false;
        const boardRow = (gameState as any).board[row];
        if (!Array.isArray(boardRow)) return false;
        boardRow[col] = value;
        return true;
    }

    const ref = getExpansionCellRef(gameState, row, col, deps);
    if (!ref) return false;
    const normalizedOwner = (value === black || value === white) ? value : empty;

    if (!ref.legacy) {
        ref.expansion.cells[ref.index] = {
            side: resolveExpansionSide(ref.cell.side, row, col, gameState, deps),
            row,
            col,
            owner: normalizedOwner
        };
        return true;
    }

    ref.expansion.side = resolveExpansionSide(ref.cell.side, row, col, gameState, deps);
    ref.expansion.row = row;
    ref.expansion.col = col;
    ref.expansion.owner = normalizedOwner;
    return true;
}

function hasBoardShapeCell(gameState: GameState, row: number, col: number, deps?: BoardShapeDeps): boolean {
    return getBoardCell(gameState, row, col, deps) !== null;
}

const CardHyperactiveBoardShape = {
    resolveBoardConfig,
    isMainBoardCell,
    resolveExpansionSide,
    getExpansionCellRef,
    getExpansionCells,
    forEachBoardShapeCell,
    getBoardCell,
    setBoardCell,
    hasBoardShapeCell
};

const boardShapeRoot = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);
if (boardShapeRoot && !boardShapeRoot.CardHyperactiveBoardShape) {
    boardShapeRoot.CardHyperactiveBoardShape = CardHyperactiveBoardShape;
}

export = CardHyperactiveBoardShape;
