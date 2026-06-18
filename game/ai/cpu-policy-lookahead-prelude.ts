import type { CpuPolicyBoard, CpuPolicyLookaheadSearchMeta, CpuPolicyMoveOptions } from './cpu-policy-core-types';

type CpuPolicyLookaheadPreludeDeps = {
    isFiniteNumber?: (value: unknown) => boolean;
    countBoardDiscsForPlayer?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => { empties: number };
    resolveLookaheadEndgameDepth?: (options: CpuPolicyMoveOptions | null | undefined, empties: number) => number;
    resolveLookaheadDepth?: (board: CpuPolicyBoard | null | undefined, level: number, preferredDepth?: number | null) => number;
    resolveLookaheadBranch?: (board: CpuPolicyBoard | null | undefined, preferredBranch?: number | null) => number;
    resolveLookaheadNodeBudget?: (preferredBudget: number | null | undefined, depth: number, branchLimit: number | null, endgameMode: boolean) => number;
    resolveLookaheadTimeBudgetMs?: (options: CpuPolicyMoveOptions | null | undefined, level: number, endgameMode: boolean) => number | null;
    resolveLookaheadVirtualTimePerNodeMs?: (options: CpuPolicyMoveOptions | null | undefined) => number | null;
    createConsumedBonusMap?: (boardBonusConsumedByCell: Record<string, boolean> | Record<string, boolean | number> | null | undefined) => Record<string, boolean | number>;
    resolveLookaheadMixWeights?: (level: number, empties: number, priorWeight: number | null | undefined, searchWeight: number | null | undefined) => { priorWeight: number; searchWeight: number };
    getLegalMovesBasic?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => Array<unknown>;
    resolveLookaheadParityFeature?: (board: CpuPolicyBoard | null | undefined, empties: number) => { oddRegionCount: number; evenRegionCount: number; signal: number };
    resolveForcedPassFeature?: (ownMoves: number, oppMoves: number, empties: number) => { signal: number; score: number };
    resolveLookaheadTranspositionLimit?: (nodeBudget: number, endgameMode: boolean) => number;
};

type CpuPolicyLookaheadPreludeInput = {
    opts: CpuPolicyMoveOptions;
    board: CpuPolicyBoard;
    playerValue: number;
    level: number;
    readVisited?: () => number;
};

type CpuPolicyLookaheadPreludeOutput = {
    empties: number;
    endgameMode: boolean;
    depth: number;
    branchLimit: number | null;
    nodeBudget: number;
    timeBudgetMs: number | null;
    virtualTimePerNodeMs: number | null;
    readNowMs: () => number;
    deadlineMs: number | null;
    boardBonusByCell: Record<string, number> | null;
    baseConsumedMap: Record<string, boolean | number>;
    priorFn: ((move: any) => number) | null;
    priorWeight: number;
    searchWeight: number;
    rootOwnMoves: number;
    rootOppMoves: number;
    rootParity: { oddRegionCount: number; evenRegionCount: number; signal: number };
    rootPassPressure: { signal: number; score: number };
    transpositionLimit: number;
};

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

