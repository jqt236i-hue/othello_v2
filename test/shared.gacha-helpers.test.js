const GachaHelpers = require('../shared/gacha-helpers.js');

describe('gacha helpers observation reward', () => {
  test('uses 10-step weights from 100 to 3000 bonus stones', () => {
    expect(GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_MIN).toBe(100);
    expect(GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_MAX).toBe(3000);
    expect(GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_STEP).toBe(10);
    expect(
      GachaHelpers.getObservationBonusTotalWeight(
        GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_MIN,
        GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_MAX,
        GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_STEP
      )
    ).toBe(42486);
  });

  test('rollObservationBonus returns only 10-step values within 100..3000', () => {
    const totalWeight = GachaHelpers.getObservationBonusTotalWeight(
      GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_MIN,
      GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_MAX,
      GachaHelpers.OBSERVATION_STONE_REWARD_BONUS_STEP
    );

    expect(GachaHelpers.rollObservationBonus(() => 0)).toBe(100);
    expect(GachaHelpers.rollObservationBonus(() => 291 / totalWeight)).toBe(110);

    const nearMax = GachaHelpers.rollObservationBonus(() => 1 - Number.EPSILON);
    expect(nearMax).toBe(3000);
    expect(nearMax % 10).toBe(0);

    const mid = GachaHelpers.rollObservationBonus(() => 0.5);
    expect(mid % 10).toBe(0);
    expect(mid).toBeGreaterThanOrEqual(100);
    expect(mid).toBeLessThanOrEqual(3000);
  });
});
