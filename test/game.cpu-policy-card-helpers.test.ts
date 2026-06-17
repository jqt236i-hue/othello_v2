import { createCpuPolicyCardHelpers } from '../game/ai/cpu-policy-card-helpers';

describe('cpu-policy card helpers module', () => {
  test('chooseHighestCostCard picks the highest cost id and carries card definition', () => {
    const helpers = createCpuPolicyCardHelpers();

    expect(helpers.chooseHighestCostCard(['a', 'b', 'c'] as any, (cardId: string) => (
      cardId === 'b' ? 7 : (cardId === 'c' ? 4 : 2)
    ), (cardId: string) => ({ id: cardId, type: `${cardId}_TYPE` } as any))).toEqual({
      cardId: 'b',
      cardDef: { id: 'b', type: 'b_TYPE' }
    });
  });

  test('card type accessors use injected heuristics and fallback maps', () => {
    const helpers = createCpuPolicyCardHelpers({
      SharedCardHeuristics: {
        isRecoveryCardType: jest.fn((type: string) => type === 'RECOVERY_BY_HEURISTIC'),
        isHoldCardType: jest.fn(() => false),
        isChargeRampCardType: jest.fn((type: string) => type === 'RAMP_BY_HEURISTIC')
      },
      CORNER_RECOVERY_CARD_TYPES: new Set(['RECOVERY_BY_SET']),
      CORNER_HOLD_CARD_TYPES: new Set(['HOLD_BY_SET']),
      CHARGE_RAMP_CARD_TYPES: new Set(['RAMP_BY_SET']),
      CARD_TYPE_USAGE_STYLE: { STYLE_CARD: { leadBias: 2 } },
      CARD_TYPE_BASE_SCORE_BONUS: { BONUS_CARD: 12 },
      CARD_TYPE_MOVE_PLAN_PROFILE: { PLAN_CARD: { cornerBias: 3 } }
    });

    expect(helpers.isCornerRecoveryCardType('RECOVERY_BY_HEURISTIC')).toBe(true);
    expect(helpers.isCornerRecoveryCardType('RECOVERY_BY_SET')).toBe(true);
    expect(helpers.isCornerHoldCardType('HOLD_BY_SET')).toBe(true);
    expect(helpers.isChargeRampCardType('RAMP_BY_HEURISTIC')).toBe(true);
    expect(helpers.isChargeRampCardType('RAMP_BY_SET')).toBe(true);
    expect(helpers.hasUsageStyleForCardType('STYLE_CARD')).toBe(true);
    expect(helpers.hasBaseScoreBonusForCardType('BONUS_CARD')).toBe(true);
    expect(helpers.hasMovePlanProfileForCardType('PLAN_CARD')).toBe(true);
    expect(helpers.getMovePlanProfileForCardType('PLAN_CARD')).toEqual({ cornerBias: 3 });
    expect(helpers.getMovePlanProfileForCardType('MISSING')).toBeNull();
  });

  test('getForcedHandDestroyReason classifies immediate, low-charge, and unusable cards', () => {
    const helpers = createCpuPolicyCardHelpers({
      IMMEDIATE_DESTROY_CARD_TYPES: new Set(['NEVER_USE']),
      LOW_CHARGE_DESTROY_CARD_TYPES: new Set(['LOW_CHARGE']),
      LOW_CHARGE_DESTROY_MAX_CHARGE: 1,
      CONDITION_DEPENDENT_DESTROY_CARD_TYPES: new Set(['CONDITIONAL'])
    });

    expect(helpers.getForcedHandDestroyReason('a', 'NEVER_USE', {}, null)).toBe('bucket1_never_use');
    expect(helpers.getForcedHandDestroyReason('a', 'LOW_CHARGE', { ownCharge: 1 }, null)).toBe('bucket2_low_charge');
    expect(helpers.getForcedHandDestroyReason('a', 'CONDITIONAL', { ownCharge: 5 }, new Set(['b']))).toBe('bucket3_currently_unusable');
  });

  test('buildBlockedCardUseDecision and chooseForcedHandDestroyTarget preserve priority ordering', () => {
    const helpers = createCpuPolicyCardHelpers({
      IMMEDIATE_DESTROY_CARD_TYPES: new Set(['ALWAYS_DROP']),
      LOW_CHARGE_DESTROY_CARD_TYPES: new Set(['LOW_CHARGE']),
      LOW_CHARGE_DESTROY_MAX_CHARGE: 0,
      CONDITION_DEPENDENT_DESTROY_CARD_TYPES: new Set(['CONDITIONAL'])
    });

    expect(helpers.buildBlockedCardUseDecision(
      'card_a',
      { id: 'card_a', type: 'A' } as any,
      'A',
      3,
      { minUseScore: 9 },
      'blocked_for_test'
    )).toEqual(expect.objectContaining({
      cardId: 'card_a',
      cardType: 'A',
      cardCost: 3,
      score: -1000000,
      shouldUse: false,
      minUseScore: 9,
      reason: 'blocked_for_test'
    }));

    const out = helpers.chooseForcedHandDestroyTarget(
      ['c3', 'c1', 'c2'] as any,
      (cardId: string) => ({ c1: 2, c2: 7, c3: 5 } as Record<string, number>)[cardId] || 0,
      (cardId: string) => ({
        c1: { id: 'c1', type: 'LOW_CHARGE' },
        c2: { id: 'c2', type: 'CONDITIONAL' },
        c3: { id: 'c3', type: 'ALWAYS_DROP' }
      } as Record<string, any>)[cardId] || null,
      { ownCharge: 0 },
      new Set<string>()
    );

    expect(out).toEqual({
      cardId: 'c3',
      cardDef: { id: 'c3', type: 'ALWAYS_DROP' },
      cardType: 'ALWAYS_DROP',
      score: Number.NEGATIVE_INFINITY,
      reason: 'bucket1_never_use'
    });
  });
});
