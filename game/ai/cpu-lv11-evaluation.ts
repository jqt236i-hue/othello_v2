import Core = require('../logic/core');
import Board = require('../../shared/shared-board-utils');
import Registry = require('../../shared/special-stone-registry-static');
import DeckSpec = require('../../shared/deck-spec');
import { lv10PlacementMoves, type Lv10Position, type Lv10Player } from './cpu-lv10-position';

const CARDS = DeckSpec.getEnabledCardDefMap();
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
export function aggregateLv11ScenarioValues(values: readonly number[]): number {
    if (!values.length) throw new Error('Scenario comparison needs a completed value');
    const bounded = values.map(value => Math.tanh(value / 64));
    return .85 * bounded.reduce((sum, value) => sum + value, 0) / bounded.length + .15 * Math.min(...bounded);
}

export function lv11MarkerPotential(marker: any, horizon = 8): number {
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

export function lv11CardPotential(id: string): number {
    const card = CARDS.get(id);
    if (!card) return 0;
    const marker = Registry.getMarkerTypeForSpecialStoneCard(card.type);
    if (marker) return 2 + lv11MarkerPotential({ data: { type: marker, remainingOwnerTurns: 5 } }) * .65;
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

export function evaluateLv11Position(state: Lv10Position, player: Lv10Player): number {
    const gs = state.gameState, cs = state.cardState, sign = player === 'black' ? 1 : -1;
    const opponent = player === 'black' ? 'white' : 'black';
    const counts = Core.countDiscs(gs, cs), material = sign * (counts.black - counts.white);
    if (Core.isGameOver(gs)) return material === 0 ? 0 : Math.sign(material) * 100000 + material;
    // This evaluation never mutates its position. Project the complete board
    // (including holes and expansions) once instead of rebuilding a checked
    // board view for every coordinate/owner/corner lookup below.
    const board = Board.prepareBoardForSearch(Board.createBoardContext(gs, cs));
    const cells = Board.collectBoardCoordinates(board).filter((cell: any) => Board.hasPlayableCell(board, cell.row, cell.col));
    const owners = new Map<string, number>(cells.map((cell: any) => [`${cell.row},${cell.col}`, Board.getCellValue(board, cell.row, cell.col) || 0]));
    const empty = cells.length - counts.black - counts.white;
    const moves = { black: lv10PlacementMoves(state, 'black'), white: lv10PlacementMoves(state, 'white') };
    // Card reversi can end with a mostly empty board. Dwindling legal lines
    // make present material more important than distant marker production.
    // This remains a heuristic; only Core's consecutive passes end a game.
    const closure = Math.max(0, 1 - (moves.black.length + moves.white.length) / 8);
    const end = Math.max(closure, 1 - empty / Math.max(1, cells.length * .3));
    const horizon = Math.max(1, Math.min(8, empty / 2 + 1, 1 + 7 * (1 - closure)));
    let geometry = 0, frontier = 0, lasting = 0;
    for (const corner of Board.getCornerCells(board)) {
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
            lasting += owner * lv11MarkerPotential(marker, horizon);
        }
    }
    const mobility = (side: Lv10Player) => moves[side].length;
    const hand = (side: Lv10Player) => {
        const charge = Math.max(0, cs.charge?.[side] || 0);
        const values = (cs.hands?.[side] || []).map((id: string) => lv11CardPotential(id)
            * ((CARDS.get(id)?.cost || 0) <= charge ? 1 : .5)).sort((a: number,b: number) => b-a);
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
    return material * (.35 + end * 3.15) + geometry - frontier * .45 * (1-end)
        + (mobility(player) - mobility(opponent)) * (2 - end)
        + survival(player) - survival(opponent)
        + lasting * .4 * (1 - end * .55) + (hand(player) - hand(opponent)) * .18 * (1 - closure * .75)
        + (charge(player) - charge(opponent)) * .7 * (1 - closure * .75);
}
