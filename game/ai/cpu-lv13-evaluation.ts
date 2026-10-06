import Core = require('../logic/core');
import Board = require('../../shared/shared-board-utils');
import Registry = require('../../shared/special-stone-registry-static');
import SharedConstants = require('../../shared-constants');
import { lv10PlacementMoves, type Lv10Position, type Lv10Player } from './cpu-lv10-position';
import { LV13_VALUE_WEIGHTS } from './cpu-lv13-model';
import {
    estimateStonePlacementLead,
    isSearchStoneSupplyBlockingMobility,
    readSearchStoneSupply,
    resolveStonePlacementCardValueFactor,
    resolveSearchRemainingPlacements
} from './cpu-search-stone-supply';

// Generated progression cards are legitimate hand cards even though they
// are excluded from initial deck construction. Value the complete catalog;
// deck sampling continues to use only the public recipe.
const definitions=SharedConstants.CARD_DEFS;
if(!definitions)throw new Error('Lv13 requires the canonical card catalog');
const CARDS = new Map(definitions.map(card=>[card.id,card]));
export function lv13CardDefinition(id:string){return CARDS.get(id);}
/** Development coefficients, evaluated on public sampled worlds only.
 * Recurring production/conversion is valued separately from purchase price.
 * These estimates never settle effects, declare a win or mutate game state. */
const RECURRING_POWER: Readonly<Record<string, number>> = Object.freeze({
    DRAGON: 9, ULTIMATE_DESTROY_GOD: 6, BREEDING: 6, WILL_HUNTER_KING: 6,
    LIGHTNING: 4, METEOR_GOD: 4, SNIPER: 3.5, DESTROY_DRAGON: 2.5,
    ROBOT_VACUUM: 4, GLUTTONOUS: 3.5, ULTIMATE_HYPERACTIVE: 6,
    HYPERACTIVE: 2.5, EXTREME_HYPERACTIVE: 3.5, ZOMBIE: 3,
    GRASS: 3, WATER: 1, FIRE: 1.5, STONE_SALVATION_GOD: 5,
    WORK: 1.8, ULTIMATE_WORK_GOD: 1.5, SHINRA_BANSHO_GOD: 14,
    THEORY_INCARNATION: 8, OBSERVER_WILL: 2, BOARD_EXECUTOR: 0
});

/** A sampled terminal is uncertain at the live root. Keep sampled outcomes
 * and unresolved positions on a comparable bounded scale; this is a search
 * utility, not a calibrated win probability. Immediate proven wins are still
 * selected separately by the search. */
export function aggregateLv13ScenarioValues(values: readonly number[]): number {
    if (!values.length) throw new Error('Scenario comparison needs a completed value');
    const bounded = values.map(value => Math.tanh(value / 64));
    return .85 * bounded.reduce((sum, value) => sum + value, 0) / bounded.length + .15 * Math.min(...bounded);
}

export function lv13MarkerPotential(marker: any, horizon = 8): number {
    const data = marker.data || {}, type = Registry.normalizeSpecialStoneType(data.type);
    const info = Registry.getSpecialStoneInfo(type) || {};
    const remaining = Number(data.remainingOwnerTurns);
    const life = Number.isFinite(remaining) ? Math.max(0, Math.min(horizon, remaining)) : horizon;
    const production = (RECURRING_POWER[type] || 0) * Math.sqrt(life);
    let defense = info.inviolable ? 10 : info.ghost ? 6 : info.flipProtected ? 3.5 : 0;
    if (type === 'REGEN') defense += Math.min(3, Number(data.remainingRegens ?? data.remainingUses ?? 3)) * 2;
    if (type === 'AFTERIMAGE_WILL') defense += 4;
    if (type === 'SACRIFICE') defense += 6;
    if (type === 'LIVING_WILL') defense += 4;
    if (type === 'PROTECTED' || type === 'GUARD') defense *= Math.min(1, life / 3);
    if (type === 'TIME_STOP' || type === 'TIME_STOP_DEITY') {
        const delay = Math.max(1, remaining || 5);
        defense += (type === 'TIME_STOP_DEITY' ? 26 : 10) / (1 + delay / 3);
    }
    return production + defense;
}

