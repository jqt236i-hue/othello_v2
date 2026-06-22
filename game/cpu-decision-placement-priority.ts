export type CpuDecisionPlacementPriorityDeps = {
  buildMovePlanContext: (playerKey: any, level: any, candidateMoves: any) => any;
  cpuDebugLog: (...args: any[]) => void;
  getBoardCellValueSafe: (board: any, row: any, col: any) => any;
  getCornerProximity: (row: any, col: any, boardOverride: any) => any;
  getCpuPolicyCore: () => any;
  getCurrentCpuBoard: () => any;
  getMoveOpponentSpecialFlipProfile: (playerKey: any, move: any) => any;
  isCornerCell: (row: any, col: any, board?: any) => any;
  isEdgeCell: (row: any, col: any, board?: any) => any;
  resolvePendingType: (playerKey: any) => any;
  shouldRespectPendingPlacementPlanStrictly: (pendingType: any) => any;
};

export function createCpuDecisionPlacementPriority(deps: CpuDecisionPlacementPriorityDeps) {
  const ultimateImmediateAnchorPendingTypes = new Set([
    'ULTIMATE_REVERSE_DRAGON',
    'ULTIMATE_DESTROY_GOD'
  ]);

  function isUltimateImmediateAnchorPendingType(pendingType: any): boolean {
    return ultimateImmediateAnchorPendingTypes.has(String(pendingType || '').trim().toUpperCase());
  }

  function resolveMovePlayerValue(playerKey: any, move: any): number {
    const movePlayerValue = Number(move && move.playerValue !== undefined ? move.playerValue : move && move.player);
    if (Number.isFinite(movePlayerValue) && movePlayerValue !== 0) return movePlayerValue > 0 ? 1 : -1;
    const key = String(playerKey || '').trim().toLowerCase();
    if (key === 'black' || key === '1') return 1;
    return -1;
  }

  function countAdjacentEnemyCells(board: any, row: number, col: number, playerValue: number): number {
    if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const opponentValue = -playerValue;
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (deps.getBoardCellValueSafe(board, row + dr, col + dc) === opponentValue) count += 1;
      }
    }
    return count;
  }

  function filterUltimateImmediateAnchorEffectMoves(playerKey: any, pendingType: any, candidateMoves: any, board: any): any {
    if (!isUltimateImmediateAnchorPendingType(pendingType)) return candidateMoves;
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 1 || !Array.isArray(board)) return candidateMoves;

    let bestAdjacentEnemyCount = 0;
    const profiledMoves = candidateMoves.map((move: any) => {
      const row = Number(move && move.row);
      const col = Number(move && move.col);
      const adjacentEnemyCount = countAdjacentEnemyCells(board, row, col, resolveMovePlayerValue(playerKey, move));
      if (adjacentEnemyCount > bestAdjacentEnemyCount) bestAdjacentEnemyCount = adjacentEnemyCount;
      return { move, adjacentEnemyCount };
    });

    if (bestAdjacentEnemyCount <= 0) return candidateMoves;
    const narrowed = profiledMoves
      .filter((one) => one.adjacentEnemyCount === bestAdjacentEnemyCount)
      .map((one) => one.move);
    return narrowed.length > 0 ? narrowed : candidateMoves;
  }

  function scoreLv6PlacementPlanMove(playerKey: any, level: any, move: any, planContext: any): any {
    const policyCore = deps.getCpuPolicyCore();
    if (!policyCore || typeof policyCore.scoreMoveForCornerEdgePlan !== 'function') {
      return 0;
    }
    const context = planContext || deps.buildMovePlanContext(playerKey, Math.max(4, level), [move]);
    if (!context) return 0;
    const score = Number(policyCore.scoreMoveForCornerEdgePlan(move, context) || 0);
    return Number.isFinite(score) ? score : 0;
  }

  function filterLv6SpecialRemovalMoves(playerKey: any, level: any, candidateMoves: any): any {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0) return [];

    const profiledMoves = [];
    for (const move of candidateMoves) {
      const profile = deps.getMoveOpponentSpecialFlipProfile(playerKey, move);
      if (!profile || profile.count <= 0) continue;
      profiledMoves.push({ move, profile });
    }
    if (profiledMoves.length <= 1) return profiledMoves.map((one) => one.move);

    const maxCount = profiledMoves.reduce((best, one) => Math.max(best, Number(one.profile.count) || 0), 0);
    let narrowed = profiledMoves.filter((one: any) => (Number(one.profile.count) || 0) === maxCount);
    if (narrowed.length <= 1) return narrowed.map((one) => one.move);

    const maxScore = narrowed.reduce((best, one) => Math.max(best, Number(one.profile.score) || 0), 0);
    narrowed = narrowed.filter((one) => (Number(one.profile.score) || 0) === maxScore);
    if (narrowed.length <= 1) return narrowed.map((one) => one.move);

    const narrowedMoves = narrowed.map((one) => one.move);
    const planContext = deps.buildMovePlanContext(playerKey, Math.max(4, level), narrowedMoves);
    let bestPlanScore = Number.NEGATIVE_INFINITY;
    const planScored = narrowed.map((one) => {
      const planScore = scoreLv6PlacementPlanMove(playerKey, level, one.move, planContext);
      if (planScore > bestPlanScore) bestPlanScore = planScore;
      return { move: one.move, planScore };
    });
    const finalists = planScored.filter((one) => one.planScore >= (bestPlanScore - 1e-6)).map((one) => one.move);
    return finalists.length > 0 ? finalists : narrowedMoves;
  }

  function isLv6OpenCornerAdjacentCell(row: any, col: any, board: any): any {
    if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (deps.isCornerCell(row, col, board)) return false;
    const cornerHint = deps.getCornerProximity(row, col, board);
    if (!cornerHint) return false;
    return deps.getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]) === 0;
  }

  function isEdgeDangerousCornerAdjacent(row: any, col: any, board: any): any {
    if (!deps.isEdgeCell(row, col, board) || deps.isCornerCell(row, col, board)) return false;
    return isLv6OpenCornerAdjacentCell(row, col, board);
  }

  function filterLv6OpenCornerAdjacentMoves(candidateMoves: any, board: any): any {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 1 || !Array.isArray(board)) return candidateMoves;
    const safeMoves = candidateMoves.filter((move: any) => {
      if (!move) return false;
      const row = Number(move.row);
      const col = Number(move.col);
      if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
      return !isLv6OpenCornerAdjacentCell(row, col, board);
    });
    return safeMoves.length > 0 ? safeMoves : candidateMoves;
  }

  function filterLv6EdgeMovesByPlan(playerKey: any, level: any, candidateMoves: any, board: any): any {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0 || !board) return [];

    const edgeMoves = candidateMoves.filter((move: any) => {
      if (!move) return false;
      const row = Number(move.row);
      const col = Number(move.col);
      return Number.isInteger(row) && Number.isInteger(col) && !deps.isCornerCell(row, col, board) && deps.isEdgeCell(row, col, board);
    });

    const safeEdgeMoves = edgeMoves.filter((move) => {
      return !isEdgeDangerousCornerAdjacent(Number(move.row), Number(move.col), board);
    });
    if (safeEdgeMoves.length <= 0) return [];
    const policyCore = deps.getCpuPolicyCore();
    if (!policyCore || typeof policyCore.scoreMoveForCornerEdgePlan !== 'function') return safeEdgeMoves;

    const planContext = deps.buildMovePlanContext(playerKey, Math.max(4, level), candidateMoves);
    if (!planContext) return safeEdgeMoves;

    const safeEdgeSet = new Set(safeEdgeMoves);
    const edgeFinalistMargin = 1200;
    const edgeEscapeMargin = 3000;
    const strictPendingPlacement = deps.shouldRespectPendingPlacementPlanStrictly(deps.resolvePendingType(playerKey));
    let bestPlanScore = Number.NEGATIVE_INFINITY;
    let bestOverallPlanScore = Number.NEGATIVE_INFINITY;
    let bestOverallMove: any = null;
    const planScored = candidateMoves.map((move) => {
      const planScore = scoreLv6PlacementPlanMove(playerKey, level, move, planContext);
      if (safeEdgeSet.has(move) && planScore > bestPlanScore) bestPlanScore = planScore;
      if (planScore > bestOverallPlanScore) {
        bestOverallPlanScore = planScore;
        bestOverallMove = move;
      }
      return { move, planScore };
    });

    const finalists = planScored
      .filter((one) => safeEdgeSet.has(one.move) && one.planScore >= (bestPlanScore - edgeFinalistMargin))
      .map((one) => one.move);

    const bestOverallIsSafeEdge = !!bestOverallMove && safeEdgeSet.has(bestOverallMove);
    if (
      !strictPendingPlacement &&
      candidateMoves.length > safeEdgeMoves.length &&
      !bestOverallIsSafeEdge &&
      Number.isFinite(bestOverallPlanScore) &&
      Number.isFinite(bestPlanScore) &&
      (bestOverallPlanScore - bestPlanScore) >= edgeEscapeMargin
    ) {
      deps.cpuDebugLog(
        `[CPU] Lv${level} ${playerKey}: 辺優先を緩和し、内側の安全候補も保持 (${Math.round(bestOverallPlanScore - bestPlanScore)})`
      );
      return candidateMoves;
    }

    return finalists.length > 0 ? finalists : safeEdgeMoves;
  }

  function filterMovesByLv6PlacementPriority(playerKey: any, level: any, candidateMoves: any): any {
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 0) return [];
    if (!Number.isFinite(level) || level < 6) return candidateMoves;

    const board = deps.getCurrentCpuBoard();
    const pendingType = deps.resolvePendingType(playerKey);
    const effectFocusedCandidates = (board && candidateMoves.length > 1)
      ? filterUltimateImmediateAnchorEffectMoves(playerKey, pendingType, candidateMoves, board)
      : candidateMoves;
    const filteredCandidates = (board && effectFocusedCandidates.length > 1)
      ? filterLv6OpenCornerAdjacentMoves(effectFocusedCandidates, board)
      : effectFocusedCandidates;
    const candidatePool = filteredCandidates.length > 0 ? filteredCandidates : candidateMoves;

    if (board && effectFocusedCandidates.length > 0 && effectFocusedCandidates.length < candidateMoves.length) {
      deps.cpuDebugLog(
        `[CPU] Lv${level} ${playerKey}: ${String(pendingType || '')}配置を敵石隣接候補へ補正 (${effectFocusedCandidates.length}/${candidateMoves.length})`
      );
    }

    if (board && filteredCandidates.length > 0 && filteredCandidates.length < effectFocusedCandidates.length) {
      deps.cpuDebugLog(
        `[CPU] Lv${level} ${playerKey}: 角隣接の危険候補を除外 (${filteredCandidates.length}/${effectFocusedCandidates.length})`
      );
    }

    if (board) {
      const cornerMoves = candidatePool.filter((move: any) => {
        if (!move) return false;
        const row = Number(move.row);
        const col = Number(move.col);
        return Number.isInteger(row) && Number.isInteger(col) && deps.isCornerCell(row, col, board);
      });
      if (cornerMoves.length > 0) {
        deps.cpuDebugLog(
          `[CPU] Lv${level} ${playerKey}: 角合法手を最優先 (${cornerMoves.length}/${candidatePool.length})`
        );
        return cornerMoves;
      }
    }

    const prioritized = filterLv6SpecialRemovalMoves(playerKey, level, candidatePool);
    if (prioritized.length > 0) {
      let removedSpecialCount = 0;
      let strongestProfileScore = 0;
      for (const move of prioritized) {
        const profile = deps.getMoveOpponentSpecialFlipProfile(playerKey, move);
        if (!profile) continue;
        removedSpecialCount += Number(profile.count) || 0;
        strongestProfileScore = Math.max(strongestProfileScore, Number(profile.score) || 0);
      }
      deps.cpuDebugLog(
        `[CPU] Lv${level} ${playerKey}: 相手特殊石を反転除去できる候補を優先 (${prioritized.length}/${candidatePool.length}, 対象${removedSpecialCount}個, 最大優先値${strongestProfileScore})`
      );
      return prioritized;
    }

    const edgeMoves = filterLv6EdgeMovesByPlan(playerKey, level, candidatePool, board);
    if (edgeMoves.length > 0) {
      deps.cpuDebugLog(
        `[CPU] Lv${level} ${playerKey}: 安全な辺手を優先 (${edgeMoves.length}/${candidatePool.length})`
      );
      return edgeMoves;
    }

    return candidatePool;
  }

  return {
    filterLv6OpenCornerAdjacentMoves,
    filterMovesByLv6PlacementPriority,
    scoreLv6PlacementPlanMove
  };
}

module.exports = {
  createCpuDecisionPlacementPriority
};
