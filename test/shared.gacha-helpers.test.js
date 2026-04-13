const GachaHelpers = require('../shared/gacha-helpers.js');

describe('gacha helpers observation reward', () => {
  test('uses 10-step weights up to 1000 bonus stones', () => {
    expect(GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_MAX).toBe(1000);
    expect(GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_STEP).toBe(10);
    expect(
      GachaHelpers.getObservationBonusTotalWeight(
        GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_MAX,
        GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_STEP
      )
    ).toBe(5151);
  });

  test('rollObservationBonus returns only 10-step values within 0..1000', () => {
    const totalWeight = GachaHelpers.getObservationBonusTotalWeight(
      GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_MAX,
      GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_STEP
    );

    expect(GachaHelpers.rollObservationBonus(() => 0)).toBe(0);
    expect(GachaHelpers.rollObservationBonus(() => 150 / totalWeight)).toBe(10);

    const nearMax = GachaHelpers.rollObservationBonus(() => 1 - Number.EPSILON);
    expect(nearMax).toBe(1000);
    expect(nearMax % 10).toBe(0);

    const mid = GachaHelpers.rollObservationBonus(() => 0.5);
    expect(mid % 10).toBe(0);
    expect(mid).toBeGreaterThanOrEqual(0);
    expect(mid).toBeLessThanOrEqual(1000);
  });
});
