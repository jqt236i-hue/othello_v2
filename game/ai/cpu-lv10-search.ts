import Core = require('../logic/core');
import Board = require('../../shared/shared-board-utils');
import DeckSpec = require('../../shared/deck-spec');
import StoneRegistry = require('../../shared/special-stone-registry-static');
import {
    estimateStonePlacementLead,
    isSearchStoneSupplyBlockingMobility,
    readSearchStoneSupply,
    resolveSearchRemainingPlacements
} from './cpu-search-stone-supply';
import {
    applyLv10Action, currentLv10Player, lv10DecisionPlayer, enumerateLv10Actions, lv10PlacementMoves, lv10ActionKey,
    sampleLv10Position, startLv10Turn,
    type Lv10Action, type Lv10Observation, type Lv10Player, type Lv10Position
} from './cpu-lv10-position';

/** Provisional development budget. Not shipped until the fixed-baseline match
 * and browser responsiveness gates in the Lv10 plan have passed. */
export const LV10_SEARCH_CONFIG = Object.freeze({
    version: 'lv10-canonical-beam-dev7', maxTransitions: 1024, maxMs: 1500,
    maxRetainedPlans: 12, continuationBeam: 2, maxActionsPerTurn: 8,
    maxRootCandidates: 6, scenarioSeeds: Object.freeze([100901, 100909]), maxStageCandidates: 12
});

type Plan = { state: Lv10Position; actions: Lv10Action[]; value: number };
export type Lv10SearchOptions = {
    now?: () => number;
    maxTransitions?: number;
    maxMs?: number;
    publicRecipes?: Partial<Record<Lv10Player, readonly string[]>>;
    excludedActions?: readonly Lv10Action[];
};

export type Lv10SearchResult = {
    version: string; action: Lv10Action | null; continuation: Lv10Action[];
    value: number | null; transitions: number; elapsedMs: number | null;
    stopped: 'complete' | 'node_budget' | 'time_budget' | 'terminal' | 'no_completed_plan';
    rejectedCount: number; rejected: { action: Lv10Action; reason: string }[];
    evaluatedCandidates: number;
    candidates?: { action: Lv10Action; immediate: number; replies: number[]; score: number }[];
};

const CARD_COST_BY_TYPE = new Map<string, number>(DeckSpec.getEnabledCardDefs().map((card: any) => [card.type, card.cost]));
const CARD_BY_ID = DeckSpec.getEnabledCardDefMap();
const CARD_COST_BY_MARKER_TYPE = new Map<string,number>();
for (const card of DeckSpec.getEnabledCardDefs()) {
    const markerType=StoneRegistry.getMarkerTypeForSpecialStoneCard(card.type);
    if(markerType) CARD_COST_BY_MARKER_TYPE.set(markerType,card.cost);
}

function markerCardCost(marker:any): number {
    const data=marker.data || {};
    return CARD_BY_ID.get(data.sourceCardId)?.cost
        ?? CARD_COST_BY_TYPE.get(data.sourceCardType)
        ?? CARD_COST_BY_TYPE.get(data.sourceType)
        ?? CARD_COST_BY_MARKER_TYPE.get(StoneRegistry.normalizeSpecialStoneType(data.type))
        ?? CARD_COST_BY_TYPE.get(data.type) ?? 6;
}

/** A heuristic for truncated full-rule continuations, never an exact win claim.
 * Only the canonical two-pass terminal state receives a solved result. */
