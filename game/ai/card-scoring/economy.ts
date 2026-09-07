import type { CardUseScoreContext } from './context';

export function applyIsRecoveryCardScore(context: Pick<CardUseScoreContext, "isRecoveryCard" | "cornerEmergency" | "ctx">, score: number): number {
    const { isRecoveryCard, cornerEmergency, ctx } = context;
    if (isRecoveryCard) {
        score -= 18;
        if (!cornerEmergency && !ctx.forceUseCard) score -= 75;
        if (cornerEmergency) score += 65;
    }
    return score;
}

export function applyIsHoldCardScore(context: Pick<CardUseScoreContext, "isHoldCard" | "hasCornerMoveNow" | "cornerEmergency" | "ctx">, score: number): number {
    const { isHoldCard, hasCornerMoveNow, cornerEmergency, ctx } = context;
    if (isHoldCard) {
        if (hasCornerMoveNow) score += 110;
        if (!hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 20;
    }
    return score;
}

export function applyHasCornerMoveNowScore(context: Pick<CardUseScoreContext, "hasCornerMoveNow" | "isHoldCard" | "ctx" | "isCornerTimingCard" | "isSwingCard" | "isHighVarianceCard" | "remainingCharge">, score: number): number {
    const {
        hasCornerMoveNow,
        isHoldCard,
        ctx,
        isCornerTimingCard,
        isSwingCard,
        isHighVarianceCard,
        remainingCharge
    } = context;
    if (hasCornerMoveNow && !isHoldCard && !ctx.forceUseCard) {
        score -= 28;
        // When corner is available, strongly discourage off-plan card usage.
        if (!isCornerTimingCard) score -= 52;
        if (isSwingCard || isHighVarianceCard) score -= 34;
        if (ctx.discDiff >= 0 && remainingCharge <= (ctx.reserveChargeFloor + 4)) score -= 24;
    }
    return score;
}

export function applyHasCornerMoveNowScore3(context: Pick<CardUseScoreContext, "hasCornerMoveNow" | "ctx" | "whiteLv6Mode" | "criticalLowDiscEmergency" | "isHoldCard" | "isGuardWill" | "isGuardianGod" | "isProtectedNextStone" | "isAfterimageWill" | "isGhostWill" | "isPermaProtectNextStone" | "isRegenWill">, score: number): number {
    const {
        hasCornerMoveNow,
        ctx,
        whiteLv6Mode,
        criticalLowDiscEmergency,
        isHoldCard,
        isGuardWill,
        isGuardianGod,
        isProtectedNextStone,
        isAfterimageWill,
        isGhostWill,
        isPermaProtectNextStone,
        isRegenWill
    } = context;
    if (hasCornerMoveNow && !ctx.forceUseCard) {
        score -= 160;
        if (whiteLv6Mode && !criticalLowDiscEmergency) {
            score -= 120;
        }
        if (isHoldCard || isGuardWill || isGuardianGod || isProtectedNextStone || isAfterimageWill || isGhostWill || isPermaProtectNextStone || isRegenWill) {
            score -= 220;
        }
    }
    return score;
}

export function applyWhiteLv6ModeScore(context: Pick<CardUseScoreContext, "ctx" | "whiteLv6Mode" | "cornerEmergency" | "remainingCharge" | "criticalLowDiscEmergency" | "isRecoveryCard" | "isWhiteCornerSwingKeepCard" | "isHoldCard" | "isGuardWill" | "isGuardianGod" | "isProtectedNextStone" | "isAfterimageWill" | "isGhostWill" | "isPermaProtectNextStone" | "isRegenWill">, score: number): number {
    const {
        ctx,
        whiteLv6Mode,
        cornerEmergency,
        remainingCharge,
        criticalLowDiscEmergency,
        isRecoveryCard,
        isWhiteCornerSwingKeepCard,
        isHoldCard,
        isGuardWill,
        isGuardianGod,
        isProtectedNextStone,
        isAfterimageWill,
        isGhostWill,
        isPermaProtectNextStone,
        isRegenWill
    } = context;
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
    return score;
}

export function applyHasCornerMoveNowScore5(context: Pick<CardUseScoreContext, "hasCornerMoveNow" | "hasEdgeMoveNow" | "isHoldCard">, score: number): number {
    const { hasCornerMoveNow, hasEdgeMoveNow, isHoldCard } = context;
    if (!hasCornerMoveNow && hasEdgeMoveNow && isHoldCard) {
        score += 8;
    }
    return score;
}

export function applyIsChargeRampCardScore(context: Pick<CardUseScoreContext, "isChargeRampCard" | "isWorkWill" | "recoveryCostGap" | "highBonusMoveAvailable" | "ctx" | "cornerEmergency" | "hasCornerMoveNow">, score: number): number {
    const {
        isChargeRampCard,
        isWorkWill,
        recoveryCostGap,
        highBonusMoveAvailable,
        ctx,
        cornerEmergency,
        hasCornerMoveNow
    } = context;
    if (isChargeRampCard && !isWorkWill) {
        if (recoveryCostGap > 0) score += Math.min(40, recoveryCostGap * 2);
        if (highBonusMoveAvailable) score += 18;
        if (highBonusMoveAvailable && ctx.ownCharge >= 18) score += 22;
        if (ctx.discDiff >= 8 && !cornerEmergency && !ctx.forceUseCard) score -= 34;
        if (hasCornerMoveNow && !ctx.forceUseCard) score -= 46;
        if (ctx.discDiff <= -10 && cornerEmergency) score += 20;
        if (ctx.handSize >= 4 && ctx.ownCharge <= 16) score += 8;
    }
    return score;
}

export function applyIsChargeSwingCardScore(context: Pick<CardUseScoreContext, "isChargeSwingCard" | "cornerEmergency" | "recoveryCostGap" | "ctx" | "hasCornerMoveNow">, score: number): number {
    const { isChargeSwingCard, cornerEmergency, recoveryCostGap, ctx, hasCornerMoveNow } = context;
    if (isChargeSwingCard) {
        score -= 10;
        if (cornerEmergency && recoveryCostGap > 0) score += 34;
        if (ctx.discDiff >= 8 && !ctx.forceUseCard) score -= 26;
        if (hasCornerMoveNow && !ctx.forceUseCard) score -= 22;
        if (ctx.handSize >= 4) score += 10;
    }
    return score;
}

export function applyIsGoldStoneScore(context: Pick<CardUseScoreContext, "isGoldStone" | "isRainbowStone" | "isSilverStone" | "getFlipMultiplierExtraProfit" | "maxLegalFlips" | "cardCost" | "ctx" | "whiteLv6Mode" | "setupBudgetTight" | "hasCornerMoveNow" | "cornerEmergency" | "endgamePhase" | "criticalLowDiscEmergency">, score: number): number {
    const {
        isGoldStone,
        isRainbowStone,
        isSilverStone,
        getFlipMultiplierExtraProfit,
        maxLegalFlips,
        cardCost,
        ctx,
        whiteLv6Mode,
        setupBudgetTight,
        hasCornerMoveNow,
        cornerEmergency,
        endgamePhase,
        criticalLowDiscEmergency
    } = context;
    if (isGoldStone || isRainbowStone || isSilverStone) {
        const multiplier = isRainbowStone ? 6 : (isGoldStone ? 4 : 3);
        const net = getFlipMultiplierExtraProfit(maxLegalFlips, multiplier, cardCost);
        const minProfitableFlips = Math.floor(cardCost / Math.max(1, multiplier - 1)) + 1;
        score -= 12;
        score += net * 6;
        if (maxLegalFlips < minProfitableFlips && !ctx.forceUseCard) {
            score -= isRainbowStone ? 280 : 320;
            if (whiteLv6Mode) score -= 140;
            if (setupBudgetTight) score -= 72;
        }
        if (maxLegalFlips <= 1) score -= 180;
        else if (maxLegalFlips < minProfitableFlips) {
            score -= 90;
            if (whiteLv6Mode && setupBudgetTight) score -= 48;
        }
        if (net > 0) score += isRainbowStone ? 148 : 112;
        if (hasCornerMoveNow) score += 22;
        if (cornerEmergency && net <= 0) score -= 55;
        if (endgamePhase && net <= 0) score -= 55;
        if (criticalLowDiscEmergency && net > 0) score += 48;
    }
    return score;
}

export function applyIsCrystalStoneScore(context: Pick<CardUseScoreContext, "isCrystalStone" | "getNumberCellExtraProfit" | "maxLegalBoardBonus" | "cardCost" | "ctx" | "whiteLv6Mode" | "setupBudgetTight" | "cornerEmergency" | "openingPhase" | "highBonusMoveAvailable" | "endgamePhase" | "criticalLowDiscEmergency">, score: number): number {
    const {
        isCrystalStone,
        getNumberCellExtraProfit,
        maxLegalBoardBonus,
        cardCost,
        ctx,
        whiteLv6Mode,
        setupBudgetTight,
        cornerEmergency,
        openingPhase,
        highBonusMoveAvailable,
        endgamePhase,
        criticalLowDiscEmergency
    } = context;
    if (isCrystalStone) {
        const net = getNumberCellExtraProfit(maxLegalBoardBonus, cardCost);
        score -= 18;
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
        } else if (net > 0) {
            score += 132;
        } else {
            score += 72;
        }
        if (highBonusMoveAvailable) score += 24;
        if (cornerEmergency && net <= 0) score -= 55;
        if (endgamePhase && net <= 0) score -= 45;
        if (criticalLowDiscEmergency && net > 0) score += 42;
    }
    return score;
}

export function applyIsTreasureBoxScore(context: Pick<CardUseScoreContext, "isTreasureBox" | "ctx" | "leadStable" | "hasCornerMoveNow">, score: number): number {
    const { isTreasureBox, ctx, leadStable, hasCornerMoveNow } = context;
    if (isTreasureBox) {
        score += 12;
        if (ctx.ownCharge <= 8) score += 16;
        if (ctx.handSize >= 4) score += 8;
        if (leadStable && hasCornerMoveNow && !ctx.forceUseCard) score -= 6;
    }
    return score;
}

export function applyIsFreePlacementScore(context: Pick<CardUseScoreContext, "isFreePlacement" | "ctx" | "hasCornerMoveNow" | "cornerEmergency">, score: number): number {
    const { isFreePlacement, ctx, hasCornerMoveNow, cornerEmergency } = context;
    if (isFreePlacement) {
        score -= 20;
        if (ctx.legalMovesCount <= 1) score += 95;
        if (!hasCornerMoveNow && cornerEmergency) score += 75;
        if (hasCornerMoveNow && !ctx.forceUseCard) score -= 80;
        if (ctx.discDiff >= 6 && !ctx.forceUseCard) score -= 55;
    }
    return score;
}
