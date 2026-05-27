type CpuDecisionCardContextConfig = {
    getGameState: () => any;
    getCardState: () => any;
    resolvePlayerValue: (playerKey: any) => any;
    getShapeAwareBoard: (board: any, gameState: any, cardState: any) => any;
    countBoardStatsForPlayer: (playerValue: any) => any;
    countEdgeControl: (board: any, playerValue: any) => any;
    buildCornerPlanState: (playerKey: any, legalMoves?: any, usableCardIds?: any) => any;
    getBoardBonusValueAt: (row: any, col: any) => any;
    getBoardCellValueSafe: (board: any, row: any, col: any) => any;
    getCpuPolicyCore: () => any;
};

export function createCpuDecisionCardContext(config: CpuDecisionCardContextConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionCardContextConfig;

    function readGameState(): any {
        return cfg.getGameState ? cfg.getGameState() : null;
    }

    function readCardState(): any {
        return cfg.getCardState ? cfg.getCardState() : null;
    }

    function buildCardUseDecisionContext(playerKey: any, level: any, legalMovesCount: any, legalMoves?: any, usableCardIds?: any): any {
        const cs = readCardState();
        const gs = readGameState();
        const board = cfg.getShapeAwareBoard(gs && Array.isArray(gs.board) ? gs.board : null, gs, cs);
        const playerValue = cfg.resolvePlayerValue(playerKey);
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

    return {
        buildCardUseDecisionContext
    };
}

module.exports = {
    createCpuDecisionCardContext
};
