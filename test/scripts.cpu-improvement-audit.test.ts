const Engine = require('../scripts/cpu-counterfactual-engine');
const Cards = require('../game/logic/cards');
const Core = require('../game/logic/core');
const Prng = require('../game/schema/prng');

function fixture() {
    const rng = Prng.createPRNG(71101);
    const cs = Cards.initGame(rng).cardState;
    cs.hands.black = ['hard_01', 'guard_01'];
    cs.hands.white = ['lightning_01'];
    Cards.ensureCardCopyState(cs);
    return { gameState: Core.createGameState(), cardState: cs, prngState: rng.getState() };
}

describe('bounded CPU counterfactual diagnostics', () => {
    test('parallel partitions cover every position exactly once and retain global scenario IDs', () => {
        const { partitionPositions } = require('../scripts/run-cpu-improvement-audit');
        const records = Array.from({ length: 100 }, (_, index) => index);
        const groups = Array.from({ length: 4 }, (_, index) => partitionPositions(records, 4, index));
        expect(groups.map(group => group.length)).toEqual([25, 25, 25, 25]);
        expect(groups.flat().sort((a, b) => a[0] - b[0])).toEqual(records.map(index => [index, index]));
        expect(() => partitionPositions(records, 0, 0)).toThrow('Invalid shard limits');
    });
    test('deduplicates browser target coordinate aliases without losing target metadata', () => {
        expect(Engine.cleanAction({ type: 'place', row: 1, col: 2, turnIndex: 3,
            superGravityTarget: { row: 1, col: 2, directionKey: 'down' } })).toEqual({
            type: 'place', superGravityTarget: { row: 1, col: 2, directionKey: 'down' }
        });
    });
    test('changing concealed cards, deck order and RNG cannot change the view, scenarios or candidates', () => {
        const first = fixture(), second = Engine.clone(first);
        second.cardState.hands.white = ['support_troops_01'];
        second.cardState.decks.black.reverse();
        second.cardState.decks.white.reverse();
        second.prngState = { seed: 99, calls: 400 };
        second.cardState.prngState = second.prngState;
        second.cardState._defaultRandomSource = { _seed: 99, _calls: 400 };
        const a = Engine.publicView(first, 'black'), b = Engine.publicView(second, 'black');
        expect(Engine.canonical(a)).toBe(Engine.canonical(b));
        expect(Engine.canonical(Engine.materializeScenario(a, 81))).toBe(Engine.canonical(Engine.materializeScenario(b, 81)));
        expect(Engine.enumerateActions(a)).toEqual(Engine.enumerateActions(b));
    });

    test('restores visible hand costs onto synthetic card copies', () => {
        const original = fixture(), cs = original.cardState;
        Cards.setCardCostOverrideForCopyId(cs, cs._handCopyIdsByPlayer.black[0], 9, 'test');
        Cards.addCardCostModifierForCopyId(cs, cs._handCopyIdsByPlayer.black[0], -2, 'test');
        const sampled = Engine.materializeScenario(Engine.publicView(original, 'black'), 83);
        const own = sampled.cardState;
        expect(own.hands.black).toEqual(cs.hands.black);
        expect(Cards.getEffectiveCardCostForCopy(own, own.hands.black[0], own._handCopyIdsByPlayer.black[0])).toEqual(
            Cards.getEffectiveCardCostForCopy(cs, cs.hands.black[0], cs._handCopyIdsByPlayer.black[0]));
    });
    test('selects an affordable duplicate by hand slot and leaves successful default choices unchanged', () => {
        const initial = fixture(), cs = initial.cardState;
        cs.hands.black.push('hard_01');
        Cards.ensureCardCopyState(cs);
        Cards.setCardCostOverrideForCopyId(cs, cs._handCopyIdsByPlayer.black[0], 10, 'test');
        Cards.setCardCostOverrideForCopyId(cs, cs._handCopyIdsByPlayer.black[2], 1, 'test');
        cs.charge.black = 2;
        cs.lastTurnStartedFor = 'black';
        const action = Engine.resolveRolloutCardAction(cs, 'black', 'hard_01');
        expect(action.useCardHandIndex).toBe(2);
        const result = Engine.applyStep(initial, 'black', action, { steps: 0, maxSteps: 1, deadline: Date.now() + 1000 });
        expect(result.cardState.hands.black).toEqual(['hard_01', 'guard_01']);
        cs.charge.black = 100;
        expect(Engine.resolveRolloutCardAction(cs, 'black', 'hard_01')).toEqual({
            type: 'use_card', useCardId: 'hard_01', useCardOwnerKey: 'black'
        });
    });

    test('preserves effects and the source snapshot while evaluating a placement', () => {
        const initial = fixture();
        initial.cardState.lastTurnStartedFor = 'black';
        initial.cardState.pendingEffectByPlayer.black = { type: 'PROTECTED_NEXT_STONE', cardId: 'hard_01', stage: null };
        const before = Engine.canonical(initial);
        const result = Engine.applyStep(initial, 'black', { type: 'place', row: 2, col: 3 },
            { steps: 0, maxSteps: 1, deadline: Date.now() + 1000 });
        expect(result.cardState.markers.some((marker) => marker.row === 2 && marker.col === 3)).toBe(true);
        expect(result.cardState.presentationEvents).toEqual([]);
        expect(result.cardState._presentationEventsPersist).toEqual([]);
        expect(Engine.canonical(initial)).toBe(before);
    });

    test('budget exhaustion is explicit and unfinished rollouts have no win score', async () => {
        expect(() => Engine.useStep({ steps: 1, maxSteps: 1, deadline: Date.now() + 1000 })).toThrow('AUDIT_BUDGET_EXHAUSTED');
        const initial = fixture();
        initial.cardState.lastTurnStartedFor = 'black';
        const result = await Engine.rollout(initial, { type: 'place', row: 2, col: 3 }, 'black', 7,
            { steps: 0, maxSteps: 1, deadline: Date.now() + 1000 }, 0);
        expect(result).toEqual({ terminal: false, reason: 'action_limit' });
    });
});

export {};
