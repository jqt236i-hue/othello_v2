import type { GameState } from '../../../src/types';

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

function getRuntimeGlobalValue(key: string): any {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) {
            return (globalThis as any)[key];
        }
        if (typeof self !== 'undefined' && (self as any)[key]) {
            return (self as any)[key];
        }
    } catch (_error) { /* ignore */ }
    return undefined;
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (_error) {
        return null;
    }
}

const SharedConstants = safeRequire('../../../shared-constants') || getRuntimeGlobalValue('SharedConstants');
const CardExpansionModule = safeRequire('../cards/expansion') || getRuntimeGlobalValue('CardExpansion');

const P_BLACK = SharedConstants && SharedConstants.BLACK !== undefined ? SharedConstants.BLACK : 1;
const P_WHITE = SharedConstants && SharedConstants.WHITE !== undefined ? SharedConstants.WHITE : -1;
const P_EMPTY = SharedConstants && SharedConstants.EMPTY !== undefined ? SharedConstants.EMPTY : 0;

function normalizeExpansionOwner(owner: any): number {
    return (owner === P_BLACK || owner === P_WHITE) ? owner : P_EMPTY;
}

function resolveBoardDims(gameState: GameState): { rows: number; cols: number } {
    const board = gameState && Array.isArray((gameState as any).board) ? (gameState as any).board : null;
    const rows = board && board.length > 0 ? board.length : 8;
    const cols = board && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
    return { rows, cols };
}

function isMainBoardCell(row: number, col: number, gameState: GameState): boolean {
    if (CardExpansionModule && typeof CardExpansionModule.isMainBoardCellForCard === 'function') {
        return !!CardExpansionModule.isMainBoardCellForCard(row, col, gameState);
    }
    const dims = resolveBoardDims(gameState);
    return Number.isInteger(row) && row >= 0 && row < dims.rows && Number.isInteger(col) && col >= 0 && col < dims.cols;
}

function resolveExpansionSide(side: any, row: number, col: number, gameState: GameState): string | null {
    if (CardExpansionModule && typeof CardExpansionModule.resolveExpansionSideForCard === 'function') {
        return CardExpansionModule.resolveExpansionSideForCard(side, row, col, gameState);
    }
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    const dims = resolveBoardDims(gameState);
    if (col === -1) return 'left';
    if (col === dims.cols) return 'right';
    if (row === -1) return 'top';
    if (row === dims.rows) return 'bottom';
    return null;
}

