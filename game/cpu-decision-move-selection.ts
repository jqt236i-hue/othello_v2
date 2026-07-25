import { createCpuCardQuiescenceRequest } from './ai/cpu-card-quiescence';

type CpuDecisionMoveSelectionConfig = {
    buildLv6LookaheadOptions: (level: any, board: any, legalMovesCount: any, playerKey: any) => any;
    buildMovePlanContext: (playerKey: any, level: any, candidateMoves: any) => any;
    choosePendingTargetWithPolicy: (playerKey: any, pendingType: any, targets: any, pending: any) => any;
    createLearnedScoreFn: (playerKey: any, level: any, legalMovesCount: any) => any;
    createLookaheadMetaLogger: (playerKey: any, level: any, phaseLabel: any) => any;
    cpuDebugLog: (...args: any[]) => void;
    error: (...args: any[]) => void;
    filterLv6OpenCornerAdjacentMoves: (candidateMoves: any, board: any) => any;
    filterMovesByLv6PlacementPriority: (
        playerKey: any,
        level: any,
        candidateMoves: any,
        options?: { emitDebugLog?: boolean }
    ) => any;
    getAISystem: () => any;
    getCardState: () => any;
    getBoardBonusValueAt: (row: any, col: any) => any;
    getCpuPolicyCore: () => any;
    getCpuRng: () => any;
    getCurrentCpuBoard: () => any;
    getGameState: () => any;
    isAISystemAvailable: () => any;
    isPlayableBoard: (board: any) => any;
    maybeOverrideWithStrictPendingPlacement: (selectedMove: any, candidateMoves: any, playerKey: any, movePlanScoreFn: any) => any;
    readCpuPendingEffect: (playerKey: any) => any;
    readCpuCandidateScoringBatch?: (candidateMoves: any, context: any) => any;
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

    const flipProfitThresholdByPendingType: Record<string, number> = {
        SILVER_STONE: 2,
        GOLD_STONE: 3,
        RAINBOW_STONE: 3
    };

    function normalizePendingType(pendingType: any): string {
        return String(pendingType || '').trim().toUpperCase();
    }

    function getMoveFlipCount(move: any): number {
        return Array.isArray(move && move.flips) ? move.flips.length : 0;
    }

    function getMoveBoardBonusValue(move: any): number {
        const row = Number(move && move.row);
        const col = Number(move && move.col);
        if (!Number.isInteger(row) || !Number.isInteger(col) || typeof cfg.getBoardBonusValueAt !== 'function') return 0;
        const value = Number(cfg.getBoardBonusValueAt(row, col) || 0);
        return Number.isFinite(value) && value > 0 ? value : 0;
    }

    function filterPendingEconomicPlacementMoves(candidateMoves: any, pendingType: any): any {
        if (!Array.isArray(candidateMoves) || candidateMoves.length <= 1) return candidateMoves;
        const type = normalizePendingType(pendingType);
        const minFlips = flipProfitThresholdByPendingType[type];
        if (Number.isFinite(minFlips)) {
            const profitable = candidateMoves.filter((move: any) => getMoveFlipCount(move) >= minFlips);
            return profitable.length > 0 ? profitable : candidateMoves;
        }
        if (type === 'CRYSTAL_STONE') {
            const profitable = candidateMoves.filter((move: any) => getMoveBoardBonusValue(move) >= 7);
            return profitable.length > 0 ? profitable : candidateMoves;
        }
        return candidateMoves;
    }

    function prepareCandidateMovesForPolicy(candidateMoves: any, playerKey: any, emitAdjustmentLog: boolean): any {
        const safeCandidateMoves = Array.isArray(candidateMoves) ? candidateMoves : [];
        const cardLevel = cfg.resolveCpuSmartnessLevel(playerKey);
        const pendingType = cfg.resolvePendingType(playerKey);
        const board = cfg.getCurrentCpuBoard();
        const forceLv6Placement = cfg.shouldForceCardModeLv6Placement(playerKey, pendingType, board);
        const placementLevel = forceLv6Placement ? 6 : cardLevel;
        const economicCandidateMoves = filterPendingEconomicPlacementMoves(safeCandidateMoves, pendingType);
        if (emitAdjustmentLog && economicCandidateMoves.length > 0 && economicCandidateMoves.length < safeCandidateMoves.length) {
            cfg.cpuDebugLog(
                `[CPU] Lv${cardLevel} ${playerKey}: ${normalizePendingType(pendingType)}配置を布石収支ライン以上へ補正 (${economicCandidateMoves.length}/${safeCandidateMoves.length})`
            );
        }
        let prioritizedCandidateMoves = cfg.filterMovesByLv6PlacementPriority(
            playerKey,
            placementLevel,
            economicCandidateMoves,
            { emitDebugLog: emitAdjustmentLog }
        );
        if (Number.isFinite(placementLevel) && placementLevel >= 6) {
            prioritizedCandidateMoves = cfg.filterLv6OpenCornerAdjacentMoves(prioritizedCandidateMoves, board);
        }
        return {
            board,
            cardLevel,
            forceLv6Placement,
            pendingType,
            placementLevel,
            prioritizedCandidateMoves: Array.isArray(prioritizedCandidateMoves) ? prioritizedCandidateMoves : []
        };
    }

    function prepareCpuCandidateScoringRequest(candidateMoves: any, playerKey: any, identity: any): any {
        const cardLevel = cfg.resolveCpuSmartnessLevel(playerKey);
        const pendingType = cfg.resolvePendingType(playerKey);
        const normalizedPendingType = normalizePendingType(pendingType);
        if (
            !Number.isFinite(cardLevel) ||
            cardLevel < 3 ||
            cardLevel >= 6 ||
            normalizedPendingType === 'FREE_PLACEMENT' ||
            normalizedPendingType === 'LAST_RESORT'
        ) {
            return null;
        }
        const board = cfg.getCurrentCpuBoard();
        if (cfg.shouldForceCardModeLv6Placement(playerKey, pendingType, board)) return null;
        const prepared = prepareCandidateMovesForPolicy(candidateMoves, playerKey, false);
        if (
            prepared.cardLevel < 0 ||
            !Number.isFinite(prepared.placementLevel) ||
            prepared.placementLevel < 3 ||
            prepared.placementLevel >= 6 ||
            prepared.prioritizedCandidateMoves.length < 2
        ) {
            return null;
        }
        const cpuPolicyCore = cfg.getCpuPolicyCore ? cfg.getCpuPolicyCore() : null;
        if (!cpuPolicyCore || typeof cpuPolicyCore.createExpectedCandidateScoringRequest !== 'function') return null;
        return cpuPolicyCore.createExpectedCandidateScoringRequest(
            prepared.prioritizedCandidateMoves,
            prepared.placementLevel,
            null,
            identity
        );
    }

    function buildPlacementLookaheadScoring(prepared: any, playerKey: any): any {
        const { placementLevel, prioritizedCandidateMoves } = prepared;
        const learnedMove = (placementLevel >= 6)
            ? cfg.selectMoveFromLearnedPolicy(prioritizedCandidateMoves, playerKey, placementLevel)
            : null;
        const learnedScoreFn = cfg.createLearnedScoreFn(playerKey, placementLevel, prioritizedCandidateMoves.length);
        const movePlanContext = (placementLevel >= 4)
            ? cfg.buildMovePlanContext(playerKey, placementLevel, prioritizedCandidateMoves)
            : null;
        const cpuPolicyCore = cfg.getCpuPolicyCore ? cfg.getCpuPolicyCore() : null;
        const movePlanScoreFn = (
            movePlanContext
            && cpuPolicyCore
            && typeof cpuPolicyCore.scoreMoveForCornerEdgePlan === 'function'
        )
            ? (move: any) => {
                try {
                    return Number(cpuPolicyCore.scoreMoveForCornerEdgePlan(move, movePlanContext) || 0);
                } catch (_error) {
                    return 0;
                }
            }
            : null;
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
        return {
            combinedScoreFn,
            cpuPolicyCore,
            learnedMove,
            learnedScoreFn,
            movePlanScoreFn
        };
    }

    function prepareCpuPlacementLookaheadRequest(candidateMoves: any, playerKey: any, identity: any): any {
        if (!identity || typeof identity !== 'object') return null;
        const prepared = prepareCandidateMovesForPolicy(candidateMoves, playerKey, false);
        if (
            !Number.isFinite(prepared.placementLevel)
            || prepared.placementLevel < 6
            || prepared.prioritizedCandidateMoves.length <= 0
        ) return null;
        const gameState = cfg.getGameState();
        const board = gameState && gameState.board;
        if (!cfg.isPlayableBoard(board)) return null;
        const scoring = buildPlacementLookaheadScoring(prepared, playerKey);
        if (scoring.learnedMove && !scoring.movePlanScoreFn) return null;
        const lv6Lookahead = cfg.buildLv6LookaheadOptions(
            prepared.placementLevel,
            board,
            prepared.prioritizedCandidateMoves.length,
            playerKey
        );
        const weightConfig = cfg.resolveCpuLv6LookaheadWeights();
        const cardState = cfg.getCardState();
        const priorScoreByCell = Object.fromEntries(prepared.prioritizedCandidateMoves.map((move: any) => {
            const score = Number(scoring.combinedScoreFn(move) || 0);
            return [
                `${Number(move.row)},${Number(move.col)}`,
                Number.isFinite(score) ? score : 0
            ];
        }));
        return createCpuCardQuiescenceRequest({
            requestId: `placement-lookahead:${Number(identity.runId) || 0}:${Number(identity.decisionEpoch) || 0}`,
            decisionEpoch: identity.decisionEpoch,
            stateVersion: identity.stateVersion,
            turnNumber: Number.isSafeInteger(identity.turnNumber) && Number(identity.turnNumber) >= 0
                ? Number(identity.turnNumber)
                : null,
            playerKey,
            level: prepared.placementLevel,
            playerValue: cfg.resolvePlayerValue(playerKey),
            board,
            legalMoves: prepared.prioritizedCandidateMoves,
            search: {
                depth: lv6Lookahead.depth,
                maxBranch: lv6Lookahead.maxBranch,
                nodeBudget: lv6Lookahead.nodeBudget,
                maxTimeMs: lv6Lookahead.maxTimeMs || 2_200,
                endgameSolveEmpties: lv6Lookahead.endgameSolveEmpties || 20,
                endgameDepth: lv6Lookahead.endgameDepth || 16,
                endgameNodeBudget: lv6Lookahead.endgameNodeBudget || 1_500_000,
                endgameMaxTimeMs: lv6Lookahead.endgameMaxTimeMs || 1_600
            },
            priorScoreByCell,
            priorWeight: Number(weightConfig && weightConfig.policyLookaheadPriorWeight) || 62,
            searchWeight: Number(weightConfig && weightConfig.searchWeight) || 1.8,
            boardBonusByCell: (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
                ? cardState.boardBonusByCell
                : null,
            boardBonusConsumedByCell: (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
                ? cardState.boardBonusConsumedByCell
                : null
        });
    }

    function selectCpuMoveWithPolicy(
        candidateMoves: any,
        playerKey: any,
        candidateScoringPrecomputeInput?: any,
        placementLookaheadPrecomputeInput?: any
    ): any {
        const rng = cfg.getCpuRng();
        const prepared = prepareCandidateMovesForPolicy(candidateMoves, playerKey, true);
        const {
            cardLevel,
            forceLv6Placement,
            pendingType,
            placementLevel,
            prioritizedCandidateMoves
        } = prepared;

        if (cardLevel < 0) {
            cfg.error(`[CPU] selectCpuMoveWithPolicy called for human player ${playerKey}, returning random move`);
            return candidateMoves[Math.floor(rng.random() * candidateMoves.length)];
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

        const {
            combinedScoreFn,
            cpuPolicyCore,
            learnedMove,
            learnedScoreFn,
            movePlanScoreFn
        } = buildPlacementLookaheadScoring(prepared, playerKey);

        if (learnedMove && !movePlanScoreFn) {
            cfg.cpuDebugLog(`[CPU] Lv${cardLevel} ${playerKey}: 学習選択 (${learnedMove.row}, ${learnedMove.col}) - 反転${learnedMove.flips.length}枚`);
            return learnedMove;
        }

        const gameState = cfg.getGameState();
        const cardState = cfg.getCardState();
        const placementLookaheadWasPrepared = !!(
            placementLookaheadPrecomputeInput
            && placementLookaheadPrecomputeInput.prepared === true
        );
        if (
            placementLevel >= 6 &&
            cpuPolicyCore &&
            (placementLookaheadWasPrepared || typeof cpuPolicyCore.chooseMoveByLookahead === 'function') &&
            cfg.isPlayableBoard(gameState && gameState.board)
        ) {
            const playerValue = cfg.resolvePlayerValue(playerKey);
            const lv6Lookahead = cfg.buildLv6LookaheadOptions(placementLevel, gameState.board, prioritizedCandidateMoves.length, playerKey);
            const onSearchMeta = cfg.createLookaheadMetaLogger(playerKey, placementLevel, 'policy-lookahead');
            const weightConfig = cfg.resolveCpuLv6LookaheadWeights();
            const precomputedBestMove = placementLookaheadWasPrepared
                ? placementLookaheadPrecomputeInput.bestMove
                : null;
            const looked = placementLookaheadWasPrepared
                ? prioritizedCandidateMoves.find((move: any) => (
                    move
                    && precomputedBestMove
                    && Number(move.row) === Number(precomputedBestMove.row)
                    && Number(move.col) === Number(precomputedBestMove.col)
                )) || null
                : cpuPolicyCore.chooseMoveByLookahead(prioritizedCandidateMoves, {
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
            let candidateScoringPrecompute = candidateScoringPrecomputeInput || null;
            if (!candidateScoringPrecompute && typeof cfg.readCpuCandidateScoringBatch === 'function') {
                try {
                    candidateScoringPrecompute = cfg.readCpuCandidateScoringBatch(prioritizedCandidateMoves, {
                        playerKey: String(playerKey || ''),
                        level: placementLevel
                    });
                } catch (error) {
                    candidateScoringPrecompute = null;
                    cfg.cpuDebugLog('[CPU] candidate scoring batch unavailable; using local scorer', error);
                }
            }
            const moveOptions: any = {
                enableHeuristic: useHeuristic,
                scoreMove: (movePlanScoreFn || learnedScoreFn || learnedMove) ? combinedScoreFn : null
            };
            if (candidateScoringPrecompute && typeof candidateScoringPrecompute === 'object') {
                if (candidateScoringPrecompute.expectedRequest) {
                    moveOptions.expectedCandidateScoringRequest = candidateScoringPrecompute.expectedRequest;
                }
                if (candidateScoringPrecompute.batch) {
                    moveOptions.candidateScoringBatch = candidateScoringPrecompute.batch;
                }
            }
            const selected = cpuPolicyCore.chooseMove(prioritizedCandidateMoves, placementLevel, rng, aiSelector, moveOptions);
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
        prepareCpuCandidateScoringRequest,
        prepareCpuPlacementLookaheadRequest,
        selectCpuMoveWithPolicy
    };
}

module.exports = {
    createCpuDecisionMoveSelection
};
