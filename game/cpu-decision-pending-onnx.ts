type CpuDecisionPendingOnnxConfig = {
    getHandCardIdsForPlayer: (playerKey: any) => any[];
    buildOnnxContext: (playerKey: any, level: any, legalMovesCount: any, handCardIds: any, usableCardIds: any, candidateMoves?: any) => any;
    resolveCurrentLegalMovesCountForPlayer: (playerKey: any) => any;
    getCurrentCpuBoard: () => any;
    isPlayableBoard: (board: any) => any;
    resolvePlayerValue: (playerKey: any) => any;
    simulatePendingPlacementBoard: (board: any, playerValue: any, target: any) => any;
    cloneBoardForCpu: (board: any) => any;
    setBoardCellValue: (board: any, row: any, col: any, value: any) => any;
    awaitCpuPromiseWithinBudget: (promiseFactory: any, budgetMs: any, timeoutValue: any) => Promise<any>;
    getPendingSelectionOnnxTimeout: () => any;
    getPendingSelectionValueWeight: () => number;
    resolveCandidateMoveByCoord: (candidates: any, selected: any) => any;
    choosePendingTargetWithPolicy: (playerKey: any, pendingType: any, targets: any, pending: any) => any;
    isSameMoveByCoord: (a: any, b: any) => any;
    scorePendingTargetByType: (playerKey: any, pendingType: any, target: any, pending: any) => any;
    getCpuSmartnessLevel: (playerKey: any) => any;
    resolvePolicyOnnxRuntime: () => any;
    canUseStandardBoardCpuPolicy: (boardRef: any, featureKey: any, playerKey: any, level: any) => any;
    resolvePendingSelectionOnnxBudgetMs: (level: any) => any;
    evaluateCpuOnnxLatencyGate: (runtime: any, operation: any, level: any) => any;
    logCpuOnnxLatencyDegrade: (level: any, playerKey: any, operation: any, reason: any) => any;
    getCpuOnnxBudgetTimeout: () => any;
    cpuDebugLog: (...args: any[]) => any;
    warn: (...args: any[]) => any;
};

