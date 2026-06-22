type CpuDecisionCardContextConfig = {
    getGameState: () => any;
    getCardState: () => any;
    getCardLogic?: () => any;
    resolvePlayerValue: (playerKey: any) => any;
    getShapeAwareBoard: (board: any, gameState: any, cardState: any) => any;
    countBoardStatsForPlayer: (playerValue: any) => any;
    countCornerControl: (board: any, playerValue: any) => any;
    countEdgeControl: (board: any, playerValue: any) => any;
    buildCornerPlanState: (playerKey: any, legalMoves?: any, usableCardIds?: any) => any;
    getBoardBonusValueAt: (row: any, col: any) => any;
    getBoardCellValueSafe: (board: any, row: any, col: any) => any;
    getCpuPolicyCore: () => any;
    getDeckMetricsForPlayer: (playerKey: any) => any;
    getHandCardIdsForPlayer: (playerKey: any) => any;
    isCornerCell: (row: any, col: any, board?: any) => any;
    isEdgeCell: (row: any, col: any, board?: any) => any;
    resolvePendingType: (playerKey: any) => any;
};

export function createCpuDecisionCardContext(config: CpuDecisionCardContextConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionCardContextConfig;

    function readGameState(): any {
        return cfg.getGameState ? cfg.getGameState() : null;
    }

    function readCardState(): any {
        return cfg.getCardState ? cfg.getCardState() : null;
    }

    function readCardLogic(): any {
        return cfg.getCardLogic ? cfg.getCardLogic() : null;
    }

    function isEnemyOccupiedCornerTarget(board: any, playerValue: any, target: any): boolean {
        if (!target) return false;
        const row = Number(target.row);
        const col = Number(target.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (typeof cfg.isCornerCell !== 'function' || !cfg.isCornerCell(row, col, board)) return false;
        return cfg.getBoardCellValueSafe(board, row, col) === -playerValue;
    }

    function countEnemyOccupiedCornerTargets(board: any, playerValue: any, targets: any): number {
        if (!Array.isArray(targets)) return 0;
        let count = 0;
        for (const target of targets) {
            if (isEnemyOccupiedCornerTarget(board, playerValue, target)) count += 1;
        }
        return count;
    }

    function getBoardExpansionGodRequiredSelectionCount(cardLogic: any, cs: any, gs: any, playerKey: any): number {
        if (!cardLogic || typeof cardLogic.getBoardExpansionGodRequiredSelectionCount !== 'function') return 1;
        const count = Number(cardLogic.getBoardExpansionGodRequiredSelectionCount(cs, gs, playerKey));
        return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    }

    function getBoardExpansionEnemyCornerTargetCounts(playerKey: any, board: any, playerValue: any) {
        const cardLogic = readCardLogic();
        const cs = readCardState();
        const gs = readGameState();
        const willTargets = cardLogic && typeof cardLogic.getBoardExpansionTargets === 'function'
            ? cardLogic.getBoardExpansionTargets(cs, gs, playerKey)
            : [];
        const godTargets = cardLogic && typeof cardLogic.getBoardExpansionGodTargets === 'function'
            ? cardLogic.getBoardExpansionGodTargets(cs, gs, playerKey)
            : [];
        const will = countEnemyOccupiedCornerTargets(board, playerValue, willTargets);
        const rawGod = countEnemyOccupiedCornerTargets(board, playerValue, godTargets);
        const godRequired = getBoardExpansionGodRequiredSelectionCount(cardLogic, cs, gs, playerKey);
        const god = godRequired > 0 && rawGod >= godRequired ? rawGod : 0;
        return {
            boardExpansionWillEnemyCornerTargetCount: will,
            boardExpansionGodEnemyCornerTargetCount: god,
            boardExpansionEnemyCornerTargetCount: Math.max(will, god)
        };
    }

    function buildCardUseDecisionContext(playerKey: any, level: any, legalMovesCount: any, legalMoves?: any, usableCardIds?: any): any {
        const cs = readCardState();
        const gs = readGameState();
        const board = cfg.getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
        const playerValue = cfg.resolvePlayerValue(playerKey);
        const boardExpansionTargetCounts = getBoardExpansionEnemyCornerTargetCounts(playerKey, board, playerValue);
        const stats = cfg.countBoardStatsForPlayer(playerValue);
        const edgeControl = cfg.countEdgeControl(board, playerValue);
        const ownCharge = cs && cs.charge && Number.isFinite(cs.charge[playerKey])
            ? cs.charge[playerKey]
            : 0;
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const oppHandSize = cs && cs.hands && Array.isArray(cs.hands[opponentKey])
            ? cs.hands[opponentKey].length
            : 0;
        const oppCharge = cs && cs.charge && Number.isFinite(cs.charge[opponentKey])
            ? cs.charge[opponentKey]
            : 0;
        const handCardIds = cs && cs.hands && Array.isArray(cs.hands[playerKey])
            ? cs.hands[playerKey].slice()
            : [];
        const handSize = handCardIds.length;
        const deckRemaining = cs && cs.decks && Array.isArray(cs.decks[playerKey])
            ? cs.decks[playerKey].length
            : null;
        const hasDestroyedCardThisTurn = !!(cs && cs.hasDestroyedCardThisTurnByPlayer && cs.hasDestroyedCardThisTurnByPlayer[playerKey]);
        const planState = cfg.buildCornerPlanState(playerKey, legalMoves, usableCardIds);
        const safeLegalMoves = Array.isArray(legalMoves) ? legalMoves : [];
        const cpuPolicyCore = cfg.getCpuPolicyCore ? cfg.getCpuPolicyCore() : null;
        const legalMoveMetrics = (cpuPolicyCore && typeof cpuPolicyCore.computeLegalMoveMetrics === 'function')
            ? cpuPolicyCore.computeLegalMoveMetrics(safeLegalMoves, (row: any, col: any) => cfg.getBoardBonusValueAt(row, col))
            : {
                maxLegalFlips: 0,
                avgLegalFlips: 0,
                maxLegalGain: 0,
                maxLegalBoardBonus: 0
            };

        const markers = cs && Array.isArray(cs.markers) ? cs.markers : [];
        let ownSpecialCount = 0;
        let oppSpecialCount = 0;
        let ownGuardCount = 0;
        let oppGuardCount = 0;
        let cloneSplitEligibleSourceCount = 0;
        const cloneSplitEligibleSourceKeys = new Set();
        for (const marker of markers) {
            if (!marker || (marker.kind !== 'specialStone' && marker.kind !== 'bomb')) continue;
            const row = Number(marker.row);
            const col = Number(marker.col);
            if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
            if (cfg.getBoardCellValueSafe(board, row, col) === playerValue) {
                const sourceKey = `${row},${col}`;
                if (!cloneSplitEligibleSourceKeys.has(sourceKey)) {
                    cloneSplitEligibleSourceKeys.add(sourceKey);
                    cloneSplitEligibleSourceCount += 1;
                }
            }
            if (marker.kind !== 'specialStone') continue;
            const data = marker.data && typeof marker.data === 'object' ? marker.data : null;
            const type = data && typeof data.type === 'string' ? data.type : '';
            if (type === 'METEOR_HOLE') continue;
            if (marker.owner === playerKey) {
                ownSpecialCount += 1;
                if (type === 'GUARD') ownGuardCount += 1;
            } else if (marker.owner === opponentKey) {
                oppSpecialCount += 1;
                if (type === 'GUARD') oppGuardCount += 1;
            }
        }

        return {
            level,
            whiteLv6Mode: level >= 6 && playerKey === 'white',
            playerValue,
            legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
            discDiff: stats.discDiff,
            empties: stats.empties,
            ownCharge,
            oppCharge,
            oppHandSize,
            handSize,
            handCardIds,
            deckRemaining,
            hasDestroyedCardThisTurn,
            forceUseCard: (Number.isFinite(legalMovesCount) ? legalMovesCount : 0) <= 0,
            ownCorners: planState.ownCorners,
            oppCorners: planState.oppCorners,
            boardExpansionEnemyCornerTargetCount: boardExpansionTargetCounts.boardExpansionEnemyCornerTargetCount,
            boardExpansionWillEnemyCornerTargetCount: boardExpansionTargetCounts.boardExpansionWillEnemyCornerTargetCount,
            boardExpansionGodEnemyCornerTargetCount: boardExpansionTargetCounts.boardExpansionGodEnemyCornerTargetCount,
            ownEdges: edgeControl.ownEdges,
            oppEdges: edgeControl.oppEdges,
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
            cloneSplitEligibleSourceCount,
            ownSpecialCount,
            oppSpecialCount,
            ownGuardCount,
            oppGuardCount,
            usableCardIds: Array.isArray(usableCardIds) ? usableCardIds.slice() : [],
            cornerPlanState: planState
        };
    }

    function buildOnnxContext(playerKey: any, level: any, legalMovesCount: any, handCardIds: any, usableCardIds: any, candidateMoves?: any): any {
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const moves = Array.isArray(candidateMoves)
            ? candidateMoves.filter((one) => one && Number.isFinite(one.row) && Number.isFinite(one.col))
            : [];
        let hasCornerMoveNow = false;
        let hasEdgeMoveNow = false;
        let maxLegalMoveBonus = 0;
        const gs = readGameState();
        const cs = readCardState();
        const deckMetrics = cfg.getDeckMetricsForPlayer ? cfg.getDeckMetricsForPlayer(playerKey) : {};
        const boardRef = cfg.getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
        const playerValue = cfg.resolvePlayerValue(playerKey);
        const cornerControl = cfg.countCornerControl ? cfg.countCornerControl(boardRef, playerValue) : null;
        const edgeControl = cfg.countEdgeControl ? cfg.countEdgeControl(boardRef, playerValue) : null;
        const ownCornersBefore = Number(cornerControl && cornerControl.ownCorners) || 0;
        const oppCornersBefore = Number(cornerControl && cornerControl.oppCorners) || 0;
        const ownEdgesBefore = Number(edgeControl && edgeControl.ownEdges) || 0;
        const oppEdgesBefore = Number(edgeControl && edgeControl.oppEdges) || 0;
        for (const move of moves) {
            if (!hasCornerMoveNow && cfg.isCornerCell(move.row, move.col, boardRef)) hasCornerMoveNow = true;
            if (!hasEdgeMoveNow && cfg.isEdgeCell(move.row, move.col, boardRef) && !cfg.isCornerCell(move.row, move.col, boardRef)) hasEdgeMoveNow = true;
            const bonus = cfg.getBoardBonusValueAt(move.row, move.col);
            if (bonus > maxLegalMoveBonus) maxLegalMoveBonus = bonus;
        }
        const cornerEmergency = (oppCornersBefore > ownCornersBefore || (hasCornerMoveNow === false && oppCornersBefore > 0));
        const cornerHoldMode = (cornerEmergency === false && ownCornersBefore > 0 && ownCornersBefore >= oppCornersBefore && ownEdgesBefore >= oppEdgesBefore);
        return {
            playerKey,
            level,
            board: boardRef,
            pendingType: cfg.resolvePendingType ? cfg.resolvePendingType(playerKey) : null,
            legalMovesCount: Number.isFinite(legalMovesCount) ? legalMovesCount : 0,
            ownCharge: (cs && cs.charge && Number.isFinite(cs.charge[playerKey])) ? cs.charge[playerKey] : 0,
            oppCharge: (cs && cs.charge && Number.isFinite(cs.charge[opponentKey])) ? cs.charge[opponentKey] : 0,
            deckCount: Number.isFinite(deckMetrics.legacyDeckCount) ? deckMetrics.legacyDeckCount : 0,
            ownDeckCount: Number.isFinite(deckMetrics.ownDeckCount) ? deckMetrics.ownDeckCount : 0,
            initialDeckSize: Number.isFinite(deckMetrics.initialDeckSize) ? deckMetrics.initialDeckSize : 0,
            boardBonusByCell: (cs && cs.boardBonusByCell && typeof cs.boardBonusByCell === 'object')
                ? cs.boardBonusByCell
                : null,
            boardBonusConsumedByCell: (cs && cs.boardBonusConsumedByCell && typeof cs.boardBonusConsumedByCell === 'object')
                ? cs.boardBonusConsumedByCell
                : null,
            handCardIds: Array.isArray(handCardIds) ? handCardIds.slice() : (cfg.getHandCardIdsForPlayer ? cfg.getHandCardIdsForPlayer(playerKey) : []),
            usableCardIds: Array.isArray(usableCardIds) ? usableCardIds.slice() : null,
            candidateMoves: moves,
            ownCornersBefore,
            oppCornersBefore,
            ownEdgesBefore,
            oppEdgesBefore,
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerEmergency,
            cornerHoldMode,
            maxLegalMoveBonus,
            highBonusMoveAvailable: maxLegalMoveBonus >= 3
        };
    }

    return {
        buildCardUseDecisionContext,
        buildOnnxContext
    };
}

module.exports = {
    createCpuDecisionCardContext
};
