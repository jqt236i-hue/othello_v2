import { createCpuPolicyCardProfiles } from '../game/ai/cpu-policy-card-profiles';

describe('cpu-policy card profiles module', () => {
  test('exposes explicit base score bonuses and merged usage style deltas', () => {
    const profiles = createCpuPolicyCardProfiles({
      chainWillCardTypes: ['DOUBLE_CHAIN_WILL', 'TRIPLE_CHAIN_WILL', 'QUAD_CHAIN_WILL', 'INFINITE_CHAIN_WILL']
    });

    expect(profiles.CARD_TYPE_BASE_SCORE_BONUS.RAINBOW_STONE).toBe(16);
    expect(profiles.CARD_TYPE_USAGE_STYLE.PROTECTED_NEXT_STONE).toEqual(expect.objectContaining({
      leadBias: 14,
      cornerNowBias: 16,
      cornerEmergencyBias: 8
    }));
    expect(profiles.CARD_TYPE_USAGE_STYLE.INFINITE_CHAIN_WILL).toEqual(expect.objectContaining({
      leadBias: -22,
      trailingBias: 22,
      lowMobilityBias: 18,
      endgameBias: -12
    }));
    expect(profiles.CARD_TYPE_BASE_SCORE_BONUS.BOARD_EXECUTOR).toBe(3);
    expect(profiles.CARD_TYPE_USAGE_STYLE.BOARD_EXECUTOR).toEqual(expect.objectContaining({
      trailingBias: 5,
      cornerNowBias: -3
    }));
  });

  test('builds move-plan profiles by layering archetype defaults and per-card overrides', () => {
    const profiles = createCpuPolicyCardProfiles();

    expect(profiles.CARD_TYPE_MOVE_PLAN_PROFILE.WORK_WILL).toEqual(expect.objectContaining({
      archetype: 'anchorEngine',
      placementWeight: 3,
      flipBias: 0,
      emptyAdjBias: -1,
      stabilityBias: 5
    }));
    expect(profiles.CARD_TYPE_MOVE_PLAN_PROFILE.TELEPORT_WILL).toEqual(expect.objectContaining({
      archetype: 'recoveryReposition',
      placementWeight: 0,
      mobilityBias: 3,
      xPenalty: 1
    }));
    expect(profiles.CARD_TYPE_MOVE_PLAN_PROFILE.BOARD_EXECUTOR).toEqual(expect.objectContaining({
      archetype: 'controlBoard',
      placementWeight: 0,
      flipBias: 4
    }));
  });
});
