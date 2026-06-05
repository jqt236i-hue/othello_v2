type CpuDecisionMovePlanConfig = {
    getGameState: () => any;
    getCardState: () => any;
    getCardLogic: () => any;
    resolvePlayerValue: (playerKey: any) => any;
    getShapeAwareBoard: (board: any, gameState: any, cardState: any) => any;
    isPlayableBoard: (board: any) => any;
    countCornerControl: (board: any, playerValue: any) => any;
    isCornerCell: (row: any, col: any, board?: any) => any;
    isEdgeCell: (row: any, col: any, board?: any) => any;
    getBoardBonusValueAt: (row: any, col: any) => any;
    getHandCardIdsForPlayer: (playerKey: any) => any[];
    resolveCardType: (cardId: any, cardDef?: any) => any;
    isRecoveryCardType: (cardType: any) => any;
    isHoldCardType: (cardType: any) => any;
    keepCardTypesForLowCharge: Set<any>;
    getCardPlanPressureProfile: (cardType: any) => any;
    computeCardPlanPressure: (level: any, legalMovesCount: any, planState: any, decisionContext: any) => any;
    resolveCardPlanPressureThreshold: (legalMovesCount: any, planState: any, profile: any) => any;
    readPendingEffect: (playerKey: any, stateRef?: any) => any;
    resolvePendingType: (playerKey: any) => any;
    countBoardStatsForPlayer: (playerValue: any) => any;
    countPlayableCells: (board: any) => any;
    getTargetAwareUsableCardIds: (playerKey: any) => any;
    getCpuPolicyCore?: () => any;
    getCurrentCpuBoard?: () => any;
    onStrictPendingPlacementOverride?: (playerKey: any, pendingType: any, bestAnchoredMove: any) => any;
};