export function createCpuPolicyLookaheadPrelude(deps?: CpuPolicyLookaheadPreludeDeps) {
    const isFiniteNumber = typeof deps?.isFiniteNumber === 'function' ? deps.isFiniteNumber : fallbackIsFiniteNumber;
    const countBoardDiscsForPlayer = typeof deps?.countBoardDiscsForPlayer === 'function'
        ? deps.countBoardDiscsForPlayer
        : (() => ({ empties: 0 }));
    const resolveLookaheadEndgameDepth = typeof deps?.resolveLookaheadEndgameDepth === 'function'
        ? deps.resolveLookaheadEndgameDepth
        : (() => 30);
    const resolveLookaheadDepth = typeof deps?.resolveLookaheadDepth === 'function'
        ? deps.resolveLookaheadDepth
        : (() => 4);
    const resolveLookaheadBranch = typeof deps?.resolveLookaheadBranch === 'function'
        ? deps.resolveLookaheadBranch
        : (() => null);
    const resolveLookaheadNodeBudget = typeof deps?.resolveLookaheadNodeBudget === 'function'
        ? deps.resolveLookaheadNodeBudget
        : (() => 0);
    const resolveLookaheadTimeBudgetMs = typeof deps?.resolveLookaheadTimeBudgetMs === 'function'
        ? deps.resolveLookaheadTimeBudgetMs
        : (() => null);
    const resolveLookaheadVirtualTimePerNodeMs = typeof deps?.resolveLookaheadVirtualTimePerNodeMs === 'function'
        ? deps.resolveLookaheadVirtualTimePerNodeMs
        : (() => null);
    const createConsumedBonusMap = typeof deps?.createConsumedBonusMap === 'function'
        ? deps.createConsumedBonusMap
        : (() => Object.create(null));
    const resolveLookaheadMixWeights = typeof deps?.resolveLookaheadMixWeights === 'function'
        ? deps.resolveLookaheadMixWeights
        : (() => ({ priorWeight: 120, searchWeight: 1 }));
    const getLegalMovesBasic = typeof deps?.getLegalMovesBasic === 'function' ? deps.getLegalMovesBasic : (() => []);
    const resolveLookaheadParityFeature = typeof deps?.resolveLookaheadParityFeature === 'function'
        ? deps.resolveLookaheadParityFeature
        : (() => ({ oddRegionCount: 0, evenRegionCount: 0, signal: 0 }));
    const resolveForcedPassFeature = typeof deps?.resolveForcedPassFeature === 'function'
        ? deps.resolveForcedPassFeature
        : (() => ({ signal: 0, score: 0 }));
    const resolveLookaheadTranspositionLimit = typeof deps?.resolveLookaheadTranspositionLimit === 'function'
        ? deps.resolveLookaheadTranspositionLimit
        : ((nodeBudget: number, endgameMode: boolean) => Math.max(
            endgameMode ? 400_000 : 80_000,
            Math.min(endgameMode ? 2_200_000 : 1_200_000, Math.floor((Number(nodeBudget) || 0) * 0.6))
        ));

    function prepareLookaheadPrelude(input: CpuPolicyLookaheadPreludeInput): CpuPolicyLookaheadPreludeOutput {
        const opts = input.opts || {};
        const boardStat = countBoardDiscsForPlayer(input.board, input.playerValue);
        const empties = Number.isFinite(boardStat.empties) ? boardStat.empties : 0;
        const endgameSolveEmpties = isFiniteNumber(opts.endgameSolveEmpties)
            ? Math.max(4, Math.min(48, Math.floor(Number(opts.endgameSolveEmpties))))
            : 30;
        const endgameMode = input.level >= 6 && opts.disableEndgameSolve !== true && empties <= endgameSolveEmpties;
        const depth = endgameMode
            ? resolveLookaheadEndgameDepth(opts, empties)
            : resolveLookaheadDepth(input.board, input.level, opts.depth as number | null | undefined);
        const branchLimit = endgameMode ? null : resolveLookaheadBranch(input.board, opts.maxBranch as number | null | undefined);
        const nodeBudget = resolveLookaheadNodeBudget(
            endgameMode ? opts.endgameNodeBudget as number | null | undefined : opts.nodeBudget as number | null | undefined,
            depth,
            branchLimit,
            endgameMode
        );
        const timeBudgetMs = resolveLookaheadTimeBudgetMs(opts, input.level, endgameMode);
        const virtualTimePerNodeMs = resolveLookaheadVirtualTimePerNodeMs(opts);
        const readVisited = typeof input.readVisited === 'function' ? input.readVisited : (() => 0);
        const readNowMs = virtualTimePerNodeMs !== null
            ? () => readVisited() * virtualTimePerNodeMs
            : typeof opts.readNowMs === 'function'
                ? () => {
                    const value = Number(opts.readNowMs && opts.readNowMs());
                    return Number.isFinite(value) ? value : Date.now();
                }
            : () => Date.now();
        const deadlineMs = timeBudgetMs !== null ? (readNowMs() + timeBudgetMs) : null;
        const boardBonusByCell: Record<string, number> | null = opts.boardBonusByCell && typeof opts.boardBonusByCell === 'object'
            ? opts.boardBonusByCell as Record<string, number>
            : null;
        const baseConsumedMap = createConsumedBonusMap(opts.boardBonusConsumedByCell as Record<string, boolean> | null | undefined);
        const priorFn = typeof opts.scoreMove === 'function' ? opts.scoreMove : null;
        const mixWeights = resolveLookaheadMixWeights(
            input.level,
            empties,
            Number.isFinite(opts.priorWeight) ? Number(opts.priorWeight) : 120,
            Number.isFinite(opts.searchWeight) ? Number(opts.searchWeight) : 1
        );
        const rootOwnMoves = getLegalMovesBasic(input.board, input.playerValue).length;
        const rootOppMoves = getLegalMovesBasic(input.board, -input.playerValue).length;
        const rootParity = resolveLookaheadParityFeature(input.board, empties);
        const rootPassPressure = resolveForcedPassFeature(rootOwnMoves, rootOppMoves, empties);
        const transpositionLimit = resolveLookaheadTranspositionLimit(nodeBudget, endgameMode);

        return {
            empties,
            endgameMode,
            depth,
            branchLimit,
            nodeBudget,
            timeBudgetMs,
            virtualTimePerNodeMs,
            readNowMs,
            deadlineMs,
            boardBonusByCell,
            baseConsumedMap,
            priorFn,
            priorWeight: mixWeights.priorWeight,
            searchWeight: mixWeights.searchWeight,
            rootOwnMoves,
            rootOppMoves,
            rootParity,
            rootPassPressure,
            transpositionLimit
        };
    }

    function notifyLookaheadSearchMeta(opts: CpuPolicyMoveOptions, meta: CpuPolicyLookaheadSearchMeta): void {
        if (typeof opts.onSearchMeta !== 'function') return;
        try {
            opts.onSearchMeta(meta);
        } catch (_) {
            // ignore diagnostic callback errors
        }
    }

    return {
        prepareLookaheadPrelude,
        notifyLookaheadSearchMeta
    };
}
