/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayCornerPlanConfig = {
    CardLogic?: any;
    CpuPolicyCore?: any;
    SharedCardHeuristics?: any;
    SharedBoardUtils?: any;
    fallbackCornerRecoveryCardTypes?: Set<string>;
    fallbackCornerHoldCardTypes?: Set<string>;
    getSelfplayBoard?: (gameState: any, cardState: any) => any;
    toPlayerValue?: (playerKey: any) => any;
    isCorner?: (row: any, col: any, board?: any) => boolean;
    isEdge?: (row: any, col: any, board?: any) => boolean;
    countCornerControl?: (board: any, playerValue: any) => any;
    countEdgeControl?: (board: any, playerValue: any) => any;
    readSelfplayPendingEffect?: (cardState: any, playerKey: any) => any;
};

function fallbackFalse() {
    return false;
}

function fallbackNull() {
    return null;
}

function fallbackControl() {
    return { ownCorners: 0, oppCorners: 0, ownEdges: 0, oppEdges: 0 };
}

export function createSelfplayCornerPlan(config?: SelfplayCornerPlanConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayCornerPlanConfig;
    const cardLogic = cfg.CardLogic || null;
    const cpuPolicyCore = cfg.CpuPolicyCore || null;
    const sharedCardHeuristics = cfg.SharedCardHeuristics || null;
    const sharedBoardUtils = cfg.SharedBoardUtils || null;
    const fallbackCornerRecoveryCardTypes = cfg.fallbackCornerRecoveryCardTypes || new Set<string>();
    const fallbackCornerHoldCardTypes = cfg.fallbackCornerHoldCardTypes || new Set<string>();
    const getSelfplayBoard = typeof cfg.getSelfplayBoard === 'function' ? cfg.getSelfplayBoard : fallbackNull;
    const toPlayerValue = typeof cfg.toPlayerValue === 'function' ? cfg.toPlayerValue : (() => 0);
    const isCorner = typeof cfg.isCorner === 'function' ? cfg.isCorner : fallbackFalse;
    const isEdge = typeof cfg.isEdge === 'function' ? cfg.isEdge : fallbackFalse;
    const countCornerControl = typeof cfg.countCornerControl === 'function' ? cfg.countCornerControl : fallbackControl;
    const countEdgeControl = typeof cfg.countEdgeControl === 'function' ? cfg.countEdgeControl : fallbackControl;
    const readSelfplayPendingEffect = typeof cfg.readSelfplayPendingEffect === 'function'
        ? cfg.readSelfplayPendingEffect
        : fallbackNull;

    function getBoardBonusAtCell(cardState: any, row: any, col: any) {
        if (!cardState || !Number.isInteger(row) || !Number.isInteger(col)) return 0;
        const key = `${row},${col}`;
        if (cardState.boardBonusConsumedByCell && cardState.boardBonusConsumedByCell[key] === true) return 0;
        const raw = Number(cardState.boardBonusByCell && cardState.boardBonusByCell[key] ? cardState.boardBonusByCell[key] : 0);
        return Number.isFinite(raw) && raw > 0 ? raw : 0;
    }

    function resolveCardType(cardId: any) {
        if (!cardId) return '';
        if (cardLogic && typeof cardLogic.getCardType === 'function') {
            try {
                const cardType = cardLogic.getCardType(cardId);
                if (typeof cardType === 'string' && cardType) return cardType;
            } catch (e) { /* ignore */ }
        }
        if (cardLogic && typeof cardLogic.getCardDef === 'function') {
            try {
                const cardDef = cardLogic.getCardDef(cardId);
                if (cardDef && typeof cardDef.type === 'string') return cardDef.type;
            } catch (e) { /* ignore */ }
        }
        return '';
    }

    function isRecoveryCardType(cardType: any) {
        const type = String(cardType || '');
        if (!type) return false;
        if (cpuPolicyCore && typeof cpuPolicyCore.isCornerRecoveryCardType === 'function') {
            try {
                return cpuPolicyCore.isCornerRecoveryCardType(type) === true;
            } catch (e) { /* ignore */ }
        }
        if (sharedCardHeuristics && typeof sharedCardHeuristics.isRecoveryCardType === 'function') {
            try {
                if (sharedCardHeuristics.isRecoveryCardType(type) === true) return true;
            } catch (e) { /* ignore */ }
        }
        return fallbackCornerRecoveryCardTypes.has(type);
    }

    function isHoldCardType(cardType: any) {
        const type = String(cardType || '');
        if (!type) return false;
        if (cpuPolicyCore && typeof cpuPolicyCore.isCornerHoldCardType === 'function') {
            try {
                return cpuPolicyCore.isCornerHoldCardType(type) === true;
            } catch (e) { /* ignore */ }
        }
        if (sharedCardHeuristics && typeof sharedCardHeuristics.isHoldCardType === 'function') {
            try {
                if (sharedCardHeuristics.isHoldCardType(type) === true) return true;
            } catch (e) { /* ignore */ }
        }
        return fallbackCornerHoldCardTypes.has(type);
    }

    function buildCornerPlanState(gameState: any, cardState: any, playerKey: any, legalMoves: any, usableCardIds: any = []) {
        if (!gameState || typeof gameState !== 'object') {
            return {
                ownCorners: 0,
                oppCorners: 0,
                ownEdges: 0,
                oppEdges: 0,
                ownEdgeChainStrength: 0,
                oppEdgeChainStrength: 0,
                ownLongestEdgeRun: 0,
                oppLongestEdgeRun: 0,
                ownCompleteEdgeLines: 0,
                oppCompleteEdgeLines: 0,
                maxEdgeLineLength: 0,
                hasCornerMoveNow: false,
                hasEdgeMoveNow: false,
                cornerEmergency: false,
                cornerHoldMode: false,
                cornerSeekMode: true,
                recoveryReady: false,
                holdReady: false,
                recoveryCostGap: 0,
                maxBoardBonusOnLegalMoves: 0,
                highBonusMoveAvailable: false
            };
        }
        const board = getSelfplayBoard(gameState, cardState);
        const playerValue = toPlayerValue(playerKey);
        const cornerControl = countCornerControl(board, playerValue);
        const edgeControl = countEdgeControl(board, playerValue);
        const ownEdgeRunSummary = (
            sharedBoardUtils &&
            typeof sharedBoardUtils.summarizeEdgeRuns === 'function'
        )
            ? sharedBoardUtils.summarizeEdgeRuns(board, playerValue)
            : null;
        const oppEdgeRunSummary = (
            sharedBoardUtils &&
            typeof sharedBoardUtils.summarizeEdgeRuns === 'function'
        )
            ? sharedBoardUtils.summarizeEdgeRuns(board, -playerValue)
            : null;
        const safeLegalMoves = Array.isArray(legalMoves) ? legalMoves : [];
        const hasCornerMoveNow = safeLegalMoves.some((move: any) => move && isCorner(move.row, move.col, board));
        const hasEdgeMoveNow = safeLegalMoves.some((move: any) => move && !isCorner(move.row, move.col, board) && isEdge(move.row, move.col, board));
        let maxBoardBonusOnLegalMoves = 0;
        for (const move of safeLegalMoves) {
            if (!move || !Number.isInteger(move.row) || !Number.isInteger(move.col)) continue;
            const bonus = getBoardBonusAtCell(cardState, move.row, move.col);
            if (bonus > maxBoardBonusOnLegalMoves) maxBoardBonusOnLegalMoves = bonus;
        }

        const ownKey = playerKey === 'black' ? 'black' : 'white';
        const ownCharge = cardState && cardState.charge && Number.isFinite(cardState.charge[ownKey]) ? Number(cardState.charge[ownKey]) : 0;
        const safeUsableCardIds = Array.isArray(usableCardIds) ? usableCardIds : [];
        const usableSet = new Set(safeUsableCardIds.map((cardId: any) => String(cardId)));
        const handCards = cardState && cardState.hands && Array.isArray(cardState.hands[ownKey]) ? cardState.hands[ownKey] : [];

        let recoveryReady = false;
        let holdReady = false;
        let recoveryCostGap = Number.POSITIVE_INFINITY;
        for (const cardId of handCards) {
            const cardType = resolveCardType(cardId);
            if (!cardType) continue;
            const cardCost = (cardLogic && typeof cardLogic.getCardCost === 'function')
                ? Number(cardLogic.getCardCost(cardId) || 0)
                : 0;
            if (isRecoveryCardType(cardType)) {
                if (usableSet.has(String(cardId)) && ownCharge >= cardCost) {
                    recoveryReady = true;
                } else {
                    recoveryCostGap = Math.min(recoveryCostGap, Math.max(0, cardCost - ownCharge));
                }
            }
            if (isHoldCardType(cardType) && usableSet.has(String(cardId)) && ownCharge >= cardCost) {
                holdReady = true;
            }
        }
        if (!Number.isFinite(recoveryCostGap)) recoveryCostGap = 0;

        const cornerEmergency = cornerControl.oppCorners > cornerControl.ownCorners || (!hasCornerMoveNow && cornerControl.oppCorners > 0);
        const edgeLead = edgeControl.ownEdges >= edgeControl.oppEdges;
        const cornerHoldMode = !cornerEmergency && cornerControl.ownCorners > 0 && cornerControl.ownCorners >= cornerControl.oppCorners && edgeLead;

        return {
            ownCorners: cornerControl.ownCorners,
            oppCorners: cornerControl.oppCorners,
            ownEdges: edgeControl.ownEdges,
            oppEdges: edgeControl.oppEdges,
            ownEdgeChainStrength: Number(ownEdgeRunSummary && ownEdgeRunSummary.chainStrength) || 0,
            oppEdgeChainStrength: Number(oppEdgeRunSummary && oppEdgeRunSummary.chainStrength) || 0,
            ownLongestEdgeRun: Number(ownEdgeRunSummary && ownEdgeRunSummary.longestRun) || 0,
            oppLongestEdgeRun: Number(oppEdgeRunSummary && oppEdgeRunSummary.longestRun) || 0,
            ownCompleteEdgeLines: Number(ownEdgeRunSummary && ownEdgeRunSummary.completeLineCount) || 0,
            oppCompleteEdgeLines: Number(oppEdgeRunSummary && oppEdgeRunSummary.completeLineCount) || 0,
            maxEdgeLineLength: Math.max(
                Number(ownEdgeRunSummary && ownEdgeRunSummary.maxLineLength) || 0,
                Number(oppEdgeRunSummary && oppEdgeRunSummary.maxLineLength) || 0
            ),
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerEmergency,
            cornerHoldMode,
            cornerSeekMode: !cornerHoldMode,
            recoveryReady,
            holdReady,
            recoveryCostGap,
            maxBoardBonusOnLegalMoves,
            highBonusMoveAvailable: maxBoardBonusOnLegalMoves >= 3
        };
    }

    function buildMovePlanContext(gameState: any, cardState: any, playerKey: any, legalMoves: any, usableCardIds: any = []) {
        if (!gameState || typeof gameState !== 'object') return null;
        const board = getSelfplayBoard(gameState, cardState);
        const ownKey = playerKey === 'black' ? 'black' : 'white';
        const planState = buildCornerPlanState(gameState, cardState, ownKey, legalMoves, usableCardIds);
        const pending = readSelfplayPendingEffect(cardState, ownKey);
        return {
            level: 6,
            board,
            playerValue: toPlayerValue(ownKey),
            ownCharge: cardState && cardState.charge && Number.isFinite(cardState.charge[ownKey]) ? Number(cardState.charge[ownKey]) : 0,
            boardBonusByCell: (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
                ? cardState.boardBonusByCell
                : null,
            boardBonusConsumedByCell: (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
                ? cardState.boardBonusConsumedByCell
                : null,
            reserveRecoveryCardReady: planState.recoveryReady === true,
            reserveRecoveryCardCostGap: Number(planState.recoveryCostGap || 0),
            hasCornerHoldCardReady: planState.holdReady === true,
            pendingType: pending && typeof pending.type === 'string' ? pending.type : null,
            pendingPlacementsRemaining: pending && Number.isFinite(Number(pending.placementsRemaining))
                ? Number(pending.placementsRemaining)
                : 0,
            preferEdgeRetention: planState.cornerHoldMode === true,
            cornerPlanState: planState
        };
    }

    return {
        getBoardBonusAtCell,
        resolveCardType,
        isRecoveryCardType,
        isHoldCardType,
        buildCornerPlanState,
        buildMovePlanContext
    };
}
