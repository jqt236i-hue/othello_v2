/**
 * @file round-rules.ts
 * @description Pure round progression rules (01-rulebook.md): a round advances only after both
 * colors completed a turn, and every 10th round schedules a charge bonus of floor(round / 2) that is
 * consumed once at the next turn start. Core and the turn adapter delegate here; callers keep their
 * own player-key normalization and pass 'black' | 'white' | null.
 */

function normalizeRoundNumber(value: any): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    const roundNumber = Math.trunc(numeric);
    return roundNumber >= 1 ? roundNumber : 1;
}

function createRoundCompletionByPlayer(source: any): { black: boolean; white: boolean } {
    const value = (source && typeof source === 'object') ? source : {};
    return {
        black: !!value.black,
        white: !!value.white
    };
}

function clonePendingRoundBonus(source: any): { roundNumber: number; amount: number } | null {
    if (!source || typeof source !== 'object') return null;
    const roundNumber = normalizeRoundNumber(source.roundNumber);
    const amountValue = Number(source.amount);
    const amount = Number.isFinite(amountValue) ? Math.max(0, Math.trunc(amountValue)) : 0;
    if (!(amount > 0)) return null;
    return { roundNumber, amount };
}

function ensureRoundState(state: any): any {
    if (!state || typeof state !== 'object') return state;
    state.roundNumber = normalizeRoundNumber(state.roundNumber);
    state.roundCompletionByPlayer = createRoundCompletionByPlayer(state.roundCompletionByPlayer);
    state.pendingRoundBonus = clonePendingRoundBonus(state.pendingRoundBonus);
    return state;
}

function resolveRoundBonusAmount(roundNumber: number): number {
    const normalizedRound = normalizeRoundNumber(roundNumber);
    if (normalizedRound % 10 !== 0) return 0;
    return Math.max(0, Math.floor(normalizedRound / 2));
}

function advanceRoundForPlayerKey(state: any, playerKey: 'black' | 'white' | null, options?: any): { advanced: boolean; roundNumber: number; pendingRoundBonus: { roundNumber: number; amount: number } | null } {
    const targetState = ensureRoundState(state);
    const opts = (options && typeof options === 'object') ? options : {};
    if (!targetState || (playerKey !== 'black' && playerKey !== 'white')) {
        return {
            advanced: false,
            roundNumber: targetState ? targetState.roundNumber : 1,
            pendingRoundBonus: clonePendingRoundBonus(targetState && targetState.pendingRoundBonus)
        };
    }

    targetState.roundCompletionByPlayer[playerKey] = true;
    if (!targetState.roundCompletionByPlayer.black || !targetState.roundCompletionByPlayer.white) {
        return {
            advanced: false,
            roundNumber: targetState.roundNumber,
            pendingRoundBonus: clonePendingRoundBonus(targetState.pendingRoundBonus)
        };
    }

    const nextRoundNumber = normalizeRoundNumber(targetState.roundNumber + 1);
    targetState.roundNumber = nextRoundNumber;
    targetState.roundCompletionByPlayer = createRoundCompletionByPlayer(null);
    if (opts.scheduleBonus !== false) {
        const amount = resolveRoundBonusAmount(nextRoundNumber);
        targetState.pendingRoundBonus = amount > 0
            ? { roundNumber: nextRoundNumber, amount }
            : null;
    }
    return {
        advanced: true,
        roundNumber: targetState.roundNumber,
        pendingRoundBonus: clonePendingRoundBonus(targetState.pendingRoundBonus)
    };
}

function consumePendingRoundBonus(state: any): { roundNumber: number; amount: number } | null {
    const targetState = ensureRoundState(state);
    if (!targetState) return null;
    const pending = clonePendingRoundBonus(targetState.pendingRoundBonus);
    targetState.pendingRoundBonus = null;
    return pending;
}

const RoundRules = {
    normalizeRoundNumber,
    createRoundCompletionByPlayer,
    clonePendingRoundBonus,
    ensureRoundState,
    resolveRoundBonusAmount,
    advanceRoundForPlayerKey,
    consumePendingRoundBonus
};

export = RoundRules;
