export type CpuDecisionPublicApi = Record<string, any>;

export const REQUIRED_CPU_DECISION_EXPORTS = [
  'applyCardChoice',
  'applyHandCardDestroy',
  'buildCardUseDecisionContext',
  'buildOnnxContext',
  'computeCpuAction',
  'cpuMaybeDestroyHandCardWithPolicy',
  'cpuMaybeUseCardWithPolicy',
  'selectCardToUse',
  'selectCpuMoveWithPolicy',
  'selectMoveFromOnnxPolicyAsync',
  'setCpuDecisionRuntime'
];

export function assertCpuDecisionPublicApi(api: CpuDecisionPublicApi): CpuDecisionPublicApi {
  for (const key of REQUIRED_CPU_DECISION_EXPORTS) {
    if (!api || typeof api[key] === 'undefined') {
      throw new Error(`cpu-decision public API missing ${key}`);
    }
  }
  return api;
}

module.exports = {
  REQUIRED_CPU_DECISION_EXPORTS,
  assertCpuDecisionPublicApi
};
