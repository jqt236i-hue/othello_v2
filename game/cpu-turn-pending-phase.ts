import {
    measureCpuTurnSync,
    readCpuTurnPerformanceNowMs,
    recordCpuTurnPerformanceInterval,
    setActiveCpuPendingSelectionPerformanceScope,
    withCpuTurnPerformanceOptions,
    type CpuTurnPerformanceScope
} from './cpu-turn-performance';

type CpuTurnPendingPhaseConfig = {
    clearCpuPendingSelection: (playerKey: any) => any;
    emitCpuCommentary: (eventType: any, playerKey: any, extra: any) => any;
    emitCpuDebugLog: (message: any, kind?: any, meta?: any) => any;
    getAnimationRetryDelayMs: () => any;
    getCurrentPlayerKeySafe: () => any;
    getPendingDispatchHandlers: (playerKey: any) => any;
    isAborted?: () => boolean;
    isCpuDebugLogAvailable: () => any;
    isUiAnimationBusy: () => any;
    readCpuPendingSelection: (playerKey: any) => any;
    resetPendingSelectRetryState: (playerKey: any) => any;
    resolvePendingSelectionDispatchKeyForCpu: (pendingType: any) => any;
    scheduleRunCpuTurn: (playerKey: any, options: any, delayMs: any) => any;
    setCpuProcessing: (active: any) => any;
    shouldAbortCpuForHumanMode: (playerKey: any, context: any) => any;
    shouldAbortStuckPendingSelection: (playerKey: any, pending: any) => any;
};

export function createCpuTurnPendingPhase(config: CpuTurnPendingPhaseConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuTurnPendingPhaseConfig;

    function abortIfNeeded(): boolean {
        if (typeof cfg.isAborted !== 'function' || cfg.isAborted() !== true) return false;
        cfg.setCpuProcessing(false);
        return true;
    }

    async function runCpuTurnPendingPhase(args: any): Promise<any> {
        const opts = (args && typeof args === 'object') ? args : {};
        const playerKey = opts.playerKey;
        const autoMode = opts.autoMode === true;
        const level = opts.level;
        const performanceScope = (opts.performanceScope || null) as CpuTurnPerformanceScope | null;
        const resumeOptions = performanceScope
            ? withCpuTurnPerformanceOptions({ autoMode }, performanceScope.correlationId, level)
            : { autoMode };

        let pending = Object.prototype.hasOwnProperty.call(opts, 'pending')
            ? opts.pending
            : cfg.readCpuPendingSelection(playerKey);

        if (abortIfNeeded()) return { status: 'handled', pending, reason: 'runtime_unavailable' };

        if (pending && pending.stage === 'selectTarget') {
            if (performanceScope) {
                measureCpuTurnSync(performanceScope, 'commentary-context', () => {
                    cfg.emitCpuCommentary('card_targeted', playerKey, {
                        level,
                        pendingType: pending.type || ''
                    });
                });
            } else {
                cfg.emitCpuCommentary('card_targeted', playerKey, {
                    level,
                    pendingType: pending.type || ''
                });
            }
        }

        if (pending && pending.stage === 'selectTarget') {
            const pendingDispatchKey = cfg.resolvePendingSelectionDispatchKeyForCpu(pending.type);
            const dispatchHandlers = cfg.getPendingDispatchHandlers(playerKey);
            const handler = pendingDispatchKey ? dispatchHandlers[pendingDispatchKey] : null;
            if (handler) {
                if (abortIfNeeded()) return { status: 'handled', pending, reason: 'runtime_unavailable' };
                if (cfg.isCpuDebugLogAvailable()) {
                    cfg.emitCpuDebugLog(`[AI] CPU selecting ${pending.type.replace(/_/g, ' ').toLowerCase()} target`, 'debug', {
                        playerKey,
                        pendingEffect: pending
                    });
                }
                // The synchronous prefix is target scoring; the canonical commit runs
                // after the policy await and is measured by the pending pipeline.
                if (performanceScope) setActiveCpuPendingSelectionPerformanceScope(playerKey, performanceScope);
                const handlerPromise = performanceScope
                    ? measureCpuTurnSync(
                        performanceScope,
                        'pending-target-choice',
                        () => Promise.resolve(handler())
                    )
                    : Promise.resolve(handler());
                const waitStartedAtMs = performanceScope ? readCpuTurnPerformanceNowMs(performanceScope) : null;
                try {
                    await handlerPromise;
                } catch (error) {
                    if (performanceScope) setActiveCpuPendingSelectionPerformanceScope(playerKey, null);
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
                    if (abortIfNeeded()) return { status: 'handled', pending, reason: 'runtime_unavailable' };
                    throw error;
                }
                if (performanceScope) setActiveCpuPendingSelectionPerformanceScope(playerKey, null);
                if (abortIfNeeded()) return { status: 'handled', pending, reason: 'runtime_unavailable' };
                if (cfg.shouldAbortCpuForHumanMode(playerKey, 'after_pending_selection')) {
                    if (performanceScope && waitStartedAtMs !== null) {
                        recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'handled');
                    }
                    return { status: 'handled', pending };
                }
                pending = cfg.readCpuPendingSelection(playerKey);
                if (abortIfNeeded()) return { status: 'handled', pending, reason: 'runtime_unavailable' };
                if (cfg.isUiAnimationBusy()) {
                    if (performanceScope && waitStartedAtMs !== null) {
                        recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'handled');
                    }
                    cfg.setCpuProcessing(false);
                    cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                    return { status: 'handled', pending };
                }
                const activePlayerKeyAfterSelection = cfg.getCurrentPlayerKeySafe();
                if (activePlayerKeyAfterSelection && activePlayerKeyAfterSelection !== playerKey) {
                    if (performanceScope && waitStartedAtMs !== null) {
                        recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'handled');
                    }
                    cfg.resetPendingSelectRetryState(playerKey);
                    cfg.setCpuProcessing(false);
                    return { status: 'handled', pending };
                }
                if (pending && pending.stage === 'selectTarget') {
                    if (performanceScope && waitStartedAtMs !== null) {
                        recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'handled');
                    }
                    if (cfg.shouldAbortStuckPendingSelection(playerKey, pending)) {
                        cfg.clearCpuPendingSelection(playerKey);
                        cfg.resetPendingSelectRetryState(playerKey);
                        cfg.setCpuProcessing(false);
                        cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                        return { status: 'handled', pending: null };
                    }
                    cfg.setCpuProcessing(false);
                    cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                    return { status: 'handled', pending };
                }
                if (performanceScope && waitStartedAtMs !== null) {
                    recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'handled');
                }
                // Pending resolution mutates canonical state. End this invocation and
                // let the normal resume path build a fresh analysis seed.
                cfg.resetPendingSelectRetryState(playerKey);
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, resumeOptions, 0);
                return { status: 'handled', pending };
            } else {
                if (abortIfNeeded()) return { status: 'handled', pending, reason: 'runtime_unavailable' };
                if (cfg.shouldAbortStuckPendingSelection(playerKey, pending)) {
                    cfg.clearCpuPendingSelection(playerKey);
                    cfg.resetPendingSelectRetryState(playerKey);
                }
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                return { status: 'handled', pending };
            }
        }

        if (abortIfNeeded()) return { status: 'handled', pending, reason: 'runtime_unavailable' };
        cfg.resetPendingSelectRetryState(playerKey);
        return { status: 'continue', pending };
    }

    return {
        runCpuTurnPendingPhase
    };
}

module.exports = {
    createCpuTurnPendingPhase
};
