import { createCpuPolicyHandDestroyScore } from '../game/ai/cpu-policy-hand-destroy-score';

describe('cpu-policy hand-destroy score module', () => {
  test('prefers rotating TIME_BOMB first when recovery role is missing', () => {
    const helpers = createCpuPolicyHandDestroyScore({
      getCpuPolicyCardTypeFlags: (cardType) => ({
        isRecoveryCard: false,
        isHoldCard: false,
        isChargeRampCard: false,
        isTimeBomb: cardType === 'TIME_BOMB',
        isTimeStopGod: false,
        isLastResort: false,
        isSuperCrushWill: false,
        isGeneratedKeepPlace: false,
        isFastRotate: false,
        isWhiteCornerSwingKeepCard: false,
        isHighVarianceCard: cardType === 'TIME_BOMB'
      }),
      whiteLv6DestroyWhenAheadTypes: new Set(['DOUBLE_CHAIN_WILL'])
    });

    const out = helpers.chooseCpuPolicyHandDestroyCandidate({
      hand: ['bomb', 'guard'],
      loopState: {
        cornerEmergency: true,
        hasCornerMoveNow: false,
        hasEdgeMoveNow: false,
        cornerHoldMode: false,
        whiteLv6Mode: false,
        needRecoveryCard: true,
        needHoldCard: false,
        needChargeRampCard: false,
        shouldCycleForNeededCards: true,
        lv6FastCycleMode: false,
        handPressure: 2,
        usableSet: new Set<string>()
      },
      normalizedContext: {
        discDiff: 2,
        legalMovesCount: 4,
        handSize: 4,
        forceUseCard: false
      },
      scoreCardRetentionPriority: (cardId) => (
        cardId === 'bomb'
          ? { cardId, cardDef: null, cardType: 'TIME_BOMB', cardCost: 13, score: 10 }
          : { cardId, cardDef: null, cardType: 'GUARD_WILL', cardCost: 2, score: 40 }
      )
    });

    expect(out).toBeTruthy();
    expect(out?.cardId).toBe('bomb');
  });

  test('keeps generated TRIPLE_PLACE while ahead in white Lv6 and rotates other candidate', () => {
    const helpers = createCpuPolicyHandDestroyScore({
      getCpuPolicyCardTypeFlags: (cardType) => ({
        isRecoveryCard: false,
        isHoldCard: false,
        isChargeRampCard: false,
        isTimeBomb: false,
        isTimeStopGod: false,
        isLastResort: false,
        isSuperCrushWill: false,
        isGeneratedKeepPlace: cardType === 'TRIPLE_PLACE',
        isFastRotate: false,
        isWhiteCornerSwingKeepCard: false,
        isHighVarianceCard: false
      }),
      whiteLv6DestroyWhenAheadTypes: new Set(['TRIPLE_PLACE', 'HEAVEN_BLESSING'])
    });

    const out = helpers.chooseCpuPolicyHandDestroyCandidate({
      hand: ['triple', 'heaven'],
      loopState: {
        cornerEmergency: false,
        hasCornerMoveNow: false,
        hasEdgeMoveNow: false,
        cornerHoldMode: false,
        whiteLv6Mode: true,
        needRecoveryCard: false,
        needHoldCard: false,
        needChargeRampCard: false,
        shouldCycleForNeededCards: false,
        lv6FastCycleMode: false,
        handPressure: 2,
        usableSet: new Set<string>()
      },
      normalizedContext: {
        discDiff: 8,
        legalMovesCount: 4,
        handSize: 4,
        forceUseCard: false
      },
      scoreCardRetentionPriority: (cardId) => (
        cardId === 'triple'
          ? { cardId, cardDef: null, cardType: 'TRIPLE_PLACE', cardCost: 24, score: 20 }
          : { cardId, cardDef: null, cardType: 'HEAVEN_BLESSING', cardCost: 24, score: 20 }
      )
    });

    expect(out).toBeTruthy();
    expect(out?.cardId).toBe('heaven');
  });
});
