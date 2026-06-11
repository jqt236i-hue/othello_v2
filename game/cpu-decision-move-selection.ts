type CpuDecisionMoveSelectionConfig = {
    buildLv6LookaheadOptions: (level: any, board: any, legalMovesCount: any, playerKey: any) => any;
    buildMovePlanContext: (playerKey: any, level: any, candidateMoves: any) => any;
    choosePendingTargetWithPolicy: (playerKey: any, pendingType: any, targets: any, pending: any) => any;
    createLearnedScoreFn: (playerKey: any, level: any, legalMovesCount: any) => any;
    createLookaheadMetaLogger: (playerKey: any, level: any, phaseLabel: any) => any;
    cpuDebugLog: (...args: any[]) => void;
    error: (...args: any[]) => void;
    filterLv6OpenCornerAdjacentMoves: (candidateMoves: any, board: any) => any;
    filterMovesByLv6PlacementPriority: (playerKey: any, level: any, candidateMoves: any) => any;
    getAISystem: () => any;
    getCardState: () => any;
    getCpuPolicyCore: () => any;
    getCpuRng: () => any;
    getCurrentCpuBoard: () => any;
    getGameState: () => any;
    isAISystemAvailable: () => any;
    isPlayableBoard: (board: any) => any;
    maybeOverrideWithStrictPendingPlacement: (selectedMove: any, candidateMoves: any, playerKey: any, movePlanScoreFn: any) => any;
    readCpuPendingEffect: (playerKey: any) => any;
    resolveCpuLv6LookaheadWeights: () => any;
    resolveCpuSmartnessLevel: (playerKey: any) => any;
    resolvePendingType: (playerKey: any) => any;
    resolvePlayerValue: (playerKey: any) => any;
    selectMoveFromLearnedPolicy: (candidateMoves: any, playerKey: any, level: any) => any;
    selectMoveFromOthelloPolicy: (candidateMoves: any, playerKey: any, level: any, options?: any) => any;
    shouldForceCardModeLv6Placement: (playerKey: any, pendingType: any, boardRef: any) => any;
    warn: (...args: any[]) => void;
};

