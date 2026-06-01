export {};

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

function setBoardCell(gameState: SpawnAndFlipGameState, row: number, col: number, value: any): void {
    if (!gameState || !Array.isArray(gameState.board)) return;
    if (!Array.isArray(gameState.board[row])) return;
    gameState.board[row][col] = value;
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

module.exports = {
    spawnAndFlipBatch
};
