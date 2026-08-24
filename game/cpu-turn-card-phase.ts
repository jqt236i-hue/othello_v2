import {
    measureCpuTurnSync,
    readCpuTurnPerformanceNowMs,
    recordCpuTurnPerformanceInterval,
    withCpuTurnPerformanceOptions,
    type CpuTurnPerformanceScope
} from './cpu-turn-performance';

type CpuTurnCardPhaseConfig = {
    emitCpuCommentary: (eventType: any, playerKey: any, extra: any) => any;
    getAnimationRetryDelayMs: () => any;
    getDestroyHandCardWithPolicyFn: () => any;
    getLastUsedCardIdSafe: (playerKey: any) => any;
    getCurrentPlayerKeySafe?: () => any;
    getCurrentTurnNumberSafe?: () => any;
    getUseCardWithPolicyFn: () => any;
    isAborted?: () => boolean;
    isUiAnimationBusy: () => any;
    runCpuTurn: (playerKey: any, options?: any) => any;
    scheduleRetry: (fn: any, delayMs?: any) => any;
    scheduleRunCpuTurn: (playerKey: any, options: any, delayMs: any) => any;
    setCpuProcessing: (active: any) => any;
    shouldAbortCpuForHumanMode: (playerKey: any, context: any) => any;
    shouldSkipCardPhaseForProfile?: (playerKey: any, level: any) => any;
    tryDestroyHighPriorityHandCardViaAdapter: (playerKey: any) => any;
};

