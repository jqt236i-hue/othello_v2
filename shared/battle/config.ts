import Board = require('../shared-board-utils');
import Profiles = require('../cpu-opponent-profiles');
import Startup = require('../cpu-opponent-startup-options');
import Deck = require('../deck-spec');
import { cloneBattle, type BattlePlayer } from './types';
const Codec: any = require('../deck-codec');

export interface BattleSeatConfig {
    controller: 'human' | 'cpu';
    profile?: string | number;
    deckCardIds?: readonly string[];
    initialCharge?: number;
    chargeGainMultiplier?: number;
}
export interface BattleConfig {
    version: 1;
    battleId: string;
    seed: number;
    board?: { rows: number; cols: number; shape?: 'rectangle' | 'circle' };
    players?: Partial<Record<BattlePlayer, BattleSeatConfig>>;
    /** Ordinary stones only. Holes/topology continue to belong to board configuration. */
    initialLayout?: { stones: Array<{ row: number; col: number; owner: 1 | -1 }>; currentPlayer?: 1 | -1 };
}
export interface ResolvedBattleConfig extends BattleConfig {
    board: { rows: number; cols: number; shape: 'rectangle' | 'circle' };
    players: Record<BattlePlayer, BattleSeatConfig & { profile: string }>;
}

function assertKeys(value: any, allowed: string[], name: string): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`Invalid ${name}`);
}
function boundedInteger(value: any, min: number, max: number, name: string): void {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
}
export function resolveBattleConfig(input: BattleConfig): ResolvedBattleConfig {
    assertKeys(input, ['version', 'battleId', 'seed', 'board', 'players', 'initialLayout'], 'battle config');
    if (input.version !== 1) throw new Error('Unsupported battle config version');
    if (typeof input.battleId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(input.battleId)) {
        throw new Error('Invalid battleId');
    }
    boundedInteger(input.seed, 0, 0xffffffff, 'seed');
    const rawBoard = input.board === undefined ? { rows: 8, cols: 8, shape: 'rectangle' } : input.board;
    assertKeys(rawBoard, ['rows', 'cols', 'shape'], 'board');
    if (rawBoard.shape !== undefined && !['rectangle', 'circle'].includes(rawBoard.shape)) throw new Error('Invalid board shape');
    const normalized = Board.resolveBoardConfig(rawBoard);
    if (normalized.rows !== rawBoard.rows || normalized.cols !== rawBoard.cols) throw new Error('Unsupported board dimensions');
    const board = { rows: normalized.rows, cols: normalized.cols, shape: normalized.shape };
    const enabled = new Set(Deck.getEnabledCardIds());
    const profileIds = new Set(Profiles.getCpuOpponentProfiles().map((profile: any) => profile.id));
    if (input.players !== undefined) assertKeys(input.players, ['black', 'white'], 'players');
    const players = {} as ResolvedBattleConfig['players'];
    for (const player of ['black', 'white'] as const) {
        const seat: BattleSeatConfig = input.players?.[player] === undefined ? { controller: player === 'black' ? 'human' : 'cpu', profile: '1' } : input.players![player]!;
        assertKeys(seat, ['controller', 'profile', 'deckCardIds', 'initialCharge', 'chargeGainMultiplier'], `${player} player`);
        if (!['human', 'cpu'].includes(seat.controller)) throw new Error('Invalid controller');
        const rawProfile = String(seat.profile ?? '1');
        const numericProfile = /^\d+$/.test(rawProfile) && Profiles.getCpuOpponentProfiles().some((item: any) => item.level === Number(rawProfile));
        if (!profileIds.has(rawProfile) && !numericProfile) throw new Error(`Unknown CPU profile: ${rawProfile}`);
        const profile = Profiles.getCpuOpponentProfileId(rawProfile);
        if (seat.deckCardIds !== undefined && (!Array.isArray(seat.deckCardIds) || seat.deckCardIds.length > 512
            || seat.deckCardIds.some(id => typeof id !== 'string' || !enabled.has(id)))) throw new Error('Invalid deckCardIds');
        if (seat.initialCharge !== undefined) boundedInteger(seat.initialCharge, 0, 99, 'initialCharge');
        if (seat.chargeGainMultiplier !== undefined) boundedInteger(seat.chargeGainMultiplier, 1, 100, 'chargeGainMultiplier');
        players[player] = { ...cloneBattle(seat), profile };
    }
    const resolved: ResolvedBattleConfig = { version: 1, battleId: input.battleId, seed: input.seed, board, players };
    if (input.initialLayout !== undefined) {
        assertKeys(input.initialLayout, ['stones', 'currentPlayer'], 'initialLayout');
        const layout = input.initialLayout;
        if (layout.currentPlayer !== undefined && layout.currentPlayer !== 1 && layout.currentPlayer !== -1) throw new Error('Invalid starting player');
        if (!Array.isArray(layout.stones) || layout.stones.length > board.rows * board.cols) throw new Error('Invalid starting stones');
        const seen = new Set<string>();
        for (const stone of layout.stones) {
            assertKeys(stone, ['row', 'col', 'owner'], 'starting stone');
            boundedInteger(stone.row, 0, board.rows - 1, 'stone row');
            boundedInteger(stone.col, 0, board.cols - 1, 'stone col');
            if (stone.owner !== 1 && stone.owner !== -1) throw new Error('Invalid stone owner');
            const key = `${stone.row},${stone.col}`;
            if (seen.has(key) || !Board.isMainBoardCell(stone.row, stone.col, normalized)) throw new Error('Invalid starting cell');
            seen.add(key);
        }
        resolved.initialLayout = cloneBattle(layout);
    }
    return resolved;
}

/** Explicit settings override profile defaults; omitted settings retain the canonical factory defaults. */
export function battleCardOptions(config: ResolvedBattleConfig): any {
    const options: any = { boardConfig: config.board, initialDeckCardIdsByPlayer: {}, initialChargeByPlayer: {}, chargeGainMultiplierByPlayer: {} };
    for (const player of ['black', 'white'] as const) {
        const seat = config.players[player];
        const startup = Startup.getCpuOpponentStartupOptions(seat.profile, player);
        const recipe = startup.deckCardIds ?? (startup.deckCode ? Deck.expandDeckSpec(Codec.decodeDeckCode(startup.deckCode), { requireFullDeck: false }) : null);
        const cards = seat.deckCardIds ?? recipe;
        if (cards !== null && cards !== undefined) options.initialDeckCardIdsByPlayer[player] = [...cards];
        const charge = seat.initialCharge ?? startup.initialCharge;
        if (charge !== null) options.initialChargeByPlayer[player] = charge;
        const multiplier = seat.chargeGainMultiplier ?? startup.chargeGainMultiplier;
        if (multiplier !== null) options.chargeGainMultiplierByPlayer[player] = multiplier;
    }
    return options;
}
