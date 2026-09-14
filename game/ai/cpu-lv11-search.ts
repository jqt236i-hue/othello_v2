import { evaluateLv11Position, lv11CardPotential, lv11MarkerPotential, aggregateLv11ScenarioValues } from './cpu-lv11-evaluation';
import Core = require('../logic/core');
import Board = require('../../shared/shared-board-utils');
import {
    applyLv10Action, currentLv10Player, lv10DecisionPlayer, enumerateLv10Actions, lv10ActionKey,
    sampleLv10Position, startLv10Turn,
    type Lv10Action, type Lv10Observation, type Lv10Player, type Lv10Position
} from './cpu-lv10-position';

/** Separate development policy derived from the Lv10 full-rule beam search.
 * Never selected in the normal game before the Lv11 adoption gates pass.
 * Sharing the position/action vocabulary leaves the saved Lv10 unchanged. */
export const LV11_SEARCH_CONFIG = Object.freeze({
    version: 'lv11-sparse-endgame-dev5', maxTransitions: 4096, maxMs: 4800,
    maxRetainedPlans: 16, maxRetainedPartialPlans: 64, continuationBeam: 2, selectionBeam: 6, maxActionsPerTurn: 12,
    maxRootCandidates: 6, replyCandidates: 2, scenarioSeeds: Object.freeze([100901, 100909]), maxStageCandidates: 16
});

type Plan = { state: Lv10Position; actions: Lv10Action[]; value: number; rootTie?: number };

