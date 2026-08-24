/** Canonical headless implementation. Legacy global publication lives in spawn-and-flip.ts. */
import SharedBoardUtilsImport = require('../../../shared/shared-board-utils');

type SpawnAndFlipBoardUtils = {
    createBoardContext?: (gameState: SpawnAndFlipGameState, cardState: SpawnAndFlipCardState) => any;
    inspectBoardState?: (gameState: SpawnAndFlipGameState, cardState: SpawnAndFlipCardState, options: { strict: boolean }) => { ok: boolean };
    getCellValue?: (boardContext: any, row: number, col: number) => any;
    setCellValue?: (boardContext: any, row: number, col: number, value: any) => boolean;
};

const SharedBoardUtils: SpawnAndFlipBoardUtils = SharedBoardUtilsImport;

type SpawnAndFlipPosition = {
    row: number;
    col: number;
};

type SpawnAndFlipCardState = {
    markers?: any[];
    [key: string]: unknown;
};

type SpawnAndFlipGameState = {
    board?: any[][];
    [key: string]: unknown;
};

type SpawnAndFlipContext = {
    protectedStones?: unknown[];
    permaProtectedStones?: unknown[];
    cardState?: SpawnAndFlipCardState;
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
    noFlip?: boolean;
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
    attemptedFlips?: Array<[number, number]>;
    resolveFlipEvasion?: (flips: Array<[number, number]>) => { remainingFlips?: Array<[number, number]> } | null;
    clearBombAt?: (cardState: SpawnAndFlipCardState, row: number, col: number) => void;
    clearHyperactiveAtPositions?: (cardState: SpawnAndFlipCardState, positions: SpawnAndFlipPosition[]) => void;
    spawnCause: string;
    spawnReason: string;
    flipCause: string;
    flipReason: string;
    spawnMeta?: Record<string, unknown> | null;
    flipMeta?: Record<string, unknown> | null;
    noFlip?: boolean;
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

function requireBoardUtils(): Required<SpawnAndFlipBoardUtils> {
    if (
        !SharedBoardUtils ||
        typeof SharedBoardUtils.createBoardContext !== 'function' ||
        typeof SharedBoardUtils.inspectBoardState !== 'function' ||
        typeof SharedBoardUtils.getCellValue !== 'function' ||
        typeof SharedBoardUtils.setCellValue !== 'function'
    ) {
        throw new Error('SharedBoardUtils BoardContext APIs are required by CardSpawnAndFlip');
    }
    return SharedBoardUtils as Required<SpawnAndFlipBoardUtils>;
}

function createBoardContext(cardState: SpawnAndFlipCardState, gameState: SpawnAndFlipGameState): any {
    return requireBoardUtils().createBoardContext(gameState, cardState);
}

function setBoardCell(cardState: SpawnAndFlipCardState, gameState: SpawnAndFlipGameState, row: number, col: number, value: any): boolean {
    const boardUtils = requireBoardUtils();
    const boardContext = createBoardContext(cardState, gameState);
    const inspection = boardUtils.inspectBoardState(
        boardContext.gameState,
        boardContext.cardState,
        { strict: false }
    );
    if (!inspection.ok) return false;
    return boardUtils.setCellValue(boardContext, row, col, value);
}

function getBoardCell(cardState: SpawnAndFlipCardState, gameState: SpawnAndFlipGameState, row: number, col: number): any {
    return requireBoardUtils().getCellValue(createBoardContext(cardState, gameState), row, col);
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

    const noFlip = opts.noFlip === true;
    const getCardContext = opts.getCardContext || (() => ({ protectedStones: [], permaProtectedStones: [] }));
    const getFlipsWithContext = opts.getFlipsWithContext || (() => []);
    const context = { ...(getCardContext(opts.cardState) || {}), cardState: opts.cardState };
    const attemptedFlips = noFlip
        ? []
        : (Array.isArray(opts.attemptedFlips)
            ? opts.attemptedFlips.slice()
            : getFlipsWithContext(opts.gameState, row, col, opts.playerValue, context));
    if (!noFlip && (!Array.isArray(attemptedFlips) || attemptedFlips.length === 0) && !opts.allowZeroFlips) {
        throw new Error('Illegal move: no flips and zero-flip placement is not allowed');
    }
    const spawnRes = opts.BoardOps && typeof opts.BoardOps.spawnAt === 'function'
        ? opts.BoardOps.spawnAt(opts.cardState, opts.gameState, row, col, opts.playerKey, opts.spawnCause, opts.spawnReason, opts.spawnMeta || undefined)
        : { spawned: setBoardCell(opts.cardState, opts.gameState, row, col, opts.playerValue) };
    if (spawnRes && spawnRes.spawned === false) {
        return { spawned: false, attemptedFlips, appliedFlips: [], flipEvadeResult: null };
    }
    if (noFlip) {
        return {
            spawned: true,
            stoneId: spawnRes ? spawnRes.stoneId : undefined,
            attemptedFlips,
            appliedFlips: [],
            flipEvadeResult: null
        };
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
            : { changed: setBoardCell(opts.cardState, opts.gameState, flipRow, flipCol, opts.playerValue) };
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
        const originalValue = getBoardCell(cardState, gameState, target.row, target.col);
        if (originalValue !== null && originalValue !== 0) {
            setBoardCell(cardState, gameState, target.row, target.col, 0);
        }
        const context = { ...(getCardContext(cardState) || {}), cardState };
        const flips = getFlipsWithContext(gameState, target.row, target.col, player, context);
        if (originalValue !== null && originalValue !== 0) {
            setBoardCell(cardState, gameState, target.row, target.col, originalValue);
        }
        for (const [flipRow, flipCol] of flips) {
            let changed = true;
            if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                const changeRes = deps.BoardOps.changeAt(cardState, gameState, flipRow, flipCol, playerKey, changeCause, changeReason, changeMeta);
                changed = !!(changeRes && changeRes.changed);
            } else {
                changed = setBoardCell(cardState, gameState, flipRow, flipCol, player);
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
            let spawnedSuccessfully = false;
            const nextSpawnMeta = buildSpawnMeta
                ? buildSpawnMeta(target, anchorPos, playerKey, cause, reason)
                : spawnMeta;
            if (deps.BoardOps && typeof deps.BoardOps.spawnAt === 'function') {
                usedBoardOpsSpawn = true;
                spawnRes = nextSpawnMeta == null
                    ? deps.BoardOps.spawnAt(cardState, gameState, target.row, target.col, playerKey, cause, reason)
                    : deps.BoardOps.spawnAt(cardState, gameState, target.row, target.col, playerKey, cause, reason, nextSpawnMeta);
                spawnedSuccessfully = !!(spawnRes && spawnRes.spawned === true);
            } else {
                spawnedSuccessfully = setBoardCell(cardState, gameState, target.row, target.col, player);
            }
            if (!spawnedSuccessfully || (usedBoardOpsSpawn && (!spawnRes || spawnRes.spawned !== true))) {
                continue;
            }
            spawned.push({
                row: target.row,
                col: target.col,
                anchorRow: anchorPos.row,
                anchorCol: anchorPos.col,
                stoneId: spawnRes ? spawnRes.stoneId : undefined
            });

            if (deps.noFlip === true) {
                continue;
            }
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

export = CardSpawnAndFlip;
