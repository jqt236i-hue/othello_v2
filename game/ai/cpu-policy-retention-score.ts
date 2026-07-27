type CpuPolicyRetentionContext = {
    [key: string]: unknown;
    discDiff: number;
    empties: number;
    legalMovesCount: number;
    handSize: number;
    ownCharge: number;
    oppCharge?: number;
    ownDiscs?: number;
    deckRemaining?: number | null;
    forceUseCard?: boolean;
};

type CpuPolicyRetentionState = {
    ownCorners: number;
    oppCorners: number;
    hasCornerMoveNow: boolean;
    hasEdgeMoveNow: boolean;
    cornerEmergency: boolean;
    whiteLv6Mode: boolean;
    recoveryCostGap: number;
    maxLegalFlips: number;
    maxLegalGain: number;
    maxLegalBoardBonus: number;
    highBonusMoveAvailable: boolean;
    oppHandSize: number;
    ownSpecialCount: number;
    oppSpecialCount: number;
    ownCornerResetCount: number;
    oppCornerResetCount: number;
    ownEdgeResetCount: number;
    oppEdgeResetCount: number;
    ownAnchorResetWeight: number;
    oppAnchorResetWeight: number;
};

type CpuPolicyRetentionFlags = {
    cardType: string;
    isRecoveryCard: boolean;
    isHoldCard: boolean;
    isChargeRampCard: boolean;
    isWorkWill: boolean;
    isTimeBomb: boolean;
    isTimeStopGod: boolean;
    isLastResort: boolean;
    isEqualityWill: boolean;
    isReinforcementWill: boolean;
    isHeavenBlessing: boolean;
    isRevealHandWill: boolean;
    isCondemnWill: boolean;
    isExecutionWill: boolean;
    isProtectedNextStone: boolean;
    isAfterimageWill: boolean;
    isGhostWill: boolean;
    isPermaProtectNextStone: boolean;
    isGuardWill: boolean;
    isGuardianGod: boolean;
    isRegenWill: boolean;
    isLightningWill: boolean;
    isFireWill: boolean;
    isHyperactiveWill: boolean;
    isInstantHyperactiveWill: boolean;
    isTabooReverseWill: boolean;
    isCrossBomb: boolean;
    isXBomb: boolean;
    isUltimateDestroyGod: boolean;
    isUltimateHyperactiveGod: boolean;
    isThrowChainCard: boolean;
    isChainWill: boolean;
    isGoldStone: boolean;
    isCrystalStone: boolean;
    isRainbowStone: boolean;
    isSilverStone: boolean;
    isLossWill: boolean;
    isCorrosionWill: boolean;
    isTrapWill: boolean;
    isTemptWill: boolean;
    isExtendLifeWill: boolean;
    isExtendLifeGod: boolean;
    isExtendLifeCard: boolean;
    isBlockadeWill: boolean;
    isMeteorWill: boolean;
    isBoardShrinkCard: boolean;
    isDestroyDragonWill: boolean;
    isGluttonousWill: boolean;
    isTeleportWill: boolean;
    isCellTeleportWill: boolean;
    isSuperCrushWill: boolean;
    isDefensiveCard: boolean;
    isHighVarianceCard: boolean;
};

type CpuPolicyRetentionScoreParams = {
    ctx: CpuPolicyRetentionContext;
    state: CpuPolicyRetentionState;
    flags: CpuPolicyRetentionFlags;
    cardCost: number;
};

