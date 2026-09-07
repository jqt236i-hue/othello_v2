import type { CardUseScoreContext } from './context';

export function applyIsSniperWillScore(context: Pick<CardUseScoreContext, "isSniperWill" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "ctx">, score: number): number {
    const { isSniperWill, hasCornerMoveNow, hasEdgeMoveNow, ctx } = context;
    if (isSniperWill) {
        score -= 30;
        if (hasCornerMoveNow) score += 90;
        else if (hasEdgeMoveNow) score += 35;
        else score -= 95;
        if (ctx.empties <= 16) score -= 55;
        if (ctx.discDiff >= 8 && !ctx.forceUseCard) score -= 45;
    }
    return score;
}

export function applyIsStrongWindWillScore(context: Pick<CardUseScoreContext, "isStrongWindWill" | "cornerEmergency" | "trailingHard" | "trailing" | "edgeEmergency" | "ctx" | "edgeDiff" | "hasEdgeMoveNow" | "hasCornerMoveNow" | "leadStable" | "endgamePhase">, score: number): number {
    const {
        isStrongWindWill,
        cornerEmergency,
        trailingHard,
        trailing,
        edgeEmergency,
        ctx,
        edgeDiff,
        hasEdgeMoveNow,
        hasCornerMoveNow,
        leadStable,
        endgamePhase
    } = context;
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
    return score;
}

export function applyIsSwapWithEnemyScore(context: Pick<CardUseScoreContext, "isSwapWithEnemy" | "isPositionSwapWill" | "cornerEmergency" | "trailingHard" | "trailing" | "edgeEmergency" | "hasCornerMoveNow" | "ctx" | "leadStable" | "endgamePhase">, score: number): number {
    const {
        isSwapWithEnemy,
        isPositionSwapWill,
        cornerEmergency,
        trailingHard,
        trailing,
        edgeEmergency,
        hasCornerMoveNow,
        ctx,
        leadStable,
        endgamePhase
    } = context;
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
    return score;
}

export function applyIsTemptWillScore(context: Pick<CardUseScoreContext, "isTemptWill" | "cornerEmergency" | "trailingHard" | "trailing" | "edgeEmergency" | "hasCornerMoveNow" | "ctx" | "leadStable" | "endgamePhase" | "oppSpecialCount">, score: number): number {
    const {
        isTemptWill,
        cornerEmergency,
        trailingHard,
        trailing,
        edgeEmergency,
        hasCornerMoveNow,
        ctx,
        leadStable,
        endgamePhase,
        oppSpecialCount
    } = context;
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
    return score;
}

export function applyIsCloneWillScore(context: Pick<CardUseScoreContext, "isCloneWill" | "ctx" | "ownCorners" | "oppCorners" | "maxLegalFlips" | "setupBudgetTight" | "cornerEmergency" | "lowFlipMargin" | "lowGainMargin" | "trailingHard" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "leadStable">, score: number): number {
    const {
        isCloneWill,
        ctx,
        ownCorners,
        oppCorners,
        maxLegalFlips,
        setupBudgetTight,
        cornerEmergency,
        lowFlipMargin,
        lowGainMargin,
        trailingHard,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        leadStable
    } = context;
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
    return score;
}

export function applyIsThrowChainCardScore(context: Pick<CardUseScoreContext, "isThrowChainCard" | "trailingHard" | "cornerEmergency" | "trailing" | "ctx" | "endgamePhase" | "maxLegalGain" | "hasCornerMoveNow" | "leadStable">, score: number): number {
    const {
        isThrowChainCard,
        trailingHard,
        cornerEmergency,
        trailing,
        ctx,
        endgamePhase,
        maxLegalGain,
        hasCornerMoveNow,
        leadStable
    } = context;
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
    return score;
}

export function applyIsChainWillScore(context: Pick<CardUseScoreContext, "isChainWill" | "trailingHard" | "cornerEmergency" | "trailing" | "ctx" | "maxLegalFlips" | "endgamePhase" | "maxLegalGain" | "hasCornerMoveNow" | "leadStable">, score: number): number {
    const {
        isChainWill,
        trailingHard,
        cornerEmergency,
        trailing,
        ctx,
        maxLegalFlips,
        endgamePhase,
        maxLegalGain,
        hasCornerMoveNow,
        leadStable
    } = context;
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
    return score;
}

export function applyIsBoardExpansionWillScore(context: Pick<CardUseScoreContext, "isBoardExpansionWill" | "cardType" | "ctx" | "cornerEmergency" | "hasCornerMoveNow">, score: number): number {
    const { isBoardExpansionWill, cardType, ctx, cornerEmergency, hasCornerMoveNow } = context;
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
    return score;
}

export function applyIsBoardShrinkCardScore(context: Pick<CardUseScoreContext, "isBoardShrinkCard" | "cardType" | "cornerEmergency" | "trailingHard" | "trailing" | "edgeEmergency" | "leadStable" | "ctx" | "hasCornerMoveNow" | "endgamePhase" | "cardCost">, score: number): number {
    const {
        isBoardShrinkCard,
        cardType,
        cornerEmergency,
        trailingHard,
        trailing,
        edgeEmergency,
        leadStable,
        ctx,
        hasCornerMoveNow,
        endgamePhase,
        cardCost
    } = context;
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
    return score;
}

