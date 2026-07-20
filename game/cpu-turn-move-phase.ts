import {
    measureCpuTurnSync,
    readCpuTurnPerformanceNowMs,
    recordCpuTurnPerformanceInterval,
    withCpuTurnPerformanceOptions,
    type CpuTurnPerformanceScope
} from './cpu-turn-performance';

type CpuTurnMovePhaseConfig = {
    blackValue: any;
    countOwnedBasicCornersSafe: (state: any, playerKey: any) => any;
    debugCpuTrace: (message: any, meta?: any) => any;
    emitCpuCommentary: (eventType: any, playerKey: any, extra: any) => any;
    emitCpuDebugLog: (message: any, kind?: any, meta?: any) => any;
    getActiveProtectionSafe: (playerValue: any) => any;
    getAnimationRetryDelayMs: () => any;
    getCardState: () => any;
    getCurrentPlayerKeySafe: () => any;
    getCurrentStateVersionSafe: () => number | string | null;
    getCurrentTurnNumberSafe: () => any;
    getFlipBlockersSafe: () => any;
    getGameState: () => any;
    getPrepareCpuCandidateScoringRequestFn: () => any;
    getScoreCandidatesInWorkerFn: () => any;
    getSelectMoveFromOnnxFn: () => any;
    getUseCardWithPolicyFn: () => any;
    handleCpuTurnError: (
        playerKey: any,
        selfName: any,
        error: any,
        autoMode: any,
        performanceScope?: CpuTurnPerformanceScope | null
    ) => any;
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
    selectCpuMoveSafe: (candidateMoves: any, playerKey: any, candidateScoringPrecompute?: any) => any;
    setCpuProcessing: (active: any) => any;
    shouldAbortCpuForHumanMode: (playerKey: any, context: any) => any;
    shouldUseOnnxMoveDecision: (level: any) => any;
    tryApplyAnyUsableCard: (playerKey: any, level?: any, legalMovesCount?: any, legalMoves?: any[]) => any;
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

    async function runCpuTurnMovePhase(args: any): Promise<any> {
        const opts = (args && typeof args === 'object') ? args : {};
        const playerKey = opts.playerKey;
        const autoMode = opts.autoMode === true;
        const level = opts.level;
        const selfColor = opts.selfColor;
        const selfName = opts.selfName;
        const othelloMode = opts.othelloMode === true;
        const pending = opts.pending || null;
        const performanceScope = (opts.performanceScope || null) as CpuTurnPerformanceScope | null;
        const resumeOptions = performanceScope
            ? withCpuTurnPerformanceOptions({ autoMode }, performanceScope.correlationId, level)
            : { autoMode };
        const turnStartMs = Number.isFinite(opts.turnStartMs) ? opts.turnStartMs : readNowMs();
        const expectedTurnNumber = cfg.getCurrentTurnNumberSafe();
        const expectedStateVersion = typeof cfg.getCurrentStateVersionSafe === 'function'
            ? cfg.getCurrentStateVersionSafe()
            : null;

        const invokeCpuPass = async (passFn: any, passOptions: any): Promise<any> => {
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
                throw error;
            }
            if (result === false) {
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                return { status: 'retry' };
            }
            cfg.resetPendingSelectRetryState(playerKey);
            return { status: 'pass' };
        };

        let candidateMoves: any[];
        if (performanceScope) {
            const candidateContext = measureCpuTurnSync(performanceScope, 'move-candidates', () => {
                const protection = cfg.getActiveProtectionSafe(selfColor);
                const perma = cfg.getFlipBlockersSafe();
                const generateMovesForPlayerFn = cfg.resolveGenerateMovesForPlayer();
                const measuredCandidateMoves = generateMovesForPlayerFn
                    ? generateMovesForPlayerFn(selfColor, pending, protection, perma)
                    : [];
                return { candidateMoves: measuredCandidateMoves };
            });
            candidateMoves = candidateContext.candidateMoves;
        } else {
            const protection = cfg.getActiveProtectionSafe(selfColor);
            const perma = cfg.getFlipBlockersSafe();
            const generateMovesForPlayerFn = cfg.resolveGenerateMovesForPlayer();
            candidateMoves = generateMovesForPlayerFn
                ? generateMovesForPlayerFn(selfColor, pending, protection, perma)
                : [];
        }

        if (!candidateMoves.length) {
            const cardLogicForRetry = cfg.resolveCpuCardLogic();
            const cardState = cfg.getCardState();
            const gameState = cfg.getGameState();
            const stillUsableCard = (cardLogicForRetry && typeof cardLogicForRetry.hasUsableCard === 'function')
                ? (performanceScope
                    ? measureCpuTurnSync(
                        performanceScope,
                        'card-availability',
                        () => !!cardLogicForRetry.hasUsableCard(cardState, gameState, playerKey)
                    )
                    : !!cardLogicForRetry.hasUsableCard(cardState, gameState, playerKey))
                : false;
            if (!othelloMode && stillUsableCard) {
                const expectedRetryTurnNumber = cfg.getCurrentTurnNumberSafe();
                let retried = false;
                const useCardWithPolicyFn = cfg.getUseCardWithPolicyFn();
                if (typeof useCardWithPolicyFn === 'function') {
                    retried = performanceScope
                        ? measureCpuTurnSync(
                            performanceScope,
                            'card-context-base',
                            () => !!useCardWithPolicyFn(playerKey)
                        )
                        : !!useCardWithPolicyFn(playerKey);
                }
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
                    retried = performanceScope
                        ? measureCpuTurnSync(
                            performanceScope,
                            'card-context-base',
                            () => cfg.tryApplyAnyUsableCard(playerKey, level, 0, [])
                        )
                        : cfg.tryApplyAnyUsableCard(playerKey, level, 0, []);
                }
                if (retried) {
                    cfg.setCpuProcessing(false);
                    cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                    return { status: 'retry' };
                }
            }
            const passFn = cfg.resolveProcessPassTurn();
            if (passFn) {
                if (cfg.shouldAbortCpuForHumanMode(playerKey, 'before_pass')) {
                    return { status: 'handled' };
                }
                if (performanceScope) {
                    measureCpuTurnSync(performanceScope, 'commentary-context', () => {
                        cfg.emitCpuCommentary('pass', playerKey, {
                            level,
                            legalMovesCount: 0
                        });
                    });
                } else {
                    cfg.emitCpuCommentary('pass', playerKey, {
                        level,
                        legalMovesCount: 0
                    });
                }
                const hasPendingAction = !!pending;
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

        let move = null;
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
            if (cfg.shouldUseOnnxMoveDecision(level) && typeof selectMoveFromOnnx === 'function') {
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
                    cfg.debugCpuTrace('[AI] selectMoveFromOnnxPolicyAsync failed; fallback to policy table/core', {
                        playerKey,
                        error: e && (e as any).message ? (e as any).message : String(e)
                    });
                }
            }
            if (!move) {
                let candidateScoringPrecompute = null;
                const prepareCandidateScoring = typeof cfg.getPrepareCpuCandidateScoringRequestFn === 'function'
                    ? cfg.getPrepareCpuCandidateScoringRequestFn()
                    : null;
                const scoreCandidatesInWorker = typeof cfg.getScoreCandidatesInWorkerFn === 'function'
                    ? cfg.getScoreCandidatesInWorkerFn()
                    : null;
                if (typeof prepareCandidateScoring === 'function' && typeof scoreCandidatesInWorker === 'function') {
                    const decisionEpoch = ++candidateScoringDecisionEpoch;
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
                            decisionEpoch !== candidateScoringDecisionEpoch ||
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
                            if (decisionEpoch === candidateScoringDecisionEpoch) cfg.setCpuProcessing(false);
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
                move = performanceScope
                    ? measureCpuTurnSync(
                        performanceScope,
                        'move-candidates',
                        () => cfg.selectCpuMoveSafe(candidateMoves, playerKey, candidateScoringPrecompute)
                    )
                    : cfg.selectCpuMoveSafe(candidateMoves, playerKey, candidateScoringPrecompute);
            }
        }
        if (!move) {
            const passFn = cfg.resolveProcessPassTurn();
            if (passFn) {
                return invokeCpuPass(passFn, autoMode);
            } else {
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                return { status: 'retry' };
            }
        }
        if (cfg.isCpuDebugLogAvailable()) {
            cfg.emitCpuDebugLog(`[AI] Move selected`, 'info', {
                playerKey,
                selectedMove: { row: move.row, col: move.col },
                candidateCount: candidateMoves.length,
                flips: move.flips ? move.flips.length : 0
            });
        }
        const minThinkMs = cfg.resolveLv6MinThinkMs(playerKey, level, autoMode);
        const thinkElapsedMs = Math.max(0, readNowMs() - turnStartMs);
        const extraDelayMs = Math.max(0, minThinkMs - thinkElapsedMs);

        const commitSelectedMove = async (
            onGuardResolved?: (outcome: 'continue' | 'handled' | 'stale' | 'error') => void
        ) => {
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
            if (onGuardResolved) onGuardResolved('continue');
            try {
                const beforeState = cfg.getGameState();
                const cornersBeforeMove = cfg.countOwnedBasicCornersSafe(beforeState, playerKey);
                const executeMoveFn = cfg.resolveExecuteMoveFn();
                if (typeof executeMoveFn !== 'function') {
                    throw new Error('executeMove is not available');
                }
                const executionPromise = performanceScope
                    ? Promise.resolve(executeMoveFn(move, { performanceScope }))
                    : Promise.resolve(executeMoveFn(move));
                const waitStartedAtMs = performanceScope ? readCpuTurnPerformanceNowMs(performanceScope) : null;
                try {
                    await executionPromise;
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
                    throw error;
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
                commitSelectedMove(finishWait).catch((error: any) => {
                    finishWait('error');
                    cfg.handleCpuTurnError(playerKey, selfName, error, autoMode, performanceScope);
                });
            }, extraDelayMs);
        } else {
            await commitSelectedMove();
        }
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
