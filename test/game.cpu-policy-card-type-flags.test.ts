import { createCpuPolicyCardTypeFlags } from '../game/ai/cpu-policy-card-type-flags';

describe('cpu-policy card type flags module', () => {
  test('classifies representative card types and derived groups', () => {
    const helpers = createCpuPolicyCardTypeFlags({
      isCornerRecoveryCardType: (cardType: unknown) => String(cardType) === 'HEAVEN_BLESSING',
      isCornerHoldCardType: (cardType: unknown) => String(cardType) === 'GUARD_WILL',
      isChargeRampCardType: (cardType: unknown) => String(cardType) === 'GOLD_STONE',
      throwChainCardTypes: ['DOUBLE_PLACE', 'TRIPLE_PLACE', 'QUAD_PLACE', 'INFINITE_PLACE'],
      chainWillCardTypes: ['DOUBLE_CHAIN_WILL', 'TRIPLE_CHAIN_WILL', 'QUAD_CHAIN_WILL', 'INFINITE_CHAIN_WILL'],
      defensiveCardTypes: new Set(['GUARD_WILL']),
      highVarianceCardTypes: new Set(['TIME_BOMB']),
      stabilityCardTypes: new Set(['GUARD_WILL']),
      swingCardTypes: new Set(['TIME_BOMB']),
      edgeContestCardTypes: new Set(['STRONG_WIND_WILL']),
      longHorizonCardTypes: new Set(['WORK_WILL']),
      whiteLv6CornerSwingKeepTypes: new Set(['HEAVEN_BLESSING']),
      whiteLv6FastRotateTypes: new Set(['LAST_RESORT'])
    });

    const gold = helpers.getCpuPolicyCardTypeFlags('GOLD_STONE');
    expect(gold.isChargeRampCard).toBe(true);
    expect(gold.isGoldStone).toBe(true);
    expect(gold.isChargeSwingCard).toBe(true);

    const buoyancy = helpers.getCpuPolicyCardTypeFlags('SUPER_BUOYANCY_WILL');
    expect(buoyancy.isBuoyancyWill).toBe(true);
    expect(buoyancy.isSuperCrushWill).toBe(true);

    const chain = helpers.getCpuPolicyCardTypeFlags('TRIPLE_CHAIN_WILL');
    expect(chain.isChainWill).toBe(true);
    expect(chain.isThrowChainCard).toBe(false);

    const lastResort = helpers.getCpuPolicyCardTypeFlags('LAST_RESORT');
    expect(lastResort.isLastResort).toBe(true);
    expect(lastResort.isFreePlacement).toBe(true);
    expect(lastResort.isFastRotate).toBe(true);
  });
});
