/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
    CpuPolicyCardContext,
    CpuPolicyCardCostResolver,
    CpuPolicyCardDefinition,
    CpuPolicyCardDefinitionResolver,
    CpuPolicyCardId,
    CpuPolicyCardScore,
    CpuPolicyCardSelection
} from './cpu-policy-core-types';

type CpuPolicyForcedDestroyReason = 'bucket1_never_use' | 'bucket2_low_charge' | 'bucket3_currently_unusable';

type CpuPolicyCardHelpersConfig = {
    SharedCardHeuristics?: any;
    CORNER_RECOVERY_CARD_TYPES?: Set<string>;
    CORNER_HOLD_CARD_TYPES?: Set<string>;
    CHARGE_RAMP_CARD_TYPES?: Set<string>;
    CARD_TYPE_USAGE_STYLE?: Record<string, any>;
    CARD_TYPE_BASE_SCORE_BONUS?: Record<string, any>;
    CARD_TYPE_MOVE_PLAN_PROFILE?: Record<string, any>;
    IMMEDIATE_DESTROY_CARD_TYPES?: Set<string>;
    LOW_CHARGE_DESTROY_CARD_TYPES?: Set<string>;
    LOW_CHARGE_DESTROY_MAX_CHARGE?: number;
    CONDITION_DEPENDENT_DESTROY_CARD_TYPES?: Set<string>;
    asRecord?: (value: unknown) => Record<string, unknown>;
    isFiniteNumber?: (value: unknown) => boolean;
};

function fallbackAsRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