export function createCpuPolicyRetentionScore() {
    function computeCpuPolicyCardRetentionScore(params: CpuPolicyRetentionScoreParams): number {
        const { ctx, state, flags, cardCost } = params;
        const {
            ownCorners,
            oppCorners,
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerEmergency,
            whiteLv6Mode,
            recoveryCostGap,
            maxLegalFlips,
            maxLegalGain,
            maxLegalBoardBonus,
            highBonusMoveAvailable,
            oppHandSize,
            ownSpecialCount,
            oppSpecialCount,
            ownCornerResetCount,
            oppCornerResetCount,
            ownEdgeResetCount,
            oppEdgeResetCount,
            ownAnchorResetWeight,
            oppAnchorResetWeight
        } = state;
        const {
            cardType,
            isRecoveryCard,
            isHoldCard,
            isChargeRampCard,
            isWorkWill,
            isTimeBomb,
            isTimeStopGod,
            isLastResort,
            isEqualityWill,
            isReinforcementWill,
            isHeavenBlessing,
            isRevealHandWill,
            isCondemnWill,
            isExecutionWill,
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
            isThrowChainCard,
            isChainWill,
            isGoldStone,
            isCrystalStone,
            isRainbowStone,
            isSilverStone,
            isLossWill,
            isCorrosionWill,
            isTrapWill,
            isTemptWill,
            isExtendLifeWill,
            isExtendLifeGod,
            isExtendLifeCard,
            isBlockadeWill,
            isMeteorWill,
            isBoardShrinkCard,
            isDestroyDragonWill,
            isGluttonousWill,
            isTeleportWill,
            isCellTeleportWill,
            isSuperCrushWill,
            isDefensiveCard,
            isHighVarianceCard
        } = flags;

        let score = cardCost * 3;
        if (whiteLv6Mode && cardCost >= 20) {
            score -= (220 + (cardCost * 5));
        }
        if (isHoldCard) score += 220;
        if (isRecoveryCard) score += cornerEmergency ? 220 : 120;
        if (isChargeRampCard && !isWorkWill) score += 85;
        if (isWorkWill) score += hasCornerMoveNow ? 110 : 35;
        if (isWorkWill && !cornerEmergency && !hasCornerMoveNow && !hasEdgeMoveNow) score += 90;
        if (isDefensiveCard) score += 40;
        if (isHighVarianceCard) score -= 35;
        if (hasCornerMoveNow && isHoldCard) score += 55;
        if (recoveryCostGap > 0 && isChargeRampCard && !isWorkWill) {
            score += Math.min(95, recoveryCostGap * 3);
        }

        if (isTimeBomb) {
            if (cornerEmergency || ctx.discDiff <= -8) score += 70;
            if (ctx.discDiff >= 8 && !cornerEmergency) score -= 130;
        }

        if (isTimeStopGod) {
            if (cornerEmergency || ctx.discDiff <= -8) score += 80;
            if (ctx.discDiff >= 6 && !cornerEmergency) score -= 150;
            if (ctx.empties <= 12 && !cornerEmergency) score -= 70;
            if (Number.isFinite(ctx.ownDiscs) && Number(ctx.ownDiscs) <= 6) score -= 120;
        }

        if (isLastResort) {
            if (ctx.legalMovesCount > 0) score -= 220;
            if (ctx.discDiff >= 0) score -= 260;
            if (ctx.legalMovesCount <= 0 && ctx.discDiff < 0) score += 40;
        }

        if (isEqualityWill) {
            if (ctx.ownCharge <= 0) {
                score += 180;
                if (ctx.handSize >= 3) score += 30;
            } else {
                score -= 180;
            }
            if (ctx.empties <= 8) score -= 24;
        }

        if (isReinforcementWill) {
            if (cornerEmergency || ctx.discDiff <= -8) score += 80;
            if (ctx.discDiff <= -12) score += 24;
            if (ctx.discDiff >= 6 && !cornerEmergency) score -= 150;
            if (hasCornerMoveNow && !cornerEmergency) score -= 45;
            if (ctx.empties <= 10 && ctx.discDiff > 0) score -= 35;
        }

        if (whiteLv6Mode && (isThrowChainCard || isChainWill)) score -= 260;
        if (
            whiteLv6Mode &&
            (cardType === 'TRIPLE_PLACE' || cardType === 'QUAD_PLACE' || cardType === 'INFINITE_PLACE') &&
            ctx.discDiff >= 4 &&
            !cornerEmergency
        ) score += 520;
        if (whiteLv6Mode && isLastResort && ctx.discDiff >= 0 && !cornerEmergency) score -= 220;
        if (whiteLv6Mode && isLastResort && ctx.legalMovesCount > 0) score -= 520;
        if (whiteLv6Mode && isLastResort && ctx.legalMovesCount > 0 && ctx.handSize >= 4) score -= 220;
        if (whiteLv6Mode && isTimeBomb && ctx.discDiff >= 2 && !cornerEmergency) score -= 240;
        if (whiteLv6Mode && isTimeStopGod && ctx.discDiff >= 2 && !cornerEmergency) score -= 260;
        if (whiteLv6Mode && (isThrowChainCard || isChainWill) && ctx.ownCharge < 70 && !cornerEmergency) score -= 180;
        if (whiteLv6Mode && (isThrowChainCard || isChainWill) && ctx.ownCharge >= 70 && ctx.empties <= 20) score += 64;

        if (isProtectedNextStone || isAfterimageWill || isGhostWill || isPermaProtectNextStone || isGuardWill || isGuardianGod || isRegenWill) {
            if (hasCornerMoveNow) score += 180;
            else if (hasEdgeMoveNow) score += 70;
            else score -= 80;
            if (cornerEmergency && !hasCornerMoveNow) score -= 90;
            if (ctx.empties <= 12 && !hasCornerMoveNow) score -= 50;
        }

        if (isLightningWill || isFireWill) {
            if (hasCornerMoveNow) score += 120;
            else if (hasEdgeMoveNow) score += 50;
            else score -= 100;
            if (cornerEmergency && !hasCornerMoveNow) score -= 70;
            if (ctx.discDiff >= 6 && !cornerEmergency) score -= 60;
            if (ctx.empties <= 14) score -= 110;
        }

        if (isHyperactiveWill || isInstantHyperactiveWill) {
            score -= isInstantHyperactiveWill ? 80 : 60;
            if (ctx.discDiff <= -10 || cornerEmergency) score += 70;
            if (ctx.discDiff >= 6 && !cornerEmergency) score -= 140;
            if (ctx.empties <= 16) score -= 85;
        }

        if (isCrossBomb || isXBomb) {
            score -= 70;
            if (ctx.discDiff <= -10 || cornerEmergency) score += 62;
            if (ctx.discDiff >= 6 && !cornerEmergency) score -= 120;
            if (ctx.empties <= 14) score -= 80;
        }

        if (isTabooReverseWill) {
            score -= 90;
            if (hasCornerMoveNow) score += 140;
            if (cornerEmergency) score += 50;
            if (ctx.discDiff >= 4 && !cornerEmergency) score -= 220;
            if (ctx.ownCharge <= (cardCost + 6)) score -= 120;
        }

        if (isUltimateDestroyGod) {
            score -= 30;
            if (hasCornerMoveNow) score += 110;
            else if (hasEdgeMoveNow) score += 30;
            if (ctx.discDiff <= -10 || cornerEmergency) score += 58;
            if (ctx.discDiff >= 6 && !cornerEmergency) score -= 110;
            if (ctx.empties <= 14) score -= 85;
        }

        if (isUltimateHyperactiveGod) {
            score -= 95;
            if (ctx.discDiff <= -10 || cornerEmergency) score += 85;
            if (ctx.discDiff >= 4 && !cornerEmergency) score -= 220;
            if (ctx.empties <= 18) score -= 110;
        }

        if (isGoldStone || isRainbowStone || isSilverStone) {
            if (maxLegalFlips < 3) score -= isRainbowStone ? 80 : 110;
            if (maxLegalGain <= 1) score -= 90;
            else if (maxLegalGain <= 2) score -= 30;
            else score += Math.min(isRainbowStone ? 110 : 80, maxLegalGain * (isRainbowStone ? 12 : 10));
        }
        if (isCrystalStone) {
            if (maxLegalBoardBonus <= 0) score -= 150;
            else if (maxLegalBoardBonus === 1) score -= 40;
            else score += Math.min(104, maxLegalBoardBonus * 30);
            if (ctx.highBonusMoveAvailable === true) score += 20;
        }
        if (isHeavenBlessing) {
            score += 30;
            if (ctx.handSize >= 4) score -= 120;
            if (ctx.handSize >= 5) score -= 80;
            if (ctx.empties <= 14) score -= 130;
            if (ctx.empties >= 24 && ctx.handSize <= 2) score += 36;
            const heavenDeckRemaining = Number.isFinite(ctx.deckRemaining) ? Number(ctx.deckRemaining) : null;
            if (heavenDeckRemaining !== null) {
                if (heavenDeckRemaining <= 2) score -= 140;
                else if (heavenDeckRemaining <= 4) score -= 50;
            }
        }
        if (isRevealHandWill) {
            score += Math.min(72, oppHandSize * 16);
            if (oppHandSize <= 1) score -= 120;
            else if (oppHandSize <= 2 && !cornerEmergency) score -= 40;
            if (cornerEmergency || ctx.discDiff <= -6) score += 16;
            if (ctx.discDiff >= 6 && oppHandSize <= 2) score -= 24;
            if (ctx.empties <= 12) score -= 48;
        }
        if (isCondemnWill) {
            score += Math.min(120, oppHandSize * 24);
            if (oppHandSize <= 1) score -= 140;
            else if (oppHandSize <= 2 && !cornerEmergency) score -= 48;
            if (cornerEmergency || ctx.discDiff <= -8) score += 24;
            if (ctx.discDiff >= 6 && oppHandSize <= 2) score -= 32;
        }
        if (isExecutionWill) {
            score += Math.min(132, oppHandSize * 28);
            if (oppHandSize <= 1) score -= 120;
            else if (oppHandSize <= 2 && !cornerEmergency) score -= 36;
            if (cornerEmergency || ctx.discDiff <= -8) score += 26;
            if (ctx.discDiff >= 6 && oppHandSize <= 2) score -= 24;
        }
        if (isTrapWill) {
            if (cornerEmergency || ctx.discDiff <= -8) score += 28;
            else score -= 140;
            if (ctx.handSize >= 4) score -= 36;
        }
        if (isTemptWill) {
            if (oppSpecialCount <= 0) score -= 260;
            else score += Math.min(120, oppSpecialCount * 42);
            if (ctx.discDiff >= 6 && !cornerEmergency && oppSpecialCount <= 1) score -= 82;
        }
        if (isLossWill) {
            const specialDiff = oppSpecialCount - ownSpecialCount;
            const anchorResetDiff = oppAnchorResetWeight - ownAnchorResetWeight;
            if (specialDiff <= 0) score -= 300;
            else score += Math.min(200, specialDiff * 70);
            score += anchorResetDiff * 60;
            if (oppCornerResetCount > 0) score += (oppCornerResetCount * 90);
            if (ownCornerResetCount > 0) score -= (ownCornerResetCount * 260);
            if (ownEdgeResetCount > 0) score -= (ownEdgeResetCount * 84);
            if (ownAnchorResetWeight > 0 && anchorResetDiff <= 0) score -= 140;
        }
        if (isCorrosionWill) {
            const specialDiff = oppSpecialCount - ownSpecialCount;
            if (specialDiff <= 0) score -= 240;
            else score += Math.min(150, specialDiff * 52);
        }
        if (isExtendLifeCard) {
            score += (ownSpecialCount * 24);
            if (ownSpecialCount <= 0) score -= 200;
            if (ctx.empties <= 14) score -= 70;
            if (ctx.discDiff >= 4) score += 18;
            if (cornerEmergency && !hasCornerMoveNow) score -= 24;
            if (isExtendLifeGod) {
                score += (ownSpecialCount * 20);
                if (ctx.empties <= 18) score -= 30;
                if (ctx.discDiff >= 4) score += 24;
            }
        }
        if (isBlockadeWill) {
            score += (ctx.legalMovesCount <= 2 ? 90 : (ctx.legalMovesCount <= 3 ? 42 : 10));
            if (cornerEmergency) score += 28;
            if (ctx.discDiff >= 6 && ctx.legalMovesCount >= 4 && !cornerEmergency) score -= 36;
        }
        if (isMeteorWill || isBoardShrinkCard) {
            score -= cardType === 'BOARD_SHRINK_GOD' ? 84 : (cardType === 'BOARD_SHRINK_WILL' ? 66 : 55);
            if (cornerEmergency || ctx.discDiff <= -8) score += cardType === 'BOARD_SHRINK_GOD' ? 122 : (cardType === 'BOARD_SHRINK_WILL' ? 102 : 90);
            if (ctx.discDiff >= 4 && !cornerEmergency) score -= cardType === 'BOARD_SHRINK_GOD' ? 176 : (cardType === 'BOARD_SHRINK_WILL' ? 152 : 140);
            if (ctx.empties <= 12 && ctx.discDiff >= 0) score -= cardType === 'BOARD_SHRINK_GOD' ? 90 : 70;
        }
        if (isDestroyDragonWill) {
            if (hasCornerMoveNow) score += 110;
            else if (hasEdgeMoveNow) score += 56;
            else score -= 52;
            if (cornerEmergency && !hasCornerMoveNow) score -= 34;
            if (ctx.empties <= 14) score -= 72;
        }
        if (isGluttonousWill) {
            score -= 120;
            if (hasCornerMoveNow) score += 100;
            else if (hasEdgeMoveNow) score += 34;
            if (ctx.discDiff <= -10) score += 52;
            if (ctx.discDiff >= 4 && !cornerEmergency) score -= 120;
            if (ctx.handSize <= 2) score -= 80;
            if (ctx.empties <= 16) score -= 100;
        }

        if (cardType === 'EXTREME_HYPERACTIVE_WILL') {
            score -= 80;
            if (ctx.empties <= 18) score -= 120;
            if (ctx.discDiff >= 6 && !cornerEmergency) score -= 85;
            if (cornerEmergency || ctx.discDiff <= -10) score += 78;
            if (hasCornerMoveNow) score += 24;
            if (ctx.ownCharge <= 24 && !cornerEmergency) score -= 24;
        }

        if (isSuperCrushWill) {
            score += 96;
            if (cornerEmergency || ctx.discDiff <= -10) score += 105;
            else score -= 96;
            if (oppCorners > ownCorners) score += 26;
            if (hasCornerMoveNow && ctx.discDiff >= 0 && !cornerEmergency) score -= 52;
            if (!cornerEmergency && !hasCornerMoveNow && !hasEdgeMoveNow) score -= 110;
            if (ctx.empties <= 12) score -= 82;
        }
        if (isTeleportWill) {
            score += 140;
            if (cornerEmergency) score += 120;
            if (ctx.discDiff >= 6 && !cornerEmergency && hasCornerMoveNow) score -= 40;
        }
        if (isCellTeleportWill) {
            score -= 30;
            if (cornerEmergency) score += 36;
            if (ctx.discDiff >= 6 && !cornerEmergency) score -= 48;
        }

        if (ctx.handSize >= 5) {
            if (!isHoldCard && !isRecoveryCard && !isChargeRampCard && !isWorkWill) score -= 55;
            if (cardCost <= 4 && !isHoldCard && !isRecoveryCard) score -= 30;
            if (ctx.discDiff >= 0 && isHighVarianceCard) score -= 45;
        }

        return score;
    }

    return {
        computeCpuPolicyCardRetentionScore
    };
}
