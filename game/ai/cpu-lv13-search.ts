import { evaluateLv13Position, lv13CardPotential, lv13MarkerPotential, aggregateLv13ScenarioValues, lv13CardDefinition } from './cpu-lv13-evaluation';
import { createLv13ScenarioSampler } from './cpu-lv13-scenarios';
import Core = require('../logic/core');
import Board = require('../../shared/shared-board-utils');
import StateHash = require('../../shared/state-hash');
import {
    applyLv10Action, currentLv10Player, lv10DecisionPlayer, enumerateLv10Actions, lv10ActionKey,
    startLv10Turn, lv10PlacementMoves,
    type Lv10Action, type Lv10Observation, type Lv10Player, type Lv10Position
} from './cpu-lv10-position';
import { readSearchStoneSupply, resolveSearchRemainingPlacements } from './cpu-search-stone-supply';

/** Lv13 policy: the Lv12 search with a larger transition allowance (faster
 * board reads left the 4096 allowance unused well before the clock), and a
 * root which spends a card (cardUseMargin) or destroys a hand card
 * (destroyHandMargin) must beat the best root that does not by a margin.
 * The clock keeps a judgment within 5 s. Canonical actions and turn starts share the same
 * accounting and rules. */
export const LV13_SEARCH_CONFIG = Object.freeze({
    version: 'lv13-keep-relocation', maxTransitions: 6144, maxMs: 4700,
    maxRetainedPlans: 32, maxRetainedPartialPlans: 64, continuationBeam: 3, selectionBeam: 6, maxActionsPerTurn: 12,
    maxRootCandidates: 6, replyCandidates: 2, scenarioSeeds: Object.freeze([100901, 100909, 100913]), maxStageCandidates: 16,
    maxFreePlacementCandidates:32,
    endgameExtraTurns: 2, endgameEmptyThreshold: 16, endgameMobilityThreshold: 6, sparseStoneThreshold: 10,
    lateReplyCandidates: 1,
    maxAdditionalDeepCandidates: 1, maxDeepCandidates: 3, shallowBudgetFraction: .3, repairBudgetFraction: .25,
    // Score margin (aggregated scale -1..1) a card-using root must win by.
    cardUseMargin: .1,
    // Per card type adjustment added to cardUseMargin (positive: use only when clearly better).
    cardUseMarginByType: Object.freeze({}) as Readonly<Record<string, number>>,
    // Score margin a root that destroys a hand card must win by over a root that does not.
    destroyHandMargin: .08,
    // Root placement priors on the comparison scale: a corner of the current
    // shape gains cornerRootBonus; a cell next to an empty corner loses
    // dangerRootPenalty. Zero keeps the search's own judgment.
    cornerRootBonus: 0,
    dangerRootPenalty: 0,
    // Stone-relocation and board-expansion cards are kept (neither used nor
    // destroyed) unless the turn gains corners over every turn without them:
    // taking a corner, or taking back / removing one the opponent holds. The
    // restriction lifts when at most cornerOnlyOpenPlacements placements remain.
    cornerOnlyCardTypes: Object.freeze(['TELEPORT_WILL','SWAP_WITH_ENEMY','POSITION_SWAP_WILL','STRONG_WIND_WILL',
        'GRAVITY_WILL','BUOYANCY_WILL','SUPER_GRAVITY_WILL','SUPER_BUOYANCY_WILL',
        'BOARD_EXPANSION_WILL','BOARD_EXPANSION_GOD']) as readonly string[],
    cornerOnlyOpenPlacements: 10
});

type Plan = { state: Lv10Position; actions: Lv10Action[]; value: number; rootTie?: number };

// Card-state fields that record a card's use (hand, piles, copy/sequence IDs,
// charge, use counters, presentation) rather than any effect on the game.
// Markers are compared without their IDs.
const CARD_BOOKKEEPING = new Set([
    'decks', 'deck', 'discard', 'hands', 'handCostAdjustmentsByPlayer', '_handCopyIdsByPlayer', '_deckCopyIdsByPlayer',
    '_discardCopyIds', '_nextCardCopySeq', 'cardCostOverridesByCopyId', 'cardCostModifiersByCopyId',
    '_revealedHandCopyIdsByViewer', 'markers', '_nextMarkerId', '_nextCreatedSeq', 'presentationEvents',
    '_presentationEventsPersist', '_nextStoneId', 'stoneIdMap', 'selectedCardId', 'hasUsedCardThisTurnByPlayer',
    'lastUsedCardByPlayer', 'lastUsedCard', 'cardUseCountByPlayer', 'charge', 'chargeGainedTotal', 'chargeDeltaEvents',
    '_nextChargeDeltaSeq', 'pendingEffectSeq', '_nextEffectBlockId', 'prngState'
]);

/** Endgame reading reads the opponent's later turns as well. With the stone
 * supply rule (01-rulebook.md 7.3) the game can end by exhausted supplies
 * while many cells are still empty, so the threshold uses the placements that
 * can still be made. Without the rule this is exactly the empty-cell count. */
