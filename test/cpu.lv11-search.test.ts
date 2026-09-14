import { createProductionPosition } from '../src/engine/production-match';
import { observeLv10Position } from '../game/ai/cpu-lv10-observation';
import { applyLv10Action, sampleLv10Position, lv10ActionKey, startLv10Turn, currentLv10Player, lv10PlacementMoves, type Lv10Action } from '../game/ai/cpu-lv10-position';
import Core = require('../game/logic/core');
import { searchLv11, LV11_SEARCH_CONFIG, compareLv11Scenarios } from '../game/ai/cpu-lv11-search';
import { lv11MarkerPotential, evaluateLv11Position, aggregateLv11ScenarioValues } from '../game/ai/cpu-lv11-evaluation';
import { LV10_SEARCH_CONFIG } from '../game/ai/cpu-lv10-search';
import { createProductionCardFixture } from '../scripts/production-card-fixtures';
import { ProductionMatch } from '../src/engine/production-match';

test('Lv11 judges public inputs deterministically within a bounded calculation budget', () => {
    const actual = createProductionPosition(914081, { black: 10, white: 10 });
    actual.gameState.turnNumber = 8; actual.cardState.hands.black = ['udr_01', 'perma_01'];
    const observation = observeLv10Position(actual, 'black'), before = JSON.stringify(observation);
    const first = searchLv11(observation, { maxTransitions: 96 });
    expect(searchLv11(observation, { maxTransitions: 96 })).toEqual(first);
    expect(first.transitions).toBeLessThanOrEqual(96);
    expect(first.action).not.toBeNull();
    expect(first.version).toBe(LV11_SEARCH_CONFIG.version);
    expect(applyLv10Action(sampleLv10Position(observation, 100901), first.action!).ok).toBe(true);
    expect(JSON.stringify(observation)).toBe(before);
    const next = searchLv11(observation, { maxTransitions: 96, excludedActions: [first.action!] });
    expect(lv10ActionKey(next.action!)).not.toBe(lv10ActionKey(first.action!));
    expect(LV10_SEARCH_CONFIG).toMatchObject({ version: 'lv10-canonical-beam-dev7', maxTransitions: 1024, maxMs: 1500 });
});

test('Lv11 accounts for remaining recurring effects and only scores canonical terminal wins as solved', () => {
    expect(lv11MarkerPotential({ data: { type: 'DRAGON', remainingOwnerTurns: 6 } }))
        .toBeGreaterThan(lv11MarkerPotential({ data: { type: 'DRAGON', remainingOwnerTurns: 1 } }));
    const state = createProductionPosition(914082, { black: 10, white: 10 });
    state.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(1));
    expect(Math.abs(evaluateLv11Position(state, 'black'))).toBeLessThan(100000);
    state.gameState.consecutivePasses = 2;
    expect(evaluateLv11Position(state, 'black')).toBeGreaterThanOrEqual(100000);
    expect(evaluateLv11Position(state, 'white')).toBeLessThanOrEqual(-100000);
});

test('Lv11 injected production clock stops search without changing the live position', () => {
    const state = createProductionPosition(914083, { black: 10, white: 10 });
    const obs = observeLv10Position(state, 'black'); let ticks = 0;
    const result = searchLv11(obs, { now: () => ticks++ * 10, maxMs: 100 });
    expect(result.transitions).toBeLessThan(96);
    expect(['time_budget', 'no_completed_plan']).toContain(result.stopped);
});

test('sparse public loss position is materially losing before canonical termination', () => {
    // dev4 16-white decision 41: 8 black / 5 white, 42 empty cells,
    // one black legal placement and no white placement. Future card value
    // previously concealed most of this material deficit (about -1 to -2).
    const fixture = require('./fixtures/cpu-lv11-sparse-endgame.json');
    for (const seed of LV11_SEARCH_CONFIG.scenarioSeeds) {
        const state = sampleLv10Position(fixture.observation, seed, fixture.publicRecipes);
        const before = JSON.stringify(state);
        expect(Core.countDiscs(state.gameState, state.cardState)).toEqual({ black: 8, white: 5 });
        expect(lv10PlacementMoves(state, 'black')).toHaveLength(1);
        expect(lv10PlacementMoves(state, 'white')).toHaveLength(0);
        expect(Core.isGameOver(state.gameState)).toBe(false);
        const value = evaluateLv11Position(state, 'white');
        expect(value).toBeLessThan(-6);
        expect(value).toBeGreaterThan(-100000);
        expect(JSON.stringify(state)).toBe(before);
    }
});

