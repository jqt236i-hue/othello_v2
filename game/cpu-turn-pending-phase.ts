type CpuTurnPendingPhaseConfig = {
    clearCpuPendingSelection: (playerKey: any) => any;
    emitCpuCommentary: (eventType: any, playerKey: any, extra: any) => any;
    emitCpuDebugLog: (message: any, kind?: any, meta?: any) => any;
    getAnimationRetryDelayMs: () => any;
    getCurrentPlayerKeySafe: () => any;
    getPendingDispatchHandlers: (playerKey: any) => any;
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

    async function runCpuTurnPendingPhase(args: any): Promise<any> {
        const opts = (args && typeof args === 'object') ? args : {};
        const playerKey = opts.playerKey;
        const autoMode = opts.autoMode === true;
        const level = opts.level;

        let pending = Object.prototype.hasOwnProperty.call(opts, 'pending')
            ? opts.pending
            : cfg.readCpuPendingSelection(playerKey);

        if (pending && pending.stage === 'selectTarget') {
            cfg.emitCpuCommentary('card_targeted', playerKey, {
                level,
                pendingType: pending.type || ''
            });
        }

        if (pending && pending.stage === 'selectTarget') {
            const pendingDispatchKey = cfg.resolvePendingSelectionDispatchKeyForCpu(pending.type);
            const dispatchHandlers = cfg.getPendingDispatchHandlers(playerKey);
            const handler = pendingDispatchKey ? dispatchHandlers[pendingDispatchKey] : null;
            if (handler) {
                if (cfg.isCpuDebugLogAvailable()) {
                    cfg.emitCpuDebugLog(`[AI] CPU selecting ${pending.type.replace(/_/g, ' ').toLowerCase()} target`, 'debug', {
                        playerKey,
                        pendingEffect: pending
                    });
                }
                await handler();
                if (cfg.shouldAbortCpuForHumanMode(playerKey, 'after_pending_selection')) {
                    return { status: 'handled', pending };
                }
                pending = cfg.readCpuPendingSelection(playerKey);
                if (cfg.isUiAnimationBusy()) {
                    cfg.setCpuProcessing(false);
                    cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
                    return { status: 'handled', pending };
                }
                const activePlayerKeyAfterSelection = cfg.getCurrentPlayerKeySafe();
                if (activePlayerKeyAfterSelection && activePlayerKeyAfterSelection !== playerKey) {
                    cfg.resetPendingSelectRetryState(playerKey);
                    cfg.setCpuProcessing(false);
                    return { status: 'handled', pending };
                }
                if (pending && pending.stage === 'selectTarget') {
                    if (cfg.shouldAbortStuckPendingSelection(playerKey, pending)) {
                        cfg.clearCpuPendingSelection(playerKey);
                        cfg.resetPendingSelectRetryState(playerKey);
                        cfg.setCpuProcessing(false);
                        cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
                        return { status: 'handled', pending: null };
                    }
                    cfg.setCpuProcessing(false);
                    cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
                    return { status: 'handled', pending };
                }
            } else {
                if (cfg.shouldAbortStuckPendingSelection(playerKey, pending)) {
                    cfg.clearCpuPendingSelection(playerKey);
                    cfg.resetPendingSelectRetryState(playerKey);
                }
                cfg.setCpuProcessing(false);
                cfg.scheduleRunCpuTurn(playerKey, { autoMode }, cfg.getAnimationRetryDelayMs());
                return { status: 'handled', pending };
            }
        }

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
