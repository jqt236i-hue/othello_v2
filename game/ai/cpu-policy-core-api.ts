import type { CpuPolicyCoreApi } from './cpu-policy-core-types';

const REQUIRED_CPU_POLICY_FUNCTIONS: Array<keyof CpuPolicyCoreApi> = [
    'chooseHandDestroyTargetForCycle',
    'chooseCardWithRiskProfile',
    'chooseHighestCostCard',
    'chooseLowestRetentionCard',
    'chooseSellCardTargetByRetention',
    'chooseMoveByLookahead',
    'chooseMove',
    'computeLegalMoveMetrics',
    'getMovePlanProfileForCardType',
    'isChargeRampCardType',
    'isCornerHoldCardType',
    'isCornerRecoveryCardType',
    'hasBaseScoreBonusForCardType',
    'hasMovePlanProfileForCardType',
    'hasUsageStyleForCardType',
    'scoreCardRetentionForSell',
    'scoreCardRetentionPriority',
    'scoreCardUseDecision',
    'evaluatePlacementCandidate',
    'scoreMoveForCornerEdgePlan',
    'scoreMoveHeuristic'
];

export function createCpuPolicyCoreApi(value: Record<string, unknown>): CpuPolicyCoreApi {
    const missing = REQUIRED_CPU_POLICY_FUNCTIONS.filter((key) => typeof value[key] !== 'function');
    if (missing.length > 0) {
        throw new TypeError(`cpu-policy-core missing API functions: ${missing.join(', ')}`);
    }
    return value as unknown as CpuPolicyCoreApi;
}
