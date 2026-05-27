import { createCpuPolicyHandDestroyCycle } from '../game/ai/cpu-policy-hand-destroy-cycle';

describe('cpu-policy hand-destroy cycle module', () => {
  test('detects missing recovery role and fast cycle pressure when no usable cards remain', () => {
    const helpers = createCpuPolicyHandDestroyCycle({
      isCornerRecoveryCardType: (type) => type === 'RECOVERY',
      isCornerHoldCardType: (type) => type === 'HOLD',
      isChargeRampCardType: (type) => type === 'RAMP'
    });
    const defs = new Map([
      ['bomb', { type: 'TIME_BOMB' }],
      ['chain', { type: 'DOUBLE_CHAIN_WILL' }],
      ['glutton', { type: 'GLUTTONOUS_WILL' }]
    ]);

    const out = helpers.buildCpuPolicyHandDestroyCycleState({
      handCardIds: ['bomb', 'chain', 'glutton'],
      usableCardIds: [],
      getCardCost: () => 0,
      getCardDef: (id) => defs.get(id as string) as any,
      context: {
        ownCorners: 0,
        oppCorners: 2,
        hasCornerMoveNow: false,
        hasEdgeMoveNow: false,
        recoveryCostGap: 5
      } as any,
      normalizedContext: {
        level: 6,
        playerValue: -1,
        legalMovesCount: 2,
        discDiff: -6,
        handSize: 3,
        forceUseCard: false
      },
      scoreCardUseDecision: () => ({ cardId: 'x', cardDef: null, score: 0, shouldUse: false, minUseScore: 0 })
    });

    expect(out.hand).toEqual(['bomb', 'chain', 'glutton']);
    expect(out.usable).toEqual([]);
    expect(out.cornerEmergency).toBe(true);
    expect(out.needRecoveryCard).toBe(true);
    expect(out.needHoldCard).toBe(false);
    expect(out.needChargeRampCard).toBe(true);
    expect(out.shouldCycleForNeededCards).toBe(true);
    expect(out.lv6FastCycleMode).toBe(true);
    expect(out.handPressure).toBe(1);
    expect(out.strongUseReady).toBe(false);
    expect(out.whiteLv6Mode).toBe(true);
  });

  test('marks strong use ready only when best usable card clears min score margin', () => {
    const helpers = createCpuPolicyHandDestroyCycle();
    const defs = new Map([
      ['safe', { type: 'SAFE' }],
      ['weak', { type: 'WEAK' }]
    ]);

    const out = helpers.buildCpuPolicyHandDestroyCycleState({
      handCardIds: ['safe', 'weak'],
      usableCardIds: ['safe', 'weak'],
      getCardCost: () => 0,
      getCardDef: (id) => defs.get(id as string) as any,
      normalizedContext: {
        level: 5,
        playerValue: 1,
        legalMovesCount: 3,
        discDiff: 2,
        handSize: 2,
        forceUseCard: false
      },
      scoreCardUseDecision: (cardId) => (
        cardId === 'safe'
          ? { cardId, cardDef: null, score: 40, shouldUse: true, minUseScore: 20 }
          : { cardId, cardDef: null, score: 30, shouldUse: true, minUseScore: 20 }
      )
    });

    expect(out.usableSet.has('safe')).toBe(true);
    expect(out.strongUseReady).toBe(true);
    expect(out.handPressure).toBe(0);
    expect(out.lv6FastCycleMode).toBe(false);
  });
});