function isExpansionCoordinate(row: number, col: number, gameState: GameState): boolean {
    if (CardExpansionModule && typeof CardExpansionModule.isExpansionCoordinateForCard === 'function') {
        return !!CardExpansionModule.isExpansionCoordinateForCard(row, col, gameState);
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const dims = resolveBoardDims(gameState);
    if (row < -1 || row > dims.rows || col < -1 || col > dims.cols) return false;
    return !isMainBoardCell(row, col, gameState);
}

function getExpansionCells(gameState: GameState): Array<{ side: string | null; row: number; col: number; owner: number }> {
    if (CardExpansionModule && typeof CardExpansionModule.getExpansionDescriptorsForCard === 'function') {
        return CardExpansionModule.getExpansionDescriptorsForCard(gameState);
    }
    const expansion = (gameState && (gameState as any).boardExpansion && typeof (gameState as any).boardExpansion === 'object')
        ? (gameState as any).boardExpansion
        : null;
    if (!expansion) return [];

    const cells: Array<{ side: string | null; row: number; col: number; owner: number }> = [];
    const pushCell = (source: any, legacyRow?: any, legacyOwner?: any) => {
        let side: any = null;
        let row: any = null;
        let col: any = null;
        let owner: any = legacyOwner;

        if (source && typeof source === 'object') {
            side = source.side;
            row = source.row;
            col = source.col;
            owner = source.owner;
            if (!Number.isInteger(col) && side === 'left') col = -1;
            if (!Number.isInteger(col) && side === 'right') col = resolveBoardDims(gameState).cols;
        } else {
            side = source;
            row = legacyRow;
            if (side === 'left') col = -1;
            if (side === 'right') col = resolveBoardDims(gameState).cols;
        }

        if (!isExpansionCoordinate(row, col, gameState)) return;
        if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
        cells.push({
            side: resolveExpansionSide(side, row, col, gameState),
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

function syncLegacyExpansionFields(expansion: any, gameState: GameState): void {
    if (CardExpansionModule && typeof CardExpansionModule.syncLegacyExpansionFieldsForCard === 'function') {
        CardExpansionModule.syncLegacyExpansionFieldsForCard(expansion, gameState);
        return;
    }
    if (!expansion || typeof expansion !== 'object') return;
    if (!Array.isArray(expansion.cells)) expansion.cells = [];
    const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
    expansion.active = !!latest;
    expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
    expansion.row = latest ? latest.row : null;
    expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : P_EMPTY;
}

function ensureExpansionStateMutable(gameState: GameState): any {
    if (CardExpansionModule && typeof CardExpansionModule.ensureMutableBoardExpansionForCard === 'function') {
        return CardExpansionModule.ensureMutableBoardExpansionForCard(gameState);
    }
    if (!(gameState as any).boardExpansion || typeof (gameState as any).boardExpansion !== 'object') {
        (gameState as any).boardExpansion = {
            active: false,
            side: null,
            row: null,
            owner: P_EMPTY,
            usedByPlayer: { black: false, white: false },
            cells: []
        };
        return (gameState as any).boardExpansion;
    }

    const expansion = (gameState as any).boardExpansion;
    const cells = getExpansionCells(gameState);
    expansion.cells = cells.map((cell) => ({
        side: cell.side,
        row: cell.row,
        col: cell.col,
        owner: normalizeExpansionOwner(cell.owner)
    }));
    syncLegacyExpansionFields(expansion, gameState);
    return expansion;
}

function getCellValue(gameState: GameState, row: number, col: number): any {
    if (CardExpansionModule && typeof CardExpansionModule.getCellValueForCard === 'function') {
        return CardExpansionModule.getCellValueForCard(gameState, row, col);
    }
    if (isMainBoardCell(row, col, gameState)) {
        return (gameState && Array.isArray((gameState as any).board) && Array.isArray((gameState as any).board[row]))
            ? (gameState as any).board[row][col]
            : null;
    }
    for (const cell of getExpansionCells(gameState)) {
        if (!cell) continue;
        if (cell.row === row && cell.col === col) return normalizeExpansionOwner(cell.owner);
    }
    return null;
}

function setCellValue(gameState: GameState, row: number, col: number, value: any): boolean {
    if (CardExpansionModule && typeof CardExpansionModule.setCellValueForCard === 'function') {
        return !!CardExpansionModule.setCellValueForCard(gameState, row, col, value);
    }
    if (isMainBoardCell(row, col, gameState)) {
        if (!gameState || !Array.isArray((gameState as any).board) || !Array.isArray((gameState as any).board[row])) return false;
        (gameState as any).board[row][col] = value;
        return true;
    }
    const expansion = ensureExpansionStateMutable(gameState);
    if (!Array.isArray(expansion.cells)) return false;
    const normalizedOwner = normalizeExpansionOwner(value);
    for (let i = 0; i < expansion.cells.length; i++) {
        const cell = expansion.cells[i];
        if (!cell) continue;
        const cellCol = Number.isInteger(cell.col)
            ? cell.col
            : (cell.side === 'left' ? -1 : (cell.side === 'right' ? resolveBoardDims(gameState).cols : null));
        if (!Number.isInteger(cellCol)) continue;
        if (cell.row === row && cellCol === col) {
            expansion.cells[i] = {
                side: resolveExpansionSide(cell.side, cell.row, cellCol, gameState),
                row: cell.row,
                col: cellCol,
                owner: normalizedOwner
            };
            syncLegacyExpansionFields(expansion, gameState);
            return true;
        }
    }
    return false;
}

const CardExpansionFallback = {
    normalizeExpansionOwner,
    resolveBoardDims,
    isMainBoardCell,
    resolveExpansionSide,
    isExpansionCoordinate,
    getExpansionCells,
    syncLegacyExpansionFields,
    ensureExpansionStateMutable,
    getCellValue,
    setCellValue
};

const expansionFallbackRuntimeRoot = typeof self !== 'undefined'
    ? (self as any)
    : (typeof global !== 'undefined' ? (global as any) : null);

if (expansionFallbackRuntimeRoot) {
    expansionFallbackRuntimeRoot.CardExpansionFallback = CardExpansionFallback;
}

export = CardExpansionFallback;
