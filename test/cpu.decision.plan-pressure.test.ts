const cpuDecisionPlanPressure = require('../game/cpu-decision-plan-pressure');

describe('cpu decision plan pressure module', () => {
  test('generated throw-chain profiles are exposed through card profile lookup', () => {
    expect(cpuDecisionPlanPressure.hasPlanPressureProfileForCardType('DOUBLE_PLACE')).toBe(true);
    expect(cpuDecisionPlanPressure.getCardPlanPressureProfile('DOUBLE_PLACE')).toEqual({
      basePressure: 2,
      cornerWindowPressure: 4,
      recoveryGapPressure: 2,
      recoveryEmergencyPressure: 3
    });
  });

  test('computeCardPlanPressure reacts to corner emergency, low mobility, and high bonus availability', () => {
    const pressure = cpuDecisionPlanPressure.computeCardPlanPressure(6, 1, {
      cornerEmergency: true,
      oppCorners: 2,
      ownCorners: 0,
      hasCornerMoveNow: false
    }, {
      discDiff: -7,
      handSize: 5,
      ownCharge: 30,
      ownEdges: 1,
      oppEdges: 6,
      ownSpecialCount: 1,
      oppSpecialCount: 4,
      highBonusMoveAvailable: true
    });

    expect(pressure).toBe(7);
  });

  test('resolveCardPlanPressureThreshold prefers emergency over corner window and recovery gap', () => {
    const profile = cpuDecisionPlanPressure.getCardPlanPressureProfile('DESTROY_ONE_STONE');

    expect(cpuDecisionPlanPressure.resolveCardPlanPressureThreshold(2, {
      cornerEmergency: true,
      hasCornerMoveNow: true,
      recoveryCostGap: 3
    }, profile)).toBe(0);

    expect(cpuDecisionPlanPressure.resolveCardPlanPressureThreshold(2, {
      cornerEmergency: false,
      hasCornerMoveNow: true,
      recoveryCostGap: 3
    }, profile)).toBe(5);

    expect(cpuDecisionPlanPressure.resolveCardPlanPressureThreshold(2, {
      cornerEmergency: false,
      hasCornerMoveNow: false,
      recoveryCostGap: 3
    }, profile)).toBe(4);
  });

  test('DESTROY_ONE_STONE keeps strict base pressure outside targeted exceptions', () => {
    const profile = cpuDecisionPlanPressure.getCardPlanPressureProfile('DESTROY_ONE_STONE');

    expect(profile.basePressure).toBe(4);
  });
});