export function shouldDeepenLv13Search(state: Lv10Position, player: Lv10Player, ownStones: number, empty: number,
    totalMobility: number, cfg: Pick<Lv13SearchConfig, 'sparseStoneThreshold' | 'endgameEmptyThreshold' | 'endgameMobilityThreshold'> = LV13_SEARCH_CONFIG): boolean {
    const remaining = resolveSearchRemainingPlacements(empty, readSearchStoneSupply(state.cardState, player));
    return ownStones <= cfg.sparseStoneThreshold || remaining <= cfg.endgameEmptyThreshold
        || totalMobility <= cfg.endgameMobilityThreshold;
}

// A deterministic tie order avoids always retaining the upper-left portion
// of a multi-stage selection whose first choice has not changed the board.
function partialRootTie(action: Lv10Action): number {
    let value = 2166136261;
    for (const char of lv10ActionKey(action)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    return value >>> 0;
}
export type Lv13SearchOptions = {
    now?: () => number;
    maxTransitions?: number;
    maxMs?: number;
    publicRecipes?: Partial<Record<Lv10Player, readonly string[]>>;
    excludedActions?: readonly Lv10Action[];
    /** Development comparisons only (harness); production callers never set these. */
    tuning?: Partial<Lv13SearchConfig>;
    valueWeights?: readonly number[];
};
type Widen<T> = T extends string ? string : T extends number ? number : T extends readonly number[] ? readonly number[] : T;
export type Lv13SearchConfig = { [K in keyof typeof LV13_SEARCH_CONFIG]: Widen<(typeof LV13_SEARCH_CONFIG)[K]> };

export type Lv13SearchResult = {
    version: string; action: Lv10Action | null; continuation: Lv10Action[];
    value: number | null; transitions: number; elapsedMs: number | null;
    stopped: 'complete' | 'node_budget' | 'time_budget' | 'terminal' | 'no_completed_plan';
    rejectedCount: number; rejected: { action: Lv10Action; reason: string }[];
    evaluatedCandidates: number;
    comparisonScenarioSeeds?: number[];
    scenarioSampleSeeds?:number[];
    alternatePlanRepairs?:number;
    additionalDeepeningAttempts?:number;
    additionalDeepeningCompleted?:number;
    additionalDeepeningStartedAtTransitions?:number|null;
    comparisonDepths?: number[];
    evaluationCalls?: number; evaluationCacheHits?: number;
    scenarioTimeCuts?: number; scenarioNodeCuts?: number;
    candidates?: { action: Lv10Action; continuation: Lv10Action[]; immediate: number; replies: number[]; scenarioSeeds: number[]; score: number; retainedForDeepening?:boolean; additionalDeepeningAttempted?:boolean }[];
};

/** Missing scenario results retain their identity. A completed result in one
 * sampled world must never be compared with a different world's result merely
 * because both candidates happened to complete the same number of searches. */
export function compareLv13Scenarios(values: readonly (readonly (number | null)[])[]) {
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
        ? aggregateLv13ScenarioValues(scenarios.map(scenario => row[scenario]!)) : null) };
}

/** An interrupted deeper search must not replace one candidate's shallow
 * value while its competitors still use a different horizon. */
export function commonLv13DepthValues(layers: readonly (readonly (readonly (number | null)[])[])[]) {
    const shallow = layers.map(worlds=>worlds.map(values=>values[0] ?? null));
    const comparison = compareLv13Scenarios(shallow);
    const depths = shallow[0]?.map(()=>0) || [];
    for (const scenario of comparison.scenarios) {
        for (let depth=1;depth<3;depth++) {
            if (!comparison.eligible.every(index=>layers[index][scenario][depth] !== null
                && Number.isFinite(layers[index][scenario][depth]))) break;
            depths[scenario]=depth;
        }
        for (const index of comparison.eligible) shallow[index][scenario]=layers[index][scenario][depths[scenario]]!;
    }
    return {values:shallow,depths};
}

/** Entire search operates on sampled, isolated positions and injected time.
 * The caller validates and applies the returned advisory action normally. */
export function searchLv13(observation: Lv10Observation, options: Lv13SearchOptions = {}): Lv13SearchResult {
    return Board.withTopologyMemo(()=>searchLv13Scoped(observation,options));
}

