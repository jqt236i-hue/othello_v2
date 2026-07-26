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
    expansion: null;
    index: number;
    cell: any;
    legacy: false;
}

interface BoardShapeDeps {
    BoardUtils?: any;
    BLACK?: number;
    WHITE?: number;
    EMPTY?: number;
}

function requireBoardUtils(deps?: BoardShapeDeps): any {
    const boardUtils = deps && deps.BoardUtils;
    if (
        !boardUtils ||
        typeof boardUtils.createBoardContext !== 'function' ||
        typeof boardUtils.createBoardView !== 'function' ||
        typeof boardUtils.setCellValue !== 'function' ||
        typeof boardUtils.resolveBoardConfig !== 'function' ||
        typeof boardUtils.isMainBoardCell !== 'function' ||
        typeof boardUtils.resolveExpansionSide !== 'function'
    ) {
        throw new Error('SharedBoardUtils BoardContext APIs are required by CardHyperactiveBoardShape');
    }
    return boardUtils;
}

function createBoardContext(gameState: GameState, cardState: unknown, deps?: BoardShapeDeps): any {
    return requireBoardUtils(deps).createBoardContext(gameState, cardState);
}

function createBoardView(gameState: GameState, cardState: unknown, deps?: BoardShapeDeps): any {
    const boardUtils = requireBoardUtils(deps);
    const context = createBoardContext(gameState, cardState, deps);
    return boardUtils.createBoardView(context.gameState, {
        cardState: context.cardState,
        strict: false
    });
}

function resolveBoardConfig(gameState: GameState, deps?: BoardShapeDeps): BoardConfig {
    return requireBoardUtils(deps).resolveBoardConfig(gameState);
}

function isMainBoardCell(row: number, col: number, gameState: GameState, deps?: BoardShapeDeps): boolean {
    return requireBoardUtils(deps).isMainBoardCell(row, col, gameState);
}

function resolveExpansionSide(side: string | null, row: number, col: number, gameState: GameState, deps?: BoardShapeDeps): string | null {
    return requireBoardUtils(deps).resolveExpansionSide(side, row, col, gameState);
}

function getExpansionCells(gameState: GameState, cardState: unknown = null, deps?: BoardShapeDeps): any[] {
    const view = createBoardView(gameState, cardState, deps);
    return view.expansionCells
        .filter((cell: any) => view.isPlayable(cell.row, cell.col))
        .map((cell: any) => ({
            side: cell.side || null,
            row: cell.row,
            col: cell.col,
            owner: cell.owner
        }));
}

function getExpansionCellRef(
    gameState: GameState,
    row: number,
    col: number,
    cardState: unknown = null,
    deps?: BoardShapeDeps
): ExpansionCellRef | null {
    const cells = getExpansionCells(gameState, cardState, deps);
    const index = cells.findIndex((cell: any) => cell.row === row && cell.col === col);
    return index >= 0
        ? { expansion: null, index, cell: cells[index], legacy: false }
        : null;
}

function forEachBoardShapeCell(
    gameState: GameState,
    visitor: (row: number, col: number, value: any, side?: string) => void,
    cardState: unknown = null,
    deps?: BoardShapeDeps
): void {
    if (typeof visitor !== 'function') return;
    const view = createBoardView(gameState, cardState, deps);
    for (const cell of view.coordinates) {
        const value = view.get(cell.row, cell.col);
        if (value === null) {
            throw new Error(`BoardView owner missing at ${cell.row},${cell.col}`);
        }
        const side = view.topology.expansionSideByKey.get(`${cell.row},${cell.col}`) || undefined;
        visitor(cell.row, cell.col, value, side);
    }
}

function getBoardCell(
    gameState: GameState,
    row: number,
    col: number,
    cardState: unknown = null,
    deps?: BoardShapeDeps
): number | null {
    return createBoardView(gameState, cardState, deps).get(row, col);
}

function setBoardCell(
    gameState: GameState,
    row: number,
    col: number,
    value: number,
    cardState: unknown = null,
    deps?: BoardShapeDeps
): boolean {
    const boardUtils = requireBoardUtils(deps);
    return boardUtils.setCellValue(createBoardContext(gameState, cardState, deps), row, col, value);
}

function hasBoardShapeCell(
    gameState: GameState,
    row: number,
    col: number,
    cardState: unknown = null,
    deps?: BoardShapeDeps
): boolean {
    return createBoardView(gameState, cardState, deps).isPlayable(row, col);
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
