export type CpuDecisionOnnxMoveDeps = {
  getCurrentCpuBoard: () => any;
  resolvePendingType: (playerKey: any) => any;
  shouldUseOthelloOnnxRuntime: () => boolean;
  shouldForceCardModeLv6Placement: (playerKey: any, pendingType: any, boardRef: any) => any;
  isOthelloModeForCpuDecision: () => boolean;
  resolveOthelloOnnxRuntime: () => any;
  resolvePolicyOnnxRuntime: () => any;
  canUseStandardBoardCpuPolicy: (boardRef: any, featureKey: any, playerKey: any, level: any) => any;
  filterMovesByLv6PlacementPriority: (playerKey: any, level: any, candidateMoves: any) => any;
  filterLv6OpenCornerAdjacentMoves: (candidateMoves: any, board: any) => any;
  evaluateCpuOnnxLatencyGate: (runtime: any, operationKey: any, level: any) => any;
  logCpuOnnxLatencyDegrade: (level: any, playerKey: any, operationKey: any, reason: any) => any;
  resolveCpuLv6OnnxRuntimeBudgetMs: (level: any, operationKey: any) => any;
  awaitCpuPromiseWithinBudget: (factory: any, budgetMs: any, timeoutValue: any) => Promise<any>;
  getCpuOnnxBudgetTimeout: () => any;
  buildOnnxContext: (playerKey: any, level: any, legalMovesCount: any, handCardIds: any, usableCardIds: any, candidateMoves?: any) => any;
  getHandCardIdsForPlayer: (playerKey: any) => any[];
  resolveCandidateMoveByCoord: (candidateMoves: any, move: any) => any;
  refineOnnxMoveByTacticalPlan: (candidateMoves: any, selectedMove: any, playerKey: any, level: any) => any;
  selectMoveByLookahead: (candidateMoves: any, playerKey: any, level: any, onnxSelectedMove: any) => any;
  isSameMoveByCoord: (a: any, b: any) => any;
  cpuDebugLog: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

const DEFAULT_NON_LV6_ONNX_MOVE_BUDGET_MS = 120;

function resolveOnnxMoveBudgetMs(level: any, configuredBudgetMs: any): number {
  const configured = Number(configuredBudgetMs);
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
  const normalizedLevel = Number(level);
  if (Number.isFinite(normalizedLevel) && normalizedLevel < 6) {
    return DEFAULT_NON_LV6_ONNX_MOVE_BUDGET_MS;
  }
  return 0;
}

export function createCpuDecisionOnnxMove(deps: CpuDecisionOnnxMoveDeps) {
  async function selectMoveFromOnnxPolicyAsync(candidateMoves: any, playerKey: any, level: any): Promise<any> {
    const board = deps.getCurrentCpuBoard();
    const pendingType = deps.resolvePendingType(playerKey);
    const forceCardModeOthelloPlacement = Number.isFinite(level) &&
      level >= 6 &&
      deps.shouldUseOthelloOnnxRuntime() &&
      deps.shouldForceCardModeLv6Placement(playerKey, pendingType, board);
    const useOthelloOnnx = deps.shouldUseOthelloOnnxRuntime() &&
      (deps.isOthelloModeForCpuDecision() || forceCardModeOthelloPlacement);
    const runtime = useOthelloOnnx ? deps.resolveOthelloOnnxRuntime() : deps.resolvePolicyOnnxRuntime();
    if (!runtime || typeof runtime.chooseMove !== 'function') return null;
    if (!deps.canUseStandardBoardCpuPolicy(board, useOthelloOnnx ? 'othello-onnx-move' : 'onnx-move', playerKey, level)) return null;
    let prioritizedCandidateMoves = useOthelloOnnx
      ? (Array.isArray(candidateMoves) ? candidateMoves : [])
      : deps.filterMovesByLv6PlacementPriority(playerKey, level, candidateMoves);
    if (!useOthelloOnnx && Number.isFinite(level) && level >= 6) {
      prioritizedCandidateMoves = deps.filterLv6OpenCornerAdjacentMoves(prioritizedCandidateMoves, board);
    }
    const preGate = deps.evaluateCpuOnnxLatencyGate(runtime, 'chooseMove', level);
    if (preGate.shouldDegrade) {
      deps.logCpuOnnxLatencyDegrade(level, playerKey, 'chooseMove', preGate.reason);
      return null;
    }
    const budgetMs = resolveOnnxMoveBudgetMs(level, deps.resolveCpuLv6OnnxRuntimeBudgetMs(level, 'chooseMove'));
    try {
      const handCardIds = deps.getHandCardIdsForPlayer(playerKey);
      const selected = await deps.awaitCpuPromiseWithinBudget(
        (abortSignal: AbortSignal | null) => runtime.chooseMove(
          prioritizedCandidateMoves,
          useOthelloOnnx
            ? { playerKey, level, board, legalMovesCount: prioritizedCandidateMoves.length, abortSignal }
            : Object.assign(
              {},
              deps.buildOnnxContext(playerKey, level, prioritizedCandidateMoves.length, handCardIds, null),
              { abortSignal }
            )
        ),
        budgetMs,
        deps.getCpuOnnxBudgetTimeout()
      );
      if (selected === deps.getCpuOnnxBudgetTimeout()) {
        deps.logCpuOnnxLatencyDegrade(level, playerKey, 'chooseMove', `timeout budget=${budgetMs}ms`);
        return null;
      }
      const postGate = deps.evaluateCpuOnnxLatencyGate(runtime, 'chooseMove', level);
      if (postGate.shouldDegrade) {
        deps.logCpuOnnxLatencyDegrade(level, playerKey, 'chooseMove', postGate.reason);
        return null;
      }
      if (useOthelloOnnx) {
        const resolved = deps.resolveCandidateMoveByCoord(prioritizedCandidateMoves, selected) || selected;
        if (resolved) {
          deps.cpuDebugLog(`[CPU] Lv${level} ${playerKey}: リバーシONNX選択 (${resolved.row},${resolved.col})`);
        }
        return resolved;
      }
      const tactical = deps.refineOnnxMoveByTacticalPlan(prioritizedCandidateMoves, selected, playerKey, level);
      if (!Number.isFinite(level) || level < 6) {
        return tactical;
      }
      const searched = deps.selectMoveByLookahead(prioritizedCandidateMoves, playerKey, level, selected);
      if (!searched) return tactical;
      const resolved = deps.resolveCandidateMoveByCoord(prioritizedCandidateMoves, searched) || searched;
      if (tactical && !deps.isSameMoveByCoord(resolved, tactical)) {
        deps.cpuDebugLog(
          `[CPU] Lv${level} ${playerKey}: ONNX手を先読み補正 (${tactical.row},${tactical.col}) -> (${resolved.row},${resolved.col})`
        );
      }
      return resolved;
    } catch (e: any) {
      deps.warn(
        useOthelloOnnx
          ? '[CPU] othello ONNX runtime failed, fallback to default policy'
          : '[CPU] policy-onnx runtime failed, fallback to default policy',
        e
      );
      return null;
    }
  }

  return {
    selectMoveFromOnnxPolicyAsync
  };
}

module.exports = {
  createCpuDecisionOnnxMove
};
