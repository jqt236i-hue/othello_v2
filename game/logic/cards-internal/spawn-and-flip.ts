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
    spawnAt?: (cardState: SpawnAndFlipCardState, gameState: SpawnAndFlipGameState, row: number, col: number, playerKey: any, cause: string, reason: string, meta?: any) => SpawnAndFlipSpawnResult;
    changeAt?: (cardState: SpawnAndFlipCardState, gameState: SpawnAndFlipGameState, row: number, col: number, playerKey: any, cause: string, reason: string, meta?: any) => SpawnAndFlipChangeResult;
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
    spawnMeta?: Record<string, unknown> | null;
    changeMeta?: Record<string, unknown> | null;
    buildSpawnMeta?: (target: SpawnAndFlipPosition, anchorPos: SpawnAndFlipPosition, playerKey: any, cause: string, reason: string) => Record<string, unknown> | null | undefined;
};

type SpawnAndFlipPlacementOptions = {
    cardState: SpawnAndFlipCardState;
    gameState: SpawnAndFlipGameState;
    playerKey: any;
    playerValue: any;
    row: number;
    col: number;
    allowZeroFlips: boolean;
    BoardOps?: SpawnAndFlipBoardOps | null;
    getCardContext?: (cardState: SpawnAndFlipCardState) => SpawnAndFlipContext;
    getFlipsWithContext?: (gameState: SpawnAndFlipGameState, row: number, col: number, playerValue: any, context: SpawnAndFlipContext) => Array<[number, number]>;
    resolveFlipEvasion?: (flips: Array<[number, number]>) => { remainingFlips?: Array<[number, number]> } | null;
    clearBombAt?: (cardState: SpawnAndFlipCardState, row: number, col: number) => void;
    clearHyperactiveAtPositions?: (cardState: SpawnAndFlipCardState, positions: SpawnAndFlipPosition[]) => void;
    spawnCause: string;
    spawnReason: string;
    flipCause: string;
    flipReason: string;
    spawnMeta?: Record<string, unknown> | null;
    flipMeta?: Record<string, unknown> | null;
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

function getBoardCell(gameState: SpawnAndFlipGameState, row: number, col: number): any {
    if (isMainBoardCell(gameState, row, col)) {
        if (!gameState || !Array.isArray(gameState.board) || !Array.isArray(gameState.board[row])) return null;
        return gameState.board[row][col];
    }

    const ref = getExpansionCellRef(gameState, row, col);
    if (!ref) return null;
    return ref.legacy
        ? ref.expansion.owner
        : ref.cell.owner;
}

function toPositionKey(row: number, col: number): string {
    return `${row},${col}`;
}

function spawnAndFlipPlacement(options: SpawnAndFlipPlacementOptions): any {
    const opts = options || ({} as SpawnAndFlipPlacementOptions);
    const row = Number(opts.row);
    const col = Number(opts.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
        throw new Error('Illegal move: invalid placement cell');
    }

    const getCardContext = opts.getCardContext || (() => ({ protectedStones: [], permaProtectedStones: [] }));
    const getFlipsWithContext = opts.getFlipsWithContext || (() => []);
    const context = getCardContext(opts.cardState);
    const attemptedFlips = getFlipsWithContext(opts.gameState, row, col, opts.playerValue, context);
    if ((!Array.isArray(attemptedFlips) || attemptedFlips.length === 0) && !opts.allowZeroFlips) {
        throw new Error('Illegal move: no flips and zero-flip placement is not allowed');
    }

    const spawnRes = opts.BoardOps && typeof opts.BoardOps.spawnAt === 'function'
        ? opts.BoardOps.spawnAt(opts.cardState, opts.gameState, row, col, opts.playerKey, opts.spawnCause, opts.spawnReason, opts.spawnMeta || undefined)
        : (setBoardCell(opts.gameState, row, col, opts.playerValue), { spawned: true });
    if (spawnRes && spawnRes.spawned === false) {
        return { spawned: false, attemptedFlips, appliedFlips: [], flipEvadeResult: null };
    }

    let remainingFlips = Array.isArray(attemptedFlips) ? attemptedFlips.slice() : [];
    const flipEvadeResult = typeof opts.resolveFlipEvasion === 'function'
        ? opts.resolveFlipEvasion(remainingFlips)
        : null;
    if (flipEvadeResult && Array.isArray(flipEvadeResult.remainingFlips)) {
        remainingFlips = flipEvadeResult.remainingFlips.slice();
    }

    const appliedFlips: Array<[number, number]> = [];
    for (const [flipRow, flipCol] of remainingFlips) {
        const changeRes = opts.BoardOps && typeof opts.BoardOps.changeAt === 'function'
            ? opts.BoardOps.changeAt(opts.cardState, opts.gameState, flipRow, flipCol, opts.playerKey, opts.flipCause, opts.flipReason, opts.flipMeta || undefined)
            : (setBoardCell(opts.gameState, flipRow, flipCol, opts.playerValue), { changed: true });
        if (changeRes && changeRes.changed) {
            appliedFlips.push([flipRow, flipCol]);
        }
    }

    if (appliedFlips.length > 0 && typeof opts.clearBombAt === 'function') {
        for (const [flipRow, flipCol] of appliedFlips) {
            opts.clearBombAt(opts.cardState, flipRow, flipCol);
        }
    }
    if (appliedFlips.length > 0 && typeof opts.clearHyperactiveAtPositions === 'function') {
        opts.clearHyperactiveAtPositions(opts.cardState, appliedFlips.map(([flipRow, flipCol]) => ({ row: flipRow, col: flipCol })));
    }

    return {
        spawned: true,
        stoneId: spawnRes ? spawnRes.stoneId : undefined,
        attemptedFlips,
        appliedFlips,
        flipEvadeResult
    };
}

function resolveGeneratedFlipBatch(cardState: SpawnAndFlipCardState, gameState: SpawnAndFlipGameState, playerKey: any, player: any, targets: SpawnAndFlipPosition[], deps: SpawnAndFlipDeps): SpawnAndFlipPosition[] {
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
    const changeCause = deps.changeCause || 'BREEDING';
    const changeReason = deps.changeReason || 'breeding_flip';
    const changeMeta = deps.changeMeta;

    for (const target of targets) {
        const originalValue = getBoardCell(gameState, target.row, target.col);
        if (originalValue !== null && originalValue !== 0) {
            setBoardCell(gameState, target.row, target.col, 0);
        }
        const context = getCardContext(cardState);
        const flips = getFlipsWithContext(gameState, target.row, target.col, player, context);
        if (originalValue !== null && originalValue !== 0) {
            setBoardCell(gameState, target.row, target.col, originalValue);
        }
        for (const [flipRow, flipCol] of flips) {
            let changed = true;
            if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                const changeRes = deps.BoardOps.changeAt(cardState, gameState, flipRow, flipCol, playerKey, changeCause, changeReason, changeMeta);
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

    return flipped;
}

function spawnAndFlipBatch(cardState: SpawnAndFlipCardState, gameState: SpawnAndFlipGameState, playerKey: any, player: any, targets: SpawnAndFlipPosition[], cause: string, reason: string, anchorPos: SpawnAndFlipPosition, deps: SpawnAndFlipDeps): SpawnAndFlipBatchResult {
    const spawned: SpawnAndFlipSpawnedPosition[] = [];
    const flipped: SpawnAndFlipPosition[] = [];
    const flippedSet = new Set<string>();
    const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions;
    const buildSpawnMeta = typeof deps.buildSpawnMeta === 'function' ? deps.buildSpawnMeta : null;
    const spawnMeta = deps.spawnMeta || null;

    const applyBatch = (): void => {
        for (const target of targets) {
            let spawnRes = null;
            let usedBoardOpsSpawn = false;
            const nextSpawnMeta = buildSpawnMeta
                ? buildSpawnMeta(target, anchorPos, playerKey, cause, reason)
                : spawnMeta;
            if (deps.BoardOps && typeof deps.BoardOps.spawnAt === 'function') {
                usedBoardOpsSpawn = true;
                spawnRes = nextSpawnMeta == null
                    ? deps.BoardOps.spawnAt(cardState, gameState, target.row, target.col, playerKey, cause, reason)
                    : deps.BoardOps.spawnAt(cardState, gameState, target.row, target.col, playerKey, cause, reason, nextSpawnMeta);
            } else {
                setBoardCell(gameState, target.row, target.col, player);
            }
            if (usedBoardOpsSpawn && (!spawnRes || spawnRes.spawned !== true)) {
                continue;
            }
            spawned.push({
                row: target.row,
                col: target.col,
                anchorRow: anchorPos.row,
                anchorCol: anchorPos.col,
                stoneId: spawnRes ? spawnRes.stoneId : undefined
            });

            const flippedNow = resolveGeneratedFlipBatch(cardState, gameState, playerKey, player, [target], deps);
            for (const pos of flippedNow) {
                const flipKey = toPositionKey(pos.row, pos.col);
                if (!flippedSet.has(flipKey)) {
                    flippedSet.add(flipKey);
                    flipped.push(pos);
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
    resolveGeneratedFlipBatch,
    spawnAndFlipBatch,
    spawnAndFlipPlacement
};

const spawnAndFlipRuntimeRoot = typeof self !== 'undefined'
    ? (self as any)
    : (typeof global !== 'undefined' ? (global as any) : null);

if (spawnAndFlipRuntimeRoot) {
    spawnAndFlipRuntimeRoot.CardSpawnAndFlip = CardSpawnAndFlip;
}

module.exports = CardSpawnAndFlip;
