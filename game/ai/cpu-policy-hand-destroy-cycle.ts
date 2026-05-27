import type {
    CpuPolicyCardContext,
    CpuPolicyCardCostResolver,
    CpuPolicyCardDefinitionResolver,
    CpuPolicyCardId,
    CpuPolicyCardScore
} from './cpu-policy-core-types';

type CpuPolicyNormalizedDestroyContext = {
    level: number;
    playerValue: number;
    legalMovesCount: number;
    discDiff: number;
    handSize: number;
    forceUseCard: boolean;
};

type CpuPolicyHandDestroyCycleDeps = {
    asRecord?: (value: unknown) => Record<string, unknown>;
    isFiniteNumber?: (value: unknown) => boolean;
    isCornerRecoveryCardType?: (cardType: string) => boolean;
    isCornerHoldCardType?: (cardType: string) => boolean;
    isChargeRampCardType?: (cardType: string) => boolean;
};

type CpuPolicyHandDestroyStateParams = {
    handCardIds: CpuPolicyCardId[];
    usableCardIds: CpuPolicyCardId[];
    getCardCost: CpuPolicyCardCostResolver;
    getCardDef: CpuPolicyCardDefinitionResolver;
    context?: CpuPolicyCardContext;
    normalizedContext: CpuPolicyNormalizedDestroyContext;
    scoreCardUseDecision: (
        cardId: CpuPolicyCardId,
        getCardCost: CpuPolicyCardCostResolver,
        getCardDef: CpuPolicyCardDefinitionResolver,
        context?: CpuPolicyCardContext
    ) => CpuPolicyCardScore;
};

function fallbackAsRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

export function createCpuPolicyHandDestroyCycle(deps?: CpuPolicyHandDestroyCycleDeps) {
    const asRecord = typeof deps?.asRecord === 'function' ? deps.asRecord : fallbackAsRecord;
    const isFiniteNumber = typeof deps?.isFiniteNumber === 'function' ? deps.isFiniteNumber : fallbackIsFiniteNumber;
    const isCornerRecoveryCardType = typeof deps?.isCornerRecoveryCardType === 'function' ? deps.isCornerRecoveryCardType : (() => false);
    const isCornerHoldCardType = typeof deps?.isCornerHoldCardType === 'function' ? deps.isCornerHoldCardType : (() => false);
    const isChargeRampCardType = typeof deps?.isChargeRampCardType === 'function' ? deps.isChargeRampCardType : (() => false);

    function buildCpuPolicyHandDestroyCycleState(params: CpuPolicyHandDestroyStateParams) {
        const rawContext = asRecord(params.context);
        const hand = Array.isArray(params.handCardIds)
            ? params.handCardIds.map((id) => String(id || '').trim()).filter((id) => id.length > 0)
            : [];
        const usable = Array.isArray(params.usableCardIds)
            ? params.usableCardIds.map((id) => String(id || '').trim()).filter((id) => id.length > 0)
            : [];
        const usableSet = new Set(usable);

        let hasRecoveryCard = false;
        let hasHoldCard = false;
        let hasChargeRampCard = false;
        for (const cardId of hand) {
            const def = typeof params.getCardDef === 'function' ? (params.getCardDef(cardId) || null) : null;
            const type = def && typeof def.type === 'string' ? def.type : '';
            if (!type) continue;
            if (isCornerRecoveryCardType(type)) hasRecoveryCard = true;
            if (isCornerHoldCardType(type)) hasHoldCard = true;
            if (isChargeRampCardType(type)) hasChargeRampCard = true;
        }

        const ownCorners = isFiniteNumber(rawContext.ownCorners) ? Number(rawContext.ownCorners) : 0;
        const oppCorners = isFiniteNumber(rawContext.oppCorners) ? Number(rawContext.oppCorners) : 0;
        const cornerEmergency = !!rawContext.cornerEmergency || (oppCorners > ownCorners);
        const hasCornerMoveNow = rawContext.hasCornerMoveNow === true;
        const hasEdgeMoveNow = rawContext.hasEdgeMoveNow === true;
        const cornerHoldMode = rawContext.cornerHoldMode === true;
        const whiteLv6Mode = params.normalizedContext.level >= 6 && Number(params.normalizedContext.playerValue) < 0;
        const needRecoveryCard = (cornerEmergency || !hasCornerMoveNow) && !hasRecoveryCard;
        const needHoldCard = (hasCornerMoveNow || cornerHoldMode) && !hasHoldCard;
        const needChargeRampCard = (
            isFiniteNumber(rawContext.recoveryCostGap) &&
            Number(rawContext.recoveryCostGap) > 0 &&
            !hasChargeRampCard
        );
        const shouldCycleForNeededCards = needRecoveryCard || needHoldCard || needChargeRampCard;

        const noUsableCardsNow = usable.length <= 0;
        const lv6FastCycleMode = (
            params.normalizedContext.level >= 6 &&
            params.normalizedContext.handSize >= 3 &&
            noUsableCardsNow &&
            !params.normalizedContext.forceUseCard
        );
        const handPressure = params.normalizedContext.handSize >= 5
            ? 2
            : (params.normalizedContext.handSize >= 4 ? 1 : (lv6FastCycleMode ? 1 : 0));

        let strongUseReady = false;
        if (usable.length > 0) {
            let bestUse: CpuPolicyCardScore | null = null;
            for (const cardId of usable) {
                const decision = params.scoreCardUseDecision(cardId, params.getCardCost, params.getCardDef, params.context);
                if (!bestUse || decision.score > bestUse.score) {
                    bestUse = decision;
                }
            }
            if (bestUse && bestUse.shouldUse && bestUse.score >= (Number(bestUse.minUseScore) + 18)) {
                strongUseReady = true;
            }
        }

        return {
            rawContext,
            hand,
            usable,
            usableSet,
            cornerEmergency,
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerHoldMode,
            whiteLv6Mode,
            needRecoveryCard,
            needHoldCard,
            needChargeRampCard,
            shouldCycleForNeededCards,
            lv6FastCycleMode,
            handPressure,
            strongUseReady
        };
    }

    return {
        buildCpuPolicyHandDestroyCycleState
    };
}
