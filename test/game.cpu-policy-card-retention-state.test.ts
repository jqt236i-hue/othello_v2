import { createCpuPolicyCardRetentionState } from '../game/ai/cpu-policy-card-retention-state';

describe('cpu-policy card-retention state module', () => {
  test('derives corner, board bonus, and anchor-reset context from normalized card context', () => {
    const helpers = createCpuPolicyCardRetentionState();

    const out = helpers.buildCpuPolicyCardRetentionState({
      ownCorners: 1,
      oppCorners: 3,
      hasCornerMoveNow: false,
      hasEdgeMoveNow: true,
      level: 6,
      playerValue: -1,
      recoveryCostGap: 4,
      maxLegalFlips: 5,
      maxLegalGain: 7,
      maxLegalBoardBonus: 2,
      highBonusMoveAvailable: true,
      oppHandSize: 4,
      ownSpecialCount: 2,
      oppSpecialCount: 5,
      ownCornerResetCount: 1,
      oppCornerResetCount: 2,
      ownEdgeResetCount: 3,
      oppEdgeResetCount: 1
    } as any);

    expect(out.cornerEmergency).toBe(true);
    expect(out.whiteLv6Mode).toBe(true);
    expect(out.maxLegalFlips).toBe(5);
    expect(out.maxLegalGain).toBe(7);
    expect(out.maxLegalBoardBonus).toBe(2);
    expect(out.highBonusMoveAvailable).toBe(true);
    expect(out.oppHandSize).toBe(4);
    expect(out.ownAnchorResetWeight).toBe(5);
    expect(out.oppAnchorResetWeight).toBe(5);
  });

  test('falls back safely when optional values are missing', () => {
    const helpers = createCpuPolicyCardRetentionState();

    const out = helpers.buildCpuPolicyCardRetentionState({
      ownCorners: 2,
      oppCorners: 2,
      level: 5,
      playerValue: 1
    } as any);

    expect(out.cornerEmergency).toBe(false);
    expect(out.whiteLv6Mode).toBe(false);
    expect(out.maxLegalFlips).toBe(0);
    expect(out.maxLegalGain).toBe(0);
    expect(out.maxLegalBoardBonus).toBe(0);
    expect(out.highBonusMoveAvailable).toBe(false);
    expect(out.ownAnchorResetWeight).toBe(0);
    expect(out.oppAnchorResetWeight).toBe(0);
  });
});