export function lv13CardPotential(id: string): number {
    const card = CARDS.get(id);
    if (!card) return 0;
    const marker = Registry.getMarkerTypeForSpecialStoneCard(card.type);
    if (marker) return 2 + lv13MarkerPotential({ data: { type: marker, remainingOwnerTurns: 5 } }) * .65;
    const tactical: Record<string, number> = {
        DOUBLE_PLACE: 15, TRIPLE_PLACE: 22, QUAD_PLACE: 29, INFINITE_PLACE: 35,
        DOUBLE_CHAIN_WILL: 9, TRIPLE_CHAIN_WILL: 13, QUAD_CHAIN_WILL: 17, INFINITE_CHAIN_WILL: 23,
        TEMPT_WILL: 15, CAPTURE_WILL: 12, CLONE_WILL: 12, SUPPORT_TROOPS_WILL: 12,
        REINFORCEMENT_WILL: 6, FATE_WILL: 10, FREE_PLACEMENT: 8,
        METEOR_WILL: 8, BOARD_SHRINK_GOD: 9, BOARD_SHRINK_WILL: 7,
        SUPER_ATTRACTION_WILL: 10, SUPER_GRAVITY_WILL: 8, SUPER_BUOYANCY_WILL: 8,
        OBSERVER_WILL: 13, THEORY_INCARNATION: 14, BOARD_EXECUTOR: 9,
        HEAVEN_BLESSING: 8, TREASURE_BOX: 2, RIBO_WILL: 1, REBUILD_WILL: 4,
        CONDEMN_WILL: 5, REVEAL_HAND_WILL: 3, EXECUTION_WILL: 5
    };
    return tactical[card.type] ?? (3 + Math.min(18, Number(card.cost) || 0) * .2);
}

const LV13_MARKER_FEATURE_TYPES = Object.freeze(['DRAGON','ULTIMATE_DESTROY_GOD','BREEDING','WILL_HUNTER_KING','LIGHTNING','METEOR_GOD',
    'ROBOT_VACUUM','GLUTTONOUS','ULTIMATE_HYPERACTIVE','HYPERACTIVE','EXTREME_HYPERACTIVE',
    'ZOMBIE','GRASS','STONE_SALVATION_GOD','SHINRA_BANSHO_GOD','THEORY_INCARNATION']);
export const LV13_VALUE_FEATURE_NAMES = Object.freeze([
    'material','materialEnd','geometry','frontier','mobility','mobilityEnd','survival','lasting','hand','charge',
    'materialShare','mobilityShare','potentialMobility','inviolable','protected','tempo','tempoEnd','extraPlacements',
    'infinitePlacement','timeStopTurns',
    ...LV13_MARKER_FEATURE_TYPES.map(type=>'marker:'+type),
    // 持ち石ルール（01-rulebook.md §7.3）。ルール無効時は常に 0。
    'stonePlacementLead','stonePlacementLeadEnd'
]);
export const LV13_PRIOR_VALUE_WEIGHTS = Object.freeze([1.2,2.3,.65,-.3,2,-1,1,.65,.18,.7,
    ...Array(LV13_VALUE_FEATURE_NAMES.length-12).fill(0),
    // stonePlacementLead / stonePlacementLeadEnd: 1 回多く置ける ≒ 置いた石 + 反転ぶん。
    1,2] as number[]);

// Corner cells depend only on the board shape. Within a search the shape
// topology is memoized, so most positions share one entry.
const cornerCellsByTopology = new WeakMap<object, readonly { row: number; col: number }[]>();
function lv13CornerCells(view: any): readonly { row: number; col: number }[] {
    const cached = cornerCellsByTopology.get(view.topology);
    if (cached) return cached;
    const keys = Board.computeCornerKeySetForCoordinates(view.coordinates);
    const corners = Object.freeze(view.coordinates
        .filter((cell: any) => keys.has(`${cell.row},${cell.col}`))
        .map((cell: any) => ({ row: cell.row, col: cell.col }))
        .sort((a: any, b: any) => a.row - b.row || a.col - b.col));
    cornerCellsByTopology.set(view.topology, corners);
    return corners;
}

/** Feature extraction reads an isolated sampled world, never a live private
 * state. Training calls this same function on projected public observations. */
