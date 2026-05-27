/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayDecisionContextConfig = {
    Core?: any;
    CardLogic?: any;
    CpuPolicyCore?: any;
    toPlayerValue?: (playerKey: any) => any;
    getSafeCardContext?: (cardState: any) => any;
    readSelfplayPendingEffect?: (cardState: any, playerKey: any) => any;
    buildCornerPlanState?: (gameState: any, cardState: any, ownKey: any, legalMoves: any[], usableCardIds: any[]) => any;
    getBoardBonusAtCell?: (cardState: any, row: any, col: any) => number;
    countDiscsByValue?: (gameState: any, playerValue: any) => number;
    countEmpties?: (board: any) => number;
};

export function createSelfplayDecisionContext(config?: SelfplayDecisionContextConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayDecisionContextConfig;
    const core = cfg.Core || null;
    const cardLogic = cfg.CardLogic || null;
    const cpuPolicyCore = cfg.CpuPolicyCore || null;
    const toPlayerValue = typeof cfg.toPlayerValue === 'function'
        ? cfg.toPlayerValue
        : ((playerKey: any) => playerKey);
    const getSafeCardContext = typeof cfg.getSafeCardContext === 'function'
        ? cfg.getSafeCardContext
        : (() => null);
    const readSelfplayPendingEffect = typeof cfg.readSelfplayPendingEffect === 'function'
        ? cfg.readSelfplayPendingEffect
        : (() => null);
    const buildCornerPlanState = typeof cfg.buildCornerPlanState === 'function'
        ? cfg.buildCornerPlanState
        : (() => ({
            ownCorners: 0,
            oppCorners: 0,
            ownEdges: 0,
            oppEdges: 0,
            hasCornerMoveNow: false,
            hasEdgeMoveNow: false,
            cornerEmergency: false,
            cornerHoldMode: false,
            recoveryCostGap: 0,
            highBonusMoveAvailable: false
        }));
    const getBoardBonusAtCell = typeof cfg.getBoardBonusAtCell === 'function'
        ? cfg.getBoardBonusAtCell
        : (() => 0);
    const countDiscsByValue = typeof cfg.countDiscsByValue === 'function'
        ? cfg.countDiscsByValue
        : (() => 0);
    const countEmpties = typeof cfg.countEmpties === 'function'
        ? cfg.countEmpties
        : (() => 0);

    function getLegalMovesForAction(gameState: any, cardState: any, playerKey: any) {
        const player = toPlayerValue(playerKey);
        const context = getSafeCardContext(cardState);
        const pendingType = cardLogic.getPendingEffectType(cardState, playerKey);
        const isFreePlacement = cardLogic.isFreePlacementPendingType(pendingType);

        const moves = isFreePlacement
            ? core.getFreePlacementMoves(gameState, player, context)
            : core.getLegalMoves(gameState, player, context);
        if (!Array.isArray(moves) || moves.length <= 0) return [];
        return moves.filter((move: any) => !!(move && Number.isInteger(move.row) && Number.isInteger(move.col)));
    }

    function getDirectUsableCardIds(cardState: any, gameState: any, playerKey: any) {
        const ids = cardLogic.getUsableCardIds(cardState, gameState, playerKey);
        if (!Array.isArray(ids)) return [];
        const usableIds = [];
        const seen = new Set();
        for (const rawId of ids) {
            const cardId = typeof rawId === 'string' ? rawId.trim() : '';
            if (!cardId || seen.has(cardId)) continue;
            seen.add(cardId);
            usableIds.push(cardId);
        }
        return usableIds;
    }

    function buildCardDecisionContext(
        gameState: any,
        cardState: any,
        playerKey: any,
        legalMovesCount: any,
        legalMoves: any,
        usableCardIds: any = []
    ) {
        const ownKey = playerKey === 'black' ? 'black' : 'white';
        const oppKey = ownKey === 'black' ? 'white' : 'black';
        const safeLegalMoves = Array.isArray(legalMoves) ? legalMoves : [];
        const hasDestroyedCardThisTurn = !!(
            cardState &&
            cardState.hasDestroyedCardThisTurnByPlayer &&
            cardState.hasDestroyedCardThisTurnByPlayer[ownKey]
        );
        readSelfplayPendingEffect(cardState, ownKey);
        let safeUsableCardIds = Array.isArray(usableCardIds) ? usableCardIds.slice() : null;
        if (!safeUsableCardIds) {
            try {
                safeUsableCardIds = getDirectUsableCardIds(cardState, gameState, ownKey);
            } catch (e) {
                safeUsableCardIds = [];
            }
        }
        const planState = buildCornerPlanState(gameState, cardState, ownKey, safeLegalMoves, safeUsableCardIds);
        const legalMoveMetrics = (cpuPolicyCore && typeof cpuPolicyCore.computeLegalMoveMetrics === 'function')
            ? cpuPolicyCore.computeLegalMoveMetrics(safeLegalMoves, (row: any, col: any) => getBoardBonusAtCell(cardState, row, col))
            : {
                maxLegalFlips: 0,
                avgLegalFlips: 0,
                maxLegalGain: 0,
                maxLegalBoardBonus: 0
            };

        const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
        let ownSpecialCount = 0;
        let oppSpecialCount = 0;
        let ownGuardCount = 0;
        let oppGuardCount = 0;
        for (const marker of markers) {
            if (!marker || marker.kind !== 'specialStone') continue;
            const data = marker.data && typeof marker.data === 'object' ? marker.data : null;
            const type = data && typeof data.type === 'string' ? data.type : '';
            if (type === 'METEOR_HOLE') continue;
            if (marker.owner === ownKey) {
                ownSpecialCount += 1;
                if (type === 'GUARD') ownGuardCount += 1;
            } else if (marker.owner === oppKey) {
                oppSpecialCount += 1;
                if (type === 'GUARD') oppGuardCount += 1;
            }
        }

        return {
            level: 6,
            playerValue: toPlayerValue(playerKey),
            legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
            discDiff: countDiscsByValue(gameState, toPlayerValue(playerKey)),
            empties: countEmpties(gameState.board),
            ownCharge: cardState && cardState.charge && Number.isFinite(cardState.charge[ownKey]) ? cardState.charge[ownKey] : 0,
            oppCharge: cardState && cardState.charge && Number.isFinite(cardState.charge[oppKey]) ? cardState.charge[oppKey] : 0,
            oppHandSize: cardState && cardState.hands && Array.isArray(cardState.hands[oppKey]) ? cardState.hands[oppKey].length : 0,
            handSize: cardState && cardState.hands && Array.isArray(cardState.hands[ownKey]) ? cardState.hands[ownKey].length : 0,
            handCardIds: cardState && cardState.hands && Array.isArray(cardState.hands[ownKey]) ? cardState.hands[ownKey].slice() : [],
            hasDestroyedCardThisTurn,
            forceUseCard: (Number.isFinite(legalMovesCount) ? legalMovesCount : 0) <= 0,
            ownCorners: planState.ownCorners,
            oppCorners: planState.oppCorners,
            ownEdges: planState.ownEdges,
            oppEdges: planState.oppEdges,
            hasCornerMoveNow: planState.hasCornerMoveNow,
            hasEdgeMoveNow: planState.hasEdgeMoveNow,
            cornerEmergency: planState.cornerEmergency,
            cornerHoldMode: planState.cornerHoldMode,
            recoveryCostGap: planState.recoveryCostGap,
            highBonusMoveAvailable: planState.highBonusMoveAvailable,
            maxLegalFlips: legalMoveMetrics.maxLegalFlips,
            avgLegalFlips: legalMoveMetrics.avgLegalFlips,
            maxLegalGain: legalMoveMetrics.maxLegalGain,
            maxLegalBoardBonus: legalMoveMetrics.maxLegalBoardBonus,
            ownSpecialCount,
            oppSpecialCount,
            ownGuardCount,
            oppGuardCount,
            usableCardIds: safeUsableCardIds.slice(),
            cornerPlanState: planState
        };
    }

    return {
        getLegalMovesForAction,
        getDirectUsableCardIds,
        buildCardDecisionContext
    };
}