export function applyIsTrapWillScore(context: Pick<CardUseScoreContext, "isTrapWill" | "cornerEmergency" | "ctx" | "hasCornerMoveNow" | "edgeEmergency" | "endgamePhase">, score: number): number {
    const { isTrapWill, cornerEmergency, ctx, hasCornerMoveNow, edgeEmergency, endgamePhase } = context;
    if (isTrapWill) {
        score += 8;
        if (cornerEmergency || ctx.discDiff <= -6) score += 35;
        if (ctx.discDiff >= 10 && !ctx.forceUseCard) score -= 35;
        if (hasCornerMoveNow && !ctx.forceUseCard) score -= 18;
        if (!cornerEmergency && !edgeEmergency && ctx.discDiff >= 0 && !ctx.forceUseCard) score -= 84;
        if (endgamePhase && !cornerEmergency) score -= 32;
    }
    return score;
}

export function applyIsHeavenBlessingScore(context: Pick<CardUseScoreContext, "isHeavenBlessing" | "openingPhase" | "midLatePhase" | "endgamePhase" | "ctx" | "deckRemaining" | "cornerEmergency" | "recoveryCostGap" | "cardCyclePressure" | "hasCornerMoveNow" | "keepPriorityInHandCount">, score: number): number {
    const {
        isHeavenBlessing,
        openingPhase,
        midLatePhase,
        endgamePhase,
        ctx,
        deckRemaining,
        cornerEmergency,
        recoveryCostGap,
        cardCyclePressure,
        hasCornerMoveNow,
        keepPriorityInHandCount
    } = context;
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
    return score;
}

export function applyIsRevealHandWillScore(context: Pick<CardUseScoreContext, "isRevealHandWill" | "oppHandSize" | "cornerEmergency" | "openingPhase" | "midLatePhase" | "endgamePhase" | "trailingHard" | "trailing" | "leadStable" | "ctx" | "hasCornerMoveNow">, score: number): number {
    const {
        isRevealHandWill,
        oppHandSize,
        cornerEmergency,
        openingPhase,
        midLatePhase,
        endgamePhase,
        trailingHard,
        trailing,
        leadStable,
        ctx,
        hasCornerMoveNow
    } = context;
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
    return score;
}

export function applyIsCondemnWillScore(context: Pick<CardUseScoreContext, "isCondemnWill" | "oppHandSize" | "cornerEmergency" | "trailingHard" | "trailing" | "leadStable" | "ctx" | "hasCornerMoveNow" | "endgamePhase">, score: number): number {
    const {
        isCondemnWill,
        oppHandSize,
        cornerEmergency,
        trailingHard,
        trailing,
        leadStable,
        ctx,
        hasCornerMoveNow,
        endgamePhase
    } = context;
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
    return score;
}

export function applyIsExecutionWillScore(context: Pick<CardUseScoreContext, "isExecutionWill" | "oppHandSize" | "cornerEmergency" | "trailingHard" | "trailing" | "leadStable" | "ctx" | "hasCornerMoveNow" | "endgamePhase">, score: number): number {
    const {
        isExecutionWill,
        oppHandSize,
        cornerEmergency,
        trailingHard,
        trailing,
        leadStable,
        ctx,
        hasCornerMoveNow,
        endgamePhase
    } = context;
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
    return score;
}

export function applyIsExtendLifeCardScore(context: Pick<CardUseScoreContext, "isExtendLifeCard" | "ownSpecialCount" | "ctx" | "midLatePhase" | "endgamePhase" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "leadStable" | "cornerEmergency" | "isExtendLifeGod">, score: number): number {
    const {
        isExtendLifeCard,
        ownSpecialCount,
        ctx,
        midLatePhase,
        endgamePhase,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        leadStable,
        cornerEmergency,
        isExtendLifeGod
    } = context;
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
    return score;
}

export function applyIsProtectedNextStoneScore(context: Pick<CardUseScoreContext, "isProtectedNextStone" | "isAfterimageWill" | "isGhostWill" | "isPermaProtectNextStone" | "isGuardWill" | "isGuardianGod" | "isRegenWill" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "ctx" | "cornerEmergency" | "leadStable" | "endgamePhase">, score: number): number {
    const {
        isProtectedNextStone,
        isAfterimageWill,
        isGhostWill,
        isPermaProtectNextStone,
        isGuardWill,
        isGuardianGod,
        isRegenWill,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        ctx,
        cornerEmergency,
        leadStable,
        endgamePhase
    } = context;
    if (isProtectedNextStone || isAfterimageWill || isGhostWill || isPermaProtectNextStone || isGuardWill || isGuardianGod || isRegenWill) {
        score += 10;
        if (hasCornerMoveNow) score += 70;
        else if (hasEdgeMoveNow) score += 26;
        else if (!ctx.forceUseCard) score -= 62;
        if (cornerEmergency && !hasCornerMoveNow) score -= 36;
        if (leadStable && (hasCornerMoveNow || hasEdgeMoveNow)) score += 20;
        if (endgamePhase && !hasCornerMoveNow && !hasEdgeMoveNow) score -= 42;
    }
    return score;
}

export function applyIsLightningWillScore(context: Pick<CardUseScoreContext, "isLightningWill" | "isFireWill" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "cornerEmergency" | "trailingHard" | "trailing" | "leadStable" | "ctx" | "endgamePhase">, score: number): number {
    const {
        isLightningWill,
        isFireWill,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        cornerEmergency,
        trailingHard,
        trailing,
        leadStable,
        ctx,
        endgamePhase
    } = context;
    if (isLightningWill || isFireWill) {
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
    return score;
}