export function createCpuDecisionPendingOnnx(config: CpuDecisionPendingOnnxConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionPendingOnnxConfig;
    const directionAwarePendingTypes = new Set([
        'BOARD_EXPANSION_WILL',
        'BOARD_EXPANSION_GOD'
    ]);

    function buildPendingTargetOnnxContext(playerKey: any, level: any, pendingType: any, targets: any): any {
        const handCardIds = cfg.getHandCardIdsForPlayer(playerKey);
        const context = cfg.buildOnnxContext(
            playerKey,
            level,
            cfg.resolveCurrentLegalMovesCountForPlayer(playerKey),
            handCardIds,
            null,
            targets
        );
        context.pendingType = pendingType || context.pendingType;
        return context;
    }

    function simulateBoardForPendingTarget(playerKey: any, pendingType: any, target: any): any {
        const board = cfg.getCurrentCpuBoard();
        if (!cfg.isPlayableBoard(board) || !target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return null;
        const type = String(pendingType || '');
        const playerValue = cfg.resolvePlayerValue(playerKey);

        if (type === 'FREE_PLACEMENT' || type === 'LAST_RESORT') {
            return cfg.simulatePendingPlacementBoard(board, playerValue, target);
        }

        if (type === 'DESTROY_ONE_STONE') {
            const next = cfg.cloneBoardForCpu(board);
            cfg.setBoardCellValue(next, target.row, target.col, 0);
            return next;
        }

        return null;
    }

    function buildPendingTargetValueContext(baseContext: any, pendingType: any, target: any, boardOverride: any): any {
        const normalizedTarget = (target && Number.isFinite(target.row) && Number.isFinite(target.col))
            ? {
                row: Number(target.row),
                col: Number(target.col),
                flips: Array.isArray(target.flips) ? target.flips.slice() : []
            }
            : null;
        return Object.assign({}, baseContext || {}, {
            pendingType: pendingType || (baseContext && baseContext.pendingType) || null,
            board: boardOverride || (baseContext && baseContext.board) || null,
            candidateMoves: normalizedTarget ? [normalizedTarget] : [],
            legalMovesCount: normalizedTarget ? 1 : ((baseContext && baseContext.legalMovesCount) || 0)
        });
    }

    async function evaluatePendingTargetValue(runtime: any, baseContext: any, playerKey: any, level: any, pendingType: any, target: any, budgetMs: any): Promise<any> {
        if (!runtime || typeof runtime.evaluatePosition !== 'function') return null;
        const valueBudgetMs = Number.isFinite(budgetMs) && budgetMs > 0
            ? Math.max(12, Math.floor(budgetMs / 2))
            : 0;
        const boardOverride = simulateBoardForPendingTarget(playerKey, pendingType, target);
        const valueContext = buildPendingTargetValueContext(baseContext, pendingType, target, boardOverride);
        const timeoutValue = cfg.getPendingSelectionOnnxTimeout();
        const value = await cfg.awaitCpuPromiseWithinBudget(
            (abortSignal: AbortSignal | null) => runtime.evaluatePosition(Object.assign({}, valueContext, { abortSignal })),
            valueBudgetMs,
            timeoutValue
        );
        if (value === timeoutValue) return null;
        return Number.isFinite(Number(value)) ? Number(value) : null;
    }

    function resolvePendingTargetOverrideThreshold(pendingType: any): any {
        const type = String(pendingType || '');
        if (type === 'FREE_PLACEMENT' || type === 'LAST_RESORT') return 240;
        return 24;
    }

    async function rerankOnnxPendingTargetChoice(runtime: any, selectedTarget: any, playerKey: any, level: any, pendingType: any, targets: any, pending: any, baseContext: any, budgetMs: any): Promise<any> {
        const selected = cfg.resolveCandidateMoveByCoord(targets, selectedTarget) || selectedTarget;
        const fallback = cfg.choosePendingTargetWithPolicy(playerKey, pendingType, targets, pending);
        if (!selected || !fallback || cfg.isSameMoveByCoord(selected, fallback)) {
            return { target: selected || fallback || targets[0], changed: false, gap: 0, selectedValue: null, fallbackValue: null };
        }

        const selectedHeuristic = cfg.scorePendingTargetByType(playerKey, pendingType, selected, pending);
        const fallbackHeuristic = cfg.scorePendingTargetByType(playerKey, pendingType, fallback, pending);
        let selectedComposite = Number.isFinite(selectedHeuristic) ? Number(selectedHeuristic) : Number.NEGATIVE_INFINITY;
        let fallbackComposite = Number.isFinite(fallbackHeuristic) ? Number(fallbackHeuristic) : Number.NEGATIVE_INFINITY;

        const selectedValue = await evaluatePendingTargetValue(runtime, baseContext, playerKey, level, pendingType, selected, budgetMs);
        const fallbackValue = await evaluatePendingTargetValue(runtime, baseContext, playerKey, level, pendingType, fallback, budgetMs);
        const valueWeight = cfg.getPendingSelectionValueWeight();
        if (Number.isFinite(selectedValue)) selectedComposite += selectedValue * valueWeight;
        if (Number.isFinite(fallbackValue)) fallbackComposite += fallbackValue * valueWeight;

        const gap = fallbackComposite - selectedComposite;
        const shouldOverride = (
            (!Number.isFinite(selectedComposite) && Number.isFinite(fallbackComposite)) ||
            gap >= resolvePendingTargetOverrideThreshold(pendingType)
        );

        return {
            target: shouldOverride ? fallback : selected,
            changed: shouldOverride,
            gap,
            selectedValue,
            fallbackValue
        };
    }

    async function choosePendingTargetWithPolicyAsync(playerKey: any, pendingType: any, targets: any, pending: any): Promise<any> {
        const fallback = cfg.choosePendingTargetWithPolicy(playerKey, pendingType, targets, pending);
        if (!Array.isArray(targets) || targets.length <= 0) return null;
        if (directionAwarePendingTypes.has(String(pendingType || ''))) {
            return fallback || targets[0];
        }

        const level = cfg.getCpuSmartnessLevel(playerKey);
        const runtime = cfg.resolvePolicyOnnxRuntime();
        if (
            !runtime ||
            typeof runtime.choosePendingTarget !== 'function' ||
            !Number.isFinite(level) ||
            level < 6
        ) {
            return fallback || targets[0];
        }
        if (!cfg.canUseStandardBoardCpuPolicy(null, 'onnx-pending-target', playerKey, level)) {
            return fallback || targets[0];
        }

        const budgetMs = cfg.resolvePendingSelectionOnnxBudgetMs(level);
        const baseContext = buildPendingTargetOnnxContext(playerKey, level, pendingType, targets);
        const preGate = cfg.evaluateCpuOnnxLatencyGate(runtime, 'choosePendingTarget', level);
        if (preGate.shouldDegrade) {
            cfg.logCpuOnnxLatencyDegrade(level, playerKey, 'choosePendingTarget', preGate.reason);
            return fallback || targets[0];
        }

        try {
            const timeoutValue = cfg.getCpuOnnxBudgetTimeout();
            const selected = await cfg.awaitCpuPromiseWithinBudget(
                (abortSignal: AbortSignal | null) => runtime.choosePendingTarget(
                    targets,
                    Object.assign({}, baseContext, { abortSignal })
                ),
                budgetMs,
                timeoutValue
            );
            if (selected === timeoutValue) {
                cfg.logCpuOnnxLatencyDegrade(level, playerKey, 'choosePendingTarget', `timeout ${String(pendingType || '')} budget=${budgetMs}ms`);
                return fallback || targets[0];
            }
            const postGate = cfg.evaluateCpuOnnxLatencyGate(runtime, 'choosePendingTarget', level);
            if (postGate.shouldDegrade) {
                cfg.logCpuOnnxLatencyDegrade(level, playerKey, 'choosePendingTarget', postGate.reason);
                return fallback || targets[0];
            }
            if (!selected) return fallback || targets[0];

            const reranked = await rerankOnnxPendingTargetChoice(
                runtime,
                selected,
                playerKey,
                level,
                pendingType,
                targets,
                pending,
                baseContext,
                budgetMs
            );
            if (reranked && reranked.changed) {
                const chosen = reranked.target;
                cfg.cpuDebugLog(
                    `[CPU] Lv${level} ${playerKey}: ONNX対象を再評価 ${String(pendingType || '')} gap=${Number.isFinite(reranked.gap) ? reranked.gap.toFixed(1) : 'NA'} -> (${chosen.row},${chosen.col})`
                );
            }
            return (reranked && reranked.target) || cfg.resolveCandidateMoveByCoord(targets, selected) || selected || fallback || targets[0];
        } catch (e) {
            cfg.warn('[CPU] policy-onnx pending runtime failed, fallback to default policy', e);
            return fallback || targets[0];
        }
    }

    return {
        buildPendingTargetOnnxContext,
        simulateBoardForPendingTarget,
        buildPendingTargetValueContext,
        evaluatePendingTargetValue,
        resolvePendingTargetOverrideThreshold,
        rerankOnnxPendingTargetChoice,
        choosePendingTargetWithPolicyAsync
    };
}

module.exports = {
    createCpuDecisionPendingOnnx
};
