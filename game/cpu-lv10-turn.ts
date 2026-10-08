import { sampleLv10Position, enumerateLv10Actions, applyLv10Action, lv10CancellationAction, currentLv10Player, lv10ActionKey, type Lv10Action, type Lv10Player } from './ai/cpu-lv10-position';
import { observeLv10Position } from './ai/cpu-lv10-observation';
import { parseLv10AdvisorResult, type Lv10AdvisorRequest } from './ai/cpu-lv10-advisor-contract';
import type { Lv10SearchResult } from './ai/cpu-lv10-search';
import type { CpuTurnPerformanceScope } from './cpu-turn-performance';
import { readCpuTurnPerformanceNowMs, recordCpuTurnPerformanceInterval } from './cpu-turn-performance';

export type Lv10TurnDeps = {
    getState: () => { gameState: any; cardState: any };
    getPublicRecipes: () => Lv10AdvisorRequest['publicRecipes'];
    advise: (request: Lv10AdvisorRequest) => Promise<Lv10SearchResult>;
    isCurrent: () => boolean;
    apply: (action: Lv10Action) => Promise<any>;
    record?: (record: Lv10TurnRecord) => void;
    performanceScope?: CpuTurnPerformanceScope | null;
    rejectedActions?: { identity: string | null; actions: Lv10Action[];
        cancelledCards?: { turnIdentity: string; cardIds: string[] };
        /** Present only for policies that keep following the searched turn. */
        plan?: Lv10PlanMemory };
};
/** The rest of the turn the last search completed, valid only while the public
 * observation is exactly the one predicted after the previous action. */
export type Lv10PlanMemory = { expectedIdentity: string | null; continuation: Lv10Action[];
    /** Thinking time shared by every search of one turn. */
    turnBudgetMs: number; turnIdentity: string | null; spentMs: number };
export type Lv10TurnRecord = {
    player: Lv10Player; turnNumber: number; action: Lv10Action | null;
    elapsedMs: number; source: 'worker' | 'fallback'; error: string | null;
    search: Omit<Lv10SearchResult, 'continuation'> | null;
    outcome: 'applied' | 'rejected' | 'stale' | 'no_action';
    excludedActions?: readonly Lv10Action[];
    /** The action came from the previous search's continuation (no new search). */
    followedPlan?: boolean;
};

// The scenario seed of the first Lv10-13 search world. Any public outcome that
// differs from this world's (a draw, a chance effect, a hidden card) makes the
// prediction miss, and the next action is searched again.
const PLAN_SAMPLE_SEED = 100901;

// A search after a chance outcome still gets this much when the turn budget is spent.
const PLAN_MIN_SEARCH_MS = 100;

// Popup queues for the charge counter are drained by the live runtime, not by
// the search transition; they carry no rule state.
const PLAN_IGNORED_KEYS = new Set(['chargeDeltaEvents']);

/** Key-order independent identity of an observation for plan matching. The
 * live runtime and a search transition can add the same bookkeeping fields in
 * a different order. */
function lv10PlanIdentity(value: unknown): string {
    return JSON.stringify(value, (key, item) => {
        if (PLAN_IGNORED_KEYS.has(key)) return undefined;
        if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
        return Object.fromEntries(Object.keys(item).sort().map(name => [name, (item as Record<string, unknown>)[name]]));
    });
}

/** Applies an action to one sampled world of the public observation. Returns
 * the viewer's predicted observation identity, or null when it does not apply. */
function predictLv10Observation(observation: ReturnType<typeof observeLv10Position>, publicRecipes: Lv10AdvisorRequest['publicRecipes'],
    player: Lv10Player, action: Lv10Action): string | null {
    try {
        const result = applyLv10Action(sampleLv10Position(observation, PLAN_SAMPLE_SEED, publicRecipes), action);
        if (!result.ok || result.selectionFailed) return null;
        return lv10PlanIdentity(observeLv10Position(result.state, player));
    } catch {
        return null;
    }
}

/** One advisory action at a time. Presentation and the canonical handoff stay
 * in their existing UI adapters; no search state is ever installed in a match. */