export function createCpuDecisionMoveSelection(config: CpuDecisionMoveSelectionConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionMoveSelectionConfig;

    function selectCpuMoveWithPolicy(candidateMoves: any, playerKey: any): any {
        const rng = cfg.getCpuRng();
        const cardLevel = cfg.resolveCpuSmartnessLevel(playerKey);

        if (cardLevel < 0) {
            cfg.error(`[CPU] selectCpuMoveWithPolicy called for human player ${playerKey}, returning random move`);
            return candidateMoves[Math.floor(rng.random() * candidateMoves.length)];
        }

        const pendingType = cfg.resolvePendingType(playerKey);
        const board = cfg.getCurrentCpuBoard();
        const forceLv6Placement = cfg.shouldForceCardModeLv6Placement(playerKey, pendingType, board);
        const placementLevel = forceLv6Placement ? 6 : cardLevel;

        let prioritizedCandidateMoves = cfg.filterMovesByLv6PlacementPriority(playerKey, placementLevel, candidateMoves);
        if (Number.isFinite(placementLevel) && placementLevel >= 6) {
            prioritizedCandidateMoves = cfg.filterLv6OpenCornerAdjacentMoves(prioritizedCandidateMoves, board);
        }

        const aiSelector = cfg.isAISystemAvailable() && cfg.getAISystem() && typeof cfg.getAISystem().selectMove === 'function'
            ? (moves: any, lv: any) => cfg.getAISystem().selectMove(cfg.getGameState(), cfg.getCardState(), moves, lv, null)
            : null;
        if (pendingType === 'FREE_PLACEMENT' || pendingType === 'LAST_RESORT') {
            const pending = cfg.readCpuPendingEffect(playerKey);
            const pendingPicked = cfg.choosePendingTargetWithPolicy(playerKey, pendingType, prioritizedCandidateMoves, pending);
            if (pendingPicked) {
                cfg.cpuDebugLog(
                    `[CPU] Lv${cardLevel} ${playerKey}: ${pendingType}選択 (${pendingPicked.row}, ${pendingPicked.col}) - 反転${Array.isArray(pendingPicked.flips) ? pendingPicked.flips.length : 0}枚`
                );
                return pendingPicked;
            }
        }

        const othelloMove = (placementLevel >= 6)
            ? cfg.selectMoveFromOthelloPolicy(prioritizedCandidateMoves, playerKey, placementLevel, { forceEnabled: forceLv6Placement })
            : null;
        if (othelloMove) {
            cfg.cpuDebugLog(`[CPU] Lv${cardLevel} ${playerKey}: リバーシ専用AI選択 (${othelloMove.row}, ${othelloMove.col}) - 反転${Array.isArray(othelloMove.flips) ? othelloMove.flips.length : 0}枚`);
            return othelloMove;
        }

        const learnedMove = (placementLevel >= 6) ? cfg.selectMoveFromLearnedPolicy(prioritizedCandidateMoves, playerKey, placementLevel) : null;
        const learnedScoreFn = cfg.createLearnedScoreFn(playerKey, placementLevel, prioritizedCandidateMoves.length);
        const movePlanContext = (placementLevel >= 4) ? cfg.buildMovePlanContext(playerKey, placementLevel, prioritizedCandidateMoves) : null;
        const cpuPolicyCore = cfg.getCpuPolicyCore ? cfg.getCpuPolicyCore() : null;
        const movePlanScoreFn = (
            movePlanContext &&
            cpuPolicyCore &&
            typeof cpuPolicyCore.scoreMoveForCornerEdgePlan === 'function'
        )
            ? (move: any) => {
                try {
                    return Number(cpuPolicyCore.scoreMoveForCornerEdgePlan(move, movePlanContext) || 0);
                } catch (e) {
                    return 0;
                }
            }
            : null;

        if (learnedMove && !movePlanScoreFn) {
            cfg.cpuDebugLog(`[CPU] Lv${cardLevel} ${playerKey}: 学習選択 (${learnedMove.row}, ${learnedMove.col}) - 反転${learnedMove.flips.length}枚`);
            return learnedMove;
        }

        const combinedScoreFn = (move: any) => {
            let score = 0;
            if (movePlanScoreFn) score += movePlanScoreFn(move);
            if (learnedScoreFn) {
                const learnedWeight = movePlanScoreFn ? (placementLevel >= 6 ? 0.35 : 0.15) : 1.0;
                score += (Number(learnedScoreFn(move) || 0) * learnedWeight);
            }
            if (learnedMove && move && move.row === learnedMove.row && move.col === learnedMove.col) {
                score += movePlanScoreFn ? 1200 : 2500;
            }
            return score;
        };

        const gameState = cfg.getGameState();
        const cardState = cfg.getCardState();
        if (
            placementLevel >= 6 &&
            cpuPolicyCore &&
            typeof cpuPolicyCore.chooseMoveByLookahead === 'function' &&
            cfg.isPlayableBoard(gameState && gameState.board)
        ) {
            const playerValue = cfg.resolvePlayerValue(playerKey);
            const lv6Lookahead = cfg.buildLv6LookaheadOptions(placementLevel, gameState.board, prioritizedCandidateMoves.length, playerKey);
            const onSearchMeta = cfg.createLookaheadMetaLogger(playerKey, placementLevel, 'policy-lookahead');
            const weightConfig = cfg.resolveCpuLv6LookaheadWeights();
            const looked = cpuPolicyCore.chooseMoveByLookahead(prioritizedCandidateMoves, {
                board: gameState.board,
                playerValue,
                level: placementLevel,
                depth: lv6Lookahead.depth,
                maxBranch: lv6Lookahead.maxBranch,
                nodeBudget: lv6Lookahead.nodeBudget,
                scoreMove: combinedScoreFn,
                priorWeight: Number(weightConfig && weightConfig.policyLookaheadPriorWeight) || 62,
                searchWeight: Number(weightConfig && weightConfig.searchWeight) || 1.8,
                endgameSolveEmpties: lv6Lookahead.endgameSolveEmpties || 20,
                endgameDepth: lv6Lookahead.endgameDepth || 16,
                endgameNodeBudget: lv6Lookahead.endgameNodeBudget || 1_500_000,
                maxTimeMs: lv6Lookahead.maxTimeMs || 2_200,
                endgameMaxTimeMs: lv6Lookahead.endgameMaxTimeMs || 1_600,
                onSearchMeta,
                boardBonusByCell: (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
                    ? cardState.boardBonusByCell
                    : null,
                boardBonusConsumedByCell: (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
                    ? cardState.boardBonusConsumedByCell
                    : null
            });
            if (looked) {
                const stabilized = cfg.maybeOverrideWithStrictPendingPlacement(looked, prioritizedCandidateMoves, playerKey, movePlanScoreFn);
                if (stabilized) {
                    cfg.cpuDebugLog(`[CPU] Lv${cardLevel} ${playerKey}: 先読み選択 (${stabilized.row}, ${stabilized.col}) - 反転${stabilized.flips.length}枚`);
                    return stabilized;
                }
                cfg.cpuDebugLog(`[CPU] Lv${cardLevel} ${playerKey}: 先読み選択 (${looked.row}, ${looked.col}) - 反転${looked.flips.length}枚`);
                return looked;
            }
        }

        if (cpuPolicyCore && typeof cpuPolicyCore.chooseMove === 'function') {
            const useHeuristic = !movePlanScoreFn && placementLevel >= 3;
            const selected = cpuPolicyCore.chooseMove(prioritizedCandidateMoves, placementLevel, rng, aiSelector, {
                enableHeuristic: useHeuristic,
                scoreMove: (movePlanScoreFn || learnedScoreFn || learnedMove) ? combinedScoreFn : null
            });
            if (selected) {
                cfg.cpuDebugLog(`[CPU] Lv${cardLevel} ${playerKey}: 選択 (${selected.row}, ${selected.col}) - 反転${selected.flips.length}枚`);
                return selected;
            }
        }

        const aiSystem = cfg.getAISystem ? cfg.getAISystem() : null;
        if (!cfg.isAISystemAvailable() || !aiSystem || typeof aiSystem.selectMove !== 'function') {
            cfg.warn('[CPU] AISystem not available, using random');
            return prioritizedCandidateMoves[Math.floor(rng.random() * prioritizedCandidateMoves.length)];
        }
        try {
            const selectedMove = aiSystem.selectMove(cfg.getGameState(), cfg.getCardState(), prioritizedCandidateMoves, placementLevel, null);
            cfg.cpuDebugLog(`[CPU] Lv${cardLevel} ${playerKey}: 選択 (${selectedMove.row}, ${selectedMove.col}) - 反転${selectedMove.flips.length}枚`);
            return selectedMove;
        } catch (e) {
            cfg.warn('[CPU] AISystem.selectMove failed, falling back to random', e);
            return candidateMoves[Math.floor(rng.random() * candidateMoves.length)];
        }
    }

    return {
        selectCpuMoveWithPolicy
    };
}

module.exports = {
    createCpuDecisionMoveSelection
};