// A deterministic tie order avoids always retaining the upper-left portion
// of a multi-stage selection whose first choice has not changed the board.
function partialRootTie(action: Lv10Action): number {
    let value = 2166136261;
    for (const char of lv10ActionKey(action)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    return value >>> 0;
}
export type Lv11SearchOptions = {
    now?: () => number;
    maxTransitions?: number;
    maxMs?: number;
    publicRecipes?: Partial<Record<Lv10Player, readonly string[]>>;
    excludedActions?: readonly Lv10Action[];
};

export type Lv11SearchResult = {
    version: string; action: Lv10Action | null; continuation: Lv10Action[];
    value: number | null; transitions: number; elapsedMs: number | null;
    stopped: 'complete' | 'node_budget' | 'time_budget' | 'terminal' | 'no_completed_plan';
    rejectedCount: number; rejected: { action: Lv10Action; reason: string }[];
    evaluatedCandidates: number;
    comparisonScenarioSeeds?: number[];
    scenarioTimeCuts?: number; scenarioNodeCuts?: number;
    candidates?: { action: Lv10Action; immediate: number; replies: number[]; scenarioSeeds: number[]; score: number }[];
};

/** Missing scenario results retain their identity. A completed result in one
 * sampled world must never be compared with a different world's result merely
 * because both candidates happened to complete the same number of searches. */
export function compareLv11Scenarios(values: readonly (readonly (number | null)[])[]) {
    const width = Math.max(0, ...values.map(row => row.length));
    let anchor = -1, coverage = 0;
    for (let scenario = 0; scenario < width; scenario++) {
        const count = values.filter(row => Number.isFinite(row[scenario]) && row[scenario] !== null).length;
        if (count > coverage) { coverage = count; anchor = scenario; }
    }
    const eligible = values.map((_, index) => index).filter(index => anchor >= 0 && values[index][anchor] !== null && Number.isFinite(values[index][anchor]));
    const scenarios = Array.from({ length: width }, (_, index) => index)
        .filter(scenario => eligible.length && eligible.every(index => values[index][scenario] !== null && Number.isFinite(values[index][scenario])));
    return { eligible, scenarios, scores: values.map((row, index) => eligible.includes(index)
        ? aggregateLv11ScenarioValues(scenarios.map(scenario => row[scenario]!)) : null) };
}

/** Entire search operates on sampled, isolated positions and injected time.
 * The caller validates and applies the returned advisory action normally. */
export function searchLv11(observation: Lv10Observation, options: Lv11SearchOptions = {}): Lv11SearchResult {
    const cfg = LV11_SEARCH_CONFIG, player = observation.player;
    if (options.maxTransitions !== undefined && (!Number.isInteger(options.maxTransitions) || options.maxTransitions < 1)) {
        throw new Error('Lv11 transition budget must be a positive integer');
    }
    if (options.maxMs !== undefined && (!Number.isFinite(options.maxMs) || options.maxMs <= 0)) {
        throw new Error('Lv11 time budget must be positive and finite');
    }
    const cap = Math.min(cfg.maxTransitions, Math.max(1, Math.floor(options.maxTransitions ?? cfg.maxTransitions)));
    const started = options.now?.();
    const maxMs = Math.min(cfg.maxMs, Math.max(1, options.maxMs ?? cfg.maxMs));
    let transitions = 0, rejectedCount = 0, stopped: Lv11SearchResult['stopped'] = 'complete';
    let sliceDeadline = Infinity, sliceNodeEnd = Infinity, sliceTimeCut = false, sliceNodeCut = false;
    let scenarioTimeCuts = 0, scenarioNodeCuts = 0;
    const rejected: Lv11SearchResult['rejected'] = [];
    function available() {
        if (transitions >= cap) { stopped = 'node_budget'; return false; }
        if (started !== undefined && options.now) {
            const now = options.now();
            if (now - started >= maxMs) { stopped = 'time_budget'; return false; }
            if (now >= sliceDeadline) { sliceTimeCut = true; return false; }
        }
        if (transitions >= sliceNodeEnd) { sliceNodeCut = true; return false; }
        return true;
    }
    function apply(state: Lv10Position, action: Lv10Action): Lv10Position | null {
        if (!available()) return null;
        transitions++;
        const result = applyLv10Action(state, action);
        if (result.ok && !result.selectionFailed) return result.state;
        const reason = result.ok ? 'TARGET_SELECTION_NO_EFFECT' : result.reason;
        rejectedCount++;
        if (rejected.length < 12) rejected.push({ action, reason });
        if (reason.startsWith('RUNTIME_UNAVAILABLE')) throw new Error('Lv11 canonical runtime unavailable');
        return null;
    }
    function start(state: Lv10Position): Lv10Position | null {
        if (!available()) return null;
        transitions++;
        return startLv10Turn(state);
    }
    const initial = sampleLv10Position(observation, 100901, options.publicRecipes);
    const initialOwner = currentLv10Player(initial);
    const initialTurn = initial.gameState.turnNumber;
    const completed = (state: Lv10Position, owner: Lv10Player, turn: number) => Core.isGameOver(state.gameState)
        || currentLv10Player(state) !== owner || state.gameState.turnNumber > turn;
    const rank = (plans: Plan[], owner: Lv10Player, limit: number) => plans.sort((a,b) => (
        owner === player ? b.value - a.value : a.value - b.value
    ) || (a.rootTie || 0)-(b.rootTie || 0)).slice(0,limit);
    function finish(state: Lv10Position, prefix: Lv10Action[], owner: Lv10Player, turn: number, quota: number): Plan[] {
        const decisionPlayer = lv10DecisionPlayer(state);
        const beamWidth = state.cardState.pendingEffectByPlayer?.[owner]?.stage === 'selectTarget' ? cfg.selectionBeam : cfg.continuationBeam;
        const from = transitions, done: Plan[] = [];
        let beam: Plan[] = [{state,actions:prefix,value:evaluateLv11Position(state,player)}];
        for (let depth=prefix.length; depth<=cfg.maxActionsPerTurn && beam.length && available(); depth++) {
            const next: Plan[] = [];
            for (const plan of beam) {
                if (completed(plan.state,owner,turn)) { done.push(plan); continue; }
                if (depth === cfg.maxActionsPerTurn) continue;
                // Reserve transitions for later selection stages. Expanding all
                // targets at the first stage used to exhaust a card's allowance
                // before it ever reached a comparable completed turn.
                const pending = plan.state.cardState.pendingEffectByPlayer?.[owner];
                const stagesLeft = pending?.stage === 'selectTarget'
                    ? Math.max(2, Math.min(6, (pending.maxSelections || 2) - (pending.selectedCount || 0) + 1)) : 1;
                const limit = Math.max(1, Math.min(cfg.maxStageCandidates,
                    Math.floor((quota - (transitions-from)) / stagesLeft / Math.max(1, beam.length))));
                const actions = orderActions(plan.state, enumerateLv10Actions(plan.state, {
                    allowDestroy: (plan.state.cardState.hands?.[owner]?.length || 0) >= 4
                }), limit);
                for (const action of actions) {
                    if (transitions-from>=quota || !available()) break;
                    const after=apply(plan.state,action);
                    if(after) {
                        const candidate={state:after,actions:[...plan.actions,action],value:evaluateLv11Position(after,player),rootTie:partialRootTie(action)};
                        if(completed(after,owner,turn)) {
                            done.push(candidate);
                            done.splice(0,done.length,...rank(done,decisionPlayer,cfg.maxRetainedPlans));
                        } else {
                            next.push(candidate);
                            next.splice(0,next.length,...rank(next,decisionPlayer,beamWidth));
                        }
                    }
                }
            }
            beam=rank(next,decisionPlayer,beamWidth);
        }
        return rank(done,decisionPlayer,cfg.maxRetainedPlans);
    }

    function orderActions(state: Lv10Position, actions: Lv10Action[], limit: number): Lv10Action[] {
        const context = Board.createBoardContext(state.gameState, state.cardState);
        const corners = Board.getCornerCells(context);
        function priority(action: Lv10Action): number {
            if (action.type === 'pass') return 100;
            if (action.type === 'use_card') return 2 + lv11CardPotential(action.useCardId) / 3;
            if (action.type === 'destroy_hand_card') return -1;
            const target = Number.isInteger(action.row) ? action : Object.values(action).find(value => value && Number.isInteger(value.row));
            if (!target) return 0;
            let value = 0;
            for (const corner of corners) {
                const dr = Math.abs(corner.row - target.row), dc = Math.abs(corner.col - target.col);
                if (!dr && !dc) value += 16;
                else if (dr <= 1 && dc <= 1 && !Board.getCellValue(context, corner.row, corner.col)) value -= 6;
            }
            const marker = (state.cardState.markers || []).find((m: any) => m.row === target.row && m.col === target.col);
            if (marker) value += Math.min(40, lv11MarkerPotential(marker)) / 3;
            return value;
        }
        const ordered = actions.map((action,index) => ({action,index,priority:priority(action)}))
            .sort((a,b) => b.priority-a.priority || a.index-b.index).map(item => item.action);
        if (ordered.length <= limit) return ordered;
        // Include card and hold/place alternatives in opponent continuations.
        const cards = ordered.filter(action => action.type === 'use_card').slice(0, Math.max(1, Math.floor(limit/3)));
        const others = ordered.filter(action => action.type !== 'use_card').slice(0, limit-cards.length);
        return [...cards,...others];
    }
    if (Core.isGameOver(initial.gameState)) return {
        version:cfg.version,action:null,continuation:[],value:evaluateLv11Position(initial,player),transitions:0,
        elapsedMs:0,stopped:'terminal',rejectedCount:0,rejected:[],evaluatedCandidates:0
    };
    const excluded = new Set((options.excludedActions || []).map(lv10ActionKey));
    const rootActions = enumerateLv10Actions(initial, {allowDestroy:(initial.cardState.hands?.[initialOwner]?.length || 0)>=4})
        .filter(action => !excluded.has(lv10ActionKey(action)));
    let fallback: Lv10Action | null = null;
    const plans: Plan[] = [], unfinished: Plan[] = [];
    for(const action of rootActions) {
        if(!available())break;
        const after=apply(initial,action);
        if(!after)continue;
        fallback ||= action;
        const plan={state:after,actions:[action],value:evaluateLv11Position(after,player),rootTie:partialRootTie(action)};
        const list=completed(after,initialOwner,initialTurn)?plans:unfinished;
        list.push(plan);
        if (list === unfinished) {
            list.sort((a,b) => b.value-a.value || (a.rootTie || 0)-(b.rootTie || 0));
            if (list.length > cfg.maxRetainedPartialPlans) list.length = cfg.maxRetainedPartialPlans;
        } else list.splice(0,list.length,...rank(list,player,cfg.maxRetainedPlans));
    }
    const completingSelection = initial.cardState.pendingEffectByPlayer?.[initialOwner]?.stage === 'selectTarget';
    const quota=Math.max(12,Math.floor((cap-transitions)*(completingSelection ? .65 : .40)/Math.max(1,unfinished.length)));
    for(const plan of unfinished) {
        if(!available())break;
        // Keep the best completed continuation of each first action. Several
        // placements after one free-placement card must not evict every other
        // card/hold alternative before the opponent-response comparison.
        const continuations = finish(plan.state,plan.actions,initialOwner,initialTurn,quota);
        if (continuations.length) plans.push(continuations[0]);
        plans.splice(0,plans.length,...rank(plans,player,cfg.maxRetainedPlans));
    }
    const candidates: Plan[] = [];
    const seenRoots = new Set<string>();
    for (const plan of rank(plans,player,cfg.maxRetainedPlans)) {
        const key = JSON.stringify(plan.actions[0]);
        if (seenRoots.has(key)) continue;
        seenRoots.add(key); candidates.push(plan);
        if (candidates.length >= cfg.maxRootCandidates) break;
    }
    const scored = candidates.map(plan => ({ plan, replies: cfg.scenarioSeeds.map(() => null as number | null), value: aggregateLv11ScenarioValues([plan.value]) }));
    function scoreScenario(candidate: typeof scored[number], scenario: number, quota: number): number | null {
        const from = transitions;
        let own = candidate.plan;
        if (scenario > 0) {
            const alternate = sampleLv10Position(observation, cfg.scenarioSeeds[scenario], options.publicRecipes);
            const after = apply(alternate, own.actions[0]);
            if (!after) return null;
            if (completed(after, initialOwner, initialTurn)) own = { state: after, actions: [own.actions[0]], value: evaluateLv11Position(after,player) };
            else {
                const alternatives = finish(after, [own.actions[0]], initialOwner, initialTurn, Math.max(8, Math.floor(quota*.35)));
                if (!alternatives.length) return null;
                own = alternatives[0];
            }
        }
        if (Core.isGameOver(own.state.gameState)) return own.value;
        const next = start(own.state);
        if (!next) return null;
        if (Core.isGameOver(next.gameState)) return evaluateLv11Position(next, player);
        const owner = currentLv10Player(next), chooser = lv10DecisionPlayer(next);
        const remaining = Math.max(1, quota - (transitions-from));
        const replies = finish(next, [], owner, next.gameState.turnNumber, Math.max(1, Math.floor(remaining*.5)));
        if (!replies.length) return null;
        const alternatives: Plan[] = [], roots = new Set<string>();
        for (const reply of replies) {
            const key = lv10ActionKey(reply.actions[0]);
            if (!roots.has(key)) { roots.add(key); alternatives.push(reply); }
            if (alternatives.length >= cfg.replyCandidates) break;
        }
        const settled: Lv10Position[] = [];
        for (const reply of alternatives) {
            const state = Core.isGameOver(reply.state.gameState) ? reply.state : start(reply.state);
            if (!state) return null;
            settled.push(state);
        }
        const shallowValues = settled.map(state => evaluateLv11Position(state, player));
        const answerValues: number[] = [];
        for (let index = 0; index < settled.length; index++) {
            const state = settled[index];
            if (Core.isGameOver(state.gameState)) { answerValues.push(shallowValues[index]); continue; }
            const answerOwner = currentLv10Player(state);
            const answerQuota = Math.max(1, Math.floor((quota - (transitions-from) - 1) / (settled.length-index)));
            const answers = finish(state, [], answerOwner, state.gameState.turnNumber, answerQuota);
            if (!answers.length) break;
            const after = Core.isGameOver(answers[0].state.gameState) ? answers[0].state : start(answers[0].state);
            if (!after) break;
            answerValues.push(evaluateLv11Position(after, player));
        }
        // Reconsider the responding player's alternatives after our replies.
        // If the deeper layer is incomplete, compare every alternative at the
        // same shallower boundary instead of dropping a dangerous response.
        const values = answerValues.length === settled.length ? answerValues : shallowValues;
        return chooser === player ? Math.max(...values) : Math.min(...values);
    }
    for (let scenario=0; scenario<cfg.scenarioSeeds.length && available(); scenario++) {
        for (let index=0; index<scored.length && available(); index++) {
            const candidate = scored[index];
            const slotsLeft = Math.max(1, scored.length*(cfg.scenarioSeeds.length-scenario)-index);
            const quota = Math.max(12, Math.floor((cap-transitions)/slotsLeft));
            sliceNodeEnd = Math.min(cap, transitions + quota);
            if (started !== undefined && options.now) {
                const now = options.now();
                sliceDeadline = now + Math.max(0, started + maxMs - now) / slotsLeft;
            }
            sliceTimeCut = false; sliceNodeCut = false;
            try { candidate.replies[scenario] = scoreScenario(candidate, scenario, quota); }
            finally {
                if (sliceTimeCut) scenarioTimeCuts++;
                if (sliceNodeCut) scenarioNodeCuts++;
                sliceDeadline = Infinity; sliceNodeEnd = Infinity;
            }
        }
    }
    const comparison = compareLv11Scenarios(scored.map(candidate => candidate.replies));
    const examined = comparison.eligible.map(index => scored[index]);
    for (const index of comparison.eligible) scored[index].value = comparison.scores[index]!;
    const comparable = examined.length ? examined : scored;
    comparable.sort((a,b)=>b.value-a.value);
    // A terminal win caused by this immediate action is known, unlike a
    // terminal result in a hypothetical later draw sequence.
    const proven = scored.find(candidate => candidate.plan.actions.length === 1
        && Core.isGameOver(candidate.plan.state.gameState) && candidate.plan.value >= 100000);
    const best=proven || comparable[0];
    return {
        version:cfg.version,action:best?.plan.actions[0] || fallback,continuation:best?.plan.actions.slice(1) || [],
        value:best?.value ?? null,transitions,elapsedMs:started !== undefined && options.now ? options.now()-started:null,
        stopped:best?stopped:'no_completed_plan',rejectedCount,rejected,evaluatedCandidates:examined.length,
        comparisonScenarioSeeds: comparison.scenarios.map(index => cfg.scenarioSeeds[index]), scenarioTimeCuts, scenarioNodeCuts,
        candidates: scored.map(candidate => ({ action: candidate.plan.actions[0], immediate: candidate.plan.value,
            replies: candidate.replies.filter((value): value is number => value !== null),
            scenarioSeeds: cfg.scenarioSeeds.filter((_, index) => candidate.replies[index] !== null), score: candidate.value }))
    };
}
