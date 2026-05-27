const { createSelfplayCardUsageDecision } = require('../src/engine/selfplay-card-usage-decision.js');

describe('selfplay card usage decision module', () => {
    test('destroy hand card branch wins before use-card when available', () => {
        const choose = createSelfplayCardUsageDecision({
            selectDestroyHandCardId: jest.fn(() => 'dead_card'),
            selectCardIdToUse: jest.fn(),
            CpuPolicyCore: {},
            CardLogic: {},
            buildCardDecisionContext: jest.fn()
        });

        const result = choose.decideCardUsageAction({
            activeGameState: {},
            activeCardState: { hasUsedCardThisTurnByPlayer: { black: false } },
            playerKey: 'black',
            options: { allowCardUsage: true, allowHandDestroy: true },
            pending: null,
            legalMoves: [{ row: 0, col: 0 }],
            mustTakePriorityPlacement: false,
            rng: { random: () => 0.5 }
        });

        expect(result).toEqual({
            action: { type: 'destroy_hand_card', destroyCardId: 'dead_card' },
            legalMoves: [{ row: 0, col: 0 }]
        });
    });

    test('use-card branch preserves force-use and reason tags', () => {
        const choose = createSelfplayCardUsageDecision({
            selectDestroyHandCardId: jest.fn(() => null),
            selectCardIdToUse: jest.fn(() => ({
                cardId: 'spell_01',
                candidates: [{ cardId: 'spell_01', score: 42, minUseScore: 20 }]
            })),
            CpuPolicyCore: {
                scoreCardUseDecision: jest.fn(() => ({ score: 42, minUseScore: 20 }))
            },
            CardLogic: {
                getCardCost: jest.fn(),
                getCardDef: jest.fn()
            },
            buildCardDecisionContext: jest.fn(() => ({ ctx: true }))
        });

        const result = choose.decideCardUsageAction({
            activeGameState: {},
            activeCardState: {
                hasUsedCardThisTurnByPlayer: { black: false },
                hands: { black: ['a', 'b', 'c', 'd'] }
            },
            playerKey: 'black',
            options: { allowCardUsage: true, cardUsageRate: 0 },
            pending: null,
            legalMoves: [],
            mustTakePriorityPlacement: false,
            rng: { random: () => 0.99 }
        });

        expect(result.action).toEqual({ type: 'use_card', useCardId: 'spell_01', useCardOwnerKey: 'black' });
        expect(result.cardDecision.reasonTags).toEqual(
            expect.arrayContaining(['decision:use', 'force_use_card', 'hand_pressure', 'threshold_passed'])
        );
    });

    test('risk veto suppresses use-card when not forced', () => {
        const choose = createSelfplayCardUsageDecision({
            selectDestroyHandCardId: jest.fn(() => null),
            selectCardIdToUse: jest.fn(() => ({ cardId: 'spell_01' })),
            CpuPolicyCore: {
                scoreCardUseDecision: jest.fn(() => ({ shouldUse: false }))
            },
            CardLogic: {
                getCardCost: jest.fn(),
                getCardDef: jest.fn()
            },
            buildCardDecisionContext: jest.fn(() => ({ ctx: true }))
        });

        const result = choose.decideCardUsageAction({
            activeGameState: {},
            activeCardState: {
                hasUsedCardThisTurnByPlayer: { black: false },
                hands: { black: ['a'] }
            },
            playerKey: 'black',
            options: { allowCardUsage: true, cardUsageRate: 1 },
            pending: null,
            legalMoves: [{ row: 1, col: 1 }],
            mustTakePriorityPlacement: false,
            rng: { random: () => 0 }
        });

        expect(result).toBeNull();
    });
});
