import type {
    CpuPolicyCardContext,
    CpuPolicyCardCostResolver,
    CpuPolicyCardDefinitionResolver,
    CpuPolicyCardId,
    CpuPolicyCardScore
} from './cpu-policy-core-types';

type CpuPolicyCardUseDecisionDeps = {
    buildCardDecisionContext: (context?: CpuPolicyCardContext) => any;
    getCpuPolicyCardTypeFlags: (cardType: unknown) => any;
    buildCpuPolicyCardUseState: (context: CpuPolicyCardContext | null | undefined, cardId: CpuPolicyCardId, getCardDef: CpuPolicyCardDefinitionResolver) => any;
    buildBlockedCardUseDecision: (cardId: CpuPolicyCardId, cardDef: unknown, cardType: string, cardCost: number, context: CpuPolicyCardContext, reason: string) => CpuPolicyCardScore;
    getForcedHandDestroyReason: (cardId: CpuPolicyCardId, cardType: string, context: CpuPolicyCardContext, usableCardIdSet: ReadonlySet<string>) => string | null | undefined;
    cardTypeBaseScoreBonus?: Readonly<Record<string, number>>;
    cardTypeUsageStyle?: Readonly<Record<string, any>>;
    highVarianceCardTypes?: ReadonlySet<string>;
    rebuildKeepPriorityCardTypes?: ReadonlySet<string>;
    whiteLv6DestroyWhenAheadTypes?: ReadonlySet<string>;
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
            isSupplyWill,
            isGoldStone,
            isCrystalStone,
            isTheoryIncarnation,
            isRainbowStone,
            isSilverStone,
            isPlunderWill,
            isTreasureBox,
            isLossWill,
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
            isHyperactiveWill,
            isInstantHyperactiveWill,
            isTabooReverseWill,
            isCrossBomb,
            isXBomb,
            isUltimateDestroyGod,
            isUltimateHyperactiveGod,
            isObserverWill,
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
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerEmergency,
            recoveryCostGap,
            highBonusMoveAvailable,
            ownDiscs,
            ownEdges,
            oppEdges,
            maxLegalFlips,
            avgLegalFlips,
            maxLegalGain,
            maxLegalBoardBonus,
            cloneSplitEligibleSourceCount,
            oppHandSize,
            ownSpecialCount,
            oppSpecialCount,
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
            lossEnemyAnchorPayoffIsModest,
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
            isObserverWill ||
            isDestroyDragonWill ||
            isAnchorPlacementCard
        );

        const forcedDestroyReason = getForcedHandDestroyReason(cardId, cardType, ctx, usableCardIdSet);
        if (forcedDestroyReason) {
            return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, forcedDestroyReason);
        }
        if (isLossWill && ownSpecialCount > 0 && lossEnemyAnchorPayoffIsModest) {
            return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, 'loss_will_own_special');
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
        const highYieldChargeRecovery = (
            ((isGoldStone || isRainbowStone || isSilverStone) &&
                maxLegalFlips >= 3 &&
                maxLegalGain >= 3) ||
            ((isCrystalStone || isTheoryIncarnation) && maxLegalBoardBonus >= 2) ||
            (isPlunderWill &&
                maxLegalFlips >= 3 &&
                maxLegalGain >= 3 &&
                Number.isFinite(ctx.oppCharge) &&
                Number(ctx.oppCharge) >= 3)
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
            if (isChargeSwingCard || isTreasureBox || isSupplyWill || isRebuildWill) score -= 18;
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
                    isObserverWill ||
                    isWorkWill
                )
            ) score += 138;
            if ((isThrowChainCard || isChainWill) && !cornerEmergency) score -= 180;
            if (cardCyclePressure > 0 && (isStabilityCard || isChargeRampCard || isChargeSwingCard || isEdgeContestCard || isWorkWill || isObserverWill || isDestroyDragonWill || isRebuildWill)) {
                score += cardCyclePressure * 8;
            }
            if (cardCyclePressure >= 3 && cardCost <= 10 && !isHighVarianceCard) {
                score += 18;
            }
            if (mobilityPressureLevel >= 2 && (isRecoveryCard || isHoldCard || isEdgeContestCard || isChargeSwingCard || isChargeRampCard || isWorkWill || isObserverWill)) {
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
                    (maxLegalBoardBonus >= 2 && (isCrystalStone || isTheoryIncarnation)) ||
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

        if (isRecoveryCard) {
            score -= 18;
            if (!cornerEmergency && !ctx.forceUseCard) score -= 75;
            if (cornerEmergency) score += 65;
        }

        if (isHoldCard) {
            if (hasCornerMoveNow) score += 110;
            if (!hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 20;
        }

        if (hasCornerMoveNow && !isHoldCard && !ctx.forceUseCard) {
            score -= 28;
            // When corner is available, strongly discourage off-plan card usage.
            if (!isCornerTimingCard) score -= 52;
            if (isSwingCard || isHighVarianceCard) score -= 34;
            if (ctx.discDiff >= 0 && remainingCharge <= (ctx.reserveChargeFloor + 4)) score -= 24;
        }
        if (hasCornerMoveNow && !ctx.forceUseCard) {
            score -= 160;
            if (whiteLv6Mode && !criticalLowDiscEmergency) {
                score -= 120;
            }
            if (isHoldCard || isGuardWill || isGuardianGod || isProtectedNextStone || isAfterimageWill || isGhostWill || isPermaProtectNextStone || isRegenWill) {
                score -= 220;
            }
        }
        if (
            !ctx.forceUseCard &&
            whiteLv6Mode &&
            !cornerEmergency &&
            remainingCharge <= Math.max(6, ctx.reserveChargeFloor + 1) &&
            !criticalLowDiscEmergency &&
            !isRecoveryCard &&
            !isWhiteCornerSwingKeepCard
        ) {
            score -= 180;
            if (isHoldCard || isGuardWill || isGuardianGod || isProtectedNextStone || isAfterimageWill || isGhostWill || isPermaProtectNextStone || isRegenWill) {
                score -= 120;
            }
        }

        if (!hasCornerMoveNow && hasEdgeMoveNow && isHoldCard) {
            score += 8;
        }

        if (isChargeRampCard && !isWorkWill) {
            if (recoveryCostGap > 0) score += Math.min(40, recoveryCostGap * 2);
            if (highBonusMoveAvailable) score += 18;
            if (highBonusMoveAvailable && ctx.ownCharge >= 18) score += 22;
            if (ctx.discDiff >= 8 && !cornerEmergency && !ctx.forceUseCard) score -= 34;
            if (hasCornerMoveNow && !ctx.forceUseCard) score -= 46;
            if (ctx.discDiff <= -10 && cornerEmergency) score += 20;
            if (ctx.handSize >= 4 && ctx.ownCharge <= 16) score += 8;
        }

        if (isChargeSwingCard) {
            score -= 10;
            if (cornerEmergency && recoveryCostGap > 0) score += 34;
            if (ctx.discDiff >= 8 && !ctx.forceUseCard) score -= 26;
            if (hasCornerMoveNow && !ctx.forceUseCard) score -= 22;
            if (ctx.handSize >= 4) score += 10;
        }

        // Charge ROI cards should be evaluated by
        // expected immediate gain from currently available legal moves.
        if (isGoldStone || isRainbowStone || isSilverStone) {
            const multiplier = isRainbowStone ? 6 : (isGoldStone ? 4 : 3);
            const gross = maxLegalGain * multiplier;
            const net = gross - cardCost;
            score -= 12;
            score += net * 6;
            if (maxLegalFlips < 3 && !ctx.forceUseCard) {
                score -= isRainbowStone ? 280 : 320;
                if (whiteLv6Mode) score -= 140;
                if (setupBudgetTight) score -= 72;
            }
            if (maxLegalGain <= 1) score -= 180;
            else if (maxLegalGain <= 2) {
                score -= 90;
                if (whiteLv6Mode && setupBudgetTight) score -= 48;
            }
            if (maxLegalFlips >= 3) score += isRainbowStone ? 148 : 112;
            if (hasCornerMoveNow) score += 22;
            if (cornerEmergency && maxLegalGain <= 2) score -= 55;
            if (endgamePhase && maxLegalGain <= 2) score -= 55;
            if (criticalLowDiscEmergency && maxLegalFlips >= 3) score += 48;
        }

        if (isCrystalStone || isTheoryIncarnation) {
            const multiplier = 2;
            const gross = maxLegalBoardBonus * multiplier;
            const net = gross - cardCost;
            score -= isTheoryIncarnation ? 8 : 18;
            score += net * 7;
            if (maxLegalBoardBonus <= 0 && !ctx.forceUseCard) {
                score -= 360;
                if (whiteLv6Mode) score -= 160;
                if (setupBudgetTight) score -= 72;
            } else if (maxLegalBoardBonus === 1) {
                score -= 180;
                if (whiteLv6Mode && setupBudgetTight) score -= 48;
            } else if (maxLegalBoardBonus === 2) {
                score -= 260;
                if (whiteLv6Mode) score -= 60;
                if (cornerEmergency) score -= 48;
                if (openingPhase) score -= 24;
            } else if (maxLegalBoardBonus >= 3) {
                score += 132;
            } else {
                score += 72;
            }
            if (highBonusMoveAvailable) score += 24;
            if (cornerEmergency && maxLegalBoardBonus <= 1) score -= 55;
            if (endgamePhase && maxLegalBoardBonus <= 1) score -= 45;
            if (criticalLowDiscEmergency && maxLegalBoardBonus >= 2) score += 42;
            if (isTheoryIncarnation && !endgamePhase) score += 80;
        }

        if (isPlunderWill) {
            const siphon = Math.min(Math.max(0, Math.floor(ctx.oppCharge || 0)), maxLegalFlips);
            score -= 8;
            score += (siphon - cardCost) * 8;
            if (avgLegalFlips >= 2.5) score += 10;
            if (maxLegalFlips < 3 && !ctx.forceUseCard) {
                score -= 240;
                if (whiteLv6Mode) score -= 150;
                if (setupBudgetTight) score -= 72;
            }
            if (siphon <= 1) score -= 120;
            else if (siphon <= 2) {
                score -= 70;
                if (whiteLv6Mode && setupBudgetTight) score -= 54;
            }
            if (siphon >= 3) score += 44;
            if (cornerEmergency && siphon <= 2) score -= 30;
        }

        if (isTreasureBox) {
            score += 12;
            if (ctx.ownCharge <= 8) score += 16;
            if (ctx.handSize >= 4) score += 8;
            if (leadStable && hasCornerMoveNow && !ctx.forceUseCard) score -= 6;
        }

        if (isSupplyWill) {
            score += 10;
            if (ctx.handSize <= 1) score += 90;
            else if (ctx.handSize === 2) score += 72;
            else if (ctx.handSize === 3) score += 34;
            else if (ctx.handSize >= 5) score -= 150;
            else if (ctx.handSize >= 4) score -= 26;

            if (usableCardIds.length <= 1 && ctx.handSize <= 3) score += 18;
            if (openingPhase) score += 22;
            if (midLatePhase) score += 8;
            if (endgamePhase) score -= 80;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 26;
            if (leadStable && ctx.handSize >= 4 && !ctx.forceUseCard) score -= 18;
            if (cardCyclePressure >= 2 && ctx.handSize <= 3) score += 18;

            if (deckRemaining !== null) {
                if (deckRemaining <= 1) score -= 180;
                else if (deckRemaining <= 2) score -= 96;
                else if (deckRemaining <= 4) score -= 28;
                else if (deckRemaining >= 8 && ctx.handSize <= 2) score += 16;
            }
        }

        // FREE_PLACEMENT is strongest when legal mobility is poor and corner access is denied.
        if (isFreePlacement) {
            score -= 20;
            if (ctx.legalMovesCount <= 1) score += 95;
            if (!hasCornerMoveNow && cornerEmergency) score += 75;
            if (hasCornerMoveNow && !ctx.forceUseCard) score -= 80;
            if (ctx.discDiff >= 6 && !ctx.forceUseCard) score -= 55;
        }

        // SNIPER_WILL is long-horizon: prefer stable deployment (corner/edge) and avoid panic waste.
        if (isSniperWill) {
            score -= 30;
            if (hasCornerMoveNow) score += 90;
            else if (hasEdgeMoveNow) score += 35;
            else score -= 95;
            if (ctx.empties <= 16) score -= 55;
            if (ctx.discDiff >= 8 && !ctx.forceUseCard) score -= 45;
        }

        if (isStrongWindWill) {
            score -= 12;
            if (cornerEmergency) score += 54;
            if (trailingHard) score += 68;
            else if (trailing) score += 30;
            if (edgeEmergency) score += 26;
            if (ctx.legalMovesCount <= 1 && edgeDiff < 0 && hasEdgeMoveNow && !cornerEmergency) score += 18;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 46;
            if (leadStable && !ctx.forceUseCard) score -= 78;
            if (endgamePhase && leadStable) score -= 28;
        }

        if (isSwapWithEnemy || isPositionSwapWill) {
            score -= isPositionSwapWill ? 16 : 10;
            if (cornerEmergency) score += isPositionSwapWill ? 62 : 54;
            if (trailingHard) score += isPositionSwapWill ? 78 : 62;
            else if (trailing) score += isPositionSwapWill ? 34 : 26;
            if (edgeEmergency) score += 26;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 42;
            if (leadStable && !ctx.forceUseCard) score -= isPositionSwapWill ? 86 : 72;
            if (endgamePhase && leadStable) score -= 30;
        }

        if (isTemptWill) {
            score -= 8;
            if (cornerEmergency) score += 42;
            if (trailingHard) score += 58;
            else if (trailing) score += 24;
            if (edgeEmergency) score += 18;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 38;
            if (leadStable && !ctx.forceUseCard) score -= 62;
            if (endgamePhase && leadStable) score -= 26;
            if (oppSpecialCount <= 0) score -= 180;
            else if (oppSpecialCount <= 1 && !cornerEmergency) score -= 42;
        }

        if (isCloneWill) {
            score -= 42;
            if (ctx.discDiff >= 6 && ownCorners >= oppCorners && maxLegalFlips >= 3 && !setupBudgetTight) score += 35;
            if (cornerEmergency && !ctx.forceUseCard) score -= 70;
            if (ctx.empties <= 14) score -= 45;
            if (lowFlipMargin && !ctx.forceUseCard) score -= 88;
            if (lowGainMargin && !cornerEmergency) score -= 42;
            if (setupBudgetTight) score -= 84;
            if (ctx.handSize <= 2 && !trailingHard) score -= 46;
            if (!hasCornerMoveNow && !hasEdgeMoveNow && !cornerEmergency) score -= 30;
            if (leadStable && !cornerEmergency && !ctx.forceUseCard && lowFlipMargin) score -= 36;
        }

        if (isThrowChainCard) {
            score -= 26;
            if (trailingHard || cornerEmergency) score += 84;
            else if (trailing) score += 32;
            if (ctx.legalMovesCount <= 2) score += 18;
            if (ctx.handSize >= 4) score += 14;
            if (ctx.ownCharge < 70 && !cornerEmergency && !trailingHard) score -= 120;
            if (ctx.ownCharge >= 70 && (ctx.discDiff >= 0 || endgamePhase)) score += 46;
            if (maxLegalGain <= 3 && !cornerEmergency) score -= 34;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 54;
            if (leadStable && !ctx.forceUseCard) score -= 108;
            if (endgamePhase) score -= 66;
        }

        if (isChainWill) {
            score -= 20;
            if (trailingHard || cornerEmergency) score += 76;
            else if (trailing) score += 34;
            if (ctx.legalMovesCount <= 2) score += 26;
            if (maxLegalFlips >= 4) score += 18;
            if (ctx.ownCharge < 70 && !cornerEmergency && !trailingHard) score -= 104;
            if (ctx.ownCharge >= 70 && (ctx.discDiff >= 0 || endgamePhase)) score += 40;
            if (maxLegalGain <= 3 && maxLegalFlips <= 3 && !cornerEmergency) score -= 42;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 52;
            if (leadStable && !ctx.forceUseCard) score -= 96;
            if (endgamePhase) score -= 58;
        }

        if (isBoardExpansionWill) {
            score -= cardType === 'BOARD_EXPANSION_GOD' ? 58 : 42;
            if (ctx.handSize >= 4) score += 18;
            if (ctx.ownCharge >= 28) score += 12;
            if (ctx.legalMovesCount <= 2) score += 14;
            if (cornerEmergency && ctx.discDiff <= -8) score += 96;
            if (ctx.discDiff >= 0 && !ctx.forceUseCard) score -= 86;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 30;
            if (ctx.empties <= 18) score -= cardType === 'BOARD_EXPANSION_GOD' ? 72 : 48;
        }

        if (isBoardShrinkCard) {
            score -= cardType === 'BOARD_SHRINK_GOD' ? 82 : 56;
            if (cornerEmergency) score += cardType === 'BOARD_SHRINK_GOD' ? 126 : 92;
            if (trailingHard) score += cardType === 'BOARD_SHRINK_GOD' ? 144 : 108;
            else if (trailing) score += cardType === 'BOARD_SHRINK_GOD' ? 62 : 38;
            if (edgeEmergency) score += 34;
            if (leadStable && !ctx.forceUseCard) score -= cardType === 'BOARD_SHRINK_GOD' ? 190 : 150;
            if (ctx.discDiff >= 0 && !cornerEmergency && !ctx.forceUseCard) score -= 88;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 42;
            if (endgamePhase && leadStable) score -= 64;
            if (ctx.ownCharge <= (cardCost + 8) && !ctx.forceUseCard) score -= 76;
        }

        if (isTrapWill) {
            score += 8;
            if (cornerEmergency || ctx.discDiff <= -6) score += 35;
            if (ctx.discDiff >= 10 && !ctx.forceUseCard) score -= 35;
            if (hasCornerMoveNow && !ctx.forceUseCard) score -= 18;
            if (!cornerEmergency && !edgeEmergency && ctx.discDiff >= 0 && !ctx.forceUseCard) score -= 84;
            if (endgamePhase && !cornerEmergency) score -= 32;
        }

        if (isHeavenBlessing) {
            score += 20;
            if (openingPhase) score += 34;
            if (midLatePhase && !endgamePhase) score += 12;
            if (endgamePhase) score -= 150;
            if (ctx.handSize >= 5) score -= 220;
            else if (ctx.handSize >= 4) score -= 90;
            else if (ctx.handSize <= 2) score += 32;
            if (deckRemaining != null) {
                if (deckRemaining <= 2) score -= 140;
                else if (deckRemaining <= 4) score -= 48;
                else if (deckRemaining >= 8 && ctx.handSize <= 2) score += 18;
            }
            if (cornerEmergency && recoveryCostGap > 0) score += 26;
            if (cardCyclePressure >= 2 && ctx.handSize <= 3) score += 20;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 22;
            if (keepPriorityInHandCount >= 2) score -= 18;
        }

        if (isRevealHandWill) {
            score += 10 + (oppHandSize * 8);
            if (oppHandSize >= 4) score += 24;
            else if (oppHandSize <= 1) score -= 110;
            else if (oppHandSize <= 2 && !cornerEmergency) score -= 28;
            if (openingPhase) score += 18;
            if (midLatePhase && !endgamePhase) score += 10;
            if (cornerEmergency || trailingHard) score += 18;
            else if (trailing) score += 8;
            if (leadStable && oppHandSize <= 2 && !ctx.forceUseCard) score -= 24;
            if (hasCornerMoveNow && !cornerEmergency && oppHandSize <= 2 && !ctx.forceUseCard) score -= 14;
            if (ctx.handSize >= 4) score += 4;
            if (endgamePhase) score -= 44;
        }

        if (isCondemnWill) {
            score += 8 + (oppHandSize * 14);
            if (oppHandSize >= 4) score += 38;
            else if (oppHandSize <= 1) score -= 120;
            else if (oppHandSize <= 2 && !cornerEmergency) score -= 38;
            if (cornerEmergency || trailingHard) score += 34;
            else if (trailing) score += 14;
            if (leadStable && oppHandSize <= 2 && !ctx.forceUseCard) score -= 34;
            if (hasCornerMoveNow && !cornerEmergency && oppHandSize <= 2 && !ctx.forceUseCard) score -= 18;
            if (ctx.handSize >= 4) score += 8;
            if (endgamePhase && oppHandSize <= 1) score -= 30;
        }

        if (isExecutionWill) {
            score += 16 + (oppHandSize * 18);
            if (oppHandSize >= 4) score += 30;
            else if (oppHandSize <= 1) score -= 96;
            else if (oppHandSize <= 2 && !cornerEmergency) score -= 24;
            if (cornerEmergency || trailingHard) score += 30;
            else if (trailing) score += 16;
            if (leadStable && oppHandSize <= 2 && !ctx.forceUseCard) score -= 24;
            if (hasCornerMoveNow && !cornerEmergency && oppHandSize <= 2 && !ctx.forceUseCard) score -= 12;
            if (ctx.handSize >= 4) score += 6;
            if (endgamePhase && oppHandSize <= 1) score -= 20;
        }

        if (isExtendLifeCard) {
            score += 16 + (ownSpecialCount * 12);
            if (ctx.empties >= 22 && ctx.empties <= 42) score += 12;
            if (midLatePhase) score += 8;
            if (endgamePhase) score -= 72;
            if (hasCornerMoveNow) score += 36;
            else if (hasEdgeMoveNow) score += 16;
            if (leadStable) score += 18;
            if (cornerEmergency && !hasCornerMoveNow) score -= 34;
            if (ownSpecialCount <= 1 && endgamePhase) score -= 28;
            if (isExtendLifeGod) {
                score += 28 + (ownSpecialCount * 10);
                if (midLatePhase) score += 8;
                if (endgamePhase) score -= 36;
                if (leadStable) score += 12;
            }
        }

        if (isProtectedNextStone || isAfterimageWill || isGhostWill || isPermaProtectNextStone || isGuardWill || isGuardianGod || isRegenWill) {
            score += 10;
            if (hasCornerMoveNow) score += 70;
            else if (hasEdgeMoveNow) score += 26;
            else if (!ctx.forceUseCard) score -= 62;
            if (cornerEmergency && !hasCornerMoveNow) score -= 36;
            if (leadStable && (hasCornerMoveNow || hasEdgeMoveNow)) score += 20;
            if (endgamePhase && !hasCornerMoveNow && !hasEdgeMoveNow) score -= 42;
        }

        if (isLightningWill) {
            score -= 26;
            if (hasCornerMoveNow) score += 120;
            else if (hasEdgeMoveNow) score += 36;
            else score -= 140;
            if (cornerEmergency && !hasCornerMoveNow) score -= 54;
            if (trailingHard) score += 42;
            else if (trailing) score += 16;
            if (leadStable && !cornerEmergency && !ctx.forceUseCard) score -= 90;
            if (endgamePhase) score -= 96;
        }

        if (isHyperactiveWill || isInstantHyperactiveWill) {
            score -= isInstantHyperactiveWill ? 56 : 34;
            if (trailingHard || cornerEmergency) score += isInstantHyperactiveWill ? 86 : 58;
            else if (trailing) score += isInstantHyperactiveWill ? 28 : 20;
            if (hasCornerMoveNow && !cornerEmergency) score += 16;
            if (leadStable && !ctx.forceUseCard) score -= isInstantHyperactiveWill ? 132 : 88;
            if (endgamePhase) score -= isInstantHyperactiveWill ? 90 : 62;
        }

        if (isTabooReverseWill) {
            score -= 110;
            if (hasCornerMoveNow) score += 168;
            if (cornerEmergency) score += 92;
            if (trailingHard) score += 78;
            else if (trailing) score += 30;
            if (leadStable && !cornerEmergency && !ctx.forceUseCard) score -= 180;
            if (endgamePhase && ctx.discDiff >= 0) score -= 120;
            if (ctx.ownCharge <= (cardCost + 6) && !ctx.forceUseCard) score -= 75;
            if (ctx.legalMovesCount <= 1) score += 32;
        }

        if (isCrossBomb || isXBomb) {
            score -= 36;
            if (trailingHard || cornerEmergency) score += 76;
            else if (trailing) score += 24;
            if (edgeEmergency) score += 20;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 36;
            if (leadStable && !ctx.forceUseCard) score -= 96;
            if (endgamePhase) score -= 82;
        }

        if (isUltimateDestroyGod) {
            score -= 64;
            if (hasCornerMoveNow) score += 132;
            else if (hasEdgeMoveNow) score += 44;
            else score -= 66;
            if (trailingHard) score += 96;
            else if (trailing) score += 38;
            if (cornerEmergency && !hasCornerMoveNow) score -= 24;
            if (leadStable && !cornerEmergency && !ctx.forceUseCard) score -= 110;
            if (endgamePhase) score -= 95;
        }

        if (isUltimateHyperactiveGod) {
            score -= 96;
            if (trailingHard) score += 136;
            else if (trailing) score += 52;
            if (cornerEmergency) score += 34;
            if (hasCornerMoveNow && !cornerEmergency) score += 18;
            if (leadStable && !ctx.forceUseCard) score -= 188;
            if (endgamePhase) score -= 190;
            if (ctx.ownCharge <= (cardCost + 10) && !ctx.forceUseCard) score -= 46;
        }

        if (isObserverWill) {
            score -= 8;
            if (openingPhase) score += 44;
            if (midLatePhase) score += 18;
            if (endgamePhase) score -= 64;
            if (hasCornerMoveNow) score += 28;
            else if (hasEdgeMoveNow) score += 18;
            else score -= 18;
            if (cornerEmergency && !hasCornerMoveNow) score -= 42;
            if (leadStable && (hasCornerMoveNow || hasEdgeMoveNow)) score += 16;
            if (ctx.handSize >= 4 && cardCyclePressure >= 1) score += 8;
        }

        if (isDestroyDragonWill) {
            score -= 10;
            if (hasCornerMoveNow) score += 110;
            else if (hasEdgeMoveNow) score += 54;
            else score -= 58;
            if (cornerEmergency && !hasCornerMoveNow) score -= 42;
            if (ctx.discDiff <= -8) score += 34;
            if (ctx.empties <= 12) score -= 62;
            if (leadStable && hasCornerMoveNow) score += 28;
            if (leadStable && !hasCornerMoveNow && !hasEdgeMoveNow) score -= 26;
        }

        if (isBreedingWill) {
            score -= 24;
            if (openingPhase) score += 30;
            if (midLatePhase && !endgamePhase) score += 18;
            if (hasCornerMoveNow) score += 42;
            else if (hasEdgeMoveNow) score += 18;
            else score -= 28;
            if (cornerEmergency && !hasCornerMoveNow) score -= 44;
            if (trailingHard) score += 28;
            else if (trailing) score += 12;
            if (leadStable && !ctx.forceUseCard) score -= 42;
            if (endgamePhase) score -= 104;
        }

        if (isTeleportWill) {
            score -= 22;
            if (cornerEmergency || trailingHard) score += 110;
            else if (trailing) score += 34;
            if (oppCorners > ownCorners) score += 42;
            if (leadStable && oppCorners <= ownCorners && !ctx.forceUseCard) score -= 120;
            if (endgamePhase) score -= 48;
            if (hasCornerMoveNow && oppCorners <= ownCorners && !cornerEmergency && !ctx.forceUseCard) score -= 30;
        }

        if (isCellTeleportWill) {
            score -= 58;
            if (cornerEmergency || trailingHard) score += 96;
            else if (trailing) score += 34;
            if (leadStable && !ctx.forceUseCard) score -= 112;
            if (endgamePhase) score -= 62;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 36;
        }

        if (isHyperactiveInheritWill) {
            score -= 26;
            if (openingPhase) score += 24;
            if (midLatePhase) score += 10;
            if (endgamePhase) score -= 70;
            if (trailing) score += 20;
            if (leadStable && !ctx.forceUseCard) score -= 38;
            if (hasCornerMoveNow) score += 12;
        }

        if (isRobotVacuumWill) {
            score -= 24;
            if (ctx.empties >= 20 && ctx.empties <= 46) score += 24;
            if (ctx.empties <= 12) score -= 65;
            if (hasCornerMoveNow) score += 40;
            else if (hasEdgeMoveNow) score += 18;
            if (cornerEmergency && !hasCornerMoveNow) score -= 26;
            if (trailing) score += 18;
        }

        if (isEqualityWill) {
            score -= 24;
            if (ctx.discDiff <= -10) score += 52;
            else if (!ctx.forceUseCard) score -= 120;
            if (ctx.discDiff <= -14) score += 24;
            if (lowDiscEmergency) score += 18;
            if (criticalLowDiscEmergency) score += 24;
            if (ctx.empties <= 12) score -= 42;
            else if (ctx.empties <= 18) score -= 16;
        }

        if (isReinforcementWill) {
            score -= 6;
            if (cornerEmergency || ctx.discDiff <= -8) score += 36;
            if (ctx.discDiff <= -12) score += 18;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 46;
            if (ctx.discDiff >= 6 && !cornerEmergency && !ctx.forceUseCard) score -= 60;
            if (endgamePhase && ctx.discDiff >= 0) score -= 42;
            if (ctx.legalMovesCount <= 1) score += 18;
        }

        if (isGluttonousWill) {
            score -= 42;
            if (hasCornerMoveNow) score += 78;
            else if (hasEdgeMoveNow) score += 30;
            else score -= 48;
            if (maxLegalFlips < 4 && !ctx.forceUseCard) score -= 260;
            if (whiteLv6Mode && maxLegalFlips < 4 && !ctx.forceUseCard) score -= 60;
            if (maxLegalFlips >= 4) score += 108;
            if (cornerEmergency && !hasCornerMoveNow) score += 40;
            if (trailingHard) score += 52;
            else if (trailing) score += 24;
            if (leadStable && !ctx.forceUseCard) score -= 72;
            if (endgamePhase) score -= 92;
            if (keepPriorityInHandCount >= 2) score -= 80;
            if (highVarianceInHandCount >= 2 || fastRotateInHandCount >= 2) score += 20;
            if (ctx.handSize <= 2) score -= 46;
            if (criticalLowDiscEmergency && maxLegalFlips >= 4) score += 52;
        }

        if (isExtremeHyperactiveWill) {
            score -= 62;
            if (openingPhase) score += 20;
            if (midLatePhase && !endgamePhase) score += 12;
            if (hasCornerMoveNow) score += 62;
            else if (hasEdgeMoveNow) score += 24;
            else score -= 42;
            if (trailingHard) score += 118;
            else if (trailing) score += 46;
            if (cornerEmergency && !hasCornerMoveNow) score += 24;
            if (leadStable && !ctx.forceUseCard) score -= 140;
            if (endgamePhase) score -= 168;
            if (ctx.ownCharge <= (cardCost + 8) && !ctx.forceUseCard) score -= 44;
        }

        if (isSuperCrushWill) {
            score -= 42;
            if (cornerEmergency || trailingHard) score += 96;
            else if (trailing) score += 34;
            if (edgeEmergency) score += 26;
            if (openingPhase && !cornerEmergency && edgeDiff >= -1 && maxLegalFlips <= 2 && maxLegalGain <= 2) score -= 140;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 48;
            if (leadStable && !ctx.forceUseCard) score -= 108;
            if (endgamePhase) score -= 78;
        }

        if (isBlockadeWill) {
            score += 12;
            if (mobilityPressureLevel >= 2) score += 54;
            else if (mobilityPressureLevel >= 1) score += 22;
            if (cornerEmergency) score += 42;
            if (edgeEmergency) score += 20;
            if (leadStable && ctx.legalMovesCount >= 4 && !cornerEmergency) score -= 24;
            if (openingPhase && ctx.legalMovesCount >= 4 && !cornerEmergency) score -= 18;
            if (endgamePhase) score += 18;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 20;
        }

        if (isObserverWill) {
            score -= 24;
            if (hasCornerMoveNow) score += 150;
            else if (hasEdgeMoveNow) score += 48;
            else score -= 170;
            if (!hasCornerMoveNow && !hasEdgeMoveNow && !ctx.forceUseCard) score -= 90;
            if (cornerEmergency && !hasCornerMoveNow) score -= 52;
            if (leadStable && !ctx.forceUseCard) score += 16;
            if (endgamePhase) score -= 82;
            if (criticalLowDiscEmergency && (hasCornerMoveNow || hasEdgeMoveNow)) score += 54;
        }

        if (isMeteorWill || isBoardShrinkCard) {
            score -= cardType === 'BOARD_SHRINK_GOD' ? 86 : (cardType === 'BOARD_SHRINK_WILL' ? 72 : 64);
            if (cornerEmergency) score += cardType === 'BOARD_SHRINK_GOD' ? 144 : (cardType === 'BOARD_SHRINK_WILL' ? 128 : 120);
            if (trailingHard) score += cardType === 'BOARD_SHRINK_GOD' ? 176 : (cardType === 'BOARD_SHRINK_WILL' ? 160 : 150);
            else if (trailing) score += cardType === 'BOARD_SHRINK_GOD' ? 70 : (cardType === 'BOARD_SHRINK_WILL' ? 60 : 54);
            if (edgeEmergency) score += cardType === 'BOARD_SHRINK_GOD' ? 56 : 42;
            if (leadStable && !ctx.forceUseCard) score -= cardType === 'BOARD_SHRINK_GOD' ? 220 : (cardType === 'BOARD_SHRINK_WILL' ? 196 : 180);
            if (ctx.discDiff >= 0 && !cornerEmergency && !ctx.forceUseCard) score -= cardType === 'BOARD_SHRINK_GOD' ? 96 : 72;
            if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= cardType === 'BOARD_SHRINK_GOD' ? 60 : 42;
            if (endgamePhase && leadStable) score -= cardType === 'BOARD_SHRINK_GOD' ? 84 : 60;
            if (ctx.ownCharge <= (cardCost + 6) && !ctx.forceUseCard) score -= cardType === 'BOARD_SHRINK_GOD' ? 90 : 70;
            if (ctx.meteorBestCornerSwing > 0) score += Math.min(180, ctx.meteorBestCornerSwing * 75);
            if (ctx.meteorBestDestroyValue > 0) score += Math.min(220, ctx.meteorBestDestroyValue * 0.22);
            const meteorHasGoodTarget = (
                ctx.meteorHasCornerPromotion === true ||
                ctx.meteorHasHighValueDestroy === true ||
                ctx.meteorBestCornerSwing > 0 ||
                ctx.meteorBestDestroyValue >= 320
            );
            if (!highBonusMoveAvailable && !meteorHasGoodTarget) {
                if (cornerEmergency && !hasCornerMoveNow && !hasEdgeMoveNow) {
                    score -= ctx.forceUseCard ? 920 : 220;
                } else if (!ctx.forceUseCard) {
                    score -= 90;
                }
            }
        }

        // In stable lead, avoid spending swing/high-variance cards unless emergency.
        if (!ctx.forceUseCard && leadStable && !cornerEmergency) {
            if (isSwingCard) score -= 28;
            if (isHighVarianceCard) score -= 20;
            if (isChargeSwingCard && hasCornerMoveNow) score -= 26;
        }

        if (isLossWill) {
            const specialDiff = oppSpecialCount - ownSpecialCount;
            const anchorResetDiff = oppAnchorResetWeight - ownAnchorResetWeight;
            score -= 38;
            score += specialDiff * 52;
            score += anchorResetDiff * 44;
            if (oppSpecialCount <= 0 && ownSpecialCount <= 0) score -= 180;
            if (oppSpecialCount <= 0) score -= 90;
            if (specialDiff >= 2) score += 70;
            if (specialDiff <= -1) score -= 210;
            if (oppCornerResetCount > 0) score += (oppCornerResetCount * 56);
            if (ownCornerResetCount > 0) score -= (ownCornerResetCount * 150);
            if (ownEdgeResetCount > 0) score -= (ownEdgeResetCount * 48);
            if (cornerEmergency && oppSpecialCount > 0) score += 28;
            if (!ctx.forceUseCard && !cornerEmergency && ownAnchorResetWeight > 0 && anchorResetDiff <= 0) score -= 180;
            if (!ctx.forceUseCard && ownCornerResetCount > 0 && oppCornerResetCount < ownCornerResetCount) score -= 220;
            if (
                !ctx.forceUseCard &&
                ownAnchorResetWeight > 0 &&
                specialDiff <= 2 &&
                oppAnchorResetWeight <= ownAnchorResetWeight
            ) {
                score -= 110;
            }
            if (leadStable && specialDiff <= 0) score -= 45;
            if (endgamePhase && specialDiff <= 1) score -= 30;
            if (ownGuardCount > 0 && oppGuardCount <= ownGuardCount) score -= 20;
        }

        if (isCorrosionWill) {
            const specialDiff = oppSpecialCount - ownSpecialCount;
            score -= 26;
            score += specialDiff * 34;
            if (oppSpecialCount <= 0 && ownSpecialCount <= 0) score -= 160;
            if (oppSpecialCount <= 0) score -= 72;
            if (specialDiff >= 2) score += 48;
            if (specialDiff <= -1) score -= 165;
            if (cornerEmergency && oppSpecialCount > 0) score += 20;
            if (leadStable && specialDiff <= 0) score -= 34;
            if (endgamePhase && specialDiff <= 1) score -= 26;
            if (ownGuardCount > oppGuardCount) score -= 16;
        }

        if (isRebuildWill) {
            let keepPriorityCount = 0;
            let highVarianceInHandCount = 0;
            for (const handId of handCardIds) {
                if (!handId || handId === cardId) continue;
                const handDef = typeof getCardDef === 'function' ? (getCardDef(handId) || null) : null;
                const handType = handDef && typeof handDef.type === 'string' ? handDef.type : '';
                if (!handType) continue;
                if (rebuildKeepPriorityCardTypes.has(handType)) keepPriorityCount += 1;
                if (highVarianceCardTypes.has(handType) || handType === 'TIME_BOMB') {
                    highVarianceInHandCount += 1;
                }
            }

            const usableCount = usableCardIds.length;
            const unusableCount = Math.max(0, ctx.handSize - usableCount);

            score -= 95;
            if (ctx.handSize >= 4) score += 95;
            if (ctx.handSize >= 5) score += 30;
            if (unusableCount >= 2) score += 55;
            if (unusableCount >= 3) score += 30;
            if (highVarianceInHandCount >= 2) score += 35;

            if (ctx.handSize <= 2) score -= 130;
            if (keepPriorityCount >= 1) score -= 70;
            if (keepPriorityCount >= 2) score -= 80;
            if (cornerEmergency && keepPriorityCount >= 1) score -= 90;

            if (ctx.discDiff >= 8 && !ctx.forceUseCard) score -= 45;
            if (ctx.discDiff <= -10 && ctx.handSize >= 4 && keepPriorityCount === 0) score += 24;

            if (deckRemaining !== null) {
                if (deckRemaining <= 1) score -= 180;
                else if (deckRemaining <= 2) score -= 95;
                else if (deckRemaining <= 3) score -= 45;
                else if (deckRemaining >= 8 && ctx.handSize >= 4) score += 12;
            }
        }

        // WORK_WILL is a long-horizon card. Prefer using it only when we can anchor
        // the next stone on stable cells (corner/edge), and avoid it in emergency.
        if (isWorkWill) {
            score -= 30;
            if (cornerEmergency && !ctx.forceUseCard) score -= 120;
            if (hasCornerMoveNow) score += 180;
            else if (hasEdgeMoveNow) score += 40;
            else score -= 220;
            if (!hasCornerMoveNow && !hasEdgeMoveNow && !ctx.forceUseCard) score -= 80;
            if (ctx.discDiff >= 8 && !ctx.forceUseCard) score -= 90;
            if (ctx.empties <= 14) score -= 120;
            if (highBonusMoveAvailable) score += 12;
            if (highBonusMoveAvailable && ctx.ownCharge >= 20) score += 40;
            if (whiteLv6Mode && !hasCornerMoveNow && !hasEdgeMoveNow) score -= 55;
            if (criticalLowDiscEmergency && (hasCornerMoveNow || hasEdgeMoveNow)) score += 64;
        }

        // TIME_BOMB is a comeback tool. Avoid reckless usage while ahead.
        if (isTimeBomb) {
            score -= 15;
            if (cornerEmergency || ctx.discDiff <= -8) score += 95;
            if (ctx.discDiff <= -14) score += 40;
            if (ctx.discDiff >= 8 && !cornerEmergency && !ctx.forceUseCard) score -= 140;
            if (ctx.discDiff >= 12 && !ctx.forceUseCard) score -= 80;
            if (hasCornerMoveNow && ctx.discDiff >= 0 && !ctx.forceUseCard) score -= 55;
            if (ownCorners > oppCorners && !cornerEmergency && !ctx.forceUseCard) score -= 65;
            if (ctx.empties <= 10 && ctx.discDiff > 0) score -= 45;
            if (whiteLv6Mode && leadStable && !cornerEmergency) score -= 120;
        }

        if (isTimeStopGod) {
            score -= 55;
            if (cornerEmergency || ctx.discDiff <= -8) score += 105;
            if (ctx.discDiff <= -14) score += 35;
            if (ctx.discDiff >= 6 && !cornerEmergency && !ctx.forceUseCard) score -= 150;
            if (ctx.discDiff >= 10 && !ctx.forceUseCard) score -= 80;
            if (hasCornerMoveNow && ctx.discDiff >= 0 && !ctx.forceUseCard) score -= 65;
            if (ownCorners > oppCorners && !cornerEmergency && !ctx.forceUseCard) score -= 80;
            if (ctx.empties <= 12 && !ctx.forceUseCard) score -= 110;
            if (ownDiscs <= 6 && !ctx.forceUseCard) score -= 220;
            if (whiteLv6Mode && leadStable && !cornerEmergency) score -= 160;
        }


        if (whiteLv6Mode && isLastResort && !ctx.forceUseCard) {
            if (ctx.legalMovesCount > 0) score -= 420;
            if (ctx.legalMovesCount > 0 && ctx.handSize >= 4) score -= 180;
            if (ctx.discDiff >= 0) score -= 420;
            if (leadStable && !cornerEmergency) score -= 110;
        }

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
