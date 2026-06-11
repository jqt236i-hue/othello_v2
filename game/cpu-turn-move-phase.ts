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
    getCurrentTurnNumberSafe: () => any;
    getFlipBlockersSafe: () => any;
    getGameState: () => any;
    getSelectMoveFromOnnxFn: () => any;
    getUseCardWithPolicyFn: () => any;
    handleCpuTurnError: (playerKey: any, selfName: any, error: any, autoMode: any) => any;
    isCpuDebugLogAvailable: () => any;
    isUiAnimationBusy: () => any;
    maybeUseCardFromOnnx: (playerKey: any, level: any, legalMovesCount: any, legalMoves: any) => Promise<any>;
    resetPendingSelectRetryState: (playerKey: any) => any;
    resolveCpuCardLogic: () => any;
    resolveExecuteMoveFn: () => any;
    resolveGenerateMovesForPlayer: () => any;
    resolveLv6MinThinkMs: (playerKey: any, level: any, autoMode: any) => any;
    resolveProcessPassTurn: () => any;
    scheduleRetry: (fn: any, delayMs?: any) => any;
    scheduleRunCpuTurn: (playerKey: any, options: any, delayMs: any) => any;
    selectCpuMoveSafe: (candidateMoves: any, playerKey: any) => any;
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

    async function runCpuTurnMovePhase(args: any): Promise<any> {
        const opts = (args && typeof args === 'object') ? args : {};
        const playerKey = opts.playerKey;
        const autoMode = opts.autoMode === true;
        const level = opts.level;
        const selfColor = opts.selfColor;
        const selfName = opts.selfName;
        const othelloMode = opts.othelloMode === true;
        const pending = opts.pending || null;
        const turnStartMs = Number.isFinite(opts.turnStartMs) ? opts.turnStartMs : Date.now();

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
                const onnxCardDecision = await cfg.maybeUseCardFromOnnx(playerKey, level, 0, []);
                if (cfg.shouldAbortCpuForHumanMode(playerKey, 'after_onnx_retry')) {
                    return { status: 'handled' };
                }
                const currentPlayerKeyAfterOnnx = cfg.getCurrentPlayerKeySafe();
                const currentTurnNumberAfterOnnx = cfg.getCurrentTurnNumberSafe();
                if (
                    (currentPlayerKeyAfterOnnx && currentPlayerKeyAfterOnnx !== playerKey) ||
                    (expectedRetryTurnNumber !== null && currentTurnNumberAfterOnnx !== expectedRetryTurnNumber)
                ) {
                    cfg.setCpuProcessing(false);
                    return { status: 'handled' };
                }
                let retried = !!(onnxCardDecision && onnxCardDecision.applied === true);
                const useCardWithPolicyFn = cfg.getUseCardWithPolicyFn();
                if (!retried && typeof useCardWithPolicyFn === 'function') {
                    retried = !!useCardWithPolicyFn(playerKey);
                }
                if (!retried) {
                    retried = cfg.tryApplyAnyUsableCard(playerKey, level, 0, []);
                }
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
                return { status: retried ? 'retry' : 'handled' };
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
                passFn(playerKey, autoMode);
            } else {
                console.error('[AI] processPassTurn is not available');
                cfg.setCpuProcessing(false);
            }
            cfg.resetPendingSelectRetryState(playerKey);
            return { status: 'pass' };
        }

        let move = null;
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
            move = cfg.selectCpuMoveSafe(candidateMoves, playerKey);
        }
        if (!move) {
            const passFn = cfg.resolveProcessPassTurn();
            if (passFn) {
                passFn(playerKey, autoMode);
            } else {
                cfg.setCpuProcessing(false);
            }
            return { status: 'pass' };
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
        const thinkElapsedMs = Math.max(0, Date.now() - turnStartMs);
        const extraDelayMs = Math.max(0, minThinkMs - thinkElapsedMs);

        const commitSelectedMove = async () => {
            if (cfg.shouldAbortCpuForHumanMode(playerKey, 'commit_selected_move')) {
                return;
            }
            const gameState = cfg.getGameState();
            const nowCurrent = gameState ? gameState.currentPlayer : null;
            const nowCurrentKey = normalizePlayerKeyFromValue(nowCurrent, cfg.blackValue, cfg.whiteValue);
            if (nowCurrentKey && nowCurrentKey !== playerKey) {
                cfg.debugCpuTrace('[AI] skip stale delayed move commit (turn changed)', {
                    playerKey,
                    nowCurrentKey
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
