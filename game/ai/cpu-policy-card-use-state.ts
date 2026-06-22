import type {
    CpuPolicyCardContext,
    CpuPolicyCardDefinitionResolver,
    CpuPolicyCardId
} from './cpu-policy-core-types';

type CpuPolicyCardUseStateDeps = {
    rebuildKeepPriorityCardTypes?: ReadonlySet<string>;
    highVarianceCardTypes?: ReadonlySet<string>;
    stabilityCardTypes?: ReadonlySet<string>;
    whiteLv6FastRotateTypes?: ReadonlySet<string>;
};

function toSafeInt(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
}

function toSafeNumber(value: unknown, fallback = 0): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

export function createCpuPolicyCardUseState(deps?: CpuPolicyCardUseStateDeps) {
    const rebuildKeepPriorityCardTypes = deps?.rebuildKeepPriorityCardTypes || new Set<string>();
    const highVarianceCardTypes = deps?.highVarianceCardTypes || new Set<string>();
    const stabilityCardTypes = deps?.stabilityCardTypes || new Set<string>();
    const whiteLv6FastRotateTypes = deps?.whiteLv6FastRotateTypes || new Set<string>();

    function buildCpuPolicyCardUseState(
        context: CpuPolicyCardContext | null | undefined,
        cardId: CpuPolicyCardId,
        getCardDef: CpuPolicyCardDefinitionResolver
    ) {
        const ctx = (context && typeof context === 'object') ? context as Record<string, unknown> : {};
        const ownCorners = toSafeNumber(ctx.ownCorners);
        const oppCorners = toSafeNumber(ctx.oppCorners);
        const swapEnemyNormalCornerTargetCount = toSafeInt(ctx.swapEnemyNormalCornerTargetCount);
        const boardExpansionEnemyCornerTargetCount = toSafeInt(ctx.boardExpansionEnemyCornerTargetCount);
        const boardExpansionWillEnemyCornerTargetCount = toSafeInt(ctx.boardExpansionWillEnemyCornerTargetCount);
        const boardExpansionGodEnemyCornerTargetCount = toSafeInt(ctx.boardExpansionGodEnemyCornerTargetCount);
        const hasCornerMoveNow = ctx.hasCornerMoveNow === true;
        const hasEdgeMoveNow = ctx.hasEdgeMoveNow === true;
        const cornerEmergency = !!ctx.cornerEmergency || (oppCorners > ownCorners);
        const recoveryCostGap = Math.max(0, toSafeNumber(ctx.recoveryCostGap));
        const highBonusMoveAvailable = ctx.highBonusMoveAvailable === true;
        const ownDiscs = toSafeInt(ctx.ownDiscs);
        const ownEdges = toSafeInt(ctx.ownEdges);
        const oppEdges = toSafeInt(ctx.oppEdges);
        const maxLegalFlips = toSafeInt(ctx.maxLegalFlips);
        const avgLegalFlips = Math.max(0, toSafeNumber(ctx.avgLegalFlips));
        const maxLegalGain = Math.max(0, toSafeNumber(ctx.maxLegalGain, maxLegalFlips));
        const maxLegalBoardBonus = Math.max(0, toSafeNumber(ctx.maxLegalBoardBonus));
        const cloneSplitEligibleSourceCount = (typeof ctx.cloneSplitEligibleSourceCount === 'number' && Number.isFinite(ctx.cloneSplitEligibleSourceCount))
            ? Math.max(0, Math.floor(ctx.cloneSplitEligibleSourceCount))
            : null;
        const oppHandSize = toSafeInt(ctx.oppHandSize);
        const ownSpecialCount = toSafeInt(ctx.ownSpecialCount);
        const oppSpecialCount = toSafeInt(ctx.oppSpecialCount);
        const ownGuardCount = toSafeInt(ctx.ownGuardCount);
        const oppGuardCount = toSafeInt(ctx.oppGuardCount);
        const ownCornerResetCount = toSafeInt(ctx.ownCornerResetCount);
        const oppCornerResetCount = toSafeInt(ctx.oppCornerResetCount);
        const ownEdgeResetCount = toSafeInt(ctx.ownEdgeResetCount);
        const oppEdgeResetCount = toSafeInt(ctx.oppEdgeResetCount);
        const handCardIds: CpuPolicyCardId[] = Array.isArray(ctx.handCardIds) ? ctx.handCardIds.map((id: unknown) => String(id)) : [];
        const usableCardIds: CpuPolicyCardId[] = Array.isArray(ctx.usableCardIds) ? ctx.usableCardIds.map((id: unknown) => String(id)) : [];
        const usableCardIdSet = new Set(usableCardIds);
        const deckRemaining = (typeof ctx.deckRemaining === 'number' && Number.isFinite(ctx.deckRemaining))
            ? Math.max(0, Math.floor(ctx.deckRemaining))
            : null;

        let keepPriorityInHandCount = 0;
        let highVarianceInHandCount = 0;
        let fastRotateInHandCount = 0;
        let stabilityInHandCount = 0;
        for (const handId of handCardIds) {
            if (!handId || handId === cardId) continue;
            const handDef = typeof getCardDef === 'function' ? (getCardDef(handId) || null) : null;
            const handType = handDef && typeof handDef.type === 'string' ? handDef.type : '';
            if (!handType) continue;
            if (rebuildKeepPriorityCardTypes.has(handType)) keepPriorityInHandCount += 1;
            if (highVarianceCardTypes.has(handType)) highVarianceInHandCount += 1;
            if (whiteLv6FastRotateTypes.has(handType)) fastRotateInHandCount += 1;
            if (stabilityCardTypes.has(handType)) stabilityInHandCount += 1;
        }

        const edgeDiff = ownEdges - oppEdges;
        const cornerDiff = ownCorners - oppCorners;
        const ownAnchorResetWeight = (ownCornerResetCount * 2) + ownEdgeResetCount;
        const oppAnchorResetWeight = (oppCornerResetCount * 2) + oppEdgeResetCount;
        const lossEnemyAnchorPayoffIsModest = oppSpecialCount <= (ownSpecialCount + 1) && oppAnchorResetWeight <= ownAnchorResetWeight;
        const strategicDiff = toSafeNumber(ctx.discDiff) + (cornerDiff * 4) + edgeDiff;
        const handSize = toSafeInt(ctx.handSize);
        const handPressureLevel = Math.max(0, handSize - 2);
        const ownCharge = toSafeNumber(ctx.ownCharge);
        const legalMovesCount = toSafeInt(ctx.legalMovesCount);
        const chargePressureLevel = ownCharge >= 40 ? 2 : (ownCharge >= 28 ? 1 : 0);
        const mobilityPressureLevel = legalMovesCount <= 1 ? 3 : (legalMovesCount <= 2 ? 2 : (legalMovesCount <= 3 ? 1 : 0));
        const cardCyclePressure = handPressureLevel + chargePressureLevel + mobilityPressureLevel;
        const empties = toSafeInt(ctx.empties);
        const openingPhase = empties >= 42;
        const midLatePhase = empties <= 28;
        const endgamePhase = empties <= 14;
        const leadStable = strategicDiff >= 8;
        const trailingHard = strategicDiff <= -10;
        const trailing = strategicDiff <= -6;
        const edgeEmergency = edgeDiff <= -3;
        const edgeControlMode = edgeDiff >= 3 && cornerDiff >= 0;
        const level = toSafeInt(ctx.level);
        const playerValue = toSafeNumber(ctx.playerValue, 1);
        const whiteLv6Mode = ctx.whiteLv6Mode === true || (level >= 6 && playerValue < 0);
        const lowDiscEmergency = ctx.lowDiscEmergency === true || ownDiscs <= 8;
        const criticalLowDiscEmergency = ctx.criticalLowDiscEmergency === true || ownDiscs <= 4;

        return {
            ownCorners,
            oppCorners,
            swapEnemyNormalCornerTargetCount,
            boardExpansionEnemyCornerTargetCount,
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
        };
    }

    return {
        buildCpuPolicyCardUseState
    };
}
