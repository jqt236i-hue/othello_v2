import type { CardUseScoreContext } from './context';

export function applyIsHyperactiveWillScore(context: Pick<CardUseScoreContext, "isHyperactiveWill" | "isInstantHyperactiveWill" | "trailingHard" | "cornerEmergency" | "trailing" | "hasCornerMoveNow" | "leadStable" | "ctx" | "endgamePhase">, score: number): number {
    const {
        isHyperactiveWill,
        isInstantHyperactiveWill,
        trailingHard,
        cornerEmergency,
        trailing,
        hasCornerMoveNow,
        leadStable,
        ctx,
        endgamePhase
    } = context;
    if (isHyperactiveWill || isInstantHyperactiveWill) {
        score -= isInstantHyperactiveWill ? 56 : 34;
        if (trailingHard || cornerEmergency) score += isInstantHyperactiveWill ? 86 : 58;
        else if (trailing) score += isInstantHyperactiveWill ? 28 : 20;
        if (hasCornerMoveNow && !cornerEmergency) score += 16;
        if (leadStable && !ctx.forceUseCard) score -= isInstantHyperactiveWill ? 132 : 88;
        if (endgamePhase) score -= isInstantHyperactiveWill ? 90 : 62;
    }
    return score;
}

export function applyIsTabooReverseWillScore(context: Pick<CardUseScoreContext, "isTabooReverseWill" | "hasCornerMoveNow" | "cornerEmergency" | "trailingHard" | "trailing" | "leadStable" | "ctx" | "endgamePhase" | "cardCost">, score: number): number {
    const {
        isTabooReverseWill,
        hasCornerMoveNow,
        cornerEmergency,
        trailingHard,
        trailing,
        leadStable,
        ctx,
        endgamePhase,
        cardCost
    } = context;
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
    return score;
}

export function applyIsCrossBombScore(context: Pick<CardUseScoreContext, "isCrossBomb" | "isXBomb" | "trailingHard" | "cornerEmergency" | "trailing" | "edgeEmergency" | "hasCornerMoveNow" | "ctx" | "leadStable" | "endgamePhase">, score: number): number {
    const {
        isCrossBomb,
        isXBomb,
        trailingHard,
        cornerEmergency,
        trailing,
        edgeEmergency,
        hasCornerMoveNow,
        ctx,
        leadStable,
        endgamePhase
    } = context;
    if (isCrossBomb || isXBomb) {
        score -= 36;
        if (trailingHard || cornerEmergency) score += 76;
        else if (trailing) score += 24;
        if (edgeEmergency) score += 20;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 36;
        if (leadStable && !ctx.forceUseCard) score -= 96;
        if (endgamePhase) score -= 82;
    }
    return score;
}

export function applyIsUltimateDestroyGodScore(context: Pick<CardUseScoreContext, "isUltimateDestroyGod" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "trailingHard" | "trailing" | "cornerEmergency" | "leadStable" | "ctx" | "endgamePhase">, score: number): number {
    const {
        isUltimateDestroyGod,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        trailingHard,
        trailing,
        cornerEmergency,
        leadStable,
        ctx,
        endgamePhase
    } = context;
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
    return score;
}

export function applyIsUltimateHyperactiveGodScore(context: Pick<CardUseScoreContext, "isUltimateHyperactiveGod" | "trailingHard" | "trailing" | "cornerEmergency" | "hasCornerMoveNow" | "leadStable" | "ctx" | "endgamePhase" | "cardCost">, score: number): number {
    const {
        isUltimateHyperactiveGod,
        trailingHard,
        trailing,
        cornerEmergency,
        hasCornerMoveNow,
        leadStable,
        ctx,
        endgamePhase,
        cardCost
    } = context;
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
    return score;
}

export function applyIsDestroyDragonWillScore(context: Pick<CardUseScoreContext, "isDestroyDragonWill" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "cornerEmergency" | "ctx" | "leadStable">, score: number): number {
    const { isDestroyDragonWill, hasCornerMoveNow, hasEdgeMoveNow, cornerEmergency, ctx, leadStable } = context;
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
    return score;
}

export function applyIsBreedingWillScore(context: Pick<CardUseScoreContext, "isBreedingWill" | "openingPhase" | "midLatePhase" | "endgamePhase" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "cornerEmergency" | "trailingHard" | "trailing" | "leadStable" | "ctx">, score: number): number {
    const {
        isBreedingWill,
        openingPhase,
        midLatePhase,
        endgamePhase,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        cornerEmergency,
        trailingHard,
        trailing,
        leadStable,
        ctx
    } = context;
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
    return score;
}

export function applyIsTeleportWillScore(context: Pick<CardUseScoreContext, "isTeleportWill" | "cornerEmergency" | "trailingHard" | "trailing" | "oppCorners" | "ownCorners" | "leadStable" | "ctx" | "endgamePhase" | "hasCornerMoveNow">, score: number): number {
    const {
        isTeleportWill,
        cornerEmergency,
        trailingHard,
        trailing,
        oppCorners,
        ownCorners,
        leadStable,
        ctx,
        endgamePhase,
        hasCornerMoveNow
    } = context;
    if (isTeleportWill) {
        score -= 22;
        if (cornerEmergency || trailingHard) score += 110;
        else if (trailing) score += 34;
        if (oppCorners > ownCorners) score += 42;
        if (leadStable && oppCorners <= ownCorners && !ctx.forceUseCard) score -= 120;
        if (endgamePhase) score -= 48;
        if (hasCornerMoveNow && oppCorners <= ownCorners && !cornerEmergency && !ctx.forceUseCard) score -= 30;
    }
    return score;
}

