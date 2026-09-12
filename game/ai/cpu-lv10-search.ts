import Core = require('../logic/core');
import Board = require('../../shared/shared-board-utils');
import DeckSpec = require('../../shared/deck-spec');
import {
    applyLv10Action, currentLv10Player, enumerateLv10Actions, lv10PlacementMoves,
    sampleLv10Position, startLv10Turn,
    type Lv10Action, type Lv10Observation, type Lv10Player, type Lv10Position
} from './cpu-lv10-position';

/** Provisional development budget. Not shipped until the fixed-baseline match
 * and browser responsiveness gates in the Lv10 plan have passed. */
export const LV10_SEARCH_CONFIG = Object.freeze({
    version: 'lv10-canonical-beam-dev1', maxTransitions: 512, maxMs: 1000,
    maxRetainedPlans: 12, continuationBeam: 3, maxActionsPerTurn: 6,
    maxRootCandidates: 8
});

type Plan = { state: Lv10Position; actions: Lv10Action[]; value: number };
export type Lv10SearchOptions = {
    now?: () => number;
    maxTransitions?: number;
    maxMs?: number;
    publicRecipes?: Partial<Record<Lv10Player, readonly string[]>>;
};
export type Lv10SearchResult = {
    version: string; action: Lv10Action | null; continuation: Lv10Action[];
    value: number | null; transitions: number; elapsedMs: number | null;
    stopped: 'complete' | 'node_budget' | 'time_budget' | 'terminal' | 'no_completed_plan';
    rejectedCount: number; rejected: { action: Lv10Action; reason: string }[];
    evaluatedCandidates: number;
};

const CARD_COST_BY_TYPE = new Map<string, number>(DeckSpec.getEnabledCardDefs().map((card: any) => [card.type, card.cost]));
const CARD_BY_ID = DeckSpec.getEnabledCardDefMap();

/** A heuristic for truncated full-rule continuations, never an exact win claim.
 * Only the canonical two-pass terminal state receives a solved result. */
