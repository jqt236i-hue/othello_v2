import { createProductionPosition, ProductionMatch, createProductionCpu, stepProductionCpu, productionStateKey } from '../src/engine/production-match';
import { searchLv10 } from '../game/ai/cpu-lv10-search';
import { observeLv10Position } from '../game/ai/cpu-lv10-observation';
import { cloneLv10, enumerateLv10Actions } from '../game/ai/cpu-lv10-position';
import Startup = require('../shared/cpu-opponent-startup-options');

const profiles = { black: 10, white: 10 };
const recipes = { black: Startup.getCpuOpponentDeckCardIds(10)!, white: Startup.getCpuOpponentDeckCardIds(10)! };
const initial = () => createProductionPosition(914001, profiles);

test('production initialization preserves identical black/white privileges and deterministic deals', () => {
    const state = initial();
    expect(state).toEqual(initial());
    expect(state.cardState.charge).toEqual({ black: 99, white: 99 });
    expect(state.cardState.chargeGainMultiplierByPlayer).toEqual({ black: 2, white: 2 });
    expect(state.cardState.decks.black.slice().sort()).toEqual(recipes.black.slice().sort());
    expect(state.cardState.decks.white.slice().sort()).toEqual(recipes.white.slice().sort());
    const match = new ProductionMatch(state);
    match.startTurn();
    expect(match.snapshot().cardState.hands.black).toHaveLength(1);
    expect(state.cardState.hands.black).toHaveLength(0);
    const after = match.snapshot();
    expect(after.cardState.prngState).toEqual(after.prngState);
    match.startTurn();
    expect(productionStateKey(match.snapshot())).toBe(productionStateKey(after));
});

test('stone supply rule is opt-in and leaves the deal unchanged', () => {
    const off = initial();
    const on = createProductionPosition(914001, profiles, undefined, { stoneSupplyEnabled: true });
    expect(off.cardState.stoneSupply).toBeUndefined();
    expect(on.cardState.stoneSupply).toEqual({ initial: 30, remainingByPlayer: { black: 30, white: 30 } });
    const { stoneSupply: _supply, ...onWithoutSupply } = on.cardState as any;
    expect(onWithoutSupply).toEqual(off.cardState);
    expect(on.gameState).toEqual(off.gameState);
    expect(on.prngState).toEqual(off.prngState);
});

test('the same public request and fixed calculation budget use the normal turn judgment', async () => {
    const match = new ProductionMatch(initial()); match.startTurn();
    const before = match.snapshot();
    const observation = observeLv10Position(before, 'black');
    const expected = searchLv10(observation, { maxTransitions: 64, publicRecipes: recipes });
    const cpu = createProductionCpu(async request => {
        expect(request.observation).toEqual(observation);
        expect(request.observation.cardState.decks).toBeUndefined();
        expect(request.observation.cardState.prngState).toBeUndefined();
        return searchLv10(request.observation, { maxTransitions: 64, publicRecipes: request.publicRecipes, excludedActions: request.excludedActions });
    });
    const actual = await stepProductionCpu(match, cpu, recipes);
    expect(actual.outcome).toBe('applied');
    expect(actual.action).toEqual(expected.action);
    const replay = new ProductionMatch(before); replay.apply(expected.action!);
    expect(productionStateKey(match.snapshot())).toBe(productionStateKey(replay.snapshot()));
});

test('illegal actions stay recorded and do not silently become placements', () => {
    const records: any[] = [], match = new ProductionMatch(initial(), r => records.push(r));
    match.startTurn();
    const before = match.snapshot();
    const result = match.apply({ type: 'place', row: 3, col: 3 });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('ILLEGAL_MOVE');
    expect(productionStateKey(match.snapshot())).toBe(productionStateKey(before));
    expect(records.at(-1).action).toEqual({ type: 'place', row: 3, col: 3 });
});

test('card use and multi-stage selection replay through the production pipeline', () => {
    const state = initial(); state.gameState.turnNumber = 6;
    state.cardState.hands.black = ['destroy_01'];
    const match = new ProductionMatch(state); match.startTurn();
    const before = match.snapshot();
    const use = enumerateLv10Actions(before).find(a => a.useCardId === 'destroy_01')!;
    expect(use).toBeDefined(); expect(match.apply(use).ok).toBe(true);
    const target = enumerateLv10Actions(match.snapshot()).find(a => a.destroyTarget?.row === 3 && a.destroyTarget?.col === 3)!;
    expect(target).toBeDefined(); expect(match.apply(target).ok).toBe(true);
    expect(match.snapshot().gameState.board[3][3]).toBe(0);
    expect(match.owner).toBe('black');
    const replay = new ProductionMatch(cloneLv10(before)); replay.apply(use); replay.apply(target);
    expect(productionStateKey(replay.snapshot())).toBe(productionStateKey(match.snapshot()));
});

test('a full board is not an early result; two canonical passes are required', () => {
    const state = initial();
    state.gameState.board = Array.from({length: 8}, () => Array(8).fill(1));
    state.cardState.hands = { black: [], white: [] };
    const match = new ProductionMatch(state);
    expect(match.terminal).toBe(false); expect(() => match.result()).toThrow();
    expect(match.apply({type: 'pass'}).ok).toBe(true); expect(match.terminal).toBe(false);
    match.startTurn(); expect(match.apply({type: 'pass'}).ok).toBe(true);
    expect(match.result()).toMatchObject({ black: 64, white: 0, winner: 'black', endedBy: 'consecutive_passes' });
});
