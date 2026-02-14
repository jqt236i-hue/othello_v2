const core = require('../game/ai/cpu-policy-core');

describe('cpu-policy-core', () => {
    test('chooseHighestCostCard picks max-cost card', () => {
        const usable = ['a', 'b', 'c'];
        const costs = { a: 5, b: 12, c: 7 };
        const defs = { a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' } };
        const out = core.chooseHighestCostCard(
            usable,
            (id) => costs[id],
            (id) => defs[id]
        );
        expect(out).toEqual({ cardId: 'b', cardDef: defs.b });
    });

    test('chooseMove uses AI selector when available', () => {
        const moves = [{ row: 1, col: 1 }, { row: 2, col: 2 }];
        const selected = core.chooseMove(moves, 3, { random: () => 0.99 }, () => moves[0]);
        expect(selected).toEqual(moves[0]);
    });

    test('chooseMove falls back to deterministic rng', () => {
        const moves = [{ id: 0 }, { id: 1 }, { id: 2 }];
        const selected = core.chooseMove(moves, 1, { random: () => 0.5 }, null);
        expect(selected).toEqual(moves[1]);
    });

    test('chooseMove with heuristic enabled prefers corner', () => {
        const moves = [
            { row: 3, col: 3, flips: [{}, {}] },
            { row: 0, col: 0, flips: [] }
        ];
        const selected = core.chooseMove(moves, 4, { random: () => 0.99 }, null, {
            enableHeuristic: true
        });
        expect(selected).toEqual(moves[1]);
    });

    test('chooseMove uses scoreMove ordering when provided', () => {
        const moves = [{ id: 'a' }, { id: 'b' }];
        const selected = core.chooseMove(moves, 4, { random: () => 0.0 }, null, {
            scoreMove: (m) => (m.id === 'b' ? 100 : 0)
        });
        expect(selected).toEqual(moves[1]);
    });

    test('chooseCardWithRiskProfile avoids high-variance expensive card while ahead', () => {
        const defs = {
            high: { id: 'high', type: 'ULTIMATE_REVERSE_DRAGON' },
            safe: { id: 'safe', type: 'GUARD_WILL' }
        };
        const costs = { high: 30, safe: 2 };
        const selected = core.chooseCardWithRiskProfile(
            ['high', 'safe'],
            (id) => costs[id],
            (id) => defs[id],
            {
                level: 6,
                legalMovesCount: 1,
                discDiff: 14,
                empties: 10,
                ownCharge: 30
            }
        );
        expect(selected).toBeTruthy();
        expect(selected.cardId).toBe('safe');
    });

    test('scoreCardUseDecision forceUseCard allows risky card when no legal move exists', () => {
        const out = core.scoreCardUseDecision(
            'high',
            () => 30,
            () => ({ id: 'high', type: 'ULTIMATE_REVERSE_DRAGON' }),
            {
                level: 6,
                legalMovesCount: 0,
                forceUseCard: true,
                discDiff: 16,
                empties: 8,
                ownCharge: 30
            }
        );
        expect(out.shouldUse).toBe(true);
    });
});
