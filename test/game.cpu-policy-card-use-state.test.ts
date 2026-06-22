import { createCpuPolicyCardUseState } from '../game/ai/cpu-policy-card-use-state';

describe('cpu-policy card-use state module', () => {
  test('derives hand mix, pressure, and phase metrics from normalized context', () => {
    const helpers = createCpuPolicyCardUseState({
      rebuildKeepPriorityCardTypes: new Set(['KEEP_CARD']),
      highVarianceCardTypes: new Set(['TIME_BOMB']),
      stabilityCardTypes: new Set(['STABLE_CARD']),
      whiteLv6FastRotateTypes: new Set(['FAST_CARD'])
    });
    const defs = new Map([
      ['CURRENT', { type: 'CURRENT_CARD' }],
      ['KEEP', { type: 'KEEP_CARD' }],
      ['TIME', { type: 'TIME_BOMB' }],
      ['FAST', { type: 'FAST_CARD' }],
      ['STABLE', { type: 'STABLE_CARD' }]
    ]);

    const out = helpers.buildCpuPolicyCardUseState({
      ownCorners: 1,
      oppCorners: 3,
      hasCornerMoveNow: false,
      hasEdgeMoveNow: true,
      recoveryCostGap: 4,
      highBonusMoveAvailable: true,
      ownDiscs: 6,
      ownEdges: 4,
      oppEdges: 7,
      maxLegalFlips: 5,
      avgLegalFlips: 2.5,
      maxLegalGain: 7,
      maxLegalBoardBonus: 2,
      cloneSplitEligibleSourceCount: 3,
      oppHandSize: 4,
      ownSpecialCount: 1,
      oppSpecialCount: 4,
      ownBombCount: 1,
      ownGuardCount: 1,
      oppGuardCount: 0,
      ownCornerResetCount: 1,
      oppCornerResetCount: 2,
      ownEdgeResetCount: 0,
      oppEdgeResetCount: 3,
      handCardIds: ['CURRENT', 'KEEP', 'TIME', 'FAST', 'STABLE'],
      usableCardIds: ['TIME', 'FAST'],
      deckRemaining: 5,
      discDiff: -4,
      handSize: 5,
      ownCharge: 42,
      legalMovesCount: 2,
      empties: 12,
      level: 6,
      playerValue: -1
    } as any, 'CURRENT', (id) => defs.get(id as string) as any);

    expect(out.cornerEmergency).toBe(true);
    expect(out.keepPriorityInHandCount).toBe(1);
    expect(out.highVarianceInHandCount).toBe(1);
    expect(out.fastRotateInHandCount).toBe(1);
    expect(out.stabilityInHandCount).toBe(1);
    expect(out.cornerDiff).toBe(-2);
    expect(out.edgeDiff).toBe(-3);
    expect(out.ownAnchorResetWeight).toBe(2);
    expect(out.oppAnchorResetWeight).toBe(7);
    expect(out.ownBombCount).toBe(1);
    expect(out.strategicDiff).toBe(-15);
    expect(out.handPressureLevel).toBe(3);
    expect(out.chargePressureLevel).toBe(2);
    expect(out.mobilityPressureLevel).toBe(2);
    expect(out.cardCyclePressure).toBe(7);
    expect(out.midLatePhase).toBe(true);
    expect(out.endgamePhase).toBe(true);
    expect(out.trailingHard).toBe(true);
    expect(out.edgeEmergency).toBe(true);
    expect(out.whiteLv6Mode).toBe(true);
    expect(out.lowDiscEmergency).toBe(true);
    expect(out.criticalLowDiscEmergency).toBe(false);
    expect(out.usableCardIdSet.has('TIME')).toBe(true);
    expect(out.deckRemaining).toBe(5);
  });

  test('honors explicit emergency flags without requiring derived thresholds', () => {
    const helpers = createCpuPolicyCardUseState();

    const out = helpers.buildCpuPolicyCardUseState({
      ownCorners: 2,
      oppCorners: 2,
      cornerEmergency: true,
      ownDiscs: 10,
      ownEdges: 3,
      oppEdges: 3,
      discDiff: 2,
      handSize: 2,
      ownCharge: 10,
      legalMovesCount: 4,
      empties: 44,
      level: 4,
      playerValue: 1,
      lowDiscEmergency: true,
      criticalLowDiscEmergency: true
    } as any, 'CURRENT', () => null);

    expect(out.cornerEmergency).toBe(true);
    expect(out.openingPhase).toBe(true);
    expect(out.endgamePhase).toBe(false);
    expect(out.whiteLv6Mode).toBe(false);
    expect(out.lowDiscEmergency).toBe(true);
    expect(out.criticalLowDiscEmergency).toBe(true);
    expect(out.keepPriorityInHandCount).toBe(0);
    expect(out.lossEnemyAnchorPayoffIsModest).toBe(true);
    expect(out.deckRemaining).toBeNull();
    expect(out.cloneSplitEligibleSourceCount).toBeNull();
  });
});
