import {
    createCpuTurnPerformanceScope,
    readCpuTurnPerformanceNowMs,
    readCpuTurnPerformanceCorrelationId,
    readCpuTurnPerformanceLevel,
    recordCpuTurnPerformanceInterval,
    withCpuTurnPerformanceOptions,
    type CpuTurnPerformanceRecorder
} from './cpu-turn-performance';

type CpuTurnSchedulerConfig = {
    createCpuTurnPerformanceCorrelationId?: () => string | null;
    debugCpuTrace: (message: any, meta?: any) => any;
    getAnimationRetryDelayMs: () => any;
    getCurrentPlayerKeySafe: () => any;
    getCurrentTurnNumberSafe: () => any;
    getTimerService: () => any;
    getTimers: () => any;
    getCpuTurnPerformanceRecorder?: () => CpuTurnPerformanceRecorder | null;
    readNowMs?: () => number;
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

    function getCpuRetryGeneration(): number {
        return cpuRetryGeneration;
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

    function scheduleRetry(
        fn: any,
        delayMs: any = cfg.getAnimationRetryDelayMs(),
        onWaitRejected?: (error: unknown) => void
    ): boolean {
        const timers = cfg.getTimers ? cfg.getTimers() : null;
        if (hasUsableWaitMs(timers)) {
            try {
                Promise.resolve(timers.waitMs(delayMs)).then(() => {
                    try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); }
                }).catch((error) => {
                    if (typeof onWaitRejected === 'function') {
                        try { onWaitRejected(error); } catch (nestedError) {
                            console.error('[AI] scheduleRetry rejection handler failed', nestedError);
                        }
                    } else {
                        console.error('[AI] scheduleRetry wait failed', error);
                    }
                });
                return true;
            } catch (e) { /* fall through */ }
        }

        const timerService = cfg.getTimerService ? cfg.getTimerService() : null;
        if (timerService && typeof timerService.setTimeout === 'function') {
            const tid = timerService.setTimeout(() => {
                scheduledRetryTimerIds.delete(tid);
                try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); }
            }, delayMs);
            scheduledRetryTimerIds.add(tid);
            return true;
        }
        return false;
    }

    function scheduleRunCpuTurn(playerKey: any, options: any, delayMs: any): void {
        const key = retryStateKey(playerKey);
        const expectedRetryGeneration = cpuRetryGeneration;
        if (cpuRetryPendingByPlayer[key] === expectedRetryGeneration) return;
        cpuRetryPendingByPlayer[key] = expectedRetryGeneration;
        const recorder = typeof cfg.getCpuTurnPerformanceRecorder === 'function'
            ? cfg.getCpuTurnPerformanceRecorder()
            : null;
        const existingCorrelationId = recorder ? readCpuTurnPerformanceCorrelationId(options) : null;
        const correlationId = recorder
            ? (existingCorrelationId || (
                typeof cfg.createCpuTurnPerformanceCorrelationId === 'function'
                    ? cfg.createCpuTurnPerformanceCorrelationId()
                    : null
            ))
            : null;
        const scheduledOptions = correlationId
            ? withCpuTurnPerformanceOptions(options || {}, correlationId, readCpuTurnPerformanceLevel(options))
            : (options || {});
        const performanceScope = recorder && correlationId
            ? createCpuTurnPerformanceScope({
                recorder,
                correlationId,
                runId: null,
                playerKey: key,
                level: readCpuTurnPerformanceLevel(scheduledOptions),
                readNowMs: cfg.readNowMs
            })
            : null;
        const scheduledAtMs = performanceScope ? readCpuTurnPerformanceNowMs(performanceScope) : null;
        const expectedPlayerKey = cfg.getCurrentPlayerKeySafe ? cfg.getCurrentPlayerKeySafe() : null;
        const expectedTurnNumber = cfg.getCurrentTurnNumberSafe ? cfg.getCurrentTurnNumberSafe() : null;
        const scheduled = scheduleRetry(() => {
            const callbackStartedAtMs = performanceScope
                ? readCpuTurnPerformanceNowMs(performanceScope)
                : null;
            let handoffOutcome: 'continue' | 'handled' | 'stale' | 'error' = 'continue';
            const recordHandoffDelay = (): void => {
                if (!performanceScope || scheduledAtMs === null || callbackStartedAtMs === null) return;
                recordCpuTurnPerformanceInterval(
                    performanceScope,
                    'handoff-delay',
                    'wait',
                    scheduledAtMs,
                    callbackStartedAtMs,
                    handoffOutcome
                );
            };
            if (cpuRetryPendingByPlayer[key] === expectedRetryGeneration) {
                cpuRetryPendingByPlayer[key] = null;
            }
            if (expectedRetryGeneration !== cpuRetryGeneration) {
                handoffOutcome = 'stale';
                recordHandoffDelay();
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
                handoffOutcome = 'handled';
                recordHandoffDelay();
                return;
            }
            const currentPlayerKey = cfg.getCurrentPlayerKeySafe ? cfg.getCurrentPlayerKeySafe() : null;
            const currentTurnNumber = cfg.getCurrentTurnNumberSafe ? cfg.getCurrentTurnNumberSafe() : null;
            if (expectedPlayerKey && currentPlayerKey !== expectedPlayerKey) {
                handoffOutcome = 'stale';
                recordHandoffDelay();
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
                handoffOutcome = 'stale';
                recordHandoffDelay();
                cfg.debugCpuTrace('[AI] skip stale scheduled CPU run (turn changed)', {
                    playerKey: key,
                    expectedPlayerKey,
                    currentPlayerKey,
                    expectedTurnNumber,
                    currentTurnNumber
                });
                return;
            }
            try {
                cfg.runCpuTurn(key, scheduledOptions);
                recordHandoffDelay();
            } catch (error) {
                handoffOutcome = 'error';
                recordHandoffDelay();
                throw error;
            }
        }, delayMs, () => {
            if (cpuRetryPendingByPlayer[key] === expectedRetryGeneration) {
                cpuRetryPendingByPlayer[key] = null;
            }
            if (performanceScope && scheduledAtMs !== null) {
                recordCpuTurnPerformanceInterval(
                    performanceScope,
                    'handoff-delay',
                    'wait',
                    scheduledAtMs,
                    readCpuTurnPerformanceNowMs(performanceScope),
                    'error'
                );
            }
        });
        if (!scheduled && cpuRetryPendingByPlayer[key] === expectedRetryGeneration) {
            cpuRetryPendingByPlayer[key] = null;
            if (performanceScope && scheduledAtMs !== null) {
                recordCpuTurnPerformanceInterval(
                    performanceScope,
                    'handoff-delay',
                    'wait',
                    scheduledAtMs,
                    readCpuTurnPerformanceNowMs(performanceScope),
                    'error'
                );
            }
        }
    }

    return {
        getCpuRetryGeneration,
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