export function evaluateLv10Position(state: Lv10Position, player: Lv10Player): number {
    const gs = state.gameState, cs = state.cardState, sign = player === 'black' ? 1 : -1;
    const opponent = player === 'black' ? 'white' : 'black';
    const counts = Core.countDiscs(gs, cs);
    const material = sign * (counts.black - counts.white);
    if (Core.isGameOver(gs)) return material === 0 ? 0 : Math.sign(material) * 100000 + material;
    // One compact search projection per evaluated position, as Lv11/Lv12 do.
    const board = Board.prepareBoardForSearch(Board.createBoardContext(gs, cs));
    const coordinates = Board.collectBoardCoordinates(board).filter((cell: any) => Board.hasPlayableCell(board, cell.row, cell.col));
    const size = Math.max(1, coordinates.length), empty = size - counts.black - counts.white;
    // 持ち石ルールでは、終盤度を空きマスではなく実際に置ける残り回数で測る。
    const stoneSupply = readSearchStoneSupply(cs, player);
    const end = Math.max(0, 1 - resolveSearchRemainingPlacements(empty, stoneSupply) / (size * .3));
    let corners = 0, frontier = 0, cornerRisk = 0, stableEdge = 0;
    for (const cell of Board.getCornerCells(board)) corners += sign * (Board.getCellValue(board, cell.row, cell.col) || 0);
    const owners = new Map<string, number>(coordinates.map((cell: any) => [`${cell.row},${cell.col}`, Board.getCellValue(board, cell.row, cell.col) || 0]));
    for (const corner of Board.getCornerCells(board)) {
        const cornerOwner = owners.get(`${corner.row},${corner.col}`) || 0;
        if (!cornerOwner) {
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                if (!dr && !dc) continue;
                cornerRisk += (owners.get(`${corner.row+dr},${corner.col+dc}`) || 0) * sign * (dr && dc ? 1.7 : 1);
            }
        } else {
            for (const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                for (let step=1; step<=32; step++) {
                    if (owners.get(`${corner.row+dr*step},${corner.col+dc*step}`) !== cornerOwner) break;
                    stableEdge += cornerOwner * sign;
                }
            }
        }
    }
    for (const cell of coordinates) {
        const value = owners.get(`${cell.row},${cell.col}`)!;
        if (value && [[1,0],[-1,0],[0,1],[0,-1]].some(([dr,dc]) => owners.get(`${cell.row+dr},${cell.col+dc}`) === 0)) frontier += value * sign;
    }
    const ownMobility = lv10PlacementMoves(state, player).length, enemyMobility = lv10PlacementMoves(state, opponent).length;
    let lasting = 0;
    for (const marker of cs.markers || []) {
        if (marker.owner !== player && marker.owner !== opponent) continue;
        if (!['specialStone', 'manifestStone'].includes(marker.kind)) continue;
        if (StoneRegistry.HAZARD_STONE_STATUS_TYPES.has(marker.data?.type)) {
            // Poison and scorch are liabilities on the affected stone. Their
            // real destruction is still resolved by the canonical pipeline;
            // this discounted term only covers a truncated search horizon.
            const remaining=Math.max(0,Number(marker.data?.remainingTurns)||0);
            const occupant=Board.getCellValue(board,marker.row,marker.col) || 0;
            lasting -= occupant * sign * 15/(1+remaining/3);
            continue;
        }
        const price = markerCardCost(marker);
        const life = Number(marker.data?.remainingOwnerTurns);
        const factor = Number.isFinite(life) ? Math.min(1, Math.max(0, life) / 3) : 1;
        lasting += (marker.owner === player ? 1 : -1) * Math.min(30, price) * factor;
    }
    const chargeValue = (key: Lv10Player) => Math.sqrt(Math.max(0, Math.min(99, cs.charge?.[key] || 0)));
    const handValue = (key: Lv10Player) => (cs.hands?.[key] || []).reduce((total: number, id: string) => {
        const card = CARD_BY_ID.get(id);
        const cost = Number(card?.cost) || 0;
        return total + Math.min(12, cost) * (cost <= (cs.charge?.[key] || 0) ? 1 : .35);
    }, 0);
    // 持ち石切れの合法手 0 は機動力差ではなく、置ける回数の差（placement lead）として数える。
    const mobilityDifference = isSearchStoneSupplyBlockingMobility(stoneSupply) ? 0 : ownMobility - enemyMobility;
    return material * (.25 + end * 2.75) + corners * 8 + stableEdge * 1.2 - cornerRisk * (2.5 - end)
        + mobilityDifference * (2 - end) + estimateStonePlacementLead(empty, stoneSupply) * 2.5
        - frontier * .45 * (1-end) + lasting * .4 + (chargeValue(player) - chargeValue(opponent)) * .8
        + (handValue(player) - handValue(opponent)) * .18;
}

/** Entire search operates on sampled, isolated positions and injected time.
 * The caller validates and applies the returned advisory action normally. */
export function searchLv10(observation: Lv10Observation, options: Lv10SearchOptions = {}): Lv10SearchResult {
    // Same scope as Lv12: only immutable board geometry is reused within one search.
    return Board.withTopologyMemo(() => searchLv10Scoped(observation, options));
}