export function evaluateLv10Position(state: Lv10Position, player: Lv10Player): number {
    const gs = state.gameState, cs = state.cardState, sign = player === 'black' ? 1 : -1;
    const opponent = player === 'black' ? 'white' : 'black';
    const counts = Core.countDiscs(gs, cs);
    const material = sign * (counts.black - counts.white);
    if (Core.isGameOver(gs)) return material === 0 ? 0 : Math.sign(material) * 100000 + material;
    const board = Board.createBoardContext(gs, cs);
    const coordinates = Board.collectBoardCoordinates(board).filter((cell: any) => Board.hasPlayableCell(board, cell.row, cell.col));
    const size = Math.max(1, coordinates.length), empty = size - counts.black - counts.white;
    const end = Math.max(0, 1 - empty / (size * .3));
    let corners = 0, frontier = 0;
    for (const cell of Board.getCornerCells(board)) corners += sign * (Board.getCellValue(board, cell.row, cell.col) || 0);
    const owners = new Map<string, number>(coordinates.map((cell: any) => [`${cell.row},${cell.col}`, Board.getCellValue(board, cell.row, cell.col) || 0]));
    for (const cell of coordinates) {
        const value = owners.get(`${cell.row},${cell.col}`)!;
        if (value && [[1,0],[-1,0],[0,1],[0,-1]].some(([dr,dc]) => owners.get(`${cell.row+dr},${cell.col+dc}`) === 0)) frontier += value * sign;
    }
    const ownMobility = lv10PlacementMoves(state, player).length, enemyMobility = lv10PlacementMoves(state, opponent).length;
    let lasting = 0;
    for (const marker of cs.markers || []) {
        if (marker.owner !== player && marker.owner !== opponent) continue;
        if (!['specialStone', 'manifestStone'].includes(marker.kind)) continue;
        const price = CARD_COST_BY_TYPE.get(marker.data?.type) || 6;
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
    return material * (.75 + end * 2.25) + corners * 5 + (ownMobility - enemyMobility) * (1.5 - end)
        - frontier * .45 * (1-end) + lasting * .4 + (chargeValue(player) - chargeValue(opponent)) * .8
        + (handValue(player) - handValue(opponent)) * .18;
}

/** Entire search operates on sampled, isolated positions and injected time.
 * The caller validates and applies the returned advisory action normally. */
export function searchLv10(observation: Lv10Observation, options: Lv10SearchOptions = {}): Lv10SearchResult {
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
        if (result.ok) return result.state;
        rejectedCount++;
        if (rejected.length < 12) rejected.push({ action, reason: result.reason });
        if (result.reason.startsWith('RUNTIME_UNAVAILABLE')) throw new Error('Lv10 canonical runtime unavailable');
        return null;
    }
    function start(state: Lv10Position): Lv10Position | null {
        if (!available()) return null;
        transitions++;
        return startLv10Turn(state);
    }
    const initial = sampleLv10Position(observation, 100901, options.publicRecipes);
    const initialTurn = initial.gameState.turnNumber;
    const completed = (state: Lv10Position, owner: Lv10Player, turn: number) => Core.isGameOver(state.gameState)
        || currentLv10Player(state) !== owner || state.gameState.turnNumber > turn;
    const rank = (plans: Plan[], owner: Lv10Player, limit: number) => plans.sort((a,b) => (
        owner === player ? b.value - a.value : a.value - b.value
    )).slice(0,limit);
    function finish(state: Lv10Position, prefix: Lv10Action[], owner: Lv10Player, turn: number, quota: number): Plan[] {
        const from = transitions, done: Plan[] = [];
        let beam: Plan[] = [{state,actions:prefix,value:evaluateLv10Position(state,player)}];
        for (let depth=prefix.length; depth<=cfg.maxActionsPerTurn && beam.length && available(); depth++) {
            const next: Plan[] = [];
            for (const plan of beam) {
                if (completed(plan.state,owner,turn)) { done.push(plan); continue; }
                if (depth === cfg.maxActionsPerTurn) continue;
                for (const action of enumerateLv10Actions(plan.state)) {
                    if (transitions-from>=quota || !available()) break;
                    const after=apply(plan.state,action);
                    if(after) {
                        const candidate={state:after,actions:[...plan.actions,action],value:evaluateLv10Position(after,player)};
                        if(completed(after,owner,turn)) {
                            done.push(candidate);
                            done.splice(0,done.length,...rank(done,owner,cfg.maxRetainedPlans));
                        } else {
                            next.push(candidate);
                            next.splice(0,next.length,...rank(next,owner,cfg.continuationBeam));
                        }
                    }
                }
            }
            beam=rank(next,owner,cfg.continuationBeam);
        }
        return rank(done,owner,cfg.maxRetainedPlans);
    }
    if (Core.isGameOver(initial.gameState)) return {
        version:cfg.version,action:null,continuation:[],value:evaluateLv10Position(initial,player),transitions:0,
        elapsedMs:0,stopped:'terminal',rejectedCount:0,rejected:[],evaluatedCandidates:0
    };
    const rootActions = enumerateLv10Actions(initial, {allowDestroy:(initial.cardState.hands?.[player]?.length || 0)>=4});
    let fallback: Lv10Action | null = null;
    const plans: Plan[] = [], unfinished: Plan[] = [];
    for(const action of rootActions) {
        if(!available())break;
        const after=apply(initial,action);
        if(!after)continue;
        fallback ||= action;
        const plan={state:after,actions:[action],value:evaluateLv10Position(after,player)};
        const list=completed(after,player,initialTurn)?plans:unfinished;
        list.push(plan);
        list.splice(0,list.length,...rank(list,player,cfg.maxRetainedPlans));
    }
    const quota=Math.max(12,Math.floor((cap-transitions)*.60/Math.max(1,unfinished.length)));
    for(const plan of unfinished) {
        if(!available())break;
        plans.push(...finish(plan.state,plan.actions,player,initialTurn,quota));
        plans.splice(0,plans.length,...rank(plans,player,cfg.maxRetainedPlans));
    }
    const candidates=rank(plans,player,cfg.maxRootCandidates);
    // Opponent reply plans use the same rule transitions, including their cards.
    // This first development version examines one reply turn; deeper or more
    // diverse determinizations require independent development comparisons.
    const scored: {plan:Plan;value:number}[]=[];
    for(const plan of candidates) {
        let value=plan.value;
        if(!Core.isGameOver(plan.state.gameState) && available()) {
            const next=start(plan.state);
            if(next) {
                const owner=currentLv10Player(next);
                const replies=finish(next,[],owner,next.gameState.turnNumber,
                    Math.max(8,Math.floor((cap-transitions)/Math.max(1,candidates.length-scored.length))));
                if(replies.length)value=.25*value+.75*replies[0].value;
            }
        }
        scored.push({plan,value});
    }
    scored.sort((a,b)=>b.value-a.value);
    const best=scored[0];
    return {
        version:cfg.version,action:best?.plan.actions[0] || fallback,continuation:best?.plan.actions.slice(1) || [],
        value:best?.value ?? null,transitions,elapsedMs:started !== undefined && options.now ? options.now()-started:null,
        stopped:best?stopped:'no_completed_plan',rejectedCount,rejected,evaluatedCandidates:scored.length
    };
}
