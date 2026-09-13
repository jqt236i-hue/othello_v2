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
        cancelledCards?: { turnIdentity: string; cardIds: string[] } };
};
export type Lv10TurnRecord = {
    player: Lv10Player; turnNumber: number; action: Lv10Action | null;
    elapsedMs: number; source: 'worker' | 'fallback'; error: string | null;
    search: Omit<Lv10SearchResult, 'continuation'> | null;
    outcome: 'applied' | 'rejected' | 'stale' | 'no_action';
    excludedActions?: readonly Lv10Action[];
};

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
    const request = { observation, publicRecipes: deps.getPublicRecipes(), excludedActions };
    const record: Lv10TurnRecord = { player, turnNumber: observation.gameState.turnNumber, action: null,
        elapsedMs: 0, source: 'worker', error: null, search: null, outcome: 'no_action' };
    if (excludedActions.length) record.excludedActions = excludedActions;
    const scope = deps.performanceScope;
    const perfStarted = scope ? readCpuTurnPerformanceNowMs(scope) : null;
    try {
        const result = parseLv10AdvisorResult(await deps.advise(request));
        if (result.action && excluded.has(lv10ActionKey(result.action))) throw new Error('Advisor repeated a rejected action');
        const { continuation: _continuation, ...details } = result;
        record.search = details;
        record.action = result.action;
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
    deps.record?.(record);
    return record;
}