function searchLv10Scoped(observation: Lv10Observation, options: Lv10SearchOptions): Lv10SearchResult {
    const cfg = LV10_SEARCH_CONFIG, player = observation.player;
    if (options.maxTransitions !== undefined && (!Number.isInteger(options.maxTransitions) || options.maxTransitions < 1)) {
        throw new Error('Lv10 transition budget must be a positive integer');
    }
    if (options.maxMs !== undefined && (!Number.isFinite(options.maxMs) || options.maxMs <= 0)) {
        throw new Error('Lv10 time budget must be positive and finite');
    }
    const cap = Math.min(cfg.maxTransitions, Math.max(1, Math.floor(options.maxTransitions ?? cfg.maxTransitions)));
    const started = options.now?.();
    const maxMs = Math.min(cfg.maxMs, Math.max(1, options.maxMs ?? cfg.maxMs));
    let transitions = 0, rejectedCount = 0, stopped: Lv10SearchResult['stopped'] = 'complete';
    const rejected: Lv10SearchResult['rejected'] = [];
    function available() {
        if (transitions >= cap) { stopped = 'node_budget'; return false; }
        if (started !== undefined && options.now && options.now() - started >= maxMs) { stopped = 'time_budget'; return false; }
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
        if (reason.startsWith('RUNTIME_UNAVAILABLE')) throw new Error('Lv10 canonical runtime unavailable');
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
    )).slice(0,limit);
    function finish(state: Lv10Position, prefix: Lv10Action[], owner: Lv10Player, turn: number, quota: number): Plan[] {
        const decisionPlayer = lv10DecisionPlayer(state);
        const from = transitions, done: Plan[] = [];
        let beam: Plan[] = [{state,actions:prefix,value:evaluateLv10Position(state,player)}];
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
                        const candidate={state:after,actions:[...plan.actions,action],value:evaluateLv10Position(after,player)};
                        if(completed(after,owner,turn)) {
                            done.push(candidate);
                            done.splice(0,done.length,...rank(done,decisionPlayer,cfg.maxRetainedPlans));
                        } else {
                            next.push(candidate);
                            next.splice(0,next.length,...rank(next,decisionPlayer,cfg.continuationBeam));
                        }
                    }
                }
            }
            beam=rank(next,decisionPlayer,cfg.continuationBeam);
        }
        return rank(done,decisionPlayer,cfg.maxRetainedPlans);
    }

    function orderActions(state: Lv10Position, actions: Lv10Action[], limit: number): Lv10Action[] {
        const context = Board.createBoardContext(state.gameState, state.cardState);
        const corners = Board.getCornerCells(context);
        function priority(action: Lv10Action): number {
            if (action.type === 'pass') return 100;
            if (action.type === 'use_card') return 2 + Math.min(24, CARD_BY_ID.get(action.useCardId)?.cost || 0) / 4;
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
            if (marker) value += Math.min(20, markerCardCost(marker)) / 4;
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
        version:cfg.version,action:null,continuation:[],value:evaluateLv10Position(initial,player),transitions:0,
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
        const plan={state:after,actions:[action],value:evaluateLv10Position(after,player)};
        const list=completed(after,initialOwner,initialTurn)?plans:unfinished;
        list.push(plan);
        list.splice(0,list.length,...rank(list,player,cfg.maxRetainedPlans));
    }
    const quota=Math.max(12,Math.floor((cap-transitions)*.60/Math.max(1,unfinished.length)));
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
    const scored = candidates.map(plan => ({ plan, replies: [] as number[], value: plan.value }));
    for (let scenario=0; scenario<cfg.scenarioSeeds.length && available(); scenario++) {
        for (let index=0; index<scored.length && available(); index++) {
            const candidate = scored[index];
            const candidateStartedAtTransition = transitions;
            const quota = Math.max(12, Math.floor((cap-transitions) /
                Math.max(1, scored.length*(cfg.scenarioSeeds.length-scenario)-index)));
            let own = candidate.plan;
            if (scenario > 0) {
                const alternate = sampleLv10Position(observation, cfg.scenarioSeeds[scenario], options.publicRecipes);
                const after = apply(alternate, own.actions[0]);
                if (!after) continue;
                if (completed(after, initialOwner, initialTurn)) own = { state: after, actions: [own.actions[0]], value: evaluateLv10Position(after,player) };
                else {
                    const alternatives = finish(after, [own.actions[0]], initialOwner, initialTurn, Math.max(8, Math.floor(quota*.45)));
                    if (!alternatives.length) continue;
                    own = alternatives[0];
                }
            }
            let value = own.value;
            if (!Core.isGameOver(own.state.gameState)) {
                const next = start(own.state);
                if (!next) continue;
                const owner = currentLv10Player(next);
                const replies = finish(next,[],owner,next.gameState.turnNumber,
                    Math.max(1, quota - (transitions-candidateStartedAtTransition) - 1));
                if (!replies.length) continue;
                const settled = Core.isGameOver(replies[0].state.gameState) ? replies[0].state : start(replies[0].state);
                if (!settled) continue;
                value = evaluateLv10Position(settled,player);
            }
            candidate.replies.push(value);
        }
    }
    // Do not compare an unexamined optimistic leaf against examined replies.
    // Use the same completed scenario count across the eligible candidates.
    const examined = scored.filter(candidate => candidate.replies.length > 0);
    const coverage = examined.length ? Math.min(...examined.map(candidate => candidate.replies.length)) : 0;
    for (const candidate of examined) {
        const values = candidate.replies.slice(0,coverage);
        const mean = values.reduce((sum,value) => sum+value,0)/values.length;
        candidate.value = .85*mean + .15*Math.min(...values);
    }
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
        candidates: scored.map(candidate => ({ action: candidate.plan.actions[0], immediate: candidate.plan.value,
            replies: candidate.replies, score: candidate.value }))
    };
}
