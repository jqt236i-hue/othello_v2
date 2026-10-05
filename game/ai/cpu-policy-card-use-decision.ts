import { applyCpuCardScoreRules } from './cpu-policy-card-score-rules';
import { scoreCardStoneSupplyUseAdjustment } from './cpu-policy-card-stone-supply';
import type { createCpuPolicyDecisionContext } from './cpu-policy-decision-context';
import type { createCpuPolicyCardTypeFlags } from './cpu-policy-card-type-flags';
import type { createCpuPolicyCardUseState } from './cpu-policy-card-use-state';
import type {
    CpuPolicyCardContext,
    CpuPolicyCardCostResolver,
    CpuPolicyCardDefinitionResolver,
    CpuPolicyCardId,
    CpuPolicyCardScore
} from './cpu-policy-core-types';

type CpuPolicyCardUseDecisionDeps = {
    buildCardDecisionContext: ReturnType<typeof createCpuPolicyDecisionContext>['buildCardDecisionContext'];
    // The built-in flag resolver leaves this legacy optional hook absent.
    getCpuPolicyCardTypeFlags: (cardType: unknown) => ReturnType<ReturnType<typeof createCpuPolicyCardTypeFlags>['getCpuPolicyCardTypeFlags']> & { isHyperactiveInheritWill?: boolean };
    buildCpuPolicyCardUseState: ReturnType<typeof createCpuPolicyCardUseState>['buildCpuPolicyCardUseState'];
    buildBlockedCardUseDecision: (cardId: CpuPolicyCardId, cardDef: unknown, cardType: string, cardCost: number, context: CpuPolicyCardContext, reason: string) => CpuPolicyCardScore;
    getForcedHandDestroyReason: (cardId: CpuPolicyCardId, cardType: string, context: CpuPolicyCardContext, usableCardIdSet: ReadonlySet<string>) => string | null | undefined;
    cardTypeBaseScoreBonus?: Readonly<Record<string, number>>;
    cardTypeUsageStyle?: Readonly<Record<string, any>>;
    highVarianceCardTypes?: ReadonlySet<string>;
    rebuildKeepPriorityCardTypes?: ReadonlySet<string>;
    whiteLv6DestroyWhenAheadTypes?: ReadonlySet<string>;
    isInviolableSpecialCardId?: (cardId: unknown) => boolean;
};

