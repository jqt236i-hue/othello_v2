import * as path from 'path';

const cpuDecision = require(path.resolve(__dirname, '..', 'game', 'cpu-decision.js'));

describe('cpu-decision public api', () => {
  test('keeps exported compatibility surface stable', () => {
    expect(Object.keys(cpuDecision).sort()).toEqual([
      'applyCardChoice',
      'applyHandCardDestroy',
      'buildCardUseDecisionContext',
      'buildOnnxContext',
      'computeCpuAction',
      'cpuMaybeDestroyHandCardWithPolicy',
      'cpuMaybeUseCardWithPolicy',
      'cpuSelectBlockadeWillWithPolicy',
      'cpuSelectBoardExpansionWillWithPolicy',
      'cpuSelectBoardShrinkWithPolicy',
      'cpuSelectBuoyancyWillWithPolicy',
      'cpuSelectCaptureWillWithPolicy',
      'cpuSelectCellTeleportWillWithPolicy',
      'cpuSelectCloneWillWithPolicy',
      'cpuSelectCondemnWillWithPolicy',
      'cpuSelectCorrosionWillWithPolicy',
      'cpuSelectDestroyWithPolicy',
      'cpuSelectExtendLifeWillWithPolicy',
      'cpuSelectFreezeWillWithPolicy',
      'cpuSelectGravityWillWithPolicy',
      'cpuSelectGuardWillWithPolicy',
      'cpuSelectHeavenBlessingWithPolicy',
      'cpuSelectLivingWillWithPolicy',
      'cpuSelectMeteorWillWithPolicy',
      'cpuSelectObserverWillWithPolicy',
      'cpuSelectPositionSwapWillWithPolicy',
      'cpuSelectReverseWillWithPolicy',
      'cpuSelectSeedWillWithPolicy',
      'cpuSelectSuperAttractionWillWithPolicy',
      'cpuSelectSuperBuoyancyWillWithPolicy',
      'cpuSelectSuperGravityWillWithPolicy',
      'cpuSelectSwapWithEnemyWithPolicy',
      'cpuSelectTeleportWillWithPolicy',
      'cpuSelectTemptWillWithPolicy',
      'cpuSelectTimeBombWithPolicy',
      'cpuSelectTrapWillWithPolicy',
      'hasPlanPressureProfileForCardType',
      'isCardChoiceAllowedByHighConfidence',
      'isCardChoiceAllowedByRisk',
      'selectCardFromOnnxPolicyAsync',
      'selectCardToUse',
      'selectCpuMoveWithPolicy',
      'selectHandCardToDestroy',
      'selectMoveFromOnnxPolicyAsync',
      'setCpuDecisionRuntime',
      'setCpuExecutionMode',
      'setCpuRng',
      'setCpuTimerService'
    ].sort());
  });
});
