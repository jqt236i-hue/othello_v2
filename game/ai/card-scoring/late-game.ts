import type { CardUseScoreContext } from './context';

export function applyIsSuperCrushWillScore(context: Pick<CardUseScoreContext, "isSuperCrushWill" | "cornerEmergency" | "trailingHard" | "trailing" | "edgeEmergency" | "openingPhase" | "edgeDiff" | "maxLegalFlips" | "maxLegalGain" | "hasCornerMoveNow" | "ctx" | "leadStable" | "endgamePhase">, score: number): number {
    const {
        isSuperCrushWill,
        cornerEmergency,
        trailingHard,
        trailing,
        edgeEmergency,
        openingPhase,
        edgeDiff,
        maxLegalFlips,
        maxLegalGain,
        hasCornerMoveNow,
        ctx,
        leadStable,
        endgamePhase
    } = context;
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
    return score;
}

export function applyIsBlockadeWillScore(context: Pick<CardUseScoreContext, "isBlockadeWill" | "mobilityPressureLevel" | "cornerEmergency" | "edgeEmergency" | "leadStable" | "ctx" | "openingPhase" | "endgamePhase" | "hasCornerMoveNow">, score: number): number {
    const {
        isBlockadeWill,
        mobilityPressureLevel,
        cornerEmergency,
        edgeEmergency,
        leadStable,
        ctx,
        openingPhase,
        endgamePhase,
        hasCornerMoveNow
    } = context;
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
    return score;
}

export function applyIsMeteorWillScore(context: Pick<CardUseScoreContext, "isMeteorWill" | "isBoardShrinkCard" | "cardType" | "cornerEmergency" | "trailingHard" | "trailing" | "edgeEmergency" | "leadStable" | "ctx" | "hasCornerMoveNow" | "endgamePhase" | "cardCost" | "highBonusMoveAvailable" | "hasEdgeMoveNow">, score: number): number {
    const {
        isMeteorWill,
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
        cardCost,
        highBonusMoveAvailable,
        hasEdgeMoveNow
    } = context;
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
    return score;
}

export function applyLeadStableScore(context: Pick<CardUseScoreContext, "ctx" | "leadStable" | "cornerEmergency" | "isSwingCard" | "isHighVarianceCard" | "isChargeSwingCard" | "hasCornerMoveNow">, score: number): number {
    const {
        ctx,
        leadStable,
        cornerEmergency,
        isSwingCard,
        isHighVarianceCard,
        isChargeSwingCard,
        hasCornerMoveNow
    } = context;
    if (!ctx.forceUseCard && leadStable && !cornerEmergency) {
        if (isSwingCard) score -= 28;
        if (isHighVarianceCard) score -= 20;
        if (isChargeSwingCard && hasCornerMoveNow) score -= 26;
    }
    return score;
}

