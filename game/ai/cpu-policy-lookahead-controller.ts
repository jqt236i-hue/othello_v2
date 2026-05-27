import type {
    CpuPolicyBoard,
    CpuPolicyLookaheadSearchMeta,
    CpuPolicyMove,
    CpuPolicyMoveOptions
} from './cpu-policy-core-types';

type CpuPolicyBonusConsumedMap = Record<string, boolean | number>;

type CpuPolicyLookaheadPreludeOutput = {
    empties: number;
    endgameMode: boolean;
    depth: number;
    branchLimit: number | null;
    nodeBudget: number;
    timeBudgetMs: number | null;
    readNowMs: () => number;
    deadlineMs: number | null;
    boardBonusByCell: Record<string, number> | null;
    baseConsumedMap: CpuPolicyBonusConsumedMap;
    priorFn: ((move: CpuPolicyMove) => number) | null;
    priorWeight: number;
    searchWeight: number;
    rootOwnMoves: number;
    rootOppMoves: number;
    rootParity: { oddRegionCount: number; evenRegionCount: number; signal: number };
    rootPassPressure: { signal: number; score: number };
    transpositionLimit: number;
};

type CpuPolicyLookaheadNegamaxInput = {
    endgameMode: boolean;
    deadlineMs: number | null;
    readNowMs: () => number;
    nodeBudget: number;
    readVisited: () => number;
    incrementVisited: () => void;
    markBudgetHit: () => void;
    markTimeHit: () => void;
    transposition: Map<string, number>;
    transpositionLimit: number;
    level: number;
    boardBonusByCell: Record<string, number> | null;
    branchLimit: number | null;
    shouldStop?: () => boolean;
};

type CpuPolicyRootNegamax = (
    boardNode: CpuPolicyBoard,
    currentPlayer: number,
    depthLeft: number,
    alpha: number,
    beta: number,
    passed: boolean,
    consumedMap: CpuPolicyBonusConsumedMap
) => number;

type CpuPolicyLookaheadRootSearchInput = {
    orderedRootBase: CpuPolicyMove[];
    depth: number;
    endgameMode: boolean;
    board: CpuPolicyBoard;
    playerValue: number;
    boardBonusByCell: Record<string, number> | null;
    baseConsumedMap: CpuPolicyBonusConsumedMap;
    priorFn: ((move: CpuPolicyMove) => number) | null;
    priorWeight: number;
    searchWeight: number;
    negamax: CpuPolicyRootNegamax;
    shouldStop: () => boolean;
};

type CpuPolicyLookaheadControllerDeps = {
    isFiniteNumber?: (value: unknown) => boolean;
    prepareLookaheadPrelude?: (input: {
        opts: CpuPolicyMoveOptions;
        board: CpuPolicyBoard;
        playerValue: number;
        level: number;
        readVisited?: () => number;
    }) => CpuPolicyLookaheadPreludeOutput;
    notifyLookaheadSearchMeta?: (opts: CpuPolicyMoveOptions, meta: CpuPolicyLookaheadSearchMeta) => void;
    createNegamax?: (input: CpuPolicyLookaheadNegamaxInput) => { negamax: CpuPolicyRootNegamax };
    buildSearchMoveOrder?: (moves: CpuPolicyMove[], params: Record<string, unknown>) => CpuPolicyMove[];
    runLookaheadRootSearch?: (input: CpuPolicyLookaheadRootSearchInput) => {
        bestMove: CpuPolicyMove | null;
        bestScore: number;
        rootMoves: CpuPolicyMove[];
    };
    applyLookaheadHardGuards?: (input: {
        bestMove: CpuPolicyMove | null;
        candidateMoves: CpuPolicyMove[];
        level: number;
        board: CpuPolicyBoard;
        playerValue: number;
        boardBonusByCell: Record<string, number> | null;
        baseConsumedMap: CpuPolicyBonusConsumedMap | null | undefined;
        priorFn: ((move: CpuPolicyMove) => number) | null;
        priorWeight: number;
    }) => CpuPolicyMove | null;
};

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

function fallbackPrepareLookaheadPrelude(input: {
    opts: CpuPolicyMoveOptions;
    board: CpuPolicyBoard;
    playerValue: number;
    level: number;
    readVisited?: () => number;
}): CpuPolicyLookaheadPreludeOutput {
    return {
        empties: 0,
        endgameMode: false,
        depth: 4,
        branchLimit: null,
        nodeBudget: 50_000,
        timeBudgetMs: null,
        readNowMs: () => Date.now(),
        deadlineMs: null,
        boardBonusByCell: input.opts.boardBonusByCell && typeof input.opts.boardBonusByCell === 'object'
            ? input.opts.boardBonusByCell as Record<string, number>
            : null,
        baseConsumedMap: Object.create(null) as CpuPolicyBonusConsumedMap,
        priorFn: typeof input.opts.scoreMove === 'function' ? input.opts.scoreMove as (move: CpuPolicyMove) => number : null,
        priorWeight: 120,
        searchWeight: 1,
        rootOwnMoves: 0,
        rootOppMoves: 0,
        rootParity: { oddRegionCount: 0, evenRegionCount: 0, signal: 0 },
        rootPassPressure: { signal: 0, score: 0 },
        transpositionLimit: 80_000
    };
}