export async function runLv10Turn(player: Lv10Player, deps: Lv10TurnDeps): Promise<Lv10TurnRecord> {
    const started = performance.now();
    const observation = observeLv10Position(deps.getState(), player);
    const identity = JSON.stringify(observation);
    const rejectionMemory = deps.rejectedActions;
    if (rejectionMemory && rejectionMemory.identity !== identity) {
        rejectionMemory.identity = identity;
        rejectionMemory.actions = [];
    }
    const owner = currentLv10Player(observation);
    const turnIdentity = `${player}/${owner}/${observation.gameState.turnNumber}`;
    if (rejectionMemory && rejectionMemory.cancelledCards?.turnIdentity !== turnIdentity) {
        rejectionMemory.cancelledCards = { turnIdentity, cardIds: [] };
    }
    // Cancellation refunds and returns the card at a different hand index.
    // Its new pending ID / hand order must not trigger the same failed sequence
    // indefinitely. This is a one-turn policy choice, not a card-rule change.
    const cancelledIds = new Set(rejectionMemory?.cancelledCards?.cardIds || []);
    const cancelledActions: Lv10Action[] = (observation.cardState.hands[owner] as string[])
        .flatMap((id,index) => cancelledIds.has(id)
            ? [{ type:'use_card',useCardId:id,useCardHandIndex:index,useCardOwnerKey:owner }] : []);
    const excludedActions = [...new Map([...cancelledActions,...(rejectionMemory?.actions || [])]
        .map(action => [lv10ActionKey(action),action])).values()].slice(0,64);
    const excluded = new Set(excludedActions.map(lv10ActionKey));
    const plan = rejectionMemory?.plan;
    if (plan && plan.turnIdentity !== turnIdentity) { plan.turnIdentity = turnIdentity; plan.spentMs = 0; }
    const request: Lv10AdvisorRequest = { observation, publicRecipes: deps.getPublicRecipes(), excludedActions };
    // Every search of the turn, the first included, fits in what the turn has left.
    if (plan) request.maxMs = Math.max(PLAN_MIN_SEARCH_MS, plan.turnBudgetMs - plan.spentMs);
    const record: Lv10TurnRecord = { player, turnNumber: observation.gameState.turnNumber, action: null,
        elapsedMs: 0, source: 'worker', error: null, search: null, outcome: 'no_action' };
    if (excludedActions.length) record.excludedActions = excludedActions;
    const scope = deps.performanceScope;
    const perfStarted = scope ? readCpuTurnPerformanceNowMs(scope) : null;
    // A card, its targets and the placement are one searched turn. While every
    // public result matches the prediction, take the next action of that turn
    // instead of searching each step again (one search budget per turn).
    const planned = plan?.expectedIdentity && plan.expectedIdentity === lv10PlanIdentity(observation) ? plan.continuation[0] : undefined;
    const plannedRest = plan ? plan.continuation.slice(1) : [];
    if (plan) { plan.expectedIdentity = null; plan.continuation = []; }
    if (plan && planned && !excluded.has(lv10ActionKey(planned))) {
        const predicted = predictLv10Observation(observation, request.publicRecipes, player, planned);
        if (predicted !== null) {
            record.action = planned;
            record.followedPlan = true;
            if (plannedRest.length) { plan.expectedIdentity = predicted; plan.continuation = plannedRest; }
        }
    }
    if (!record.action) try {
        const result = parseLv10AdvisorResult(await deps.advise(request));
        if (result.action && excluded.has(lv10ActionKey(result.action))) throw new Error('Advisor repeated a rejected action');
        const { continuation, ...details } = result;
        record.search = details;
        record.action = result.action;
        if (plan && result.action && continuation.length) {
            plan.expectedIdentity = predictLv10Observation(observation, request.publicRecipes, player, result.action);
            plan.continuation = plan.expectedIdentity ? continuation.slice() : [];
        }
    } catch (error) {
        record.error = error instanceof Error ? error.message : String(error);
        record.source = 'fallback';
        // Bounded emergency legality check; never run the full search on the UI
        // thread after a Worker/transport failure.
        const state = sampleLv10Position(observation, 100901, request.publicRecipes);
        const fallbackStarted = performance.now();
        for (const action of enumerateLv10Actions(state, { allowCards: false }).filter(action => !excluded.has(lv10ActionKey(action))).slice(0, 8)) {
            const result = applyLv10Action(state, action);
            if (result.ok && !result.selectionFailed) { record.action = action; break; }
            if (performance.now() - fallbackStarted > 20) break;
        }
    }
    if (!record.action) {
        const state = sampleLv10Position(observation, 100901, request.publicRecipes);
        const cancel = lv10CancellationAction(state);
        if (cancel && !excluded.has(lv10ActionKey(cancel))) {
            const result = applyLv10Action(state, cancel);
            if (result.ok && !result.state.cardState.pendingEffectByPlayer[currentLv10Player(state)]) {
                record.action = cancel;
                record.source = 'fallback';
                record.error ||= 'No progressing target found within the advisory budget';
            }
        }
    }
    record.elapsedMs = performance.now() - started;
    if (plan) plan.spentMs += record.elapsedMs;
    if (scope && perfStarted !== null) recordCpuTurnPerformanceInterval(scope, 'move-candidates', 'wait',
        perfStarted, readCpuTurnPerformanceNowMs(scope), record.source === 'worker' ? 'continue' : 'error');
    if (!deps.isCurrent() || JSON.stringify(observeLv10Position(deps.getState(), player)) !== identity) {
        record.outcome = 'stale';
    } else if (record.action) {
        const result = await deps.apply(record.action);
        const rejected = result === false || result?.ok === false;
        record.outcome = rejected ? 'rejected' : 'applied';
        if (!rejected && record.action.type === 'cancel_card' && rejectionMemory?.cancelledCards?.turnIdentity === turnIdentity) {
            const id = observation.cardState.pendingEffectByPlayer?.[owner]?.cardId;
            if (typeof id === 'string' && !cancelledIds.has(id) && rejectionMemory.cancelledCards.cardIds.length < 64) {
                rejectionMemory.cancelledCards.cardIds.push(id);
            }
        }
        if (rejected) {
            record.error = String(result?.res?.reason || result?.reason || 'canonical action rejected');
            // A hidden opponent card can invalidate an otherwise plausible
            // sampled action. Remember only the observed rejection, never the
            // hidden card identity, until the public position changes.
            if (rejectionMemory && rejectionMemory.identity === identity && rejectionMemory.actions.length < 64
                && !excluded.has(lv10ActionKey(record.action))) rejectionMemory.actions.push(record.action);
        }
    }
    if (plan && record.outcome !== 'applied') { plan.expectedIdentity = null; plan.continuation = []; }
    deps.record?.(record);
    return record;
}
