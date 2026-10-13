import type { Lv10PlanMemory, Lv10TurnDeps } from '../cpu-lv10-turn';

// Lv13 follows its searched turn (card, targets, placement) and shares one
// thinking budget per turn, so the player waits under 5 seconds a turn. A
// search after a chance outcome may add a short minimum on top.
export const LV13_TURN_THINK_MS = 4600;

/** Identity of the decision memory this policy creates. Recorded in selfplay
 * run identities so a run started without the turn plan never resumes with it. */
export const LV13_DECISION_MEMORY_PROTOCOL = Object.freeze({
    version: 'lv13-turn-plan.v1', turnBudgetMs: LV13_TURN_THINK_MS
});

export type CpuDecisionMemory = NonNullable<Lv10TurnDeps['rejectedActions']>;

export function createLv13PlanMemory(): Lv10PlanMemory {
    return { expectedIdentity: null, continuation: [], turnBudgetMs: LV13_TURN_THINK_MS, turnIdentity: null, spentMs: 0 };
}

/** The Lv13 policy's own per-player decision memory. The normal browser turn
 * handler and headless selfplay both create it here; a policy that does not
 * export a factory keeps the plain (planless) memory of its own version. */
export function createLv13DecisionMemory(): CpuDecisionMemory {
    return { identity: null, actions: [], plan: createLv13PlanMemory() };
}

/** Search time limit for one advisory request: the rest of the turn budget
 * (request.maxMs) and an experiment's fixed limit, whichever is smaller. */
export function resolveAdvisorMaxMs(requestMaxMs: number | undefined, experimentMaxMs: number | undefined): number | undefined {
    const limits = [requestMaxMs, experimentMaxMs].filter((value): value is number => value !== undefined);
    return limits.length ? Math.min(...limits) : undefined;
}
