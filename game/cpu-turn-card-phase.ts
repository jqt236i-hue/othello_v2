type CpuTurnCardPhaseConfig = {
    emitCpuCommentary: (eventType: any, playerKey: any, extra: any) => any;
    getActiveProtectionSafe: (playerValue: any) => any;
    getAnimationRetryDelayMs: () => any;
    getDestroyHandCardWithPolicyFn: () => any;
    getFlipBlockersSafe: () => any;
    getLastUsedCardIdSafe: (playerKey: any) => any;
    getUseCardWithPolicyFn: () => any;
    isUiAnimationBusy: () => any;
    maybeUseCardFromOnnx: (playerKey: any, level: any, legalMovesCount: any, legalMoves: any) => Promise<any>;
    resolveGenerateMovesForPlayer: () => any;
    runCpuTurn: (playerKey: any, options?: any) => any;
    scheduleRetry: (fn: any, delayMs?: any) => any;
    scheduleRunCpuTurn: (playerKey: any, options: any, delayMs: any) => any;
    setCpuProcessing: (active: any) => any;
    shouldAbortCpuForHumanMode: (playerKey: any, context: any) => any;
    shouldOverrideOnnxHoldDecision: (playerKey: any, level: any, legalMovesCount: any) => any;
    tryDestroyHighPriorityHandCardViaAdapter: (playerKey: any) => any;
};

export function createCpuTurnCardPhase(config: CpuTurnCardPhaseConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuTurnCardPhaseConfig;

    async function runCpuTurnCardPhase(args: any): Promise<any> {
        const opts = (args && typeof args === 'object') ? args : {};
        const playerKey = opts.playerKey;
        const autoMode = opts.autoMode === true;
        const level = opts.level;
        const selfColor = opts.selfColor;
        const othelloMode = opts.othelloMode === true;
        const hasUsedCardThisTurn = opts.hasUsedCardThisTurn === true;
        const hasPendingSelection = opts.hasPendingSelection === true;

        if (!othelloMode && !hasUsedCardThisTurn && !hasPendingSelection) {
            const destroyHandCardWithPolicyFn = cfg.getDestroyHandCardWithPolicyFn();
            let destroyedForCycle = (typeof destroyHandCardWithPolicyFn === 'function')
                ? !!destroyHandCardWithPolicyFn(playerKey)
                : false;
            if (!destroyedForCycle) {
                destroyedForCycle = cfg.tryDestroyHighPriorityHandCardViaAdapter(playerKey);
            }
            if (destroyedForCycle) {
                cfg.setCpuProcessing(false);
                cfg.scheduleRetry(() => {
                    if (cfg.isUiAnimationBusy()) {
                        cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
                        return;
                    }
                    cfg.runCpuTurn(playerKey, { autoMode });
                }, cfg.getAnimationRetryDelayMs());
                return { status: 'handled' };
            }
        }

        if (!othelloMode && !hasUsedCardThisTurn && !hasPendingSelection) {
            const protectionPreview = cfg.getActiveProtectionSafe(selfColor);
            const permaPreview = cfg.getFlipBlockersSafe();
            const generateMovesForPlayerFn = cfg.resolveGenerateMovesForPlayer();
            const previewMoves = generateMovesForPlayerFn
                ? generateMovesForPlayerFn(selfColor, null, protectionPreview, permaPreview)
                : [];
            const previewLegalMovesCount = Array.isArray(previewMoves) ? previewMoves.length : 0;

            const onnxCardDecision = await cfg.maybeUseCardFromOnnx(playerKey, level, previewLegalMovesCount, previewMoves);
            if (cfg.shouldAbortCpuForHumanMode(playerKey, 'after_onnx_card_decision')) {
                return { status: 'handled' };
            }
            let applied = !!(onnxCardDecision && onnxCardDecision.applied === true);
            const heldByOnnx = !!(onnxCardDecision && onnxCardDecision.hold === true);
            const overrideHold = heldByOnnx && cfg.shouldOverrideOnnxHoldDecision(playerKey, level, previewLegalMovesCount);
            if (!applied && (!heldByOnnx || overrideHold)) {
                const useCardWithPolicyFn = cfg.getUseCardWithPolicyFn();
                applied = (typeof useCardWithPolicyFn === 'function') ? !!useCardWithPolicyFn(playerKey) : false;
            }
            if (applied) {
                cfg.emitCpuCommentary('card_used', playerKey, {
                    level,
                    cardId: cfg.getLastUsedCardIdSafe(playerKey)
                });
                cfg.setCpuProcessing(false);
                const resumeAfterCardAnimation = () => {
                    if (cfg.shouldAbortCpuForHumanMode(playerKey, 'resume_after_card_animation')) {
                        return;
                    }
                    if (cfg.isUiAnimationBusy()) {
                        cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
                        return;
                    }
                    cfg.runCpuTurn(playerKey, { autoMode });
                };
                cfg.scheduleRetry(resumeAfterCardAnimation, cfg.getAnimationRetryDelayMs());
                return { status: 'handled' };
            }
        }

        return { status: 'continue' };
    }

    return {
        runCpuTurnCardPhase
    };
}

module.exports = {
    createCpuTurnCardPhase
};