function searchLv13Scoped(observation: Lv10Observation, options: Lv13SearchOptions): Lv13SearchResult {
    const cfg: Lv13SearchConfig = options.tuning ? { ...LV13_SEARCH_CONFIG, ...options.tuning } : LV13_SEARCH_CONFIG, player = observation.player;
    if (options.maxTransitions !== undefined && (!Number.isInteger(options.maxTransitions) || options.maxTransitions < 1)) {
        throw new Error('Lv13 transition budget must be a positive integer');
    }
    if (options.maxMs !== undefined && (!Number.isFinite(options.maxMs) || options.maxMs <= 0)) {
        throw new Error('Lv13 time budget must be positive and finite');
    }
    const cap = Math.min(cfg.maxTransitions, Math.max(1, Math.floor(options.maxTransitions ?? cfg.maxTransitions)));
    const started = options.now?.();
    const maxMs = Math.min(cfg.maxMs, Math.max(1, options.maxMs ?? cfg.maxMs));
    const evaluationCache=new WeakMap<Lv10Position,Partial<Record<Lv10Player,number>>>();
    let evaluationCalls=0,evaluationCacheHits=0;
    function evaluate(state:Lv10Position,viewer:Lv10Player):number {
        evaluationCalls++;
        const cached=evaluationCache.get(state);
        if(cached?.[viewer]!==undefined){evaluationCacheHits++;return cached[viewer]!;}
        const value=options.valueWeights?evaluateLv13Position(state,viewer,options.valueWeights):evaluateLv13Position(state,viewer);
        evaluationCache.set(state,{...cached,[viewer]:value});
        return value;
    }
    let transitions = 0, rejectedCount = 0, stopped: Lv13SearchResult['stopped'] = 'complete';
    let sliceDeadline = Infinity, sliceNodeEnd = Infinity, sliceTimeCut = false, sliceNodeCut = false;
    let scenarioTimeCuts = 0, scenarioNodeCuts = 0;
    let alternatePlanRepairs=0;
    const rejected: Lv13SearchResult['rejected'] = [];
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
        if (result.ok && !result.selectionFailed) { Board.markImmutableBoardSource(result.state.gameState); return result.state; }
        const reason = result.ok ? 'TARGET_SELECTION_NO_EFFECT' : result.reason;
        rejectedCount++;
        if (rejected.length < 12) rejected.push({ action, reason });
        if (reason.startsWith('RUNTIME_UNAVAILABLE')) throw new Error('Lv13 canonical runtime unavailable');
        return null;
    }
    function start(state: Lv10Position): Lv10Position | null {
        if (!available()) return null;
        transitions++;
        const next = startLv10Turn(state);
        Board.markImmutableBoardSource(next.gameState);
        return next;
    }
    const rawSampler=createLv13ScenarioSampler(observation,cfg.scenarioSeeds,options.publicRecipes);
    // Hypothetical positions are never mutated after creation; let the board
    // view cache skip re-reading them (shared/board/state-kernel.ts).
    const sampler={...rawSampler,sample(index:number){const state=rawSampler.sample(index);Board.markImmutableBoardSource(state.gameState);return state;}};
    const initial = sampler.sample(0);
    const initialOwner = currentLv10Player(initial);
    const initialTurn = initial.gameState.turnNumber;
    const initialCounts = Core.countDiscs(initial.gameState,initial.cardState);
    const initialBoard = Board.prepareBoardForSearch(Board.createBoardContext(initial.gameState,initial.cardState));
    const initialEmpty = Board.collectBoardCoordinates(initialBoard).filter((cell:any)=>Board.hasPlayableCell(initialBoard,cell.row,cell.col)).length
        -initialCounts.black-initialCounts.white;
    // Legal-line count can be high immediately before a multi-placement card
    // wipes out a small army. Read the opponent's next card turn as well as
    // their first attack when the public army is sparse.
    const deepen = shouldDeepenLv13Search(initial, player, initialCounts[player], initialEmpty,
        lv10PlacementMoves(initial,'black').length+lv10PlacementMoves(initial,'white').length, cfg);
    const completed = (state: Lv10Position, owner: Lv10Player, turn: number) => Core.isGameOver(state.gameState)
        || currentLv10Player(state) !== owner || state.gameState.turnNumber > turn;
    const rank = (plans: Plan[], owner: Lv10Player, limit: number) => plans.sort((a,b) => (
        owner === player ? b.value - a.value : a.value - b.value
    ) || (a.rootTie || 0)-(b.rootTie || 0)).slice(0,limit);
    function actionsFor(state:Lv10Position):Lv10Action[]{
        const owner=currentLv10Player(state);
        // Destroying a card gives no charge. With a free hand slot it mostly
        // duplicates a card/placement plan while removing an available option.
        // Keep cycling choices when the hand is full, or hand-size upkeep is
        // imposed by a publicly visible executor.
        const allowDestroy=(state.cardState.hands?.[owner]?.length||0)>=5
            ||(state.cardState.markers||[]).some((marker:any)=>marker.data?.type==='BOARD_EXECUTOR');
        const actions=enumerateLv10Actions(state,{allowDestroy});
        const cycling=actions.filter(action=>action.type==='destroy_hand_card')
            .sort((a,b)=>lv13CardPotential(a.destroyCardId)-lv13CardPotential(b.destroyCardId)).slice(0,2);
        return actions.filter(action=>action.type!=='destroy_hand_card'||cycling.includes(action));
    }
    // Forecast work only to divide the unchanged hard budget. Every actual
    // canonical transition is still counted by apply/start above.
    function estimateSliceQuota(requested:number,deadline:number):number {
        if(started===undefined||!options.now||!Number.isFinite(deadline)||transitions<8)return requested;
        const now=options.now(),elapsed=Math.max(1,now-started);
        // Leave headroom for settling the selected reply's turn-start effects
        // and for variation in transition cost within this slice.
        const predicted=Math.floor(Math.max(0,deadline-now)*transitions/elapsed*.85);
        return Math.max(1,Math.min(requested,predicted));
    }
    function finish(state: Lv10Position, prefix: Lv10Action[], owner: Lv10Player, turn: number, quota: number): Plan[] {
        quota=estimateSliceQuota(quota,sliceDeadline);
        const decisionPlayer = lv10DecisionPlayer(state);
        const beamWidth = state.cardState.pendingEffectByPlayer?.[owner]?.stage === 'selectTarget' ? cfg.selectionBeam : cfg.continuationBeam;
        const from = transitions, done: Plan[] = [];
        let beam: Plan[] = [{state,actions:prefix,value:evaluate(state,player)}];
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
                const limit = Math.max(1, Math.min(pending && pending.stage !== 'selectTarget' ? cfg.maxFreePlacementCandidates : cfg.maxStageCandidates,
                    Math.floor((quota - (transitions-from)) / stagesLeft / Math.max(1, beam.length))));
                const actions = orderActions(plan.state, actionsFor(plan.state), limit);
                for (const action of actions) {
                    if (transitions-from>=quota || !available()) break;
                    const after=apply(plan.state,action);
                    if(after) {
                        const candidate={state:after,actions:[...plan.actions,action],value:evaluate(after,player),rootTie:partialRootTie(action)};
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
        const context = Board.prepareBoardForSearch(Board.createBoardContext(state.gameState, state.cardState));
        const corners = Board.getCornerCells(context);
        function priority(action: Lv10Action): number {
            if (action.type === 'pass') return 100;
            if (action.type === 'use_card') return 2 + lv13CardPotential(action.useCardId) / 3;
            if (action.type === 'destroy_hand_card') return -1;
            const target = Number.isInteger(action.row) ? action : Object.values(action).find(value => value && Number.isInteger(value.row));
            if (!target) return 0;
            let value = 0;
            const owner=currentLv10Player(state),sign=owner==='black'?1:-1;
            const pending=state.cardState.pendingEffectByPlayer?.[owner];
            if(Number.isInteger(action.row)&&pending?.type==='ULTIMATE_DESTROY_GOD'){
                for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
                    if((dr||dc)&&Board.getCellValue(context,target.row+dr,target.col+dc)===-sign)value+=12;
                }
            }
            for (const corner of corners) {
                const dr = Math.abs(corner.row - target.row), dc = Math.abs(corner.col - target.col);
                if (!dr && !dc) value += 16;
                else if (dr <= 1 && dc <= 1 && !Board.getCellValue(context, corner.row, corner.col)) value -= 6;
            }
            const marker = (state.cardState.markers || []).find((m: any) => m.row === target.row && m.col === target.col);
            if (marker) value += Math.min(40, lv13MarkerPotential(marker)) / 3;
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
        version:cfg.version,action:null,continuation:[],value:evaluate(initial,player),transitions:0,
        elapsedMs:0,stopped:'terminal',rejectedCount:0,rejected:[],evaluatedCandidates:0
    };
    const excluded = new Set((options.excludedActions || []).map(lv10ActionKey));
    const rootActions = actionsFor(initial)
        .filter(action => !excluded.has(lv10ActionKey(action)));
    let fallback: Lv10Action | null = null;
    const plans: Plan[] = [], unfinished: Plan[] = [];
    for(const action of rootActions) {
        if(!available())break;
        const after=apply(initial,action);
        if(!after)continue;
        fallback ||= action;
        const plan={state:after,actions:[action],value:evaluate(after,player),rootTie:partialRootTie(action)};
        const list=completed(after,initialOwner,initialTurn)?plans:unfinished;
        list.push(plan);
        if (list === unfinished) {
            list.sort((a,b) => b.value-a.value || (a.rootTie || 0)-(b.rootTie || 0));
            if (list.length > cfg.maxRetainedPartialPlans) list.length = cfg.maxRetainedPartialPlans;
        } else list.splice(0,list.length,...rank(list,player,cfg.maxRetainedPlans));
    }
    const completingSelection = initial.cardState.pendingEffectByPlayer?.[initialOwner]?.stage === 'selectTarget';
    const quota=Math.max(12,Math.floor((cap-transitions)*(completingSelection ? .65 : .40)/Math.max(1,unfinished.length)));
    const rootNow=options.now?.();
    const rootDeadline=rootNow===undefined||started===undefined?Infinity
        :rootNow+Math.max(0,maxMs-(rootNow-started))*(completingSelection ? .65 : .40);
    for(let index=0;index<unfinished.length;index++) {
        if(!available())break;
        const plan=unfinished[index];
        const previousDeadline=sliceDeadline;
        if(options.now&&Number.isFinite(rootDeadline)){
            const now=options.now();
            if(now>=rootDeadline)break;
            sliceDeadline=now+Math.max(0,rootDeadline-now)/(unfinished.length-index);
        }
        try {
            // Complete comparable turns for each card within its own time
            // share, reserving the rest of the judgment for actual replies.
            const continuations = finish(plan.state,plan.actions,initialOwner,initialTurn,quota);
            plans.push(...continuations.slice(0, 2));
            plans.splice(0,plans.length,...rank(plans,player,cfg.maxRetainedPlans));
        } finally {sliceDeadline=previousDeadline;}
    }
    // A card turn that ends exactly like a retained turn without the card
    // only pays its charge: e.g. Free Will before a placement that was legal
    // anyway. Everything except card bookkeeping must be identical, the hand
    // may differ only by the spent card and no charge may be gained (a
    // treasure box or a card that grants its successor is never a twin).
    // Under a short reading budget such a twin can still win by search noise,
    // so it is never chosen. It stays among the compared roots: removing it
    // would hand its slot to another card plan and change unrelated choices.
    const turnOutcomeKey=(plan:Plan)=>{
        const {gameState,cardState}=plan.state;
        const rest:any={};
        for(const [key,value] of Object.entries(cardState))if(!CARD_BOOKKEEPING.has(key))rest[key]=value;
        rest.markers=(cardState.markers||[]).map((m:any)=>StateHash.stableStringify([m.row,m.col,m.kind,m.owner,m.data])).sort();
        return StateHash.stableStringify([gameState,rest]);
    };
    const handKey=(hand:readonly string[])=>[...hand].sort().join(',');
    const holdingOutcomes=new Map<string,{hand:string;charge:number}[]>();
    for(const plan of plans){
        if(plan.actions.some(action=>action.type==='use_card'))continue;
        const key=turnOutcomeKey(plan);
        holdingOutcomes.set(key,[...(holdingOutcomes.get(key)||[]),
            {hand:handKey(plan.state.cardState.hands[player]||[]),charge:plan.state.cardState.charge?.[player]??0}]);
    }
    const wastedCard=(plan:Plan)=>{
        const used=plan.actions.find(action=>action.type==='use_card');
        if(!used)return false;
        const hand=handKey([...(plan.state.cardState.hands[player]||[]),used.useCardId]);
        const charge=plan.state.cardState.charge?.[player]??0;
        return !!holdingOutcomes.get(turnOutcomeKey(plan))?.some(twin=>twin.hand===hand&&charge<=twin.charge);
    };
    const wasted=new Set(plans.filter(wastedCard));
    // After the opponent's pass, a second pass does not end the game while the
    // opponent still holds a usable card (01-rulebook.md 8.2); the turn only
    // returns to them. When neither side can place (e.g. one side has no stone
    // left), two CPUs (or a CPU and a human) would pass forever. There such a
    // pass is replaced by a completed card turn, which changes the position or
    // spends charge toward the end. A pass that does end the game is still
    // compared normally.
    const canPlace=(side:Lv10Player)=>(readSearchStoneSupply(initial.cardState,side)?.own??1)>0
        &&lv10PlacementMoves(initial,side).length>0;
    if((initial.gameState.consecutivePasses||0)>=1&&!canPlace('black')&&!canPlace('white')
        &&plans.some(plan=>plan.actions.some(action=>action.type==='use_card'))){
        plans.splice(0,plans.length,...plans.filter(plan=>plan.actions.some(action=>action.type==='use_card')
            ||plan.actions[plan.actions.length-1]?.type!=='pass'||Core.isGameOver(plan.state.gameState)));
    }
    // Relocation cards (teleport, swaps, wind, gravity/buoyancy) and board
    // expansion mostly reshuffle stones the opponent can answer. Before the last
    // placements they are kept for a corner: a turn using or destroying one is
    // compared only when its corner balance (own minus opponent corners, on the
    // shape after the turn) beats every turn without them.
    const cornerOnly=new Set(cfg.cornerOnlyCardTypes);
    const cornerOnlyCard=(id:string|undefined)=>!!id&&cornerOnly.has(String(lv13CardDefinition(id)?.type));
    const touchesCornerOnlyCard=(plan:Plan)=>plan.actions.some(action=>
        (action.type==='use_card'&&cornerOnlyCard(action.useCardId))
        ||(action.type==='destroy_hand_card'&&cornerOnlyCard(action.destroyCardId)));
    if(cornerOnly.size&&resolveSearchRemainingPlacements(initialEmpty,readSearchStoneSupply(initial.cardState,player))>cfg.cornerOnlyOpenPlacements
        &&plans.some(touchesCornerOnlyCard)){
        const sign=player==='black'?1:-1;
        const cornerBalance=(state:Lv10Position)=>{
            const context=Board.prepareBoardForSearch(Board.createBoardContext(state.gameState,state.cardState));
            return Board.getCornerCells(context).reduce((sum:number,cell:any)=>sum+sign*(Board.getCellValue(context,cell.row,cell.col)||0),0);
        };
        const kept=plans.filter(plan=>!touchesCornerOnlyCard(plan));
        const baseline=Math.max(cornerBalance(initial),...kept.map(plan=>cornerBalance(plan.state)));
        const allowed=plans.filter(plan=>!touchesCornerOnlyCard(plan)||cornerBalance(plan.state)>baseline);
        if(allowed.length)plans.splice(0,plans.length,...allowed);
    }
    const candidates: Plan[] = [];
    const seenRoots = new Set<string>();
    const family=(plan:Plan)=>{
        const main=plan.actions.find(action=>action.type!=='destroy_hand_card');
        return main?.type==='use_card'?`card:${main.useCardId}`:main?lv10ActionKey(main):'hand-cycle';
    };
    const orderedPlans = rank(plans,player,cfg.maxRetainedPlans);
    for (const plan of orderedPlans) {
        const key = family(plan);
        if (seenRoots.has(key)) continue;
        seenRoots.add(key); candidates.push(plan);
        if (candidates.length >= cfg.maxRootCandidates - 2) break;
    }
    for (const plan of orderedPlans) {
        if (!candidates.includes(plan)&&candidates.filter(other=>family(other)===family(plan)).length<2) candidates.push(plan);
        if (candidates.length >= cfg.maxRootCandidates) break;
    }
    type ReplyWorld={chooser:Lv10Player;settled:Lv10Position[];shallowValues:number[]};
    const allScored = candidates.map(plan => ({ plan, replies: cfg.scenarioSeeds.map(() => null as number | null),
        worlds:cfg.scenarioSeeds.map(()=>null as ReplyWorld|null),
        layers:cfg.scenarioSeeds.map(() => [null,null,null] as (number|null)[]), value: aggregateLv13ScenarioValues([plan.value]) }));
    function tail(state:Lv10Position,depth:number,quota:number):number|null {
        if(Core.isGameOver(state.gameState)||depth===0)return evaluate(state,player);
        if(quota<4||!available())return null;
        const from=transitions,owner=currentLv10Player(state),chooser=lv10DecisionPlayer(state);
        const plans=finish(state,[],owner,state.gameState.turnNumber,Math.max(2,Math.floor(quota*.45)));
        const branches:Plan[]=[],roots=new Set<string>();
        for(const plan of plans){
            const key=lv10ActionKey(plan.actions[0]);
            if(!roots.has(key)){roots.add(key);branches.push(plan);}
            if(branches.length>=cfg.lateReplyCandidates)break;
        }
        if(!branches.length)return null;
        const values:number[]=[];
        for(let index=0;index<branches.length;index++){
            const plan=branches[index];
            const next=Core.isGameOver(plan.state.gameState)?plan.state:start(plan.state);
            if(!next)return null;
            const value=tail(next,depth-1,Math.floor((quota-(transitions-from))/(branches.length-index)));
            if(value===null)return null;
            values.push(value);
        }
        return chooser===player?Math.max(...values):Math.min(...values);
    }
    function prepareScenario(candidate: typeof allScored[number], scenario: number, quota: number): number | null {
        const from = transitions;
        const layers=candidate.layers[scenario];
        const terminalValue=(value:number)=>{layers.fill(value);return value;};
        let own = candidate.plan;
        if (scenario > 0) {
            const alternate = sampler.sample(scenario);
            let state = alternate;
            let actions:Lv10Action[]=[];
            for (const action of own.actions) {
                if(completed(state,initialOwner,initialTurn))break;
                const after = apply(state, action);
                if (!after){
                    if(!actions.length||!available())return null;
                    // Chance effects can make a later target/place impossible.
                    // The live policy receives a fresh public observation at
                    // that boundary too. Replan the continuation in this world
                    // instead of discarding an inconvenient sampled outcome.
                    alternatePlanRepairs++;
                    const alternatives=finish(state,actions,initialOwner,initialTurn,
                        Math.max(4,Math.floor((quota-(transitions-from))*.5)));
                    if(!alternatives.length)return null;
                    state=alternatives[0].state;actions=alternatives[0].actions;
                    break;
                }
                state = after;
                actions.push(action);
            }
            if (!completed(state, initialOwner, initialTurn)) return null;
            own = { state, actions, value: evaluate(state, player) };
        }
        if (Core.isGameOver(own.state.gameState)) return terminalValue(own.value);
        const next = start(own.state);
        if (!next) return null;
        if (Core.isGameOver(next.gameState)) return terminalValue(evaluate(next, player));
        const owner = currentLv10Player(next), chooser = lv10DecisionPlayer(next);
        const remaining = Math.max(1, quota - (transitions-from));
        const replies = finish(next, [], owner, next.gameState.turnNumber, Math.max(1, remaining-cfg.replyCandidates));
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
        const shallowValues = settled.map(state => evaluate(state, player));
        const reduce=(values:number[])=>chooser===player?Math.max(...values):Math.min(...values);
        layers[0]=reduce(shallowValues);
        candidate.worlds[scenario]={chooser,settled,shallowValues};
        return layers[0];
    }
    function deepenScenario(candidate:typeof allScored[number],scenario:number,quota:number){
        const from=transitions,layers=candidate.layers[scenario];
        let world=candidate.worlds[scenario];
        if(!world&&layers[0]===null){
            const outerNodeEnd=sliceNodeEnd,outerDeadline=sliceDeadline;
            sliceNodeEnd=Math.min(outerNodeEnd,transitions+Math.max(6,Math.floor(quota*.65)));
            if(started!==undefined&&options.now){const now=options.now();sliceDeadline=now+Math.max(0,outerDeadline-now)*.65;}
            try{candidate.replies[scenario]=prepareScenario(candidate,scenario,Math.max(6,Math.floor(quota*.65)));}
            finally{sliceNodeEnd=outerNodeEnd;sliceDeadline=outerDeadline;}
            world=candidate.worlds[scenario];
        }
        if(!world)return;
        const {chooser,settled,shallowValues}=world;
        const reduce=(values:number[])=>chooser===player?Math.max(...values):Math.min(...values);
        const answerValues: number[] = [];
        const afterAnswers:Lv10Position[]=[];
        for (let index = 0; index < settled.length; index++) {
            const state = settled[index];
            if (Core.isGameOver(state.gameState)) { answerValues.push(shallowValues[index]); afterAnswers.push(state); continue; }
            const answerOwner = currentLv10Player(state);
            const answerQuota = Math.max(1, Math.floor((quota - (transitions-from) - 1) * (deepen ? .55 : 1) / (settled.length-index)));
            const answers = finish(state, [], answerOwner, state.gameState.turnNumber, answerQuota);
            if (!answers.length) break;
            const after = Core.isGameOver(answers[0].state.gameState) ? answers[0].state : start(answers[0].state);
            if (!after) break;
            answerValues.push(evaluate(after, player));
            afterAnswers.push(after);
        }
        // Reconsider the responding player's alternatives after our replies.
        // If the deeper layer is incomplete, compare every alternative at the
        // same shallower boundary instead of dropping a dangerous response.
        if(answerValues.length===settled.length){
            layers[1]=reduce(answerValues);
            if(deepen){
                const extended:number[]=[];
                for(let index=0;index<afterAnswers.length;index++){
                    const value=tail(afterAnswers[index],cfg.endgameExtraTurns,Math.floor((quota-(transitions-from))/(afterAnswers.length-index)));
                    if(value===null)break;
                    extended.push(value);
                }
                if(extended.length===afterAnswers.length)layers[2]=reduce(extended);
            }
        }
    }
    function runPhase(pool:typeof allScored,phase:'prepare'|'deepen',nodeEnd:number,timeEnd:number,scenarioCount=cfg.scenarioSeeds.length){
      for (let scenario=0; scenario<scenarioCount && available(); scenario++) {
        for (let index=0; index<pool.length && available(); index++) {
            const candidate = pool[index];
            const slotsLeft = Math.max(1, pool.length*(scenarioCount-scenario)-index);
            const quota = Math.max(12, Math.floor((nodeEnd-transitions)/slotsLeft));
            sliceNodeEnd = Math.min(cap, transitions + quota);
            if (started !== undefined && options.now) {
                const now = options.now();
                sliceDeadline = now + Math.max(0, timeEnd - now) / slotsLeft;
            }
            sliceTimeCut = false; sliceNodeCut = false;
            try {
                if(phase==='prepare')candidate.replies[scenario] = prepareScenario(candidate, scenario, quota);
                else deepenScenario(candidate,scenario,quota);
            }
            finally {
                if (sliceTimeCut) scenarioTimeCuts++;
                if (sliceNodeCut) scenarioNodeCuts++;
                sliceDeadline = Infinity; sliceNodeEnd = Infinity;
            }
        }
      }
    }
    const phaseStarted=options.now?.()??0;
    runPhase(allScored,'prepare',transitions+Math.floor((cap-transitions)*cfg.shallowBudgetFraction),
        started===undefined?Infinity:phaseStarted+(started+maxMs-phaseStarted)*cfg.shallowBudgetFraction,1);
    const shallowComparison=compareLv13Scenarios(allScored.map(candidate=>candidate.replies));
    for(const index of shallowComparison.eligible)allScored[index].value=shallowComparison.scores[index]!;
    // Give a wholly unexamined high-value plan a conservative provisional
    // score so an expensive response search cannot exclude it automatically.
    for(let index=0;index<allScored.length;index++){
        if(!shallowComparison.eligible.includes(index))allScored[index].value=aggregateLv13ScenarioValues([allScored[index].plan.value])*.5-.15;
    }
    const scored=allScored.slice().sort((a,b)=>b.value-a.value).slice(0,cfg.maxDeepCandidates);
    const missing:{candidate:typeof scored[number];scenario:number}[]=[];
    for(let scenario=0;scenario<1;scenario++)for(const candidate of scored){
        if(candidate.layers[scenario][0]===null)missing.push({candidate,scenario});
    }
    const repairStarted=options.now?.()??0;
    const repairNodeEnd=transitions+Math.floor((cap-transitions)*cfg.repairBudgetFraction);
    const repairTimeEnd=started===undefined?Infinity:repairStarted+(started+maxMs-repairStarted)*cfg.repairBudgetFraction;
    for(let index=0;index<missing.length&&available();index++){
        const {candidate,scenario}=missing[index],left=missing.length-index;
        const quota=Math.max(12,Math.floor((repairNodeEnd-transitions)/left));
        sliceNodeEnd=Math.min(cap,transitions+quota);
        if(started!==undefined&&options.now){const now=options.now();sliceDeadline=now+Math.max(0,repairTimeEnd-now)/left;}
        sliceTimeCut=false;sliceNodeCut=false;
        try{candidate.replies[scenario]=prepareScenario(candidate,scenario,quota);}
        finally{
            if(sliceTimeCut)scenarioTimeCuts++;if(sliceNodeCut)scenarioNodeCuts++;
            sliceDeadline=Infinity;sliceNodeEnd=Infinity;
        }
    }
    runPhase(scored,'deepen',cap,started===undefined?Infinity:started+maxMs);
    // Preserve the original three-candidate search and its completed values.
    // Only genuinely unused time/nodes can fund one more retained root. Admit
    // it only after every public hypothetical world reaches the same horizon.
    // An incomplete extra search never weakens the existing comparison.
    const finalLayer=deepen?2:1;
    const fullyDeepened=(candidate:typeof scored[number])=>candidate.layers.every(world=>
        world[finalLayer]!==null&&Number.isFinite(world[finalLayer]));
    let additionalCandidate:typeof scored[number]|undefined;
    let additionalDeepeningStartedAtTransitions:number|null=null;
    let additionalDeepeningCompleted=0;
    if(cfg.maxAdditionalDeepCandidates>0&&scored.length&&scored.every(fullyDeepened)
        &&!allScored.some(candidate=>candidate.plan.actions.length===1
            &&Core.isGameOver(candidate.plan.state.gameState)&&candidate.plan.value>=100000)
        &&available()){
        additionalCandidate=allScored.filter(candidate=>!scored.includes(candidate))
            .sort((a,b)=>b.value-a.value)[0];
        if(additionalCandidate){
            additionalDeepeningStartedAtTransitions=transitions;
            runPhase([additionalCandidate],'deepen',cap,started===undefined?Infinity:started+maxMs);
            if(fullyDeepened(additionalCandidate)){
                scored.push(additionalCandidate);additionalDeepeningCompleted=1;
            }
        }
    }
    const commonDepth=commonLv13DepthValues(scored.map(candidate=>candidate.layers));
    scored.forEach((candidate,index)=>{candidate.replies=commonDepth.values[index];});
    const comparison = compareLv13Scenarios(scored.map(candidate => candidate.replies));
    const examined = comparison.eligible.map(index => scored[index]);
    for (const index of comparison.eligible) scored[index].value = comparison.scores[index]!;
    const comparable = examined.length ? examined : scored;
    // Spending a card (its charge and the turn's card use) must beat the best
    // compared root that keeps the hand by a clear margin, not by search noise.
    // A card is not compared with holding when every compared root spends a
    // card: the shallow comparison already preferred cards there, and forcing
    // a holding root into the deep set was measured to lose (see
    // docs/cpu-lv13-development-plan.md, 第5段階).
    if(comparable.some(candidate=>candidate.plan.actions[0]?.type!=='use_card')){
        for(const candidate of comparable){
            const first=candidate.plan.actions[0];
            if(first?.type!=='use_card')continue;
            const type=lv13CardDefinition(first.useCardId)?.type;
            candidate.value-=cfg.cardUseMargin+((type&&cfg.cardUseMarginByType[type])||0);
        }
    }
    if(cfg.cornerRootBonus>0||cfg.dangerRootPenalty>0){
        const corners=Board.getCornerCells(initialBoard);
        const emptyCorners=corners.filter((cell:any)=>!Board.getCellValue(initialBoard,cell.row,cell.col));
        for(const candidate of comparable){
            const first=candidate.plan.actions[0];
            if(first?.type!=='place'||!Number.isInteger(first.row)||!Number.isInteger(first.col))continue;
            if(corners.some((cell:any)=>cell.row===first.row&&cell.col===first.col))candidate.value+=cfg.cornerRootBonus;
            else if(emptyCorners.some((cell:any)=>Math.abs(cell.row-first.row)<=1&&Math.abs(cell.col-first.col)<=1))candidate.value-=cfg.dangerRootPenalty;
        }
    }
    if(cfg.destroyHandMargin>0&&comparable.some(candidate=>candidate.plan.actions[0]?.type!=='destroy_hand_card')){
        for(const candidate of comparable)if(candidate.plan.actions[0]?.type==='destroy_hand_card')candidate.value-=cfg.destroyHandMargin;
    }
    comparable.sort((a,b)=>b.value-a.value);
    // A terminal win caused by this immediate action is known, unlike a
    // terminal result in a hypothetical later draw sequence.
    const proven = allScored.find(candidate => candidate.plan.actions.length === 1
        && Core.isGameOver(candidate.plan.state.gameState) && candidate.plan.value >= 100000);
    const best=proven || comparable.find(candidate=>!wasted.has(candidate.plan)) || comparable[0];
    return {
        version:cfg.version,action:best?.plan.actions[0] || fallback,continuation:best?.plan.actions.slice(1) || [],
        value:best?.value ?? null,transitions,elapsedMs:started !== undefined && options.now ? options.now()-started:null,
        stopped:best?stopped:'no_completed_plan',rejectedCount,rejected,evaluatedCandidates:examined.length,
        comparisonScenarioSeeds: comparison.scenarios.map(index => cfg.scenarioSeeds[index]), scenarioTimeCuts, scenarioNodeCuts,
        scenarioSampleSeeds:sampler.sampleSeeds,
        alternatePlanRepairs,
        additionalDeepeningAttempts:additionalCandidate?1:0,
        additionalDeepeningCompleted,additionalDeepeningStartedAtTransitions,
        comparisonDepths:comparison.scenarios.map(index=>[2,3,5][commonDepth.depths[index]]),
        evaluationCalls,evaluationCacheHits,
        candidates: allScored.map(candidate => ({ action: candidate.plan.actions[0], continuation:candidate.plan.actions.slice(1), immediate: candidate.plan.value,
            retainedForDeepening:scored.includes(candidate),additionalDeepeningAttempted:candidate===additionalCandidate,
            replies: candidate.replies.filter((value): value is number => value !== null),
            scenarioSeeds: cfg.scenarioSeeds.filter((_, index) => candidate.replies[index] !== null), score: candidate.value }))
    };
}