export function createCpuTurnCardPhase(config: CpuTurnCardPhaseConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuTurnCardPhaseConfig;

    function abortIfNeeded(): boolean {
        if (typeof cfg.isAborted !== 'function' || cfg.isAborted() !== true) return false;
        cfg.setCpuProcessing(false);
        return true;
    }

    function shouldSkipStaleResume(expectedPlayerKey: any, expectedTurnNumber: any): boolean {
        const currentPlayerKey = typeof cfg.getCurrentPlayerKeySafe === 'function'
            ? cfg.getCurrentPlayerKeySafe()
            : null;
        const currentTurnNumber = typeof cfg.getCurrentTurnNumberSafe === 'function'
            ? cfg.getCurrentTurnNumberSafe()
            : null;
        return !!(
            (expectedPlayerKey && currentPlayerKey && currentPlayerKey !== expectedPlayerKey) ||
            (expectedTurnNumber !== null && currentTurnNumber !== null && currentTurnNumber !== expectedTurnNumber)
        );
    }

    async function runCpuTurnCardPhase(args: any): Promise<any> {
        const opts = (args && typeof args === 'object') ? args : {};
        const playerKey = opts.playerKey;
        const autoMode = opts.autoMode === true;
        const level = opts.level;
        const othelloMode = opts.othelloMode === true;
        const hasUsedCardThisTurn = opts.hasUsedCardThisTurn === true;
        const hasPendingSelection = opts.hasPendingSelection === true;
        const performanceScope = (opts.performanceScope || null) as CpuTurnPerformanceScope | null;
        const preparedCardDecision = opts.getPreparedCardDecision;
        const analyzedUsableCardIds = opts.analysisSeed
            && opts.analysisSeed.cardUsability
            && Array.isArray(opts.analysisSeed.cardUsability.usableCardIds)
            ? opts.analysisSeed.cardUsability.usableCardIds
            : null;
        const resumeOptions = performanceScope
            ? withCpuTurnPerformanceOptions({ autoMode }, performanceScope.correlationId, level)
            : { autoMode };

        if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };

        if (typeof cfg.shouldSkipCardPhaseForProfile === 'function'
            && cfg.shouldSkipCardPhaseForProfile(playerKey, level)) {
            return { status: 'continue' };
        }

        if (!othelloMode && !hasUsedCardThisTurn && !hasPendingSelection) {
            if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
            const destroyHandCardWithPolicyFn = cfg.getDestroyHandCardWithPolicyFn();
            let destroyedForCycle = (typeof destroyHandCardWithPolicyFn === 'function')
                ? (performanceScope
                    ? !!destroyHandCardWithPolicyFn(playerKey, performanceScope, preparedCardDecision)
                    : !!destroyHandCardWithPolicyFn(playerKey, null, preparedCardDecision))
                : false;
            if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
            if (!destroyedForCycle) {
                destroyedForCycle = performanceScope
                    ? measureCpuTurnSync(
                        performanceScope,
                        'card-context-base',
                        () => cfg.tryDestroyHighPriorityHandCardViaAdapter(playerKey)
                    )
                    : cfg.tryDestroyHighPriorityHandCardViaAdapter(playerKey);
                if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
            }
            if (destroyedForCycle) {
                cfg.setCpuProcessing(false);
                const expectedPlayerKey = typeof cfg.getCurrentPlayerKeySafe === 'function'
                    ? cfg.getCurrentPlayerKeySafe()
                    : playerKey;
                const expectedTurnNumber = typeof cfg.getCurrentTurnNumberSafe === 'function'
                    ? cfg.getCurrentTurnNumberSafe()
                    : null;
                const waitStartedAtMs = performanceScope ? readCpuTurnPerformanceNowMs(performanceScope) : null;
                const scheduled = cfg.scheduleRetry(() => {
                    if (abortIfNeeded()) return;
                    if (shouldSkipStaleResume(expectedPlayerKey, expectedTurnNumber)) {
                        if (performanceScope && waitStartedAtMs !== null) {
                            recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'stale');
                        }
                        cfg.setCpuProcessing(false);
                        return;
                    }
                    if (cfg.isUiAnimationBusy()) {
                        if (performanceScope && waitStartedAtMs !== null) {
                            recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'handled');
                        }
                        cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                        return;
                    }
                    if (performanceScope && waitStartedAtMs !== null) {
                        recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'continue');
                    }
                    cfg.runCpuTurn(playerKey, resumeOptions);
                }, cfg.getAnimationRetryDelayMs());
                if (scheduled === false) {
                    if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
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
                    cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                }
                return { status: 'handled' };
            }
        }

        if (
            !othelloMode
            && !hasUsedCardThisTurn
            && !hasPendingSelection
            && (analyzedUsableCardIds === null || analyzedUsableCardIds.length > 0)
        ) {
            if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
            const useCardWithPolicyFn = cfg.getUseCardWithPolicyFn();
            const applied = (typeof useCardWithPolicyFn === 'function')
                ? (performanceScope
                    ? !!useCardWithPolicyFn(playerKey, performanceScope, preparedCardDecision)
                    : !!useCardWithPolicyFn(playerKey, null, preparedCardDecision))
                : false;
            if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
            if (applied) {
                if (performanceScope) {
                    measureCpuTurnSync(performanceScope, 'commentary-context', () => {
                        cfg.emitCpuCommentary('card_used', playerKey, {
                            level,
                            cardId: cfg.getLastUsedCardIdSafe(playerKey)
                        });
                    });
                } else {
                    cfg.emitCpuCommentary('card_used', playerKey, {
                        level,
                        cardId: cfg.getLastUsedCardIdSafe(playerKey)
                    });
                }
                cfg.setCpuProcessing(false);
                const expectedPlayerKey = typeof cfg.getCurrentPlayerKeySafe === 'function'
                    ? cfg.getCurrentPlayerKeySafe()
                    : playerKey;
                const expectedTurnNumber = typeof cfg.getCurrentTurnNumberSafe === 'function'
                    ? cfg.getCurrentTurnNumberSafe()
                    : null;
                const waitStartedAtMs = performanceScope ? readCpuTurnPerformanceNowMs(performanceScope) : null;
                const resumeAfterCardAnimation = () => {
                    if (abortIfNeeded()) return;
                    if (cfg.shouldAbortCpuForHumanMode(playerKey, 'resume_after_card_animation')) {
                        if (performanceScope && waitStartedAtMs !== null) {
                            recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'handled');
                        }
                        return;
                    }
                    if (shouldSkipStaleResume(expectedPlayerKey, expectedTurnNumber)) {
                        if (performanceScope && waitStartedAtMs !== null) {
                            recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'stale');
                        }
                        cfg.setCpuProcessing(false);
                        return;
                    }
                    if (cfg.isUiAnimationBusy()) {
                        if (performanceScope && waitStartedAtMs !== null) {
                            recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'handled');
                        }
                        cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                        return;
                    }
                    if (performanceScope && waitStartedAtMs !== null) {
                        recordCpuTurnPerformanceInterval(performanceScope, 'presentation-handoff', 'wait', waitStartedAtMs, readCpuTurnPerformanceNowMs(performanceScope), 'continue');
                    }
                    cfg.runCpuTurn(playerKey, resumeOptions);
                };
                const scheduled = cfg.scheduleRetry(resumeAfterCardAnimation, cfg.getAnimationRetryDelayMs());
                if (scheduled === false) {
                    if (abortIfNeeded()) return { status: 'handled', reason: 'runtime_unavailable' };
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
                    cfg.scheduleRunCpuTurn(playerKey, resumeOptions, cfg.getAnimationRetryDelayMs());
                }
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
