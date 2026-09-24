import {
    measureCpuTurnSync,
    readCpuTurnPerformanceNowMs,
    recordCpuTurnPerformanceInterval,
    withCpuTurnPerformanceOptions,
    type CpuTurnPerformanceScope
} from './cpu-turn-performance';

import { avoidTacticalBlunder } from './ai/cpu-tactical-safety';

type CpuTurnMovePhaseConfig = {
    blackValue: any;
    countOwnedBasicCornersSafe: (state: any, playerKey: any) => any;
    debugCpuTrace: (message: any, meta?: any) => any;
    emitCpuCommentary: (eventType: any, playerKey: any, extra: any, analysisOptions?: any) => any;
    emitCpuDebugLog: (message: any, kind?: any, meta?: any) => any;
    getActiveProtectionSafe: (playerValue: any) => any;
    getAnimationRetryDelayMs: () => any;
    getCardState: () => any;
    getCardUsabilityAnalysis?: (playerKey: any) => any;
    getCurrentPlayerKeySafe: () => any;
    getCurrentStateVersionSafe: () => number | string | null;
    getCurrentTurnNumberSafe: () => any;
    getFlipBlockersSafe: () => any;
    getGameState: () => any;
    getPrepareCpuCandidateScoringRequestFn: () => any;
    getPrepareCpuPlacementLookaheadRequestFn: () => any;
    getScoreCandidatesInWorkerFn: () => any;
    getSearchCpuPlacementLookaheadInWorkerFn: () => any;
    getSelectMoveFromOnnxFn: () => any;
    getUseCardWithPolicyFn: () => any;
    handleCpuTurnError: (
        playerKey: any,
        selfName: any,
        error: any,
        autoMode: any,
        performanceScope?: CpuTurnPerformanceScope | null
    ) => any;
    isAborted?: () => boolean;
    isCpuDebugLogAvailable: () => any;
    isUiAnimationBusy: () => any;
    readNowMs: () => any;
    resetPendingSelectRetryState: (playerKey: any) => any;
    resolveCpuCardLogic: () => any;
    resolveExecuteMoveFn: () => any;
    resolveGenerateMovesForPlayer: () => any;
    resolveLv6MinThinkMs: (playerKey: any, level: any, autoMode: any) => any;
    resolveProcessPassTurn: () => any;
    scheduleRetry: (fn: any, delayMs?: any) => any;
    scheduleRunCpuTurn: (playerKey: any, options: any, delayMs: any) => any;
    selectCpuMoveSafe: (
        candidateMoves: any,
        playerKey: any,
        candidateScoringPrecompute?: any,
        placementLookaheadPrecompute?: any
    ) => any;
    disableSynchronousPlacementLookaheadFallback?: boolean;
    setCpuProcessing: (active: any) => any;
    shouldAbortCpuForHumanMode: (playerKey: any, context: any) => any;
    shouldUseOnnxMoveDecision: (level: any) => any;
    tryApplyAnyUsableCard: (playerKey: any, level?: any, legalMovesCount?: any, legalMoves?: any[], prepared?: any) => any;
    whiteValue: any;
};

function normalizePlayerKeyFromValue(value: any, blackValue: any, whiteValue: any): any {
    if (value === blackValue || value === 'black') return 'black';
    if (value === whiteValue || value === 'white') return 'white';
    return null;
}