export function extractLv13ValueFeatures(state: Lv10Position, player: Lv10Player): number[] {
    const gs = state.gameState, cs = state.cardState, sign = player === 'black' ? 1 : -1;
    const opponent = player === 'black' ? 'white' : 'black';
    const counts = Core.countDiscs(gs, cs), material = sign * (counts.black - counts.white);
    // This evaluation never mutates its position. Read the complete board
    // (including holes and expansions) through one shared view; the search
    // marks its positions immutable so the view is built once per position.
    const view: any = Board.createBoardView(gs, { cardState: cs, strict: false });
    const cells: { row: number; col: number }[] = view.coordinates;
    const owners = new Map<string, number>(cells.map(cell => [`${cell.row},${cell.col}`, view.get(cell.row, cell.col) || 0]));
    const empty = cells.length - counts.black - counts.white;
    const moves = { black: lv10PlacementMoves(state, 'black'), white: lv10PlacementMoves(state, 'white') };
    // Card reversi can end with a mostly empty board. Dwindling legal lines
    // make present material more important than distant marker production.
    // This remains a heuristic; only Core's consecutive passes end a game.
    const closure = Math.max(0, 1 - (moves.black.length + moves.white.length) / 8);
    // 持ち石ルールでは、終盤度と見通しを空きマスではなく実際に置ける残り回数で測る。
    const stoneSupply = readSearchStoneSupply(cs, player);
    const remaining = resolveSearchRemainingPlacements(empty, stoneSupply);
    const end = Math.max(closure, 1 - remaining / Math.max(1, cells.length * .3));
    const horizon = Math.max(1, Math.min(8, remaining / 2 + 1, 1 + 7 * (1 - closure)));
    let geometry = 0, frontier = 0, lasting = 0, potentialMobility = 0, inviolable = 0, protectedCount = 0;
    const markerFeatures:Record<string,number>={};
    for (const corner of lv13CornerCells(view)) {
        const owner = owners.get(`${corner.row},${corner.col}`) || 0;
        geometry += sign * owner * 8;
        if (owner) {
            for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                for (let n = 1; n <= 32; n++) {
                    if (owners.get(`${corner.row + dr*n},${corner.col + dc*n}`) !== owner) break;
                    geometry += sign * owner * 1.1;
                }
            }
        } else for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (dr || dc) geometry -= sign * (owners.get(`${corner.row + dr},${corner.col + dc}`) || 0) * (dr && dc ? 4 : 2);
        }
    }
    for (const cell of cells) {
        const owner = owners.get(`${cell.row},${cell.col}`) || 0;
        if (owner && [[1,0],[-1,0],[0,1],[0,-1]].some(([dr,dc]) => owners.get(`${cell.row+dr},${cell.col+dc}`) === 0)) frontier += sign * owner;
        if(!owner){
            let black=false,white=false;
            for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
                if(!dr&&!dc)continue;
                const neighbor=owners.get(`${cell.row+dr},${cell.col+dc}`);
                if(neighbor===1)white=true;if(neighbor===-1)black=true;
            }
            potentialMobility+=sign*(Number(black)-Number(white));
        }
    }
    for (const marker of cs.markers || []) {
        const owner = marker.owner === player ? 1 : marker.owner === opponent ? -1 : 0;
        const type = Registry.normalizeSpecialStoneType(marker.data?.type);
        const occupant = owners.get(`${marker.row},${marker.col}`) || 0;
        if (Registry.HAZARD_STONE_STATUS_TYPES.has(type)) {
            lasting -= sign * occupant * 5 / (1 + Math.max(0, Number(marker.data?.remainingTurns) || 0) / 3);
        } else if (type === 'SEED') {
            if (!occupant) lasting += owner * 2.5 / (1 + Math.max(0, Number(marker.data?.remainingOwnerTurns) || 0) / 3);
        } else if (occupant && ['specialStone', 'manifestStone'].includes(marker.kind)) {
            const power=owner * lv13MarkerPotential(marker, horizon);
            lasting += power;
            markerFeatures[type]=(markerFeatures[type]||0)+power*(1-end*.55);
            const info=Registry.getSpecialStoneInfo(type)||{};
            if(info.inviolable)inviolable+=owner;
            if(info.flipProtected||info.ghost)protectedCount+=owner;
        }
    }
    const mobility = (side: Lv10Player) => moves[side].length;
    // 持ち石ルールでは各側の残り持ち石（自分, 相手）。無効時は null。
    const sideSupply = (side: Lv10Player) => stoneSupply
        ? (side === player ? [stoneSupply.own, stoneSupply.opp] : [stoneSupply.opp, stoneSupply.own])
        : null;
    const hand = (side: Lv10Player) => {
        const charge = Math.max(0, cs.charge?.[side] || 0);
        const supply = sideSupply(side);
        const values = (cs.hands?.[side] || []).map((id: string) => lv13CardPotential(id)
            * ((CARDS.get(id)?.cost || 0) <= charge ? 1 : .5)
            * (supply ? resolveStonePlacementCardValueFactor(CARDS.get(id)?.type, supply[0], supply[1], empty) : 1))
            .sort((a: number,b: number) => b-a);
        return values.reduce((sum: number, value: number, index: number) => sum + value * (index < 3 ? 1 : .25), 0);
    };
    const charge = (side: Lv10Player) => Math.sqrt(Math.max(0, Math.min(99, cs.charge?.[side] || 0)));
    // A good hand cannot reliably rescue a side with too few remaining stones
    // to form a legal line. Keep this a risk estimate, not a terminal shortcut:
    // free placement, delayed revival and later card draws remain searchable.
    // Count only flips offered by the shared legal-move generator. This is a
    // public tactical risk estimate; protected stones and irregular geometry
    // retain their normal rules, and only Core may declare a terminal result.
    const survival = (side: Lv10Player) => {
        const other = side === 'black' ? 'white' : 'black';
        const mostFlips = moves[other].reduce((most: number, move: any) => Math.max(most, move.flips?.length || 0), 0);
        return -24 / (Math.max(0, counts[side]) + .5)
            -24 / (Math.max(0, counts[side] - mostFlips) + .5);
    };
    // 持ち石切れの合法手 0 は機動力差ではなく、置ける回数の差（stonePlacementLead）として数える。
    const mobilityBlocked=isSearchStoneSupplyBlockingMobility(stoneSupply);
    const mobile=mobilityBlocked?0:mobility(player)-mobility(opponent);
    const placementLead=estimateStonePlacementLead(empty,stoneSupply);
    const turnOwner=gs.currentPlayer===1||gs.currentPlayer==='black'?'black':'white';
    // A nominal turn with no legal placement is not a tempo advantage. Cards
    // that restore placement remain valued and are settled by normal search.
    const tempo=sign*(turnOwner==='black'?1:-1)*Math.min(1,mobility(turnOwner)/3);
    const difference=(field:string,cap:number)=>(Math.min(cap,Math.max(0,Number(cs[field]?.[player])||0))
        -Math.min(cap,Math.max(0,Number(cs[field]?.[opponent])||0)));
    // 残り追加配置は持ち石の範囲でしか使えない（持ち石ルール無効時は従来どおり）。
    const extraPlacements=stoneSupply
        ? Math.min(4,stoneSupply.own,Math.max(0,Number(cs.extraPlaceRemainingByPlayer?.[player])||0))
            -Math.min(4,stoneSupply.opp,Math.max(0,Number(cs.extraPlaceRemainingByPlayer?.[opponent])||0))
        : difference('extraPlaceRemainingByPlayer',4);
    return [material,material*end,geometry,frontier*(1-end),mobile,mobile*end,
        survival(player)-survival(opponent),lasting*(1-end*.55),
        (hand(player)-hand(opponent))*(1-closure*.75),(charge(player)-charge(opponent))*(1-closure*.75),
        material*16/(counts.black+counts.white+4),mobile*8/(moves.black.length+moves.white.length+2),
        potentialMobility,inviolable,protectedCount,tempo,tempo*end,
        extraPlacements,difference('infinitePlaceActiveByPlayer',1),
        difference('timeStopConsecutiveTurnsRemainingByPlayer',4),
        ...LV13_MARKER_FEATURE_TYPES.map(type=>markerFeatures[type]||0),
        placementLead,placementLead*end];
}

export function evaluateLv13Position(state:Lv10Position,player:Lv10Player):number{
    if(Core.isGameOver(state.gameState)){
        const counts=Core.countDiscs(state.gameState,state.cardState);
        const material=(player==='black'?1:-1)*(counts.black-counts.white);
        return material===0?0:Math.sign(material)*100000+material;
    }
    const features=extractLv13ValueFeatures(state,player);
    return Math.max(-192,Math.min(192,features.reduce((sum,value,index)=>sum+value*LV13_VALUE_WEIGHTS[index],0)));
}