export function createCpuPolicyCardUseDecision(deps: CpuPolicyCardUseDecisionDeps) {
    const cardTypeBaseScoreBonus: Readonly<Record<string, number>> = deps.cardTypeBaseScoreBonus || Object.freeze({});
    const cardTypeUsageStyle: Readonly<Record<string, any>> = deps.cardTypeUsageStyle || Object.freeze({});
    const highVarianceCardTypes = deps.highVarianceCardTypes || new Set<string>();
    const rebuildKeepPriorityCardTypes = deps.rebuildKeepPriorityCardTypes || new Set<string>();
    const whiteLv6DestroyWhenAheadTypes = deps.whiteLv6DestroyWhenAheadTypes || new Set<string>();
    const buildCardDecisionContext = deps.buildCardDecisionContext;
    const getCpuPolicyCardTypeFlags = deps.getCpuPolicyCardTypeFlags;
    const buildCpuPolicyCardUseState = deps.buildCpuPolicyCardUseState;
    const buildBlockedCardUseDecision = deps.buildBlockedCardUseDecision;
    const getForcedHandDestroyReason = deps.getForcedHandDestroyReason;
    const isInviolableSpecialCardId = typeof deps.isInviolableSpecialCardId === 'function'
        ? deps.isInviolableSpecialCardId
        : () => false;

    function countLossWillDestroyableHandCards(handCardIds: CpuPolicyCardId[], useCardId: CpuPolicyCardId): number {
        if (!Array.isArray(handCardIds)) return 0;
        let count = 0;
        let skippedUseCard = false;
        for (const handId of handCardIds) {
            if (!handId) continue;
            if (!skippedUseCard && handId === useCardId) {
                skippedUseCard = true;
                continue;
            }
            if (isInviolableSpecialCardId(handId)) continue;
            count += 1;
        }
        return count;
    }

    function getFlipMultiplierExtraProfit(maxLegalFlips: number, multiplier: number, cardCost: number): number {
        return Math.max(0, Math.floor(maxLegalFlips || 0)) * Math.max(0, multiplier - 1) - Math.max(0, Number(cardCost) || 0);
    }

    function getNumberCellExtraProfit(maxLegalBoardBonus: number, cardCost: number): number {
        return Math.max(0, Math.floor(maxLegalBoardBonus || 0)) - Math.max(0, Number(cardCost) || 0);
    }

    function getEqualityWillStealableAmount(ownCharge: unknown, oppCharge: unknown): number {
        const normalizedOwnCharge = Number.isFinite(Number(ownCharge))
            ? Math.max(0, Math.floor(Number(ownCharge)))
            : 0;
        const availableOpponentCharge = Number.isFinite(Number(oppCharge))
            ? Math.max(0, Math.floor(Number(oppCharge)))
            : 0;
        const playerChargeRoom = Math.max(0, 99 - normalizedOwnCharge);
        return Math.min(10, availableOpponentCharge, playerChargeRoom);
    }

    function getMovementCornerSwingTargetCount(context: any, cardType: string): number {
        const counts = context && context.movementCornerSwingTargetCounts;
        if (counts && typeof counts === 'object' && Object.prototype.hasOwnProperty.call(counts, cardType)) {
            const value = Number(counts[cardType]);
            return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
        }
        const fallback = Number(context && context.movementCornerSwingTargetCount);
        return Number.isFinite(fallback) ? Math.max(0, Math.floor(fallback)) : 0;
    }

    function isMovementCornerSwingCardType(cardType: string): boolean {
        return (
            cardType === 'BUOYANCY_WILL' ||
            cardType === 'GRAVITY_WILL' ||
            cardType === 'SUPER_BUOYANCY_WILL' ||
            cardType === 'SUPER_GRAVITY_WILL' ||
            cardType === 'SUPER_ATTRACTION_WILL'
        );
    }

    function scoreCardUseDecision(
        cardId: CpuPolicyCardId,
        getCardCost: CpuPolicyCardCostResolver,
        getCardDef: CpuPolicyCardDefinitionResolver,
        context?: CpuPolicyCardContext
    ): CpuPolicyCardScore {
        const ctx = buildCardDecisionContext(context);
        const cardCost = typeof getCardCost === 'function' ? Number(getCardCost(cardId) || 0) : 0;
        const cardDef = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
        const {
            cardType,
            isRecoveryCard,
            isHoldCard,
            isChargeRampCard,
            isWorkWill,
            isTimeBomb,
            isTimeStopGod,
            isThrowChainCard,
            isChainWill,
            isLastResort,
            isEqualityWill,
            isReinforcementWill,
            isFreePlacement,
            isSniperWill,
            isStrongWindWill,
            isSwapWithEnemy,
            isPositionSwapWill,
            isTemptWill,
            isCloneWill,
            isBoardExpansionWill,
            isBoardShrinkCard,
            isTrapWill,
            isHeavenBlessing,
            isRevealHandWill,
            isCondemnWill,
            isExecutionWill,
            isExtendLifeWill,
            isExtendLifeGod,
            isExtendLifeCard,
            isRebuildWill,
            isGoldStone,
            isCrystalStone,
            isRainbowStone,
            isSilverStone,
            isTreasureBox,
            isLossWill,
            isMassFreezeWill,
            isCorrosionWill,
            isBlockadeWill,
            isMeteorWill,
            isProtectedNextStone,
            isAfterimageWill,
            isGhostWill,
            isPermaProtectNextStone,
            isGuardWill,
            isGuardianGod,
            isRegenWill,
            isLightningWill,
            isFireWill,
            isHyperactiveWill,
            isInstantHyperactiveWill,
            isTabooReverseWill,
            isCrossBomb,
            isXBomb,
            isUltimateDestroyGod,
            isUltimateHyperactiveGod,
            isDestroyDragonWill,
            isBreedingWill,
            isTeleportWill,
            isCellTeleportWill,
            isHyperactiveInheritWill,
            isRobotVacuumWill,
            isExtremeHyperactiveWill,
            isGluttonousWill,
            isBuoyancyWill,
            isGravityWill,
            isSuperCrushWill,
            isAnchorPlacementCard,
            isChargeSwingCard,
            isDefensiveCard,
            isHighVarianceCard,
            isStabilityCard,
            isSwingCard,
            isEdgeContestCard,
            isLongHorizonCard,
            isWhiteCornerSwingKeepCard
        } = getCpuPolicyCardTypeFlags(cardDef && typeof cardDef.type === 'string' ? cardDef.type : '');
        const {
            ownCorners,
            oppCorners,
            swapEnemyNormalCornerTargetCount,
            boardExpansionWillEnemyCornerTargetCount,
            boardExpansionGodEnemyCornerTargetCount,
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerEmergency,
            recoveryCostGap,
            highBonusMoveAvailable,
            ownDiscs,
            ownEdges,
            oppEdges,
            maxLegalFlips,
            maxLegalGain,
            maxLegalBoardBonus,
            cloneSplitEligibleSourceCount,
            oppHandSize,
            ownSpecialCount,
            oppSpecialCount,
            ownBombCount,
            massFreezeOwnTargetCount,
            massFreezeOpponentTargetCount,
            temptHighValueTargetCount,
            ownGuardCount,
            oppGuardCount,
            ownCornerResetCount,
            oppCornerResetCount,
            ownEdgeResetCount,
            oppEdgeResetCount,
            handCardIds,
            usableCardIds,
            usableCardIdSet,
            deckRemaining,
            keepPriorityInHandCount,
            highVarianceInHandCount,
            fastRotateInHandCount,
            stabilityInHandCount,
            edgeDiff,
            cornerDiff,
            ownAnchorResetWeight,
            oppAnchorResetWeight,
            strategicDiff,
            handPressureLevel,
            chargePressureLevel,
            mobilityPressureLevel,
            cardCyclePressure,
            openingPhase,
            midLatePhase,
            endgamePhase,
            leadStable,
            trailingHard,
            trailing,
            edgeEmergency,
            edgeControlMode,
            whiteLv6Mode,
            lowDiscEmergency,
            criticalLowDiscEmergency
        } = buildCpuPolicyCardUseState(ctx, cardId, getCardDef);
        const isCornerTimingCard = (
            isHoldCard ||
            isRecoveryCard ||
            isChargeRampCard ||
            isWorkWill ||
            isDestroyDragonWill ||
            isAnchorPlacementCard
        );

        const forcedDestroyReason = getForcedHandDestroyReason(cardId, cardType, ctx, usableCardIdSet);
        if (forcedDestroyReason) {
            return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, forcedDestroyReason);
        }
        if (isTrapWill && ownDiscs <= 20) {
            return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, 'trap_will_low_own_stones');
        }
        if (isLossWill && (ownSpecialCount > 0 || ownBombCount > 0)) {
            return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, 'loss_will_own_special');
        }
        if (isMassFreezeWill && massFreezeOpponentTargetCount <= 0) {
            return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, 'mass_freeze_no_opponent_target');
        }
        if (isSwapWithEnemy && swapEnemyNormalCornerTargetCount <= 0) {
            return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, 'swap_no_enemy_normal_corner');
        }
        if (isBoardExpansionWill) {
            const enemyCornerTargetCount = cardType === 'BOARD_EXPANSION_GOD'
                ? boardExpansionGodEnemyCornerTargetCount
                : boardExpansionWillEnemyCornerTargetCount;
            if (enemyCornerTargetCount <= 0) {
                return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, 'board_expansion_no_enemy_corner');
            }
        }
        if (cardType === 'TEMPT_WILL' && temptHighValueTargetCount <= 0) {
            return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, 'tempt_no_high_value_enemy_special');
        }
        if (isMovementCornerSwingCardType(cardType) && getMovementCornerSwingTargetCount(ctx, cardType) <= 0) {
            return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, 'movement_no_enemy_corner_swing');
        }
        let score = cardCost * 2;
        if (Object.prototype.hasOwnProperty.call(cardTypeBaseScoreBonus, cardType)) {
            score += Number((cardTypeBaseScoreBonus as Readonly<Record<string, number>>)[cardType] || 0);
        }
        if (ctx.forceUseCard) score += 1000;
        if (ctx.legalMovesCount <= 1) score += 35;

        const remainingCharge = ctx.ownCharge - cardCost;
        const reserveGap = Number.isFinite(ctx.reserveChargeFloor)
            ? Math.max(0, Number(ctx.reserveChargeFloor) - remainingCharge)
            : 0;
        const lowFlipMargin = maxLegalFlips <= 2;
        const lowGainMargin = maxLegalGain <= 2;
        const resourceTight = !ctx.forceUseCard && remainingCharge <= Math.max(6, ctx.reserveChargeFloor + 2);
        const setupBudgetTight = whiteLv6Mode && resourceTight && !cornerEmergency && !criticalLowDiscEmergency;
        if (ctx.level >= 6 && isCloneWill && cloneSplitEligibleSourceCount === 0) {
            return {
                cardId,
                cardDef,
                cardType,
                cardCost,
                score: -1000000,
                shouldUse: false,
                minUseScore: ctx.minUseScore
            };
        }
        if (isGoldStone || isRainbowStone || isSilverStone || isCrystalStone) {
            const multiplier = isRainbowStone ? 6 : (isGoldStone ? 4 : (isSilverStone ? 3 : 2));
            const extraProfit = isCrystalStone
                ? getNumberCellExtraProfit(maxLegalBoardBonus, cardCost)
                : getFlipMultiplierExtraProfit(maxLegalFlips, multiplier, cardCost);
            if (extraProfit <= 0) {
                return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, 'cpu_unprofitable_charge_roi');
            }
        }
        const highYieldChargeRecovery = (
            ((isGoldStone || isRainbowStone || isSilverStone) &&
                getFlipMultiplierExtraProfit(maxLegalFlips, isRainbowStone ? 6 : (isGoldStone ? 4 : 3), cardCost) > 0) ||
            (isCrystalStone && getNumberCellExtraProfit(maxLegalBoardBonus, cardCost) > 0)
        );
        if (!ctx.forceUseCard && reserveGap > 0) {
            let reservePenalty = reserveGap * 26;
            if (isChargeRampCard && !isWorkWill) reservePenalty *= 0.45;
            if (highYieldChargeRecovery) reservePenalty *= 0.25;
            if (isHoldCard || isRecoveryCard) reservePenalty *= 0.35;
            if (cornerEmergency && (isHoldCard || isRecoveryCard || isTimeBomb || isTimeStopGod)) reservePenalty *= 0.25;
            score -= reservePenalty;
        }

        const counterThreatHigh = (
            (Number.isFinite(ctx.oppCharge) && Number(ctx.oppCharge) >= 20) ||
            oppSpecialCount >= (ownSpecialCount + 2) ||
            (cornerEmergency && !hasCornerMoveNow)
        );
        if (
            whiteLv6Mode &&
            !ctx.forceUseCard &&
            counterThreatHigh &&
            recoveryCostGap > 0 &&
            !isRecoveryCard &&
            !isHoldCard &&
            !isChargeRampCard &&
            !highYieldChargeRecovery &&
            !isWhiteCornerSwingKeepCard
        ) {
            score -= 34;
            if (isChargeSwingCard || isTreasureBox || isRebuildWill) score -= 18;
        }

        if (ctx.discDiff >= 10) score -= 20;
        if (ctx.discDiff >= 16) score -= 15;
        if (ctx.discDiff <= -8) score += 20;
        if (ctx.discDiff <= -14) score += 20;

        if (ctx.empties <= 12) {
            if (ctx.discDiff > 0) score -= 25;
            else score += 12;
        }

        if (ctx.ownCharge <= (cardCost + 2)) score -= 8;
        if (ctx.ownCharge >= (cardCost + 10)) score += 10;
        if (ctx.ownCharge >= (cardCost + 16)) score += 12;
        if (ctx.ownCharge >= 28 && ctx.handSize >= 3 && !cornerEmergency) score += 14;
        if (ctx.handSize >= 5) score += 30;
        else if (ctx.handSize >= 4) score += 14;
        if (ctx.handSize >= 4 && cardCost <= 8 && !isHighVarianceCard) score += 10;

        if (whiteLv6Mode && !ctx.forceUseCard) {
            if (recoveryCostGap > 0 && !isRecoveryCard && !isHoldCard && !isChargeRampCard && !isWhiteCornerSwingKeepCard) {
                score -= Math.min(84, recoveryCostGap * 8);
            }
            if (recoveryCostGap > 0 && highYieldChargeRecovery) {
                score += Math.min(72, recoveryCostGap * 10);
            }
            if ((cornerEmergency || !hasCornerMoveNow) && isWhiteCornerSwingKeepCard) score += 42;
            if (!cornerEmergency && !hasCornerMoveNow && isWhiteCornerSwingKeepCard) score -= 34;
            if (lowDiscEmergency && (isSwingCard || isRecoveryCard || isHoldCard || isWhiteCornerSwingKeepCard)) score += 38;
            if (
                criticalLowDiscEmergency &&
                (
                    isRecoveryCard ||
                    isHoldCard ||
                    isEdgeContestCard ||
                    isFreePlacement ||
                    isChargeSwingCard ||
                    isChargeRampCard ||
                    isBlockadeWill ||
                    isStrongWindWill ||
                    isSwapWithEnemy ||
                    isPositionSwapWill ||
                    isTemptWill ||
                    isBoardExpansionWill ||
                    isBoardShrinkCard ||
                    isTeleportWill ||
                    isCellTeleportWill ||
                    isDestroyDragonWill ||
                    isSuperCrushWill ||
                    isWorkWill
                )
            ) score += 138;
            if ((isThrowChainCard || isChainWill) && !cornerEmergency) score -= 180;
            if (cardCyclePressure > 0 && (isStabilityCard || isChargeRampCard || isChargeSwingCard || isEdgeContestCard || isWorkWill || isDestroyDragonWill || isRebuildWill)) {
                score += cardCyclePressure * 8;
            }
            if (cardCyclePressure >= 3 && cardCost <= 10 && !isHighVarianceCard) {
                score += 18;
            }
            if (mobilityPressureLevel >= 2 && (isRecoveryCard || isHoldCard || isEdgeContestCard || isChargeSwingCard || isChargeRampCard || isWorkWill)) {
                score += 16;
            }
            if (ctx.handSize >= 4 && ctx.ownCharge >= 20 && !isHighVarianceCard) {
                score += 12;
            }
            if (ctx.handSize >= 5 && (isChargeSwingCard || isChargeRampCard || isRebuildWill)) {
                score += 18;
            }
            if (
                mobilityPressureLevel >= 2 &&
                ((maxLegalFlips >= 4 && (isGoldStone || isRainbowStone || isSilverStone)) ||
                    (maxLegalBoardBonus >= 2 && isCrystalStone) ||
                    isGluttonousWill)
            ) {
                score += 84;
            }
            if (lowDiscEmergency && highYieldChargeRecovery) {
                score += 42;
            }
            if (
                (mobilityPressureLevel >= 2 || criticalLowDiscEmergency) &&
                whiteLv6DestroyWhenAheadTypes.has(cardType) &&
                !isWhiteCornerSwingKeepCard
            ) {
                score -= 72;
            }
        }

        if (isHighVarianceCard) {
            score -= 22;
            if (ctx.discDiff >= 0) score -= 18;
            if (ctx.empties <= 18) score -= 10;
            if (ctx.discDiff <= -12) score += 14;
        }

        if (isDefensiveCard) {
            score += 12;
            if (ctx.discDiff >= 0) score += 10;
            if (ctx.empties <= 16) score += 6;
        }

        if (cardCost >= 20 && ctx.discDiff >= 0 && ctx.empties <= 20) score -= 16;
        if (cardCost <= 4 && isDefensiveCard && ctx.discDiff >= 0) score += 8;

        if (!ctx.forceUseCard) {
            if (leadStable) {
                if (isStabilityCard) score += midLatePhase ? 24 : 14;
                if (isSwingCard) score -= 24;
                if (isHighVarianceCard) score -= 10;
                if (endgamePhase && isLongHorizonCard) score -= 58;
                if (cornerDiff >= 1 && edgeDiff >= 1 && isHoldCard) score += 18;
            }

            if (trailing) {
                if (isSwingCard) score += trailingHard ? 56 : 30;
                if (isEdgeContestCard) score += edgeEmergency ? 36 : 14;
                if (isRecoveryCard && (cornerDiff < 0 || !hasCornerMoveNow)) score += 26;
                if (isStabilityCard && !cornerEmergency && !hasCornerMoveNow) score -= 14;
                if (isChargeRampCard && ctx.ownCharge <= 16 && ctx.handSize >= 3) score += 12;
            }

            if (edgeEmergency) {
                if (isEdgeContestCard) score += 30;
                if (isHoldCard && !cornerEmergency && !hasCornerMoveNow) score -= 18;
                if (isStabilityCard && !isEdgeContestCard && !cornerEmergency) score -= 24;
                if (ctx.legalMovesCount <= 2 && isEdgeContestCard) score += 16;
            } else if (edgeControlMode && ctx.discDiff >= 0) {
                if (isStabilityCard) score += 12;
                if (isSwingCard && !cornerEmergency) score -= 10;
            }

            if (openingPhase && cornerEmergency && isLongHorizonCard) score -= 20;
        }

        const style = Object.prototype.hasOwnProperty.call(cardTypeUsageStyle, cardType)
            ? cardTypeUsageStyle[cardType]
            : null;
        if (style && !ctx.forceUseCard) {
            if (leadStable) score += Number(style.leadBias || 0);
            if (trailing) score += Number(style.trailingBias || 0);
            if (openingPhase) score += Number(style.openingBias || 0);
            if (!openingPhase && !endgamePhase) score += Number(style.midLateBias || 0);
            if (endgamePhase) score += Number(style.endgameBias || 0);
            if (hasCornerMoveNow) score += Number(style.cornerNowBias || 0);
            if (cornerEmergency) score += Number(style.cornerEmergencyBias || 0);
            if (edgeEmergency) score += Number(style.edgeEmergencyBias || 0);
            if (ctx.legalMovesCount <= 2) score += Number(style.lowMobilityBias || 0);
            if (ctx.handSize >= 4) score += Number(style.handPressureBias || 0);
        }

        score = applyCpuCardScoreRules({
            isRecoveryCard,
            cornerEmergency,
            ctx,
            isHoldCard,
            hasCornerMoveNow,
            isCornerTimingCard,
            isSwingCard,
            isHighVarianceCard,
            remainingCharge,
            whiteLv6Mode,
            criticalLowDiscEmergency,
            isGuardWill,
            isGuardianGod,
            isProtectedNextStone,
            isAfterimageWill,
            isGhostWill,
            isPermaProtectNextStone,
            isRegenWill,
            isWhiteCornerSwingKeepCard,
            hasEdgeMoveNow,
            isChargeRampCard,
            isWorkWill,
            recoveryCostGap,
            highBonusMoveAvailable,
            isChargeSwingCard,
            isGoldStone,
            isRainbowStone,
            isSilverStone,
            getFlipMultiplierExtraProfit,
            maxLegalFlips,
            cardCost,
            setupBudgetTight,
            endgamePhase,
            isCrystalStone,
            getNumberCellExtraProfit,
            maxLegalBoardBonus,
            openingPhase,
            isTreasureBox,
            leadStable,
            isFreePlacement,
            isSniperWill,
            isStrongWindWill,
            trailingHard,
            trailing,
            edgeEmergency,
            edgeDiff,
            isSwapWithEnemy,
            isPositionSwapWill,
            isTemptWill,
            oppSpecialCount,
            isCloneWill,
            ownCorners,
            oppCorners,
            lowFlipMargin,
            lowGainMargin,
            isThrowChainCard,
            maxLegalGain,
            isChainWill,
            isBoardExpansionWill,
            cardType,
            isBoardShrinkCard,
            isTrapWill,
            isHeavenBlessing,
            midLatePhase,
            deckRemaining,
            cardCyclePressure,
            keepPriorityInHandCount,
            isRevealHandWill,
            oppHandSize,
            isCondemnWill,
            isExecutionWill,
            isExtendLifeCard,
            ownSpecialCount,
            isExtendLifeGod,
            isLightningWill,
            isFireWill,
            isHyperactiveWill,
            isInstantHyperactiveWill,
            isTabooReverseWill,
            isCrossBomb,
            isXBomb,
            isUltimateDestroyGod,
            isUltimateHyperactiveGod,
            isDestroyDragonWill,
            isBreedingWill,
            isTeleportWill,
            isCellTeleportWill,
            isHyperactiveInheritWill,
            isRobotVacuumWill,
            isEqualityWill,
            getEqualityWillStealableAmount,
            isReinforcementWill,
            isGluttonousWill,
            highVarianceInHandCount,
            fastRotateInHandCount,
            isExtremeHyperactiveWill,
            isSuperCrushWill,
            isBlockadeWill,
            mobilityPressureLevel,
            isMeteorWill,
            isLossWill,
            oppAnchorResetWeight,
            ownAnchorResetWeight,
            countLossWillDestroyableHandCards,
            handCardIds,
            cardId,
            oppCornerResetCount,
            ownCornerResetCount,
            ownEdgeResetCount,
            ownGuardCount,
            oppGuardCount,
            isMassFreezeWill,
            massFreezeOpponentTargetCount,
            massFreezeOwnTargetCount,
            isCorrosionWill,
            isRebuildWill,
            getCardDef,
            rebuildKeepPriorityCardTypes,
            highVarianceCardTypes,
            usableCardIds,
            isTimeBomb,
            isTimeStopGod,
            ownDiscs,
            isLastResort,
            lowDiscEmergency,
        }, score);
        score += scoreCardStoneSupplyUseAdjustment(cardType, ctx);

        return {
            cardId,
            cardDef,
            cardType,
            cardCost,
            score,
            shouldUse: score >= ctx.minUseScore,
            minUseScore: ctx.minUseScore
        };
    }

    return {
        scoreCardUseDecision
    };
}