export function createCpuDecisionMovePlan(config: CpuDecisionMovePlanConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionMovePlanConfig;

    function readGameState(): any {
        return cfg.getGameState ? cfg.getGameState() : null;
    }

    function readCardState(): any {
        return cfg.getCardState ? cfg.getCardState() : null;
    }

    function resolveCardLogic(): any {
        return cfg.getCardLogic ? cfg.getCardLogic() : null;
    }

    function buildCornerPlanState(playerKey: any, legalMoves: any, usableCardIds: any): any {
        const gs = readGameState();
        const cs = readCardState();
        const board = cfg.getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
        const playerValue = cfg.resolvePlayerValue(playerKey);
        const ownCharge = cs && cs.charge && Number.isFinite(cs.charge[playerKey]) ? Number(cs.charge[playerKey]) : 0;
        const corners = cfg.countCornerControl(board, playerValue);

        const moves = Array.isArray(legalMoves) ? legalMoves : [];
        const hasCornerMoveNow = moves.some((m: any) => m && cfg.isCornerCell(m.row, m.col, board));
        const hasEdgeMoveNow = moves.some((m: any) => m && !cfg.isCornerCell(m.row, m.col, board) && cfg.isEdgeCell(m.row, m.col, board));
        let maxBoardBonusOnLegalMoves = 0;
        for (const m of moves) {
            if (!m || !Number.isInteger(m.row) || !Number.isInteger(m.col)) continue;
            const b = cfg.getBoardBonusValueAt(m.row, m.col);
            if (b > maxBoardBonusOnLegalMoves) maxBoardBonusOnLegalMoves = b;
        }

        const usableSet = new Set((Array.isArray(usableCardIds) ? usableCardIds : []).map((id: any) => String(id)));
        const handIds = cfg.getHandCardIdsForPlayer(playerKey);
        let recoveryReady = false;
        let holdReady = false;
        let recoveryCostGap = Number.POSITIVE_INFINITY;
        const cardLogicRef = resolveCardLogic();
        for (const cardId of handIds) {
            const cardType = cfg.resolveCardType(cardId, null);
            if (!cardType) continue;
            const cost = (cardLogicRef && typeof cardLogicRef.getCardCost === 'function')
                ? Number(cardLogicRef.getCardCost(cardId) || 0)
                : 0;
            if (cfg.isRecoveryCardType(cardType)) {
                if (usableSet.has(String(cardId)) && ownCharge >= cost) {
                    recoveryReady = true;
                } else {
                    recoveryCostGap = Math.min(recoveryCostGap, Math.max(0, cost - ownCharge));
                }
            }
            if (cfg.isHoldCardType(cardType) && usableSet.has(String(cardId)) && ownCharge >= cost) {
                holdReady = true;
            }
        }
        if (!Number.isFinite(recoveryCostGap)) recoveryCostGap = 0;

        const cornerEmergency = (
            corners.oppCorners > corners.ownCorners ||
            (!hasCornerMoveNow && corners.oppCorners > 0)
        );
        const cornerHoldMode = !cornerEmergency && corners.ownCorners > 0 && corners.ownCorners >= corners.oppCorners;

        return {
            ownCorners: corners.ownCorners,
            oppCorners: corners.oppCorners,
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerEmergency,
            cornerHoldMode,
            recoveryReady,
            recoveryCostGap,
            maxBoardBonusOnLegalMoves,
            highBonusMoveAvailable: maxBoardBonusOnLegalMoves >= 3
        };
    }

    function isCardChoiceAllowedByPlan(playerKey: any, level: any, legalMovesCount: any, cardId: any, cardDef: any, planState: any, decisionContext: any): any {
        if (!cardId) return false;
        if (!Number.isFinite(level) || level < 6) return true;
        if (!Number.isFinite(legalMovesCount) || legalMovesCount <= 0) return true;

        const plan = planState || buildCornerPlanState(playerKey, [], []);
        const cardType = cfg.resolveCardType(cardId, cardDef);
        if (!cardType) return true;

        const forceUseCard = !!(decisionContext && decisionContext.forceUseCard === true);
        const ownCharge = Number.isFinite(decisionContext && decisionContext.ownCharge)
            ? Number(decisionContext.ownCharge)
            : 0;
        const reserveChargeFloor = Number.isFinite(decisionContext && decisionContext.reserveChargeFloor)
            ? Number(decisionContext.reserveChargeFloor)
            : 0;
        const lowDiscEmergency = !!(decisionContext && decisionContext.lowDiscEmergency === true);
        const criticalLowDiscEmergency = !!(decisionContext && decisionContext.criticalLowDiscEmergency === true);
        const discDiff = Number.isFinite(decisionContext && decisionContext.discDiff)
            ? Number(decisionContext.discDiff)
            : 0;
        const recoveryCostGap = Number.isFinite(decisionContext && decisionContext.recoveryCostGap)
            ? Math.max(0, Number(decisionContext.recoveryCostGap))
            : 0;
        const whiteLv6Mode = !!(decisionContext && decisionContext.whiteLv6Mode === true);
        const hasCornerMoveNow = !!(plan && plan.hasCornerMoveNow === true);
        const cornerEmergency = !!(plan && plan.cornerEmergency === true);
        const lowChargeTight = ownCharge <= Math.max(8, reserveChargeFloor + 2);
        const maxLegalFlips = Number.isFinite(decisionContext && decisionContext.maxLegalFlips)
            ? Math.max(0, Math.floor(Number(decisionContext.maxLegalFlips)))
            : 0;
        const maxLegalGain = Number.isFinite(decisionContext && decisionContext.maxLegalGain)
            ? Math.max(0, Number(decisionContext.maxLegalGain))
            : maxLegalFlips;
        const maxLegalBoardBonus = Number.isFinite(decisionContext && decisionContext.maxLegalBoardBonus)
            ? Math.max(0, Number(decisionContext.maxLegalBoardBonus))
            : 0;
        const highYieldChargeRecovery = (
            ((cardType === 'GOLD_STONE' || cardType === 'SILVER_STONE' || cardType === 'RAINBOW_STONE') &&
                maxLegalFlips >= 3 &&
                maxLegalGain >= 3) ||
            (cardType === 'CRYSTAL_STONE' &&
                maxLegalBoardBonus >= 3) ||
            (cardType === 'PLUNDER_WILL' &&
                maxLegalFlips >= 3 &&
                maxLegalGain >= 3 &&
                Number.isFinite(decisionContext && decisionContext.oppCharge) &&
                Number(decisionContext.oppCharge) >= 3)
        );

        const allowCornerWindowException = (
            whiteLv6Mode &&
            cfg.keepCardTypesForLowCharge.has(cardType) &&
            (
                criticalLowDiscEmergency ||
                (cornerEmergency && (lowDiscEmergency || legalMovesCount <= 2 || discDiff <= -10)) ||
                (recoveryCostGap > 0 && legalMovesCount <= 2 && discDiff <= -6)
            )
        );

        if (hasCornerMoveNow && !forceUseCard && !allowCornerWindowException) {
            return false;
        }

        if (
            lowChargeTight &&
            !forceUseCard &&
            !criticalLowDiscEmergency &&
            !highYieldChargeRecovery &&
            !cfg.isRecoveryCardType(cardType) &&
            !cfg.keepCardTypesForLowCharge.has(cardType)
        ) {
            if (!(lowDiscEmergency && cfg.isHoldCardType(cardType))) {
                return false;
            }
        }

        const profile = cfg.getCardPlanPressureProfile(cardType);
        if (!profile) return true;

        const planPressure = cfg.computeCardPlanPressure(level, legalMovesCount, plan, decisionContext);
        const requiredPressure = cfg.resolveCardPlanPressureThreshold(legalMovesCount, plan, profile);
        if (planPressure >= requiredPressure) return true;

        const allowTightDestroyRecoveryWindow = (
            whiteLv6Mode &&
            cardType === 'DESTROY_ONE_STONE' &&
            hasCornerMoveNow !== true &&
            !!(plan && plan.cornerHoldMode === true) &&
            legalMovesCount <= 1 &&
            discDiff <= 4 &&
            (planPressure + 1) >= requiredPressure
        );
        return allowTightDestroyRecoveryWindow;
    }

    function buildMovePlanContext(playerKey: any, level: any, candidateMoves: any): any {
        const gs = readGameState();
        const cs = readCardState();
        const board = cfg.getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
        if (!cfg.isPlayableBoard(board)) return null;
        const pending = cfg.readPendingEffect(playerKey, cs);
        const pendingType = cfg.resolvePendingType(playerKey);
        const playerValue = cfg.resolvePlayerValue(playerKey);
        const ownCharge = cs && cs.charge && Number.isFinite(cs.charge[playerKey])
            ? Number(cs.charge[playerKey])
            : 0;
        const boardStats = cfg.countBoardStatsForPlayer(playerValue);
        const totalCells = Math.max(1, cfg.countPlayableCells(board));
        const occupied = Math.max(0, totalCells - Math.max(0, Number(boardStats.empties) || 0));
        const ownDiscs = Math.max(0, Math.min(
            occupied,
            Math.floor((occupied + (Number(boardStats.discDiff) || 0)) / 2)
        ));
        const usable = resolveCardLogic()
            ? cfg.getTargetAwareUsableCardIds(playerKey)
            : [];
        const plan = buildCornerPlanState(playerKey, candidateMoves, usable);
        return {
            level,
            board,
            playerValue,
            ownCharge,
            ownDiscs,
            boardBonusByCell: (cs && cs.boardBonusByCell && typeof cs.boardBonusByCell === 'object') ? cs.boardBonusByCell : null,
            boardBonusConsumedByCell: (cs && cs.boardBonusConsumedByCell && typeof cs.boardBonusConsumedByCell === 'object') ? cs.boardBonusConsumedByCell : null,
            reserveRecoveryCardReady: plan.recoveryReady === true,
            reserveRecoveryCardCostGap: Number(plan.recoveryCostGap || 0),
            hasCornerHoldCardReady: plan.holdReady === true,
            pendingType,
            pendingPlacementsRemaining: pending && Number.isFinite(Number(pending.placementsRemaining))
                ? Number(pending.placementsRemaining)
                : 0,
            preferEdgeRetention: plan.cornerHoldMode === true
        };
    }

    function shouldRespectPendingPlacementPlanStrictly(pendingType: any): any {
        const cpuPolicyCore = cfg.getCpuPolicyCore ? cfg.getCpuPolicyCore() : null;
        if (!pendingType || !cpuPolicyCore || typeof cpuPolicyCore.getMovePlanProfileForCardType !== 'function') {
            return false;
        }

        const profile = cpuPolicyCore.getMovePlanProfileForCardType(pendingType);
        if (!profile) return false;

        const stabilityBias = Number(profile.stabilityBias || 0);
        const emptyAdjBias = Number(profile.emptyAdjBias || 0);
        const cornerBias = Number(profile.cornerBias || 0);
        const edgeBias = Number(profile.edgeBias || 0);
        const innerBias = Number(profile.innerBias || 0);

        return (
            stabilityBias >= 3 &&
            emptyAdjBias <= 0 &&
            innerBias < 0 &&
            (cornerBias >= 3 || edgeBias >= 2)
        );
    }

    function maybeOverrideWithStrictPendingPlacement(selectedMove: any, candidateMoves: any, playerKey: any, movePlanScoreFn: any): any {
        if (!selectedMove || !Array.isArray(candidateMoves) || candidateMoves.length <= 1) return selectedMove;
        if (typeof movePlanScoreFn !== 'function') return selectedMove;

        const pendingType = cfg.resolvePendingType(playerKey);
        if (!shouldRespectPendingPlacementPlanStrictly(pendingType)) return selectedMove;

        const selectedRow = Number(selectedMove.row);
        const selectedCol = Number(selectedMove.col);
        const board = cfg.getCurrentCpuBoard ? cfg.getCurrentCpuBoard() : null;
        const selectedAnchored = cfg.isCornerCell(selectedRow, selectedCol, board) || cfg.isEdgeCell(selectedRow, selectedCol, board);
        const selectedPlanScore = Number(movePlanScoreFn(selectedMove) || 0);

        let bestAnchoredMove: any = null;
        let bestAnchoredScore = Number.NEGATIVE_INFINITY;
        for (const move of candidateMoves) {
            if (!move) continue;
            const row = Number(move.row);
            const col = Number(move.col);
            const anchored = cfg.isCornerCell(row, col, board) || cfg.isEdgeCell(row, col, board);
            if (!anchored) continue;

            const planScore = Number(movePlanScoreFn(move) || 0);
            if (planScore > bestAnchoredScore) {
                bestAnchoredMove = move;
                bestAnchoredScore = planScore;
            }
        }

        if (!bestAnchoredMove) return selectedMove;
        if (Number(bestAnchoredMove.row) === selectedRow && Number(bestAnchoredMove.col) === selectedCol) {
            return selectedMove;
        }

        const planGap = bestAnchoredScore - selectedPlanScore;
        const selectedBonus = cfg.getBoardBonusValueAt(selectedRow, selectedCol);
        const anchoredBonus = cfg.getBoardBonusValueAt(Number(bestAnchoredMove.row), Number(bestAnchoredMove.col));
        const threshold = selectedAnchored ? 2200 : 3000;
        if (planGap < threshold) return selectedMove;

        if ((selectedBonus - anchoredBonus) >= 5 && planGap < 5500) {
            return selectedMove;
        }

        if (typeof cfg.onStrictPendingPlacementOverride === 'function') {
            cfg.onStrictPendingPlacementOverride(playerKey, pendingType, bestAnchoredMove);
        }
        return bestAnchoredMove;
    }

    return {
        buildCornerPlanState,
        isCardChoiceAllowedByPlan,
        buildMovePlanContext,
        shouldRespectPendingPlacementPlanStrictly,
        maybeOverrideWithStrictPendingPlacement
    };
}

module.exports = {
    createCpuDecisionMovePlan
};
