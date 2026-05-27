import type {
    CpuPolicyCardDefinition,
    CpuPolicyCardId,
    CpuPolicyCardScore
} from './cpu-policy-core-types';

type CpuPolicyHandDestroyScoringDeps = {
    getCpuPolicyCardTypeFlags?: (cardType: unknown) => Record<string, unknown>;
    whiteLv6DestroyWhenAheadTypes?: ReadonlySet<string>;
};

type CpuPolicyHandDestroyLoopState = {
    cornerEmergency: boolean;
    hasCornerMoveNow: boolean;
    hasEdgeMoveNow: boolean;
    cornerHoldMode: boolean;
    whiteLv6Mode: boolean;
    needRecoveryCard: boolean;
    needHoldCard: boolean;
    needChargeRampCard: boolean;
    shouldCycleForNeededCards: boolean;
    lv6FastCycleMode: boolean;
    handPressure: number;
    usableSet: Set<string>;
};

type CpuPolicyNormalizedDestroyContext = {
    discDiff: number;
    legalMovesCount: number;
    handSize: number;
    forceUseCard: boolean;
};

type CpuPolicyHandDestroyCandidate = {
    cardId: CpuPolicyCardId;
    cardDef: CpuPolicyCardDefinition | null;
    cardCost?: number;
    cardType: string;
    destroyScore: number;
};

type CpuPolicyChooseHandDestroyCandidateParams = {
    hand: CpuPolicyCardId[];
    loopState: CpuPolicyHandDestroyLoopState;
    normalizedContext: CpuPolicyNormalizedDestroyContext;
    scoreCardRetentionPriority: (cardId: CpuPolicyCardId) => CpuPolicyCardScore;
};

export function createCpuPolicyHandDestroyScore(deps?: CpuPolicyHandDestroyScoringDeps) {
    const getCpuPolicyCardTypeFlags = typeof deps?.getCpuPolicyCardTypeFlags === 'function'
        ? deps.getCpuPolicyCardTypeFlags
        : (() => ({}));
    const whiteLv6DestroyWhenAheadTypes = deps?.whiteLv6DestroyWhenAheadTypes || new Set<string>();

    function chooseCpuPolicyHandDestroyCandidate(params: CpuPolicyChooseHandDestroyCandidateParams) {
        const {
            hand,
            loopState,
            normalizedContext,
            scoreCardRetentionPriority
        } = params;

        let best: CpuPolicyHandDestroyCandidate | null = null;
        for (const cardId of hand) {
            const retention = scoreCardRetentionPriority(cardId);
            let destroyScore = Number.isFinite(retention.score) ? Number(retention.score) : 0;
            const cardType = retention.cardType || '';
            const {
                isRecoveryCard,
                isHoldCard,
                isChargeRampCard,
                isTimeBomb,
                isTimeStopGod,
                isLastResort,
                isSuperCrushWill,
                isGeneratedKeepPlace,
                isFastRotate,
                isWhiteCornerSwingKeepCard,
                isHighVarianceCard
            } = getCpuPolicyCardTypeFlags(cardType) as Record<string, any>;

            if (loopState.needRecoveryCard && isRecoveryCard) destroyScore += 520;
            if (loopState.needHoldCard && isHoldCard) destroyScore += 460;
            if (loopState.needChargeRampCard && isChargeRampCard) destroyScore += 220;
            if (loopState.needRecoveryCard && isTimeBomb) destroyScore -= 220;

            if (isTimeBomb && !loopState.cornerEmergency && normalizedContext.discDiff >= 0) destroyScore -= 210;
            if (isTimeStopGod && !loopState.cornerEmergency && normalizedContext.discDiff >= 0) destroyScore -= 240;
            if (isHighVarianceCard && normalizedContext.discDiff >= 0) destroyScore -= 70;

            if (loopState.usableSet.has(cardId) && loopState.handPressure < 2) destroyScore += 40;
            if (loopState.shouldCycleForNeededCards && !loopState.usableSet.has(cardId)) destroyScore -= 28;
            if (loopState.lv6FastCycleMode && !loopState.usableSet.has(cardId)) destroyScore -= 36;

            if (loopState.whiteLv6Mode) {
                if ((loopState.cornerEmergency || loopState.hasCornerMoveNow || loopState.cornerHoldMode) && isWhiteCornerSwingKeepCard) {
                    destroyScore += 520;
                }
                if (isFastRotate) destroyScore -= 380;
                if (normalizedContext.discDiff >= 4 && whiteLv6DestroyWhenAheadTypes.has(cardType) && !isGeneratedKeepPlace) {
                    destroyScore -= 360;
                }
                if ((normalizedContext.legalMovesCount <= 2 || normalizedContext.handSize >= 4) && whiteLv6DestroyWhenAheadTypes.has(cardType) && !isWhiteCornerSwingKeepCard && !isGeneratedKeepPlace) {
                    destroyScore -= 220;
                }
                if (!loopState.cornerEmergency && !loopState.hasCornerMoveNow && !loopState.hasEdgeMoveNow && isSuperCrushWill) {
                    destroyScore -= 160;
                }
                if (normalizedContext.legalMovesCount <= 1 && isHighVarianceCard && !isWhiteCornerSwingKeepCard) {
                    destroyScore -= 180;
                }
                if (isLastResort && !normalizedContext.forceUseCard && normalizedContext.discDiff >= 0) {
                    destroyScore -= 220;
                }
            }

            if (!best || destroyScore < best.destroyScore) {
                best = {
                    cardId,
                    cardDef: retention.cardDef || null,
                    cardCost: retention.cardCost,
                    cardType,
                    destroyScore
                };
            } else if (best && destroyScore === best.destroyScore && Number(retention.cardCost || 0) > Number(best.cardCost || 0)) {
                best = {
                    cardId,
                    cardDef: retention.cardDef || null,
                    cardCost: retention.cardCost,
                    cardType,
                    destroyScore
                };
            }
        }

        return best;
    }

    return {
        chooseCpuPolicyHandDestroyCandidate
    };
}
