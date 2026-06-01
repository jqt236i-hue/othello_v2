export {};

type SpawnAndFlipPosition = {
    row: number;
    col: number;
};

type SpawnAndFlipExpansionSide = 'left' | 'right' | 'top' | 'bottom';

type SpawnAndFlipCardState = {
    markers?: any[];
    [key: string]: unknown;
};

type SpawnAndFlipExpansionCell = SpawnAndFlipPosition & {
    side?: SpawnAndFlipExpansionSide | null;
    owner?: any;
};

type SpawnAndFlipExpansionState = {
    active?: boolean;
    side?: SpawnAndFlipExpansionSide | null;
    row?: number | null;
    col?: number | null;
    owner?: any;
    cells?: SpawnAndFlipExpansionCell[];
    [key: string]: unknown;
};

type SpawnAndFlipGameState = {
    board?: any[][];
    boardExpansion?: SpawnAndFlipExpansionState | null;
    [key: string]: unknown;
};

type SpawnAndFlipContext = {
    protectedStones?: unknown[];
    permaProtectedStones?: unknown[];
    [key: string]: unknown;
};

type SpawnAndFlipSpawnResult = {
    spawned?: boolean;
    stoneId?: unknown;
    [key: string]: unknown;
} | null | undefined;

type SpawnAndFlipChangeResult = {
    changed?: boolean;
    [key: string]: unknown;
} | null | undefined;

type SpawnAndFlipBoardOps = {
    spawnAt?: (cardState: SpawnAndFlipCardState, gameState: SpawnAndFlipGameState, row: number, col: number, playerKey: any, cause: string, reason: string) => SpawnAndFlipSpawnResult;
    changeAt?: (cardState: SpawnAndFlipCardState, gameState: SpawnAndFlipGameState, row: number, col: number, playerKey: any, cause: string, reason: string) => SpawnAndFlipChangeResult;
    runSpawnBlock?: (cardState: SpawnAndFlipCardState, gameState: SpawnAndFlipGameState, fn: () => void, meta: Record<string, unknown>) => unknown;
};

type SpawnAndFlipDeps = {
    BoardOps?: SpawnAndFlipBoardOps | null;
    getCardContext?: (cardState: SpawnAndFlipCardState) => SpawnAndFlipContext;
    getFlipsWithContext?: (gameState: SpawnAndFlipGameState, row: number, col: number, playerValue: any, context: SpawnAndFlipContext) => Array<[number, number]>;
    clearBombAt?: (cardState: SpawnAndFlipCardState, row: number, col: number) => void;
    clearHyperactiveAtPositions?: (cardState: SpawnAndFlipCardState, positions: SpawnAndFlipPosition[]) => void;
    changeCause?: string;
    changeReason?: string;
};

type SpawnAndFlipSpawnedPosition = SpawnAndFlipPosition & {
    anchorRow: any;
    anchorCol: any;
    stoneId?: unknown;
};

type SpawnAndFlipBatchResult = {
    spawned: SpawnAndFlipSpawnedPosition[];
    flipped: SpawnAndFlipPosition[];
};

function resolveBoardBounds(gameState: SpawnAndFlipGameState): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
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

function isMainBoardCell(gameState: SpawnAndFlipGameState, row: number, col: number): boolean {
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

function resolveExpansionSide(side: unknown, row: number, col: number, gameState: SpawnAndFlipGameState): SpawnAndFlipExpansionSide | null {
    const bounds = resolveBoardBounds(gameState);
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    if (!bounds) return null;
    if (col === -1) return 'left';
    if (col === (bounds.maxCol + 1)) return 'right';
    if (row === -1) return 'top';
    if (row === (bounds.maxRow + 1)) return 'bottom';
    return null;
}

function getExpansionCellRef(gameState: SpawnAndFlipGameState, row: number, col: number): { expansion: SpawnAndFlipExpansionState; index: number; cell: SpawnAndFlipExpansionCell | SpawnAndFlipExpansionState; legacy: boolean } | null {
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion
        : null;
    if (!expansion) return null;

    if (Array.isArray(expansion.cells)) {
        for (let index = 0; index < expansion.cells.length; index++) {
            const cell = expansion.cells[index];
            if (!cell || typeof cell !== 'object') continue;
            const bounds = resolveBoardBounds(gameState);
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? -1 : (cell.side === 'right' && bounds ? bounds.maxCol + 1 : null));
            if (!Number.isInteger(cellCol)) continue;
            if (cell.row === row && cellCol === col) {
                return { expansion, index, cell, legacy: false };
            }
        }
    }

    if (expansion.active === true) {
        const bounds = resolveBoardBounds(gameState);
        const legacyCol = Number.isInteger(expansion.col)
            ? expansion.col
            : (expansion.side === 'left' ? -1 : (expansion.side === 'right' && bounds ? bounds.maxCol + 1 : null));
        if (expansion.row === row && legacyCol === col) {
            return { expansion, index: -1, cell: expansion, legacy: true };
        }
    }

    return null;
}

