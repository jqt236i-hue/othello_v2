import { sampleLv10Position, enumerateLv10Actions, applyLv10Action, type Lv10Action, type Lv10Player } from './ai/cpu-lv10-position';
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
};
export type Lv10TurnRecord = {
    player: Lv10Player; turnNumber: number; action: Lv10Action | null;
    elapsedMs: number; source: 'worker' | 'fallback'; error: string | null;
    search: Omit<Lv10SearchResult, 'continuation'> | null;
    outcome: 'applied' | 'rejected' | 'stale' | 'no_action';
};

/** One advisory action at a time. Presentation and the canonical handoff stay
 * in their existing UI adapters; no search state is ever installed in a match. */
export async function runLv10Turn(player: Lv10Player, deps: Lv10TurnDeps): Promise<Lv10TurnRecord> {
    const started = performance.now();
    const observation = observeLv10Position(deps.getState(), player);
    const identity = JSON.stringify(observation);
    const request = { observation, publicRecipes: deps.getPublicRecipes() };
    const record: Lv10TurnRecord = { player, turnNumber: observation.gameState.turnNumber, action: null,
        elapsedMs: 0, source: 'worker', error: null, search: null, outcome: 'no_action' };
    const scope = deps.performanceScope;
    const perfStarted = scope ? readCpuTurnPerformanceNowMs(scope) : null;
    try {
        const result = parseLv10AdvisorResult(await deps.advise(request));
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
        for (const action of enumerateLv10Actions(state, { allowCards: false }).slice(0, 8)) {
            if (applyLv10Action(state, action).ok) { record.action = action; break; }
            if (performance.now() - fallbackStarted > 20) break;
        }
    }
    record.elapsedMs = performance.now() - started;
    if (scope && perfStarted !== null) recordCpuTurnPerformanceInterval(scope, 'move-candidates', 'wait',
        perfStarted, readCpuTurnPerformanceNowMs(scope), record.source === 'worker' ? 'continue' : 'error');
    if (!deps.isCurrent() || JSON.stringify(observeLv10Position(deps.getState(), player)) !== identity) {
        record.outcome = 'stale';
    } else if (record.action) {
        const result = await deps.apply(record.action);
        record.outcome = result?.ok === false ? 'rejected' : 'applied';
        if (result?.ok === false) record.error = String(result?.res?.reason || result.reason || 'canonical action rejected');
    }
    deps.record?.(record);
    return record;
}