export function createCpuPolicyLookaheadController(deps?: CpuPolicyLookaheadControllerDeps) {
    const isFiniteNumber = typeof deps?.isFiniteNumber === 'function' ? deps.isFiniteNumber : fallbackIsFiniteNumber;
    const prepareLookaheadPrelude = typeof deps?.prepareLookaheadPrelude === 'function'
        ? deps.prepareLookaheadPrelude
        : fallbackPrepareLookaheadPrelude;
    const notifyLookaheadSearchMeta = typeof deps?.notifyLookaheadSearchMeta === 'function'
        ? deps.notifyLookaheadSearchMeta
        : (() => undefined);
    const createNegamax = typeof deps?.createNegamax === 'function'
        ? deps.createNegamax
        : (() => ({ negamax: () => 0 }));
    const buildSearchMoveOrder = typeof deps?.buildSearchMoveOrder === 'function'
        ? deps.buildSearchMoveOrder
        : ((moves: CpuPolicyMove[]) => moves);
    const runLookaheadRootSearch = typeof deps?.runLookaheadRootSearch === 'function'
        ? deps.runLookaheadRootSearch
        : ((input: CpuPolicyLookaheadRootSearchInput) => ({
            bestMove: input.orderedRootBase[0] || null,
            bestScore: Number.NEGATIVE_INFINITY,
            rootMoves: input.orderedRootBase
        }));
    const applyLookaheadHardGuards = typeof deps?.applyLookaheadHardGuards === 'function'
        ? deps.applyLookaheadHardGuards
        : ((input: { bestMove: CpuPolicyMove | null }) => input.bestMove);

    function chooseMoveByLookahead(candidateMoves: CpuPolicyMove[], options?: CpuPolicyMoveOptions | null): CpuPolicyMove | null {
        if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;
        const opts = options || {};
        const board = Array.isArray(opts.board) ? opts.board : null;
        if (!board) return null;
        const playerValue = isFiniteNumber(opts.playerValue) ? (Number(opts.playerValue) >= 0 ? 1 : -1) : 1;
        const level = isFiniteNumber(opts.level) ? Math.max(1, Math.floor(Number(opts.level))) : 6;
        let visited = 0;
        let budgetHit = false;
        let timeHit = false;
        const prelude = prepareLookaheadPrelude({
            opts,
            board,
            playerValue,
            level,
            readVisited: () => visited
        });
        const transposition = new Map<string, number>();

        notifyLookaheadSearchMeta(opts, {
            endgameMode: prelude.endgameMode,
            empties: prelude.empties,
            depth: prelude.depth,
            branchLimit: prelude.branchLimit,
            nodeBudget: prelude.nodeBudget,
            timeBudgetMs: prelude.timeBudgetMs,
            ownMoves: prelude.rootOwnMoves,
            oppMoves: prelude.rootOppMoves,
            effectivePriorWeight: prelude.priorWeight,
            effectiveSearchWeight: prelude.searchWeight,
            parityOddRegionCount: prelude.rootParity.oddRegionCount,
            parityEvenRegionCount: prelude.rootParity.evenRegionCount,
            paritySignal: prelude.rootParity.signal,
            forcedPassSignal: prelude.rootPassPressure.signal
        });

        const { negamax } = createNegamax({
            endgameMode: prelude.endgameMode,
            deadlineMs: prelude.deadlineMs,
            readNowMs: prelude.readNowMs,
            nodeBudget: prelude.nodeBudget,
            readVisited: () => visited,
            incrementVisited: () => { visited += 1; },
            markBudgetHit: () => { budgetHit = true; },
            markTimeHit: () => { timeHit = true; },
            transposition,
            transpositionLimit: prelude.transpositionLimit,
            level,
            boardBonusByCell: prelude.boardBonusByCell,
            branchLimit: prelude.branchLimit,
            shouldStop: () => budgetHit || timeHit
        });

        const orderedRootBase = buildSearchMoveOrder(candidateMoves, {
            level,
            board,
            playerValue,
            boardBonusByCell: prelude.boardBonusByCell,
            boardBonusConsumedByCell: prelude.baseConsumedMap,
            rootPriorScoreFn: prelude.priorFn,
            priorWeight: prelude.priorWeight,
            branchLimit: prelude.branchLimit
        });

        const rootSearch = runLookaheadRootSearch({
            orderedRootBase,
            depth: prelude.depth,
            endgameMode: prelude.endgameMode,
            board,
            playerValue,
            boardBonusByCell: prelude.boardBonusByCell,
            baseConsumedMap: prelude.baseConsumedMap,
            priorFn: prelude.priorFn,
            priorWeight: prelude.priorWeight,
            searchWeight: prelude.searchWeight,
            negamax,
            shouldStop: () => budgetHit || timeHit
        });
        let bestMove = rootSearch.bestMove;

        if (!bestMove && orderedRootBase.length > 0) bestMove = orderedRootBase[0];
        if (!bestMove && candidateMoves.length > 0) bestMove = candidateMoves[0];
        if ((budgetHit || timeHit) && !bestMove && candidateMoves.length > 0) return candidateMoves[0];

        if (bestMove && level >= 6) {
            bestMove = applyLookaheadHardGuards({
                bestMove,
                candidateMoves,
                level,
                board,
                playerValue,
                boardBonusByCell: prelude.boardBonusByCell,
                baseConsumedMap: prelude.baseConsumedMap,
                priorFn: prelude.priorFn,
                priorWeight: prelude.priorWeight
            }) || bestMove;
        }

        return bestMove;
    }

    return {
        chooseMoveByLookahead
    };
}
