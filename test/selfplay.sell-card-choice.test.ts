const { createSelfplaySellCardChoice } = require('../src/engine/selfplay-sell-card-choice.js');

describe('selfplay sell card choice module', () => {
    test('uses retention chooser when available', () => {
        const chooseSellCardTargetByRetention = jest.fn(() => ({ cardId: 'b' }));
        const getLegalMovesForAction = jest.fn(() => ([{ row: 0, col: 0 }]));
        const buildCardDecisionContext = jest.fn(() => ({ plan: 'ctx' }));
        const chooser = createSelfplaySellCardChoice({
            CpuPolicyCore: { chooseSellCardTargetByRetention },
            CardLogic: {
                getCardCost: jest.fn((cardId) => ({ a: 1, b: 2 }[cardId] || 0)),
                getCardDef: jest.fn((cardId) => ({ id: cardId }))
            },
            getLegalMovesForAction,
            buildCardDecisionContext
        });

        const result = chooser.chooseSellCardTarget({}, { hands: { black: ['a', 'b'] } }, 'black');

        expect(result).toBe('b');
        expect(getLegalMovesForAction).toHaveBeenCalled();
        expect(buildCardDecisionContext).toHaveBeenCalledWith({}, { hands: { black: ['a', 'b'] } }, 'black', 1, [{ row: 0, col: 0 }]);
        expect(chooseSellCardTargetByRetention).toHaveBeenCalled();
    });

    test('falls back to highest cost when retention chooser is absent or empty', () => {
        const chooser = createSelfplaySellCardChoice({
            CpuPolicyCore: { chooseSellCardTargetByRetention: jest.fn(() => null) },
            CardLogic: {
                getCardCost: jest.fn((cardId) => ({ a: 1, b: 5, c: 3 }[cardId] || 0)),
                getCardDef: jest.fn()
            },
            getLegalMovesForAction: () => [],
            buildCardDecisionContext: () => null
        });

        expect(chooser.chooseSellCardTarget({}, { hands: { black: ['a', 'b', 'c'] } }, 'black')).toBe('b');
        expect(chooser.chooseSellCardTarget({}, { hands: { black: [] } }, 'black')).toBeNull();
    });
});