test('a single hypothetical terminal win does not outweigh a consistently favorable unresolved position', () => {
    expect(aggregateLv11ScenarioValues([50, 40])).toBeGreaterThan(aggregateLv11ScenarioValues([100010, -80]));
    expect(aggregateLv11ScenarioValues([100010, 100002])).toBeGreaterThan(aggregateLv11ScenarioValues([50, 40]));
    expect(aggregateLv11ScenarioValues([0, 0])).toBe(0);
});

test('interrupted scenario searches compare matching worlds instead of compressed result positions', () => {
    // The first candidate wins only in world zero, which the second did not
    // finish. Its large first result must not defeat the second in world one.
    const comparison = compareLv11Scenarios([[100010, -40], [null, 30], [null, null]]);
    expect(comparison.eligible).toEqual([0, 1]);
    expect(comparison.scenarios).toEqual([1]);
    expect(comparison.scores[1]!).toBeGreaterThan(comparison.scores[0]!);
    expect(comparison.scores[2]).toBeNull();
    expect(compareLv11Scenarios([[null, null]]).eligible).toEqual([]);
});

test('public late-loss position avoids a card that consumes almost all remaining stones', () => {
    const fixture = require('./fixtures/cpu-lv11-capture-risk.json');
    const before = JSON.stringify(fixture.observation);
    const minimumRemaining = (actions: Lv10Action[]) => {
        let state = sampleLv10Position(fixture.observation, 100901, fixture.publicRecipes);
        for (const action of actions) {
            const applied = applyLv10Action(state, action);
            expect(applied.ok).toBe(true);
            if (!applied.ok) throw new Error(applied.reason);
            expect(applied.selectionFailed).not.toBe(true);
            state = applied.state;
        }
        if (!Core.isGameOver(state.gameState) && currentLv10Player(state) !== 'white') state = startLv10Turn(state);
        const maximumFlips = Math.max(0, ...lv10PlacementMoves(state, 'black').map(move => move.flips.length));
        return Core.countDiscs(state.gameState, state.cardState).white - maximumFlips;
    };
    expect(minimumRemaining([fixture.previousAction])).toBe(2);
    const decision = searchLv11(fixture.observation, { publicRecipes: fixture.publicRecipes, excludedActions: fixture.excludedActions });
    expect(decision.action).not.toBeNull();
    expect(minimumRemaining([decision.action!, ...decision.continuation])).toBeGreaterThanOrEqual(13);
    expect(decision.transitions).toBeLessThanOrEqual(LV11_SEARCH_CONFIG.maxTransitions);
    expect(JSON.stringify(fixture.observation)).toBe(before);
}, 60000);

test('multi-stage shrinking considers the winning enemy line beyond the first sixteen board cells', () => {
    const state = createProductionCardFixture('board_shrink_01', 'black');
    state.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
    for (const [row, col] of [[0, 6], [0, 7]]) state.gameState.board[row][col] = 1;
    for (const col of [5, 6, 7]) state.gameState.board[7][col] = -1;
    state.cardState.markers = [];
    state.cardState.stoneIdMap = state.gameState.board.map((row: number[], r: number) => row.map((value, c) => value ? 1+r*8+c : 0));
    state.cardState.decks = { black: [], white: [] }; state.cardState.deck = [];
    state.cardState.hands.white = [];
    const match = new ProductionMatch(state);
    expect(match.apply({ type: 'use_card', useCardId: 'board_shrink_01', useCardHandIndex: 0, useCardOwnerKey: 'black' }).ok).toBe(true);
    const decision = searchLv11(observeLv10Position(match.snapshot(), 'black'));
    expect(decision.action?.shrinkTarget?.row).toBe(7);
    for (const action of [decision.action!, ...decision.continuation]) expect(match.apply(action).ok).toBe(true);
    for (let turn = 0; turn < 4 && !match.terminal; turn++) {
        if (match.snapshot().cardState.lastTurnStartedFor !== match.owner) match.startTurn();
        if (!match.terminal) expect(match.apply({ type: 'pass' }).ok).toBe(true);
    }
    expect(match.result()?.winner).toBe('black');
}, 30000);
