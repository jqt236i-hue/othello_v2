type CpuTurnSchedulerConfig = {
    debugCpuTrace: (message: any, meta?: any) => any;
    getAnimationRetryDelayMs: () => any;
    getCurrentPlayerKeySafe: () => any;
    getCurrentTurnNumberSafe: () => any;
    getTimerService: () => any;
    getTimers: () => any;
    runCpuTurn: (playerKey: any, options?: any) => any;
    shouldAbortCpuForHumanMode: (playerKey: any, context: any) => any;
};

const MAX_STUCK_PENDING_SELECT_RETRIES = 4;

function retryStateKey(playerKey: any): 'black' | 'white' {
    return playerKey === 'white' ? 'white' : 'black';
}

function hasUsableWaitMs(timers: any): boolean {
    if (!timers || typeof timers.waitMs !== 'function') return false;
    if (typeof timers.hasTimerImpl === 'function' && !timers.hasTimerImpl()) return false;
    return true;
}

function makePendingSelectRetryKey(pending: any): string {
    if (!pending) return '';
    const type = String(pending.type || '');
    const stage = String(pending.stage || '');
    const selectedCount = Number.isFinite(pending.selectedCount) ? pending.selectedCount : 0;
    const maxSelections = Number.isFinite(pending.maxSelections) ? pending.maxSelections : 0;
    const offersLen = Array.isArray(pending.offers) ? pending.offers.length : 0;
    return `${type}:${stage}:${selectedCount}:${maxSelections}:${offersLen}`;
}

export function createCpuTurnScheduler(config: CpuTurnSchedulerConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuTurnSchedulerConfig;
    const cpuRetryPendingByPlayer: Record<string, any> = { black: null, white: null };
    const pendingSelectRetryStateByPlayer = {
        black: { key: '', count: 0 },
        white: { key: '', count: 0 }
    };
    const scheduledRetryTimerIds = new Set<any>();
    let cpuRetryGeneration = 0;

    function resetPendingSelectRetryState(playerKey: any): void {
        const key = retryStateKey(playerKey);
        pendingSelectRetryStateByPlayer[key].key = '';
        pendingSelectRetryStateByPlayer[key].count = 0;
    }

    function resetCpuTurnHandlerState(): void {
        cpuRetryGeneration += 1;
        cpuRetryPendingByPlayer.black = null;
        cpuRetryPendingByPlayer.white = null;
        resetPendingSelectRetryState('black');
        resetPendingSelectRetryState('white');
        const timerService = cfg.getTimerService ? cfg.getTimerService() : null;
        for (const tid of scheduledRetryTimerIds) {
            try {
                if (timerService && typeof timerService.clearTimeout === 'function') {
                    timerService.clearTimeout(tid);
                }
            } catch (e) { /* ignore */ }
        }
        scheduledRetryTimerIds.clear();
    }

    function shouldAbortStuckPendingSelection(playerKey: any, pending: any): boolean {
        const key = retryStateKey(playerKey);
        const retryKey = makePendingSelectRetryKey(pending);
        const state = pendingSelectRetryStateByPlayer[key];
        if (state.key === retryKey) {
            state.count += 1;
        } else {
            state.key = retryKey;
            state.count = 1;
        }
        return state.count > MAX_STUCK_PENDING_SELECT_RETRIES;
    }

    function scheduleRetry(fn: any, delayMs: any = cfg.getAnimationRetryDelayMs()): void {
        const timers = cfg.getTimers ? cfg.getTimers() : null;
        if (hasUsableWaitMs(timers)) {
            try {
                timers.waitMs(delayMs).then(() => {
                    try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); }
                });
                return;
            } catch (e) { /* fall through */ }
        }

        const timerService = cfg.getTimerService ? cfg.getTimerService() : null;
        if (timerService && typeof timerService.setTimeout === 'function') {
            const tid = timerService.setTimeout(() => {
                scheduledRetryTimerIds.delete(tid);
                try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); }
            }, delayMs);
            scheduledRetryTimerIds.add(tid);
        }
    }

    function scheduleRunCpuTurn(playerKey: any, options: any, delayMs: any): void {
        const key = retryStateKey(playerKey);
        const expectedRetryGeneration = cpuRetryGeneration;
        if (cpuRetryPendingByPlayer[key] === expectedRetryGeneration) return;
        cpuRetryPendingByPlayer[key] = expectedRetryGeneration;
        const expectedPlayerKey = cfg.getCurrentPlayerKeySafe ? cfg.getCurrentPlayerKeySafe() : null;
        const expectedTurnNumber = cfg.getCurrentTurnNumberSafe ? cfg.getCurrentTurnNumberSafe() : null;
        scheduleRetry(() => {
            if (cpuRetryPendingByPlayer[key] === expectedRetryGeneration) {
                cpuRetryPendingByPlayer[key] = null;
            }
            if (expectedRetryGeneration !== cpuRetryGeneration) {
                cfg.debugCpuTrace('[AI] skip stale scheduled CPU run (generation changed)', {
                    playerKey: key,
                    expectedRetryGeneration,
                    currentRetryGeneration: cpuRetryGeneration,
                    expectedPlayerKey,
                    expectedTurnNumber
                });
                return;
            }
            if (cfg.shouldAbortCpuForHumanMode(key, 'scheduled_retry')) {
                return;
            }
            const currentPlayerKey = cfg.getCurrentPlayerKeySafe ? cfg.getCurrentPlayerKeySafe() : null;
            const currentTurnNumber = cfg.getCurrentTurnNumberSafe ? cfg.getCurrentTurnNumberSafe() : null;
            if (expectedPlayerKey && currentPlayerKey !== expectedPlayerKey) {
                cfg.debugCpuTrace('[AI] skip stale scheduled CPU run (player changed)', {
                    playerKey: key,
                    expectedPlayerKey,
                    currentPlayerKey,
                    expectedTurnNumber,
                    currentTurnNumber
                });
                return;
            }
            if (expectedTurnNumber !== null && currentTurnNumber !== expectedTurnNumber) {
                cfg.debugCpuTrace('[AI] skip stale scheduled CPU run (turn changed)', {
                    playerKey: key,
                    expectedPlayerKey,
                    currentPlayerKey,
                    expectedTurnNumber,
                    currentTurnNumber
                });
                return;
            }
            cfg.runCpuTurn(key, options || {});
        }, delayMs);
    }

    return {
        resetCpuTurnHandlerState,
        resetPendingSelectRetryState,
        scheduleRetry,
        scheduleRunCpuTurn,
        shouldAbortStuckPendingSelection
    };
}

module.exports = {
    createCpuTurnScheduler
};
