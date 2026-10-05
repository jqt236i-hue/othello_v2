import type { CpuPolicyBoard } from './cpu-policy-core-types';

type CpuPolicyLookaheadConfigDeps = {
    countBoardDiscsForPlayer?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => { empties?: number } | null | undefined;
    asRecord?: (value: unknown) => Record<string, unknown>;
    isFiniteNumber?: (value: unknown) => boolean;
};

function fallbackAsRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

export function createCpuPolicyLookaheadConfig(deps?: CpuPolicyLookaheadConfigDeps) {
    const countBoardDiscsForPlayer = typeof deps?.countBoardDiscsForPlayer === 'function'
        ? deps.countBoardDiscsForPlayer
        : (() => ({ empties: 24 }));
    const asRecord = typeof deps?.asRecord === 'function' ? deps.asRecord : fallbackAsRecord;
    const isFiniteNumber = typeof deps?.isFiniteNumber === 'function' ? deps.isFiniteNumber : fallbackIsFiniteNumber;

    function resolveRemainingOrEmpties(board: CpuPolicyBoard | null | undefined, remainingPlacements?: number | null): number {
        if (isFiniteNumber(remainingPlacements)) return Math.max(0, Math.floor(Number(remainingPlacements)));
        const stat = countBoardDiscsForPlayer(board, 1);
        return Number.isFinite(stat && stat.empties) ? Number(stat && stat.empties) : 24;
    }

    /** remainingPlacements は持ち石ルール有効時の「実際に置ける残り回数」。未指定は盤面の空きマス数。 */
    function resolveLookaheadDepth(board: CpuPolicyBoard | null | undefined, level: number, preferredDepth?: number | null, remainingPlacements?: number | null): number {
        if (isFiniteNumber(preferredDepth)) {
            return Math.max(1, Math.min(64, Math.floor(Number(preferredDepth))));
        }
        const empties = resolveRemainingOrEmpties(board, remainingPlacements);
        if (level >= 6) {
            if (empties <= 14) return 5;
            if (empties <= 30) return 4;
            return 3;
        }
        if (level >= 5) return empties <= 20 ? 4 : 3;
        return 2;
    }

    function resolveLookaheadEndgameDepth(options: unknown, empties: number): number {
        const opts = asRecord(options);
        if (isFiniteNumber(opts.endgameDepth)) {
            return Math.max(1, Math.min(64, Math.floor(Number(opts.endgameDepth))));
        }
        const remaining = Number.isFinite(empties) ? Math.max(0, Math.floor(empties)) : 0;
        return Math.max(30, Math.min(64, remaining + 2));
    }

    function resolveLookaheadBranch(board: CpuPolicyBoard | null | undefined, preferredBranch?: number | null, remainingPlacements?: number | null): number {
        if (isFiniteNumber(preferredBranch)) {
            return Math.max(2, Math.min(24, Math.floor(Number(preferredBranch))));
        }
        const empties = resolveRemainingOrEmpties(board, remainingPlacements);
        if (empties >= 40) return 7;
        if (empties >= 24) return 9;
        if (empties >= 14) return 11;
        return 16;
    }

    function resolveLookaheadNodeBudget(preferredBudget: number | null | undefined, depth: number, branchLimit: number | null, endgameMode: boolean): number {
        if (isFiniteNumber(preferredBudget)) {
            return Math.max(500, Math.floor(Number(preferredBudget)));
        }
        const depthFactor = Math.max(1, Number(depth) || 1);
        if (endgameMode) {
            return Math.max(200_000, Math.min(4_000_000, (depthFactor * depthFactor * 7_200)));
        }
        const branchFactor = Math.max(2, Number(branchLimit) || 8);
        return Math.max(8_000, Math.min(80_000, (depthFactor * depthFactor * branchFactor * 650)));
    }

    function resolveLookaheadTranspositionLimit(nodeBudget: number, endgameMode: boolean): number {
        const base = endgameMode ? 400_000 : 80_000;
        const scaled = Math.floor((Number(nodeBudget) || 0) * 0.6);
        const cap = endgameMode ? 2_200_000 : 1_200_000;
        return Math.max(base, Math.min(cap, scaled));
    }

    function resolveLookaheadTimeBudgetMs(options: unknown, level: number, endgameMode: boolean): number | null {
        const opts = asRecord(options);
        const preferred = endgameMode ? opts.endgameMaxTimeMs : opts.maxTimeMs;
        if (isFiniteNumber(preferred)) {
            const n = Math.floor(Number(preferred));
            if (n <= 0) return null;
            return Math.max(50, Math.min(120_000, n));
        }
        if (endgameMode) return level >= 6 ? 12_000 : 8_000;
        if (level >= 6) return 2_200;
        return 1_200;
    }

    function resolveLookaheadVirtualTimePerNodeMs(options: unknown): number | null {
        const opts = asRecord(options);
        const preferred = Number(opts.virtualTimePerNodeMs);
        if (!Number.isFinite(preferred) || preferred <= 0) return null;
        return Math.max(0.001, Math.min(1_000, preferred));
    }

    function resolveLookaheadMixWeights(
        level: number,
        empties: number,
        priorWeight: number | null | undefined,
        searchWeight: number | null | undefined
    ): { priorWeight: number; searchWeight: number } {
        const resolved = {
            priorWeight: Number.isFinite(priorWeight) ? Number(priorWeight) : 120,
            searchWeight: Number.isFinite(searchWeight) ? Number(searchWeight) : 1
        };
        if (!Number.isFinite(level) || level < 6) return resolved;

        if (empties <= 12) {
            resolved.priorWeight *= 0.18;
            resolved.searchWeight *= 1.22;
        } else if (empties <= 20) {
            resolved.priorWeight *= 0.34;
            resolved.searchWeight *= 1.15;
        } else if (empties <= 28) {
            resolved.priorWeight *= 0.58;
            resolved.searchWeight *= 1.08;
        }

        return resolved;
    }

    return {
        resolveLookaheadDepth,
        resolveLookaheadEndgameDepth,
        resolveLookaheadBranch,
        resolveLookaheadNodeBudget,
        resolveLookaheadTranspositionLimit,
        resolveLookaheadTimeBudgetMs,
        resolveLookaheadVirtualTimePerNodeMs,
        resolveLookaheadMixWeights
    };
}