export function createCpuPolicyCardHelpers(config?: CpuPolicyCardHelpersConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuPolicyCardHelpersConfig;
    const sharedCardHeuristics = cfg.SharedCardHeuristics || null;
    const cornerRecoveryCardTypes = cfg.CORNER_RECOVERY_CARD_TYPES || new Set<string>();
    const cornerHoldCardTypes = cfg.CORNER_HOLD_CARD_TYPES || new Set<string>();
    const chargeRampCardTypes = cfg.CHARGE_RAMP_CARD_TYPES || new Set<string>();
    const cardTypeUsageStyle = cfg.CARD_TYPE_USAGE_STYLE || {};
    const cardTypeBaseScoreBonus = cfg.CARD_TYPE_BASE_SCORE_BONUS || {};
    const cardTypeMovePlanProfile = cfg.CARD_TYPE_MOVE_PLAN_PROFILE || {};
    const immediateDestroyCardTypes = cfg.IMMEDIATE_DESTROY_CARD_TYPES || new Set<string>();
    const lowChargeDestroyCardTypes = cfg.LOW_CHARGE_DESTROY_CARD_TYPES || new Set<string>();
    const lowChargeDestroyMaxCharge = Number(cfg.LOW_CHARGE_DESTROY_MAX_CHARGE || 0);
    const conditionDependentDestroyCardTypes = cfg.CONDITION_DEPENDENT_DESTROY_CARD_TYPES || new Set<string>();
    const asRecord = typeof cfg.asRecord === 'function' ? cfg.asRecord : fallbackAsRecord;
    const isFiniteNumber = typeof cfg.isFiniteNumber === 'function' ? cfg.isFiniteNumber : fallbackIsFiniteNumber;

    function chooseHighestCostCard(
        usableCardIds: CpuPolicyCardId[],
        getCardCost: CpuPolicyCardCostResolver,
        getCardDef?: CpuPolicyCardDefinitionResolver
    ): CpuPolicyCardSelection | null {
        if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
        const sorted = usableCardIds.slice().sort((a, b) => {
            const ca = typeof getCardCost === 'function' ? (getCardCost(a) || 0) : 0;
            const cb = typeof getCardCost === 'function' ? (getCardCost(b) || 0) : 0;
            return cb - ca;
        });
        const cardId = sorted[0];
        const cardDef = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
        return { cardId, cardDef };
    }

    function isCornerRecoveryCardType(cardType: unknown): boolean {
        const normalizedType = String(cardType || '');
        if (!normalizedType) return false;
        if (sharedCardHeuristics && typeof sharedCardHeuristics.isRecoveryCardType === 'function') {
            try {
                if (sharedCardHeuristics.isRecoveryCardType(normalizedType) === true) return true;
            } catch (e) { /* ignore */ }
        }
        return cornerRecoveryCardTypes.has(normalizedType);
    }

    function isCornerHoldCardType(cardType: unknown): boolean {
        const normalizedType = String(cardType || '');
        if (!normalizedType) return false;
        if (sharedCardHeuristics && typeof sharedCardHeuristics.isHoldCardType === 'function') {
            try {
                if (sharedCardHeuristics.isHoldCardType(normalizedType) === true) return true;
            } catch (e) { /* ignore */ }
        }
        return cornerHoldCardTypes.has(normalizedType);
    }

    function isChargeRampCardType(cardType: unknown): boolean {
        const normalizedType = String(cardType || '');
        if (!normalizedType) return false;
        if (sharedCardHeuristics && typeof sharedCardHeuristics.isChargeRampCardType === 'function') {
            try {
                if (sharedCardHeuristics.isChargeRampCardType(normalizedType) === true) return true;
            } catch (e) { /* ignore */ }
        }
        return chargeRampCardTypes.has(normalizedType);
    }

    function hasUsageStyleForCardType(cardType: unknown): boolean {
        return Object.prototype.hasOwnProperty.call(cardTypeUsageStyle, String(cardType || ''));
    }

    function hasBaseScoreBonusForCardType(cardType: unknown): boolean {
        return Object.prototype.hasOwnProperty.call(cardTypeBaseScoreBonus, String(cardType || ''));
    }

    function hasMovePlanProfileForCardType(cardType: unknown): boolean {
        return Object.prototype.hasOwnProperty.call(cardTypeMovePlanProfile, String(cardType || ''));
    }

    function getMovePlanProfileForCardType(cardType: unknown) {
        const type = String(cardType || '');
        if (!Object.prototype.hasOwnProperty.call(cardTypeMovePlanProfile, type)) return null;
        return cardTypeMovePlanProfile[type] || null;
    }

    function getForcedHandDestroyReason(
        cardId: unknown,
        cardType: unknown,
        context: CpuPolicyCardContext | null | undefined,
        usableCardIdSet: Set<string> | null | undefined
    ): CpuPolicyForcedDestroyReason | null {
        const type = String(cardType || '').trim();
        if (!type) return null;
        if (immediateDestroyCardTypes.has(type)) return 'bucket1_never_use';

        const ctx = asRecord(context);
        const ownCharge = isFiniteNumber(ctx.ownCharge) ? Number(ctx.ownCharge) : 0;
        if (lowChargeDestroyCardTypes.has(type) && ownCharge <= lowChargeDestroyMaxCharge) {
            return 'bucket2_low_charge';
        }

        const safeCardId = String(cardId || '').trim();
        if (
            conditionDependentDestroyCardTypes.has(type) &&
            safeCardId &&
            !(usableCardIdSet instanceof Set && usableCardIdSet.has(safeCardId))
        ) {
            return 'bucket3_currently_unusable';
        }

        return null;
    }

    function getForcedHandDestroyPriority(reason: unknown): number {
        switch (String(reason || '')) {
        case 'bucket1_never_use':
            return 1;
        case 'bucket2_low_charge':
            return 2;
        case 'bucket3_currently_unusable':
            return 3;
        default:
            return 99;
        }
    }

    function buildBlockedCardUseDecision(
        cardId: CpuPolicyCardId,
        cardDef: CpuPolicyCardDefinition | null,
        cardType: string,
        cardCost: number,
        context: CpuPolicyCardContext | null | undefined,
        reason: unknown
    ): CpuPolicyCardScore {
        const ctx = asRecord(context);
        return {
            cardId,
            cardDef,
            cardType,
            cardCost,
            score: -1000000,
            shouldUse: false,
            minUseScore: Number.isFinite(ctx.minUseScore) ? Number(ctx.minUseScore) : Number.NEGATIVE_INFINITY,
            reason: String(reason || 'blocked')
        };
    }

    function chooseForcedHandDestroyTarget(
        handCardIds: CpuPolicyCardId[],
        getCardCost: CpuPolicyCardCostResolver,
        getCardDef: CpuPolicyCardDefinitionResolver,
        context: CpuPolicyCardContext | null | undefined,
        usableCardIdSet: Set<string> | null | undefined
    ): CpuPolicyCardScore | null {
        if (!Array.isArray(handCardIds) || handCardIds.length <= 0) return null;
        let best: (CpuPolicyCardScore & { cardCost: number; priority: number; reason: CpuPolicyForcedDestroyReason }) | null = null;

        for (const rawCardId of handCardIds) {
            const cardId = String(rawCardId || '').trim();
            if (!cardId) continue;
            const cardDef = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
            const cardType = cardDef && typeof cardDef.type === 'string' ? cardDef.type : '';
            const reason = getForcedHandDestroyReason(cardId, cardType, context, usableCardIdSet);
            if (!reason) continue;
            const cardCost = typeof getCardCost === 'function' ? Number(getCardCost(cardId) || 0) : 0;
            const priority = getForcedHandDestroyPriority(reason);

            if (
                !best ||
                priority < best.priority ||
                (priority === best.priority && cardCost > best.cardCost) ||
                (priority === best.priority && cardCost === best.cardCost && cardId < best.cardId)
            ) {
                best = {
                    cardId,
                    cardDef,
                    cardType,
                    cardCost,
                    score: Number.NEGATIVE_INFINITY,
                    priority,
                    reason
                };
            }
        }

        if (!best) return null;
        return {
            cardId: best.cardId,
            cardDef: best.cardDef,
            cardType: best.cardType,
            score: Number.NEGATIVE_INFINITY,
            reason: best.reason
        };
    }

    return {
        chooseHighestCostCard,
        isCornerRecoveryCardType,
        isCornerHoldCardType,
        isChargeRampCardType,
        hasUsageStyleForCardType,
        hasBaseScoreBonusForCardType,
        hasMovePlanProfileForCardType,
        getMovePlanProfileForCardType,
        getForcedHandDestroyReason,
        getForcedHandDestroyPriority,
        buildBlockedCardUseDecision,
        chooseForcedHandDestroyTarget
    };
}