export function applyIsLossWillScore(context: Pick<CardUseScoreContext, "isLossWill" | "oppSpecialCount" | "ownSpecialCount" | "oppAnchorResetWeight" | "ownAnchorResetWeight" | "countLossWillDestroyableHandCards" | "handCardIds" | "cardId" | "ctx" | "oppCornerResetCount" | "ownCornerResetCount" | "ownEdgeResetCount" | "cornerEmergency" | "leadStable" | "endgamePhase" | "ownGuardCount" | "oppGuardCount">, score: number): number {
    const {
        isLossWill,
        oppSpecialCount,
        ownSpecialCount,
        oppAnchorResetWeight,
        ownAnchorResetWeight,
        countLossWillDestroyableHandCards,
        handCardIds,
        cardId,
        ctx,
        oppCornerResetCount,
        ownCornerResetCount,
        ownEdgeResetCount,
        cornerEmergency,
        leadStable,
        endgamePhase,
        ownGuardCount,
        oppGuardCount
    } = context;
    if (isLossWill) {
        const specialDiff = oppSpecialCount - ownSpecialCount;
        const anchorResetDiff = oppAnchorResetWeight - ownAnchorResetWeight;
        const destroyableHandCount = countLossWillDestroyableHandCards(handCardIds, cardId);
        score -= 38;
        score += specialDiff * 52;
        score += anchorResetDiff * 44;
        if (!ctx.forceUseCard && destroyableHandCount > 0) {
            score -= destroyableHandCount * 38;
            if (destroyableHandCount >= 2) score -= 34;
            if (destroyableHandCount >= 3) score -= 42;
            if (destroyableHandCount >= 4) score -= 52;
        }
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
    return score;
}

export function applyIsMassFreezeWillScore(context: Pick<CardUseScoreContext, "isMassFreezeWill" | "massFreezeOpponentTargetCount" | "massFreezeOwnTargetCount" | "endgamePhase" | "cornerEmergency">, score: number): number {
    const {
        isMassFreezeWill,
        massFreezeOpponentTargetCount,
        massFreezeOwnTargetCount,
        endgamePhase,
        cornerEmergency
    } = context;
    if (isMassFreezeWill) {
        const targetDiff = massFreezeOpponentTargetCount - massFreezeOwnTargetCount;
        score -= 24;
        score += massFreezeOpponentTargetCount * 34;
        score -= massFreezeOwnTargetCount * 12;
        if (targetDiff >= 2) score += 42;
        if (targetDiff <= -1) score -= 70;
        if (endgamePhase) score -= 20;
        if (cornerEmergency && massFreezeOpponentTargetCount > 0) score += 18;
    }
    return score;
}

export function applyIsCorrosionWillScore(context: Pick<CardUseScoreContext, "isCorrosionWill" | "oppSpecialCount" | "ownSpecialCount" | "cornerEmergency" | "leadStable" | "endgamePhase" | "ownGuardCount" | "oppGuardCount">, score: number): number {
    const {
        isCorrosionWill,
        oppSpecialCount,
        ownSpecialCount,
        cornerEmergency,
        leadStable,
        endgamePhase,
        ownGuardCount,
        oppGuardCount
    } = context;
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
    return score;
}

export function applyIsRebuildWillScore(context: Pick<CardUseScoreContext, "isRebuildWill" | "handCardIds" | "cardId" | "getCardDef" | "rebuildKeepPriorityCardTypes" | "highVarianceCardTypes" | "usableCardIds" | "ctx" | "cornerEmergency" | "deckRemaining">, score: number): number {
    const {
        isRebuildWill,
        handCardIds,
        cardId,
        getCardDef,
        rebuildKeepPriorityCardTypes,
        highVarianceCardTypes,
        usableCardIds,
        ctx,
        cornerEmergency,
        deckRemaining
    } = context;
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
    return score;
}

export function applyIsWorkWillScore(context: Pick<CardUseScoreContext, "isWorkWill" | "cornerEmergency" | "ctx" | "hasCornerMoveNow" | "hasEdgeMoveNow" | "highBonusMoveAvailable" | "whiteLv6Mode" | "criticalLowDiscEmergency">, score: number): number {
    const {
        isWorkWill,
        cornerEmergency,
        ctx,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        highBonusMoveAvailable,
        whiteLv6Mode,
        criticalLowDiscEmergency
    } = context;
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
    return score;
}

export function applyIsTimeBombScore(context: Pick<CardUseScoreContext, "isTimeBomb" | "cornerEmergency" | "ctx" | "hasCornerMoveNow" | "ownCorners" | "oppCorners" | "whiteLv6Mode" | "leadStable">, score: number): number {
    const {
        isTimeBomb,
        cornerEmergency,
        ctx,
        hasCornerMoveNow,
        ownCorners,
        oppCorners,
        whiteLv6Mode,
        leadStable
    } = context;
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
    return score;
}

export function applyIsTimeStopGodScore(context: Pick<CardUseScoreContext, "isTimeStopGod" | "cornerEmergency" | "ctx" | "hasCornerMoveNow" | "ownCorners" | "oppCorners" | "ownDiscs" | "whiteLv6Mode" | "leadStable">, score: number): number {
    const {
        isTimeStopGod,
        cornerEmergency,
        ctx,
        hasCornerMoveNow,
        ownCorners,
        oppCorners,
        ownDiscs,
        whiteLv6Mode,
        leadStable
    } = context;
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
    return score;
}

export function applyWhiteLv6ModeScore55(context: Pick<CardUseScoreContext, "whiteLv6Mode" | "isLastResort" | "ctx" | "cornerEmergency" | "criticalLowDiscEmergency" | "lowDiscEmergency" | "leadStable">, score: number): number {
    const {
        whiteLv6Mode,
        isLastResort,
        ctx,
        cornerEmergency,
        criticalLowDiscEmergency,
        lowDiscEmergency,
        leadStable
    } = context;
    if (whiteLv6Mode && isLastResort && !ctx.forceUseCard) {
        const desperateLastResortWindow = (
            cornerEmergency &&
            (
                criticalLowDiscEmergency ||
                (lowDiscEmergency && ctx.legalMovesCount <= 1) ||
                Number(ctx.discDiff || 0) <= -18
            )
        );
        if (desperateLastResortWindow) {
            if (ctx.legalMovesCount > 0) score -= 80;
            if (ctx.legalMovesCount <= 1) score += 48;
            if (criticalLowDiscEmergency) score += 124;
        } else {
            if (ctx.legalMovesCount > 0) score -= 420;
            if (ctx.legalMovesCount > 0 && ctx.handSize >= 4) score -= 180;
        }
        if (ctx.discDiff >= 0) score -= 420;
        if (leadStable && !cornerEmergency) score -= 110;
    }
    return score;
}
