const { createSelfplayCardChoice } = require('../src/engine/selfplay-card-choice.js');

describe('selfplay card choice module', () => {
    test('selectCardIdToUse chooses highest final score with cost/id tie-break', () => {
        const committee = jest.fn((candidates) => {
            for (const one of candidates) {
                if (one.cardId === 'b') one.finalScore += 5;
            }
        });
        const choice = createSelfplayCardChoice({
            CardLogic: {
                getCardCost: (cardId) => ({ a: 3, b: 2, c: 2 }[cardId] || 0),
                getCardDef: (cardId) => ({ a: { type: 'A' }, b: { type: 'B' }, c: { type: 'C' } }[cardId] || null)
            },
            CpuPolicyCore: {
                scoreCardUseDecision: (cardId) => ({
                    shouldUse: true,
                    score: { a: 10, b: 10, c: 10 }[cardId],
                    minUseScore: 0
                })
            },
            getDirectUsableCardIds: () => ['a', 'b', 'c'],
            buildCardDecisionContext: () => ({ level: 6 }),
            resolveCardType: (cardId) => cardId.toUpperCase(),
            getPolicyActionScoreByKey: () => null,
            applyTeacherCommitteeToCardCandidates: committee
        });

        const result = choice.selectCardIdToUse({}, {}, 'black', {}, {
            legalMovesCount: 2,
            legalMoves: []
        });

        expect(result.cardId).toBe('b');
        expect(result.selectedActionKey).toBe('use:b');
        expect(result.candidates.find((one) => one.cardId === 'b').isSelected).toBe(true);
        expect(committee).toHaveBeenCalled();
    });

    test('selectCardIdToUse returns keep when all candidates are rejected', () => {
        const choice = createSelfplayCardChoice({
            CardLogic: {
                getCardCost: () => 1,
                getCardDef: () => ({ type: 'X' })
            },
            CpuPolicyCore: {
                scoreCardUseDecision: () => ({
                    shouldUse: false,
                    score: 5,
                    minUseScore: 9
                })
            },
            getDirectUsableCardIds: () => ['x1', 'x2'],
            buildCardDecisionContext: () => ({ level: 6 }),
            resolveCardType: () => 'X',
            getPolicyActionScoreByKey: () => null,
            applyTeacherCommitteeToCardCandidates: () => {}
        });

        const result = choice.selectCardIdToUse({}, {}, 'white', {}, {
            legalMovesCount: 0,
            legalMoves: []
        });

        expect(result.cardId).toBeNull();
        expect(result.selectedActionKey).toBe('keep');
        expect(result.candidates).toHaveLength(2);
    });

    test('selectDestroyHandCardId respects pending lock and delegated destroy choice', () => {
        const choice = createSelfplayCardChoice({
            CardLogic: {
                getCardCost: () => 1,
                getCardDef: () => ({ type: 'X' })
            },
            CpuPolicyCore: {
                chooseHandDestroyTargetForCycle: jest.fn(() => ({ cardId: 'h2' }))
            },
            getDirectUsableCardIds: () => ['u1'],
            buildCardDecisionContext: () => ({ level: 6 }),
            readSelfplayPendingEffect: (_cardState, playerKey) => playerKey === 'white' ? { type: 'PENDING' } : null
        });

        const black = choice.selectDestroyHandCardId({
            hands: { black: ['h1', 'h2'], white: [] }
        }, {}, 'black', { legalMoves: [], legalMovesCount: 0 });
        const white = choice.selectDestroyHandCardId({
            hands: { black: [], white: ['h3'] }
        }, {}, 'white', { legalMoves: [], legalMovesCount: 0 });

        expect(black).toBe('h2');
        expect(white).toBeNull();
    });
});
