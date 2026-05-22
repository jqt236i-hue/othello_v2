/**
 * @file targets.ts
 * @description Card target selection helpers (Shared between Browser and Headless)
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

function getRuntimeGlobalValue(key: string): any {
    if (typeof self !== 'undefined' && (self as any)[key]) {
        return (self as any)[key];
    }
    return undefined;
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const SharedConstants = (() => {
    if (typeof module === 'object' && module.exports) {
        return safeRequire('../../../shared-constants') || getRuntimeGlobalValue('SharedConstants');
    }

    return getRuntimeGlobalValue('SharedConstants');
})();

const BoardUtils = ((typeof module === 'object' && module.exports)
    ? safeRequire('../../../shared/shared-board-utils')
    : null) || getRuntimeGlobalValue('SharedBoardUtils');

const { EMPTY } = SharedConstants || {};
const P_EMPTY = (EMPTY === undefined || EMPTY === null) ? 0 : EMPTY;

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

function resolveBoardConfig(gameState: GameState): BoardConfig {
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

function isMainBoardCell(row: number, col: number, gameState: GameState): boolean {
    if (BoardUtils && typeof BoardUtils.isMainBoardCell === 'function') {
        return BoardUtils.isMainBoardCell(row, col, gameState);
    }
    const config = resolveBoardConfig(gameState);
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < config.rows && col >= 0 && col < config.cols;
}

function resolveExpansionSide(side: string | null, row: number, col: number, gameState: GameState): string | null {
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

function getExpansionCells(gameState: GameState): ExpansionCell[] {
    if (BoardUtils && typeof BoardUtils.collectExpansionDescriptors === 'function') {
        return BoardUtils.collectExpansionDescriptors(gameState && gameState.boardExpansion, gameState);
    }
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion as any
        : null;
    if (!expansion) return [];
    const config = resolveBoardConfig(gameState);

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
        const normalizedOwner = (owner === (SharedConstants as any).BLACK || owner === (SharedConstants as any).WHITE)
            ? owner
            : P_EMPTY;
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

function getCellValue(gameState: GameState, row: number, col: number): number | null {
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

function forEachBoardShapeCell(gameState: GameState, visitor: (row: number, col: number, value: number) => void) {
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

function getTemptWillTargets(cardState: any, gameState: GameState, playerKey: string): Array<{row: number; col: number}> {
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const res: Array<{row: number; col: number}> = [];
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const isGuarded = (r: number, c: number) => markers.some((m: any) =>
        m &&
        m.kind === 'specialStone' &&
        m.row === r &&
        m.col === c &&
        m.data &&
        m.data.type === 'GUARD'
    );
    // Prefer CardUtils if available (handles bombs and special stones uniformly)
    const CardUtils = ((typeof module === 'object' && module.exports) ? safeRequire('./utils') : null) || getRuntimeGlobalValue('CardUtils');
    forEachBoardShapeCell(gameState, (r, c) => {
        if (isGuarded(r, c)) return;
        // Must be a special stone or bomb owned by opponent and not an empty cell
        if (CardUtils && typeof CardUtils.isSpecialStoneAt === 'function') {
            if (!CardUtils.isSpecialStoneAt(cardState, r, c)) return;
            if (CardUtils.getSpecialOwnerAt(cardState, r, c) !== opponentKey) return;
            if (getCellValue(gameState, r, c) === P_EMPTY) return;
            res.push({ row: r, col: c });
            return;
        }

        const marker = (cardState.markers || []).find((m: any) => m.kind === 'specialStone' && m.row === r && m.col === c);
        if (!marker) return;
        if (marker.owner !== opponentKey) return;
        if (getCellValue(gameState, r, c) === P_EMPTY) return;
        res.push({ row: r, col: c });
    });
    return res;
}

function getCaptureWillTargets(cardState: any, gameState: GameState, playerKey: string): Array<{row: number; col: number}> {
    return getTemptWillTargets(cardState, gameState, playerKey);
}

export = {
    getTemptWillTargets,
    getCaptureWillTargets
};
