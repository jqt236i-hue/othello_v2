const { createCpuDecisionCardLearned } = require('../game/cpu-decision-card-learned');

function createCardLearned(overrides = {}) {
  const board = overrides.board || Array.from({ length: 8 }, () => Array(8).fill(0));
  const runtime = overrides.runtime || {
    getActionScoreForKey: (key) => (key === 'use_card:b' ? 20 : 5)
  };
  const cardLogic = overrides.cardLogic || {
    getCardDef: (id) => ({ id, type: id === 'b' ? 'GUARD_WILL' : 'TREASURE_BOX' }),
    getCardCost: (id) => (id === 'b' ? 8 : 2)
  };
  const cpuPolicyCore = overrides.cpuPolicyCore || {
    scoreCardUseDecision: () => ({ score: 30, minUseScore: 10, shouldUse: true }),
    chooseCardWithRiskProfile: () => null
  };
  return createCpuDecisionCardLearned({
    resolvePolicyTableRuntime: () => runtime,
    getCurrentCpuBoard: () => board,
    canUseStandardBoardCpuPolicy: overrides.canUseStandardBoardCpuPolicy || (() => true),
    resolvePendingType: () => 'DOUBLE_PLACE',
    resolveCardLogic: () => cardLogic,
    getCpuPolicyCore: () => cpuPolicyCore,
    buildCardUseDecisionContext: () => overrides.context || ({
      forceUseCard: false,
      cornerEmergency: false,
      discDiff: 0,
      handSize: 3,
      ownCharge: 20,
      legalMovesCount: 4,
      hasCornerMoveNow: false
    }),
    isCardChoiceAllowedByHighConfidence: overrides.isCardChoiceAllowedByHighConfidence || (() => true),
    shouldUseSharedPolicyTableCoreCardDecision: () => true
  });
}

describe('cpu decision card learned module', () => {
  test('selectCardFromLearnedPolicy chooses the highest policy-table card score', () => {
    const learned = createCardLearned();

    expect(learned.selectCardFromLearnedPolicy('white', 6, 3, ['a', 'b'])).toEqual({
      cardId: 'b',
      cardDef: { id: 'b', type: 'GUARD_WILL' }
    });
  });

  test('getLearnedCardActionScore respects standard-board gating', () => {
    const learned = createCardLearned({
      canUseStandardBoardCpuPolicy: () => false
    });

    expect(learned.getLearnedCardActionScore('a', 'white', 6, 2)).toBeNull();
  });

  test('selectCardBySharedPolicyTableCore falls back to risk profile when learned choice is rejected', () => {
    const learned = createCardLearned({
      runtime: {
        getActionScoreForKey: () => 99
      },
      cpuPolicyCore: {
        scoreCardUseDecision: (cardId) => ({
          score: cardId === 'a' ? 20 : 1,
          minUseScore: 10,
          shouldUse: cardId === 'a'
        }),
        chooseCardWithRiskProfile: () => ({ cardId: 'a', cardDef: { id: 'a' } })
      }
    });

    expect(learned.selectCardBySharedPolicyTableCore('white', 6, 2, [], ['b', 'a'], null)).toEqual({
      cardId: 'a',
      cardDef: { id: 'a' }
    });
  });

  test('selectCardByLevel6Consensus returns null in stable state when high-confidence gate rejects', () => {
    const learned = createCardLearned({
      context: {
        forceUseCard: false,
        cornerEmergency: false,
        discDiff: 10,
        handSize: 2,
        ownCharge: 12,
        legalMovesCount: 5,
        hasCornerMoveNow: true
      },
      isCardChoiceAllowedByHighConfidence: () => false
    });

    expect(learned.selectCardByLevel6Consensus('white', 6, 5, [], ['a', 'b'], null)).toBeNull();
  });
});
