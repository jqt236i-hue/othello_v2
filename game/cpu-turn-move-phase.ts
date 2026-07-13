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
    handleCpuTurnError: (playerKey: any, selfName: any, error: any, autoMode: any) => any;
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
        const turnStartMs = Number.isFinite(opts.turnStartMs) ? opts.turnStartMs : readNowMs();
        const expectedTurnNumber = cfg.getCurrentTurnNumberSafe();
        const expectedStateVersion = typeof cfg.getCurrentStateVersionSafe === 'function'
            ? cfg.getCurrentStateVersionSafe()
            : null;

        const invokeCpuPass = async (passFn: any, passOptions: any): Promise<any> => {
            const result = await Promise.resolve(passFn(playerKey, passOptions));
            if (result === false) {
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
                return { status: 'retry' };
            }
            cfg.resetPendingSelectRetryState(playerKey);
            return { status: 'pass' };
        };

        const protection = cfg.getActiveProtectionSafe(selfColor);
        const perma = cfg.getFlipBlockersSafe();
        const generateMovesForPlayerFn = cfg.resolveGenerateMovesForPlayer();
        const candidateMoves = generateMovesForPlayerFn
            ? generateMovesForPlayerFn(selfColor, pending, protection, perma)
            : [];

        if (!candidateMoves.length) {
            const cardLogicForRetry = cfg.resolveCpuCardLogic();
            const cardState = cfg.getCardState();
            const gameState = cfg.getGameState();
            const stillUsableCard = (cardLogicForRetry && typeof cardLogicForRetry.hasUsableCard === 'function')
                ? !!cardLogicForRetry.hasUsableCard(cardState, gameState, playerKey)
                : false;
            if (!othelloMode && stillUsableCard) {
                const expectedRetryTurnNumber = cfg.getCurrentTurnNumberSafe();
                let retried = false;
                const useCardWithPolicyFn = cfg.getUseCardWithPolicyFn();
                if (typeof useCardWithPolicyFn === 'function') {
                    retried = !!useCardWithPolicyFn(playerKey);
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
                    retried = cfg.tryApplyAnyUsableCard(playerKey, level, 0, []);
                }
                if (retried) {
                    cfg.setCpuProcessing(false);
                    cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
                    return { status: 'retry' };
                }
            }
            const passFn = cfg.resolveProcessPassTurn();
            if (passFn) {
                if (cfg.shouldAbortCpuForHumanMode(playerKey, 'before_pass')) {
                    return { status: 'handled' };
                }
                cfg.emitCpuCommentary('pass', playerKey, {
                    level,
                    legalMovesCount: 0
                });
                const hasPendingAction = !!pending;
                const passOptions = (stillUsableCard || hasPendingAction)
                    ? { autoMode }
                    : { autoMode, autoNoActionPass: true };
                return invokeCpuPass(passFn, passOptions);
            } else {
                console.error('[AI] processPassTurn is not available');
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
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
                try {
                    move = await selectMoveFromOnnx(candidateMoves, playerKey, level);
                    if (cfg.shouldAbortCpuForHumanMode(playerKey, 'after_onnx_move_decision')) {
                        return { status: 'handled' };
                    }
                } catch (e) {
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
                    let expectedRequest = null;
                    let batch = null;
                    try {
                        expectedRequest = prepareCandidateScoring(candidateMoves, playerKey, identity);
                        if (expectedRequest) {
                            batch = await scoreCandidatesInWorker(expectedRequest);
                        }
                    } catch (e) {
                        cfg.debugCpuTrace('[AI] Dedicated Worker candidate scoring failed; using exact local scorer', {
                            playerKey,
                            decisionEpoch,
                            error: e && (e as any).message ? (e as any).message : String(e)
                        });
                    }
                    if (expectedRequest) {
                        if (cfg.shouldAbortCpuForHumanMode(playerKey, 'after_worker_candidate_scoring')) {
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
                    }
                }
                move = cfg.selectCpuMoveSafe(candidateMoves, playerKey, candidateScoringPrecompute);
            }
        }
        if (!move) {
            const passFn = cfg.resolveProcessPassTurn();
            if (passFn) {
                return invokeCpuPass(passFn, autoMode);
            } else {
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
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

        const commitSelectedMove = async () => {
            if (cfg.shouldAbortCpuForHumanMode(playerKey, 'commit_selected_move')) {
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
                return;
            }
            if (expectedTurnNumber !== null && nowTurnNumber !== expectedTurnNumber) {
                cfg.debugCpuTrace('[AI] skip stale delayed move commit (turn number changed)', {
                    playerKey,
                    expectedTurnNumber,
                    nowTurnNumber
                });
                cfg.setCpuProcessing(false);
                return;
            }
            if (nowStateVersion !== expectedStateVersion) {
                cfg.debugCpuTrace('[AI] skip stale delayed move commit (state version changed)', {
                    playerKey,
                    expectedStateVersion,
                    nowStateVersion
                });
                cfg.setCpuProcessing(false);
                return;
            }
            if (cfg.isUiAnimationBusy()) {
                cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
                cfg.setCpuProcessing(false);
                return;
            }
            try {
                const beforeState = cfg.getGameState();
                const cornersBeforeMove = cfg.countOwnedBasicCornersSafe(beforeState, playerKey);
                const executeMoveFn = cfg.resolveExecuteMoveFn();
                if (typeof executeMoveFn !== 'function') {
                    throw new Error('executeMove is not available');
                }
                await executeMoveFn(move);
                const afterState = cfg.getGameState();
                const cornersAfterMove = cfg.countOwnedBasicCornersSafe(afterState, playerKey);
                if (cornersAfterMove > cornersBeforeMove) {
                    cfg.emitCpuCommentary('turn_start', playerKey, { level });
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
            cfg.scheduleRetry(() => {
                commitSelectedMove().catch((error: any) => {
                    cfg.handleCpuTurnError(playerKey, selfName, error, autoMode);
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