function setBoardCell(gameState: SpawnAndFlipGameState, row: number, col: number, value: any): boolean {
    if (isMainBoardCell(gameState, row, col)) {
        if (!gameState || !Array.isArray(gameState.board)) return false;
        if (!Array.isArray(gameState.board[row])) return false;
        gameState.board[row][col] = value;
        return true;
    }

    const ref = getExpansionCellRef(gameState, row, col);
    if (!ref) return false;
    if (!ref.legacy) {
        if (!Array.isArray(ref.expansion.cells)) return false;
        ref.expansion.cells[ref.index] = {
            side: resolveExpansionSide(ref.cell.side, row, col, gameState),
            row,
            col,
            owner: value
        };
        return true;
    }

    ref.expansion.side = resolveExpansionSide(ref.cell.side, row, col, gameState);
    ref.expansion.row = row;
    ref.expansion.col = col;
    ref.expansion.owner = value;
    return true;
}

function toPositionKey(row: number, col: number): string {
    return `${row},${col}`;
}

function spawnAndFlipBatch(cardState: SpawnAndFlipCardState, gameState: SpawnAndFlipGameState, playerKey: any, player: any, targets: SpawnAndFlipPosition[], cause: string, reason: string, anchorPos: SpawnAndFlipPosition, deps: SpawnAndFlipDeps): SpawnAndFlipBatchResult {
    const spawned: SpawnAndFlipSpawnedPosition[] = [];
    const flipped: SpawnAndFlipPosition[] = [];
    const flippedSet = new Set<string>();
    const getCardContext = deps.getCardContext || (() => ({ protectedStones: [], permaProtectedStones: [] }));
    const getFlipsWithContext = deps.getFlipsWithContext || (() => []);
    const clearBombAt = deps.clearBombAt || ((state: SpawnAndFlipCardState, row: number, col: number) => {
        if (state.markers) {
            state.markers = state.markers.filter((marker) => !(
                marker.kind === 'specialStone' &&
                marker.data &&
                marker.data.category === 'bomb' &&
                marker.row === row &&
                marker.col === col
            ));
        }
    });
    const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions;
    const changeCause = deps.changeCause || 'BREEDING';
    const changeReason = deps.changeReason || 'breeding_flip';

    const applyBatch = (): void => {
        for (const target of targets) {
            const context = getCardContext(cardState);
            const flips = getFlipsWithContext(gameState, target.row, target.col, player, context);

            let spawnRes = null;
            if (deps.BoardOps && typeof deps.BoardOps.spawnAt === 'function') {
                spawnRes = deps.BoardOps.spawnAt(cardState, gameState, target.row, target.col, playerKey, cause, reason);
            } else {
                setBoardCell(gameState, target.row, target.col, player);
            }
            spawned.push({
                row: target.row,
                col: target.col,
                anchorRow: anchorPos.row,
                anchorCol: anchorPos.col,
                stoneId: spawnRes ? spawnRes.stoneId : undefined
            });

            for (const [flipRow, flipCol] of flips) {
                let changed = true;
                if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                    const changeRes = deps.BoardOps.changeAt(cardState, gameState, flipRow, flipCol, playerKey, changeCause, changeReason);
                    changed = !!(changeRes && changeRes.changed);
                } else {
                    setBoardCell(gameState, flipRow, flipCol, player);
                }
                if (!changed) continue;
                clearBombAt(cardState, flipRow, flipCol);
                const flipKey = toPositionKey(flipRow, flipCol);
                if (!flippedSet.has(flipKey)) {
                    flippedSet.add(flipKey);
                    flipped.push({ row: flipRow, col: flipCol });
                }
            }
        }
    };

    if (deps.BoardOps && typeof deps.BoardOps.runSpawnBlock === 'function') {
        deps.BoardOps.runSpawnBlock(cardState, gameState, applyBatch, {
            cause,
            reason,
            owner: playerKey
        });
    } else {
        applyBatch();
    }

    if (flipped.length > 0 && typeof clearHyperactiveAtPositions === 'function') {
        clearHyperactiveAtPositions(cardState, flipped);
    }
    return { spawned, flipped };
}

const CardSpawnAndFlip = {
    spawnAndFlipBatch
};

const spawnAndFlipRuntimeRoot = typeof self !== 'undefined'
    ? (self as any)
    : (typeof global !== 'undefined' ? (global as any) : null);

if (spawnAndFlipRuntimeRoot) {
    spawnAndFlipRuntimeRoot.CardSpawnAndFlip = CardSpawnAndFlip;
}

module.exports = CardSpawnAndFlip;