export function createCpuTurnMovePhase(config: CpuTurnMovePhaseConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuTurnMovePhaseConfig;
    let candidateScoringDecisionEpoch = 0;

    function readNowMs(): number {
        if (typeof cfg.readNowMs === 'function') {
            const value = Number(cfg.readNowMs());
            if (Number.isFinite(value)) return value;
        }
        return Date.now();
    }

    function abortIfNeeded(): boolean {
        if (typeof cfg.isAborted !== 'function' || cfg.isAborted() !== true) return false;
        cfg.setCpuProcessing(false);
        return true;
    }

    function isRuntimeUnavailableResult(result: any): boolean {
        if (!result || typeof result !== 'object') return false;
        const reason = String(result.reason || result.rejectedReason || '').trim().toUpperCase();
        if (reason === 'RUNTIME_UNAVAILABLE') return true;
        const nested = result.result;
        if (!nested || typeof nested !== 'object') return false;
        return String(nested.reason || nested.rejectedReason || '').trim().toUpperCase() === 'RUNTIME_UNAVAILABLE';
    }

    async function runCpuTurnMovePhase(args: any): Promise<any> {
        const opts = (args && typeof args === 'object') ? args : {};
        const playerKey = opts.playerKey;
        const autoMode = opts.autoMode === true;
        const level = opts.level;
        const selfColor = opts.selfColor;
        const selfName = opts.selfName;
        const othelloMode = opts.othelloMode === true;
        const pending = opts.pending || null;
        const analysisSeed = opts.analysisSeed || null;
        const analysisInvocation = opts.analysisInvocation || null;
        let preparedCardDecision = opts.preparedCardDecision || null;
        const isAnalysisCurrent = typeof opts.isAnalysisCurrent === 'function'
            ? opts.isAnalysisCurrent
            : null;
        const performanceScope = (opts.performanceScope || null) as CpuTurnPerformanceScope | null;
        const resumeOptionBase: any = { autoMode };
        if (opts.minThinkSatisfied === true) resumeOptionBase.cpuMinThinkSatisfied = true;
        if (opts.skipAsyncDecision === true) resumeOptionBase.cpuSkipAsyncDecision = true;
        const resumeOptions = performanceScope
            ? withCpuTurnPerformanceOptions(resumeOptionBase, performanceScope.correlationId, level)
            : resumeOptionBase;
        const turnStartMs = Number.isFinite(opts.turnStartMs) ? opts.turnStartMs : readNowMs();
        const expectedTurnNumber = cfg.getCurrentTurnNumberSafe();
        const expectedStateVersion = typeof cfg.getCurrentStateVersionSafe === 'function'
            ? cfg.getCurrentStateVersionSafe()
            : null;

        if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };

        const invokeCpuPass = async (passFn: any, passOptions: any): Promise<any> => {
            if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
            const passPromise = performanceScope
                ? Promise.resolve(passFn(playerKey, passOptions, { performanceScope }))
                : Promise.resolve(passFn(playerKey, passOptions));
            const waitStartedAtMs = performanceScope ? readCpuTurnPerformanceNowMs(performanceScope) : null;
            let result: any;
            try {
                result = await passPromise;
                if (performanceScope && waitStartedAtMs !== null) {
                    recordCpuTurnPerformanceInterval(
                        performanceScope,
                        'presentation-handoff',
                        'wait',
                        waitStartedAtMs,
                        readCpuTurnPerformanceNowMs(performanceScope),
                        result === false ? 'stale' : 'handled'
                    );
                }
            } catch (error) {
                if (performanceScope && waitStartedAtMs !== null) {
                    recordCpuTurnPerformanceInterval(
                        performanceScope,
                        'presentation-handoff',
                        'wait',
                        waitStartedAtMs,
                        readCpuTurnPerformanceNowMs(performanceScope),
                        'error'
                    );
                }
                if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                throw error;
            }
            if (abortIfNeeded() || isRuntimeUnavailableResult(result)) {
                cfg.setCpuProcessing(false);
                return { status: 'handled', reason: 'runtime_unavailable' };
            }
            if (result === false) {
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                return { status: 'retry' };
            }
            cfg.resetPendingSelectRetryState(playerKey);
            return { status: 'pass' };
        };

        const deriveCandidates = () => {
            if (analysisInvocation && typeof analysisInvocation.derivePlacementAnalysis === 'function') {
                const priorCardAnalysis = preparedCardDecision && preparedCardDecision.cardAnalysis
                    ? preparedCardDecision.cardAnalysis
                    : (typeof analysisInvocation.peekCardDecisionAnalysis === 'function'
                        ? analysisInvocation.peekCardDecisionAnalysis()
                        : null);
                const placement = analysisInvocation.derivePlacementAnalysis(priorCardAnalysis);
                return placement && Array.isArray(placement.placementCandidates)
                    ? Array.from(placement.placementCandidates)
                    : [];
            }
            const protection = cfg.getActiveProtectionSafe(selfColor);
            const perma = cfg.getFlipBlockersSafe();
            const generateMovesForPlayerFn = cfg.resolveGenerateMovesForPlayer();
            return generateMovesForPlayerFn
                ? generateMovesForPlayerFn(selfColor, pending, protection, perma)
                : [];
        };
        const candidateMoves: any[] = performanceScope
            ? measureCpuTurnSync(performanceScope, 'move-candidates', deriveCandidates)
            : deriveCandidates();

        if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };

        if (!candidateMoves.length) {
            const cardState = cfg.getCardState();
            const gameState = cfg.getGameState();
            const resolveCardUsability = () => {
                if (typeof cfg.getCardUsabilityAnalysis === 'function') {
                    return cfg.getCardUsabilityAnalysis(playerKey);
                }
                const cardLogicForRetry = cfg.resolveCpuCardLogic();
                if (cardLogicForRetry && typeof cardLogicForRetry.analyzeCardUsability === 'function') {
                    return cardLogicForRetry.analyzeCardUsability(cardState, gameState, playerKey);
                }
                if (cardLogicForRetry && typeof cardLogicForRetry.getUsableCardIds === 'function') {
                    const ids = cardLogicForRetry.getUsableCardIds(cardState, gameState, playerKey);
                    return { usableCardIds: Array.isArray(ids) ? ids : [] };
                }
                if (cardLogicForRetry && typeof cardLogicForRetry.hasUsableCard === 'function') {
                    const hand = cardState && cardState.hands && Array.isArray(cardState.hands[playerKey])
                        ? cardState.hands[playerKey]
                        : [];
                    const hasUsableCard = cardLogicForRetry.hasUsableCard(cardState, gameState, playerKey) === true;
                    return {
                        hasUsableCard,
                        usableCardIds: hasUsableCard
                            ? hand.slice()
                            : []
                    };
                }
                return { usableCardIds: [] };
            };
            const cardUsability = analysisSeed && analysisSeed.cardUsability
                ? analysisSeed.cardUsability
                : (performanceScope
                    ? measureCpuTurnSync(
                        performanceScope,
                        'card-availability',
                        resolveCardUsability
                    )
                    : resolveCardUsability());
            if (!preparedCardDecision || typeof preparedCardDecision !== 'object') {
                preparedCardDecision = {};
            }
            if (
                analysisInvocation
                && typeof analysisInvocation.deriveCardDecisionAnalysis === 'function'
                && cardUsability
                && Array.isArray(cardUsability.usableCardIds)
                && cardUsability.usableCardIds.length > 0
                && !preparedCardDecision.cardAnalysis
            ) {
                const cardAnalysis = analysisInvocation.deriveCardDecisionAnalysis();
                preparedCardDecision.cardAnalysis = cardAnalysis;
                preparedCardDecision.legalMoves = Array.from(cardAnalysis.cardLegalMoves || []);
                preparedCardDecision.legalMovesCount = preparedCardDecision.legalMoves.length;
                preparedCardDecision.decisionContext = cardAnalysis.boardMetrics;
            }
            preparedCardDecision.cardState = cardState;
            preparedCardDecision.gameState = gameState;
            preparedCardDecision.playerKey = playerKey;
            preparedCardDecision.usability = cardUsability;
            preparedCardDecision.handSnapshot = cardState
                && cardState.hands
                && Array.isArray(cardState.hands[playerKey])
                ? cardState.hands[playerKey].slice()
                : [];
            const stillUsableCard = !!(
                cardUsability
                && (
                    cardUsability.hasUsableCard === true
                    || (Array.isArray(cardUsability.usableCardIds) && cardUsability.usableCardIds.length > 0)
                )
            );
            if (!othelloMode && stillUsableCard) {
                if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                const expectedRetryTurnNumber = cfg.getCurrentTurnNumberSafe();
                let retried = false;
                const useCardWithPolicyFn = cfg.getUseCardWithPolicyFn();
                if (typeof useCardWithPolicyFn === 'function') {
                    retried = performanceScope
                        ? measureCpuTurnSync(
                            performanceScope,
                            'card-context-base',
                            () => !!useCardWithPolicyFn(playerKey, performanceScope, preparedCardDecision)
                        )
                        : !!useCardWithPolicyFn(playerKey, null, preparedCardDecision);
                }
                if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                const currentPlayerKeyAfterRetry = cfg.getCurrentPlayerKeySafe();
                const currentTurnNumberAfterRetry = cfg.getCurrentTurnNumberSafe();
                if (
                    (currentPlayerKeyAfterRetry && currentPlayerKeyAfterRetry !== playerKey) ||
                    (expectedRetryTurnNumber !== null && currentTurnNumberAfterRetry !== expectedRetryTurnNumber)
                ) {
                    cfg.setCpuProcessing(false);
                    return { status: 'handled' };
                }
                if (!retried) {
                    if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                    retried = performanceScope
                        ? measureCpuTurnSync(
                            performanceScope,
                            'card-context-base',
                            () => cfg.tryApplyAnyUsableCard(playerKey, level, 0, [], preparedCardDecision)
                        )
                        : cfg.tryApplyAnyUsableCard(playerKey, level, 0, [], preparedCardDecision);
                    if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                }
                if (retried) {
                    cfg.setCpuProcessing(false);
                    cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                    return { status: 'retry' };
                }
            }
            const passFn = cfg.resolveProcessPassTurn();
            if (passFn) {
                if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                if (cfg.shouldAbortCpuForHumanMode(playerKey, 'before_pass')) {
                    return { status: 'handled' };
                }
                if (performanceScope) {
                    measureCpuTurnSync(performanceScope, 'commentary-context', () => {
                        cfg.emitCpuCommentary('pass', playerKey, {
                            level,
                            legalMovesCount: 0
                        }, {
                            invocation: analysisInvocation,
                            snapshotMoment: 'turn-start'
                        });
                    });
                } else {
                    cfg.emitCpuCommentary('pass', playerKey, {
                        level,
                        legalMovesCount: 0
                    }, {
                        invocation: analysisInvocation,
                        snapshotMoment: 'turn-start'
                    });
                }
                // Card retries can leave a placement pending even when they return false.
                // The turn-entry snapshot is no longer authoritative at the pass boundary.
                const latestCardState = cfg.getCardState();
                const latestPending = latestCardState?.pendingEffectByPlayer
                    ? latestCardState.pendingEffectByPlayer[playerKey]
                    : pending;
                const hasPendingAction = !!latestPending;
                const passOptions = (stillUsableCard || hasPendingAction)
                    ? { autoMode }
                    : { autoMode, autoNoActionPass: true };
                return invokeCpuPass(passFn, passOptions);
            } else {
                console.error('[AI] processPassTurn is not available');
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                return { status: 'retry' };
            }
        }

        let move: any = null;
        // Lv1 fast path: 強さを犠牲にして即ランダム着手 (応答性最優先)
        // ONNX 試行・CpuPolicy 経路を全てスキップするため move は同期的に確定する。
        const cardLevel = Number(level);
        if (Number.isFinite(cardLevel) && cardLevel === 1 && candidateMoves.length > 0) {
            move = candidateMoves[Math.floor(Math.random() * candidateMoves.length)];
            if (cfg.isCpuDebugLogAvailable()) {
                cfg.emitCpuDebugLog(`[CPU] Lv1 ${playerKey}: fast random move (${move.row},${move.col})`, 'info', {
                    playerKey,
                    selectedMove: { row: move.row, col: move.col },
                    candidateCount: candidateMoves.length
                });
            }
        }
        if (!move) {
            const selectMoveFromOnnx = cfg.getSelectMoveFromOnnxFn();
            if (opts.skipAsyncDecision !== true && cfg.shouldUseOnnxMoveDecision(level) && typeof selectMoveFromOnnx === 'function') {
                let onnxWaitStartedAtMs: number | null = null;
                try {
                    const onnxPromise = performanceScope
                        ? measureCpuTurnSync(
                            performanceScope,
                            'move-candidates',
                            () => Promise.resolve(selectMoveFromOnnx(candidateMoves, playerKey, level))
                        )
                        : Promise.resolve(selectMoveFromOnnx(candidateMoves, playerKey, level));
                    onnxWaitStartedAtMs = performanceScope ? readCpuTurnPerformanceNowMs(performanceScope) : null;
                    move = await onnxPromise;
                    if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                    if (isAnalysisCurrent && !isAnalysisCurrent(true)) {
                        if (performanceScope && onnxWaitStartedAtMs !== null) {
                            recordCpuTurnPerformanceInterval(
                                performanceScope,
                                'move-candidates',
                                'wait',
                                onnxWaitStartedAtMs,
                                readCpuTurnPerformanceNowMs(performanceScope),
                                'stale'
                            );
                        }
                        cfg.setCpuProcessing(false);
                        cfg.scheduleRunCpuTurn(playerKey, {
                            ...resumeOptions,
                            cpuSkipAsyncDecision: true
                        }, 0);
                        return { status: 'handled' };
                    }
                    const abortAfterOnnx = cfg.shouldAbortCpuForHumanMode(playerKey, 'after_onnx_move_decision');
                    if (performanceScope && onnxWaitStartedAtMs !== null) {
                        recordCpuTurnPerformanceInterval(
                            performanceScope,
                            'move-candidates',
                            'wait',
                            onnxWaitStartedAtMs,
                            readCpuTurnPerformanceNowMs(performanceScope),
                            abortAfterOnnx ? 'handled' : 'continue'
                        );
                    }
                    if (abortAfterOnnx) {
                        return { status: 'handled' };
                    }
                } catch (e) {
                    if (performanceScope && onnxWaitStartedAtMs !== null) {
                        recordCpuTurnPerformanceInterval(
                            performanceScope,
                            'move-candidates',
                            'wait',
                            onnxWaitStartedAtMs,
                            readCpuTurnPerformanceNowMs(performanceScope),
                            'error'
                        );
                    }
                    if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                    cfg.debugCpuTrace('[AI] selectMoveFromOnnxPolicyAsync failed; fallback to policy table/core', {
                        playerKey,
                        error: e && (e as any).message ? (e as any).message : String(e)
                    });
                    if (isAnalysisCurrent && !isAnalysisCurrent(true)) {
                        cfg.setCpuProcessing(false);
                        cfg.scheduleRunCpuTurn(playerKey, {
                            ...resumeOptions,
                            cpuSkipAsyncDecision: true
                        }, 0);
                        return { status: 'handled' };
                    }
                }
            }
            if (!move) {
                let placementLookaheadPrecompute: any = null;
                const preparedCardBestMove = preparedCardDecision
                    && preparedCardDecision.quiescencePrepared === true
                    && preparedCardDecision.quiescenceSnapshot
                    ? preparedCardDecision.quiescenceSnapshot.bestMove
                    : null;
                if (preparedCardBestMove) {
                    placementLookaheadPrecompute = {
                        prepared: true,
                        bestMove: preparedCardBestMove
                    };
                } else if (Number(level) >= 6 && opts.skipAsyncDecision !== true) {
                    const preparePlacementLookahead = typeof cfg.getPrepareCpuPlacementLookaheadRequestFn === 'function'
                        ? cfg.getPrepareCpuPlacementLookaheadRequestFn()
                        : null;
                    const searchPlacementLookahead = typeof cfg.getSearchCpuPlacementLookaheadInWorkerFn === 'function'
                        ? cfg.getSearchCpuPlacementLookaheadInWorkerFn()
                        : null;
                    if (typeof preparePlacementLookahead === 'function' && typeof searchPlacementLookahead === 'function') {
                        const identity = analysisSeed && analysisSeed.identity
                            ? analysisSeed.identity
                            : {
                                runId: 0,
                                decisionEpoch: ++candidateScoringDecisionEpoch,
                                stateVersion: expectedStateVersion,
                                turnNumber: Number.isSafeInteger(expectedTurnNumber) && expectedTurnNumber >= 0
                                    ? expectedTurnNumber
                                    : null
                            };
                        let workerWaitStartedAtMs: number | null = null;
                        try {
                            const request = performanceScope
                                ? measureCpuTurnSync(
                                    performanceScope,
                                    'move-candidates',
                                    () => preparePlacementLookahead(
                                        candidateMoves,
                                        playerKey,
                                        identity
                                    )
                                )
                                : preparePlacementLookahead(
                                    candidateMoves,
                                    playerKey,
                                    identity
                                );
                            if (request) {
                                workerWaitStartedAtMs = performanceScope
                                    ? readCpuTurnPerformanceNowMs(performanceScope)
                                    : null;
                                const batch = await Promise.resolve(searchPlacementLookahead(request));
                                if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                                if (performanceScope && workerWaitStartedAtMs !== null) {
                                    recordCpuTurnPerformanceInterval(
                                        performanceScope,
                                        'move-candidates',
                                        'wait',
                                        workerWaitStartedAtMs,
                                        readCpuTurnPerformanceNowMs(performanceScope),
                                        'continue'
                                    );
                                }
                                const nowPlayerKey = cfg.getCurrentPlayerKeySafe();
                                const nowTurnNumber = cfg.getCurrentTurnNumberSafe();
                                const nowStateVersion = typeof cfg.getCurrentStateVersionSafe === 'function'
                                    ? cfg.getCurrentStateVersionSafe()
                                    : null;
                                const stale = (
                                    (isAnalysisCurrent && !isAnalysisCurrent(true))
                                    || (nowPlayerKey && nowPlayerKey !== playerKey)
                                    || (expectedTurnNumber !== null && nowTurnNumber !== expectedTurnNumber)
                                    || nowStateVersion !== expectedStateVersion
                                );
                                if (stale) {
                                    cfg.setCpuProcessing(false);
                                    if (analysisSeed && analysisSeed.identity && analysisSeed.identity.stateVersion === null) {
                                        cfg.scheduleRunCpuTurn(playerKey, {
                                            ...resumeOptions,
                                            cpuSkipAsyncDecision: true
                                        }, 0);
                                    }
                                    return { status: 'handled' };
                                }
                                const response = batch && batch.response ? batch.response : batch;
                                placementLookaheadPrecompute = {
                                    prepared: true,
                                    bestMove: response && response.bestMove ? response.bestMove : null
                                };
                            } else if (cfg.disableSynchronousPlacementLookaheadFallback === true) {
                                placementLookaheadPrecompute = { prepared: true, bestMove: null };
                            }
                        } catch (error) {
                            if (performanceScope && workerWaitStartedAtMs !== null) {
                                recordCpuTurnPerformanceInterval(
                                    performanceScope,
                                    'move-candidates',
                                    'wait',
                                    workerWaitStartedAtMs,
                                    readCpuTurnPerformanceNowMs(performanceScope),
                                    'error'
                                );
                            }
                            if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                            if (isAnalysisCurrent && !isAnalysisCurrent(true)) {
                                cfg.setCpuProcessing(false);
                                cfg.scheduleRunCpuTurn(playerKey, {
                                    ...resumeOptions,
                                    cpuSkipAsyncDecision: true
                                }, 0);
                                return { status: 'handled' };
                            }
                            if (cfg.disableSynchronousPlacementLookaheadFallback === true) {
                                placementLookaheadPrecompute = { prepared: true, bestMove: null };
                            }
                            cfg.debugCpuTrace('[AI] Dedicated Worker placement lookahead failed', {
                                playerKey,
                                error: error && (error as any).message ? (error as any).message : String(error)
                            });
                        }
                    } else if (cfg.disableSynchronousPlacementLookaheadFallback === true) {
                        placementLookaheadPrecompute = { prepared: true, bestMove: null };
                    }
                }
                let candidateScoringPrecompute = null;
                const prepareCandidateScoring = typeof cfg.getPrepareCpuCandidateScoringRequestFn === 'function'
                    ? cfg.getPrepareCpuCandidateScoringRequestFn()
                    : null;
                const scoreCandidatesInWorker = typeof cfg.getScoreCandidatesInWorkerFn === 'function'
                    ? cfg.getScoreCandidatesInWorkerFn()
                    : null;
                if (
                    opts.skipAsyncDecision !== true
                    && typeof prepareCandidateScoring === 'function'
                    && typeof scoreCandidatesInWorker === 'function'
                ) {
                    const decisionEpoch = analysisSeed && analysisSeed.identity
                        ? analysisSeed.identity.decisionEpoch
                        : ++candidateScoringDecisionEpoch;
                    const identity = {
                        requestId: `cpu-score-${decisionEpoch}`,
                        decisionEpoch,
                        stateVersion: expectedStateVersion,
                        turnNumber: Number.isSafeInteger(expectedTurnNumber) && expectedTurnNumber >= 0
                            ? expectedTurnNumber
                            : 0,
                        playerKey: String(playerKey || '')
                    };
                    let expectedRequest: any = null;
                    let batch: any = null;
                    let workerWaitStartedAtMs: number | null = null;
                    let workerWaitRecorded = false;
                    try {
                        expectedRequest = performanceScope
                            ? measureCpuTurnSync(
                                performanceScope,
                                'move-candidates',
                                () => prepareCandidateScoring(candidateMoves, playerKey, identity)
                            )
                            : prepareCandidateScoring(candidateMoves, playerKey, identity);
                        if (expectedRequest) {
                            const workerPromise = performanceScope
                                ? measureCpuTurnSync(
                                    performanceScope,
                                    'move-candidates',
                                    () => Promise.resolve(scoreCandidatesInWorker(expectedRequest))
                                )
                                : Promise.resolve(scoreCandidatesInWorker(expectedRequest));
                            workerWaitStartedAtMs = performanceScope ? readCpuTurnPerformanceNowMs(performanceScope) : null;
                            batch = await workerPromise;
                            if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                        }
                    } catch (e) {
                        if (performanceScope && workerWaitStartedAtMs !== null) {
                            recordCpuTurnPerformanceInterval(
                                performanceScope,
                                'move-candidates',
                                'wait',
                                workerWaitStartedAtMs,
                                readCpuTurnPerformanceNowMs(performanceScope),
                                'error'
                            );
                            workerWaitRecorded = true;
                        }
                        if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                        cfg.debugCpuTrace('[AI] Dedicated Worker candidate scoring failed; using exact local scorer', {
                            playerKey,
                            decisionEpoch,
                            error: e && (e as any).message ? (e as any).message : String(e)
                        });
                    }
                    if (expectedRequest) {
                        const abortAfterWorker = cfg.shouldAbortCpuForHumanMode(playerKey, 'after_worker_candidate_scoring');
                        if (abortAfterWorker) {
                            if (performanceScope && workerWaitStartedAtMs !== null && !workerWaitRecorded) {
                                recordCpuTurnPerformanceInterval(performanceScope, 'move-candidates', 'wait', workerWaitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'handled');
                                workerWaitRecorded = true;
                            }
                            return { status: 'handled' };
                        }
                        const nowPlayerKey = cfg.getCurrentPlayerKeySafe();
                        const nowTurnNumber = cfg.getCurrentTurnNumberSafe();
                        const nowStateVersion = typeof cfg.getCurrentStateVersionSafe === 'function'
                            ? cfg.getCurrentStateVersionSafe()
                            : null;
                        const stale = (
                            (!analysisSeed && decisionEpoch !== candidateScoringDecisionEpoch) ||
                            (isAnalysisCurrent && !isAnalysisCurrent(true)) ||
                            (nowPlayerKey && nowPlayerKey !== playerKey) ||
                            (expectedTurnNumber !== null && nowTurnNumber !== expectedTurnNumber) ||
                            nowStateVersion !== expectedStateVersion
                        );
                        if (stale) {
                            if (performanceScope && workerWaitStartedAtMs !== null && !workerWaitRecorded) {
                                recordCpuTurnPerformanceInterval(performanceScope, 'move-candidates', 'wait', workerWaitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'stale');
                                workerWaitRecorded = true;
                            }
                            cfg.debugCpuTrace('[AI] discard stale Worker candidate scores', {
                                playerKey,
                                decisionEpoch,
                                currentDecisionEpoch: candidateScoringDecisionEpoch,
                                expectedTurnNumber,
                                nowTurnNumber,
                                expectedStateVersion,
                                nowStateVersion
                            });
                            if (analysisSeed || decisionEpoch === candidateScoringDecisionEpoch) cfg.setCpuProcessing(false);
                            if (analysisSeed && analysisSeed.identity && analysisSeed.identity.stateVersion === null) {
                                cfg.scheduleRunCpuTurn(playerKey, {
                                    ...resumeOptions,
                                    cpuSkipAsyncDecision: true
                                }, 0);
                            }
                            return { status: 'handled' };
                        }
                        if (batch) {
                            candidateScoringPrecompute = { expectedRequest, batch };
                        }
                        if (performanceScope && workerWaitStartedAtMs !== null && !workerWaitRecorded) {
                            recordCpuTurnPerformanceInterval(performanceScope, 'move-candidates', 'wait', workerWaitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'continue');
                            workerWaitRecorded = true;
                        }
                    }
                }
                if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                move = performanceScope
                    ? measureCpuTurnSync(
                        performanceScope,
                        'move-candidates',
                        () => cfg.selectCpuMoveSafe(
                            candidateMoves,
                            playerKey,
                            candidateScoringPrecompute,
                            placementLookaheadPrecompute
                        )
                    )
                    : cfg.selectCpuMoveSafe(
                        candidateMoves,
                        playerKey,
                        candidateScoringPrecompute,
                        placementLookaheadPrecompute
                    );
            }
        }
        if (!move) {
            if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
            const passFn = cfg.resolveProcessPassTurn();
            if (passFn) {
                return invokeCpuPass(passFn, autoMode);
            } else {
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                return { status: 'retry' };
            }
        }
        if (level >= 6 && !othelloMode) {
            const runSafety = () => avoidTacticalBlunder({ gameState: cfg.getGameState(), cardState: cfg.getCardState(), playerKey,
                level, selected: move, candidates: candidateMoves });
            const safety = performanceScope
                ? measureCpuTurnSync(performanceScope, 'tactical-safety', runSafety)
                : runSafety();
            if (safety.changed) { move = safety.selected; cfg.debugCpuTrace('[CPU] tactical placement safeguard', safety); }
        }
        if (cfg.isCpuDebugLogAvailable()) {
            cfg.emitCpuDebugLog(`[AI] Move selected`, 'info', {
                playerKey,
                selectedMove: { row: move.row, col: move.col },
                candidateCount: candidateMoves.length,
                flips: move.flips ? move.flips.length : 0
            });
        }
        const minThinkMs = opts.minThinkSatisfied === true
            ? 0
            : cfg.resolveLv6MinThinkMs(playerKey, level, autoMode);
        const thinkElapsedMs = Math.max(0, readNowMs() - turnStartMs);
        const extraDelayMs = Math.max(0, minThinkMs - thinkElapsedMs);

        const commitSelectedMove = async (
            onGuardResolved?: (outcome: 'continue' | 'handled' | 'stale' | 'error') => void,
            crossedAsyncBoundary = false
        ) => {
            if (abortIfNeeded()) {
                if (onGuardResolved) onGuardResolved('handled');
                return { status: 'handled', reason: 'runtime_unavailable' };
            }
            if (cfg.shouldAbortCpuForHumanMode(playerKey, 'commit_selected_move')) {
                if (onGuardResolved) onGuardResolved('handled');
                return;
            }
            const nowCurrentKey = cfg.getCurrentPlayerKeySafe
                ? cfg.getCurrentPlayerKeySafe()
                : normalizePlayerKeyFromValue((cfg.getGameState() || {}).currentPlayer, cfg.blackValue, cfg.whiteValue);
            const nowTurnNumber = cfg.getCurrentTurnNumberSafe();
            const nowStateVersion = typeof cfg.getCurrentStateVersionSafe === 'function'
                ? cfg.getCurrentStateVersionSafe()
                : null;
            if (isAnalysisCurrent && !isAnalysisCurrent(crossedAsyncBoundary)) {
                cfg.debugCpuTrace('[AI] skip stale delayed move commit (analysis identity changed)', {
                    playerKey,
                    crossedAsyncBoundary,
                    decisionEpoch: analysisSeed && analysisSeed.identity
                        ? analysisSeed.identity.decisionEpoch
                        : null,
                    retryGeneration: analysisSeed && analysisSeed.identity
                        ? analysisSeed.identity.retryGeneration
                        : null
                });
                cfg.setCpuProcessing(false);
                if (
                    crossedAsyncBoundary
                    && analysisSeed
                    && analysisSeed.identity
                    && analysisSeed.identity.stateVersion === null
                    && nowCurrentKey === playerKey
                ) {
                    cfg.scheduleRunCpuTurn(playerKey, {
                        ...resumeOptions,
                        cpuMinThinkSatisfied: true
                    }, 0);
                }
                if (onGuardResolved) onGuardResolved('stale');
                return;
            }
            if (nowCurrentKey && nowCurrentKey !== playerKey) {
                cfg.debugCpuTrace('[AI] skip stale delayed move commit (turn changed)', {
                    playerKey,
                    nowCurrentKey
                });
                cfg.setCpuProcessing(false);
                if (onGuardResolved) onGuardResolved('stale');
                return;
            }
            if (expectedTurnNumber !== null && nowTurnNumber !== expectedTurnNumber) {
                cfg.debugCpuTrace('[AI] skip stale delayed move commit (turn number changed)', {
                    playerKey,
                    expectedTurnNumber,
                    nowTurnNumber
                });
                cfg.setCpuProcessing(false);
                if (onGuardResolved) onGuardResolved('stale');
                return;
            }
            if (nowStateVersion !== expectedStateVersion) {
                cfg.debugCpuTrace('[AI] skip stale delayed move commit (state version changed)', {
                    playerKey,
                    expectedStateVersion,
                    nowStateVersion
                });
                cfg.setCpuProcessing(false);
                if (onGuardResolved) onGuardResolved('stale');
                return;
            }
            if (cfg.isUiAnimationBusy()) {
                cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                cfg.setCpuProcessing(false);
                if (onGuardResolved) onGuardResolved('handled');
                return;
            }
            if (abortIfNeeded()) {
                if (onGuardResolved) onGuardResolved('handled');
                return { status: 'handled', reason: 'runtime_unavailable' };
            }
            if (onGuardResolved) onGuardResolved('continue');
            try {
                const beforeState = cfg.getGameState();
                const cornersBeforeMove = cfg.countOwnedBasicCornersSafe(beforeState, playerKey);
                const executeMoveFn = cfg.resolveExecuteMoveFn();
                if (typeof executeMoveFn !== 'function') {
                    throw new Error('executeMove is not available');
                }
                if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                const executionPromise = performanceScope
                    ? Promise.resolve(executeMoveFn(move, { performanceScope }))
                    : Promise.resolve(executeMoveFn(move));
                const waitStartedAtMs = performanceScope ? readCpuTurnPerformanceNowMs(performanceScope) : null;
                let executionResult: any;
                try {
                    executionResult = await executionPromise;
                    if (performanceScope && waitStartedAtMs !== null) {
                        recordCpuTurnPerformanceInterval(
                            performanceScope,
                            'presentation-handoff',
                            'wait',
                            waitStartedAtMs,
                            readCpuTurnPerformanceNowMs(performanceScope),
                            'handled'
                        );
                    }
                } catch (error) {
                    if (performanceScope && waitStartedAtMs !== null) {
                        recordCpuTurnPerformanceInterval(
                            performanceScope,
                            'presentation-handoff',
                            'wait',
                            waitStartedAtMs,
                            readCpuTurnPerformanceNowMs(performanceScope),
                            'error'
                        );
                    }
                    if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
                    throw error;
                }
                if (abortIfNeeded() || isRuntimeUnavailableResult(executionResult)) {
                    cfg.setCpuProcessing(false);
                    return { status: 'handled', reason: 'runtime_unavailable' };
                }
                const afterState = cfg.getGameState();
                const cornersAfterMove = cfg.countOwnedBasicCornersSafe(afterState, playerKey);
                if (cornersAfterMove > cornersBeforeMove) {
                    if (performanceScope) {
                        measureCpuTurnSync(performanceScope, 'commentary-context', () => {
                            cfg.emitCpuCommentary('turn_start', playerKey, { level });
                        });
                    } else {
                        cfg.emitCpuCommentary('turn_start', playerKey, { level });
                    }
                }
            } finally {
                cfg.setCpuProcessing(false);
            }
        };

        if (extraDelayMs > 0) {
            cfg.debugCpuTrace('[AI] Lv6 minimum think-time wait', {
                playerKey,
                level,
                thinkElapsedMs,
                minThinkMs,
                extraDelayMs
            });
            const waitStartedAtMs = performanceScope ? readCpuTurnPerformanceNowMs(performanceScope) : null;
            cfg.scheduleRetry(() => {
                if (abortIfNeeded()) return;
                let waitRecorded = false;
                const finishWait = (outcome: 'continue' | 'handled' | 'stale' | 'error'): void => {
                    if (!performanceScope || waitStartedAtMs === null || waitRecorded) return;
                    waitRecorded = true;
                    recordCpuTurnPerformanceInterval(
                        performanceScope,
                        'move-candidates',
                        'wait',
                        waitStartedAtMs,
                        readCpuTurnPerformanceNowMs(performanceScope),
                        outcome
                    );
                };
                commitSelectedMove(finishWait, true).catch((error: any) => {
                    finishWait('error');
                    if (abortIfNeeded()) return;
                    cfg.handleCpuTurnError(playerKey, selfName, error, autoMode, performanceScope);
                });
            }, extraDelayMs);
        } else {
            await commitSelectedMove();
        }
        if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
        cfg.resetPendingSelectRetryState(playerKey);
        return { status: 'handled' };
    }

    return {
        runCpuTurnMovePhase
    };
}

module.exports = {
    createCpuTurnMovePhase
};