export function applyIsCellTeleportWillScore(context: Pick<CardUseScoreContext, "isCellTeleportWill" | "cornerEmergency" | "trailingHard" | "trailing" | "leadStable" | "ctx" | "endgamePhase" | "hasCornerMoveNow">, score: number): number {
    const {
        isCellTeleportWill,
        cornerEmergency,
        trailingHard,
        trailing,
        leadStable,
        ctx,
        endgamePhase,
        hasCornerMoveNow
    } = context;
    if (isCellTeleportWill) {
        score -= 58;
        if (cornerEmergency || trailingHard) score += 96;
        else if (trailing) score += 34;
        if (leadStable && !ctx.forceUseCard) score -= 112;
        if (endgamePhase) score -= 62;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 36;
    }
    return score;
}

export function applyIsHyperactiveInheritWillScore(context: Pick<CardUseScoreContext, "isHyperactiveInheritWill" | "openingPhase" | "midLatePhase" | "endgamePhase" | "trailing" | "leadStable" | "ctx" | "hasCornerMoveNow">, score: number): number {
    const {
        isHyperactiveInheritWill,
        openingPhase,
        midLatePhase,
        endgamePhase,
        trailing,
        leadStable,
        ctx,
        hasCornerMoveNow
    } = context;
    if (isHyperactiveInheritWill) {
        score -= 26;
        if (openingPhase) score += 24;
        if (midLatePhase) score += 10;
        if (endgamePhase) score -= 70;
        if (trailing) score += 20;
        if (leadStable && !ctx.forceUseCard) score -= 38;
        if (hasCornerMoveNow) score += 12;
    }
    return score;
}

export function applyIsRobotVacuumWillScore(context: Pick<CardUseScoreContext, "isRobotVacuumWill" | "ctx" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "cornerEmergency" | "trailing">, score: number): number {
    const { isRobotVacuumWill, ctx, hasCornerMoveNow, hasEdgeMoveNow, cornerEmergency, trailing } = context;
    if (isRobotVacuumWill) {
        score -= 24;
        if (ctx.empties >= 20 && ctx.empties <= 46) score += 24;
        if (ctx.empties <= 12) score -= 65;
        if (hasCornerMoveNow) score += 40;
        else if (hasEdgeMoveNow) score += 18;
        if (cornerEmergency && !hasCornerMoveNow) score -= 26;
        if (trailing) score += 18;
    }
    return score;
}

export function applyIsEqualityWillScore(context: Pick<CardUseScoreContext, "isEqualityWill" | "ctx" | "getEqualityWillStealableAmount">, score: number): number {
    const { isEqualityWill, ctx, getEqualityWillStealableAmount } = context;
    if (isEqualityWill) {
        score -= 10;
        if (ctx.ownCharge <= 0) {
            const stealableAmount = getEqualityWillStealableAmount(ctx.ownCharge, ctx.oppCharge);
            if (stealableAmount > 0) {
                score += 76 + (stealableAmount * 7);
                if (ctx.handSize >= 3) score += 20;
            } else if (!ctx.forceUseCard) {
                score -= 130;
            }
        } else if (!ctx.forceUseCard) {
            score -= 220;
        }
        if (ctx.empties <= 8) score -= 18;
    }
    return score;
}

export function applyIsReinforcementWillScore(context: Pick<CardUseScoreContext, "isReinforcementWill" | "cornerEmergency" | "ctx" | "hasCornerMoveNow" | "endgamePhase">, score: number): number {
    const { isReinforcementWill, cornerEmergency, ctx, hasCornerMoveNow, endgamePhase } = context;
    if (isReinforcementWill) {
        score -= 6;
        if (cornerEmergency || ctx.discDiff <= -8) score += 36;
        if (ctx.discDiff <= -12) score += 18;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 46;
        if (ctx.discDiff >= 6 && !cornerEmergency && !ctx.forceUseCard) score -= 60;
        if (endgamePhase && ctx.discDiff >= 0) score -= 42;
        if (ctx.legalMovesCount <= 1) score += 18;
    }
    return score;
}

export function applyIsGluttonousWillScore(context: Pick<CardUseScoreContext, "isGluttonousWill" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "maxLegalFlips" | "ctx" | "whiteLv6Mode" | "cornerEmergency" | "trailingHard" | "trailing" | "leadStable" | "endgamePhase" | "keepPriorityInHandCount" | "highVarianceInHandCount" | "fastRotateInHandCount" | "criticalLowDiscEmergency">, score: number): number {
    const {
        isGluttonousWill,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        maxLegalFlips,
        ctx,
        whiteLv6Mode,
        cornerEmergency,
        trailingHard,
        trailing,
        leadStable,
        endgamePhase,
        keepPriorityInHandCount,
        highVarianceInHandCount,
        fastRotateInHandCount,
        criticalLowDiscEmergency
    } = context;
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
    return score;
}

export function applyIsExtremeHyperactiveWillScore(context: Pick<CardUseScoreContext, "isExtremeHyperactiveWill" | "openingPhase" | "midLatePhase" | "endgamePhase" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "trailingHard" | "trailing" | "cornerEmergency" | "leadStable" | "ctx" | "cardCost">, score: number): number {
    const {
        isExtremeHyperactiveWill,
        openingPhase,
        midLatePhase,
        endgamePhase,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        trailingHard,
        trailing,
        cornerEmergency,
        leadStable,
        ctx,
        cardCost
    } = context;
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
    return score;
}
