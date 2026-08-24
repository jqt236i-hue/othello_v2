type CpuDecisionSelectionFlowConfig = {
    getRuntime: () => any;
    getNetworkTurnHandoff: () => any;
    getTimerService: () => any;
    getGameState: () => any;
    getCardState: () => any;
    resolvePlayerKeyFromTurnValue: (value: any) => any;
    isSelectionOnlyEndTurnPendingType: (pendingType: any) => any;
    resolvePendingSelectionFlow: (requiredFunctionName: any) => any;
    readLegacyProcessCpuTurn: () => any;
    emitBoardUpdate: () => void;
};

export function createCpuDecisionSelectionFlow(config: CpuDecisionSelectionFlowConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionSelectionFlowConfig;

    function isCpuSelectionRuntimeIntegrityBlocked(): boolean {
        const runtime = cfg.getRuntime();
        if (!runtime || typeof runtime.isCardRuntimeIntegrityBlocked !== 'function') return false;
        try {
            return runtime.isCardRuntimeIntegrityBlocked() === true;
        } catch (_error) {
            return true;
        }
    }

    function emitBoardUpdateSafely(): void {
        if (isCpuSelectionRuntimeIntegrityBlocked()) return;
        try {
            cfg.emitBoardUpdate();
        } catch (e) { /* ignore */ }
    }

    function readCpuDecisionMatchMode(): any {
        const runtime = cfg.getRuntime();
        if (runtime && typeof runtime.readMatchMode === 'function') {
            try {
                const mode = runtime.readMatchMode();
                if (mode) return mode;
            } catch (e) { /* ignore */ }
        }
        if (runtime && typeof runtime.getCurrentMatchMode === 'function') {
            try {
                const mode = runtime.getCurrentMatchMode();
                if (mode) return mode;
            } catch (e) { /* ignore */ }
        }
        if (runtime && typeof runtime.MATCH_MODE !== 'undefined') {
            return runtime.MATCH_MODE;
        }
        return null;
    }

    function readCpuDecisionHumanVsHumanFlag(): boolean {
        const runtime = cfg.getRuntime();
        if (runtime && typeof runtime.readHumanVsHumanMode === 'function') {
            try { return runtime.readHumanVsHumanMode() === true; } catch (e) { /* ignore */ }
        }
        if (runtime && typeof runtime.DEBUG_HUMAN_VS_HUMAN !== 'undefined') {
            return runtime.DEBUG_HUMAN_VS_HUMAN === true;
        }
        return false;
    }

    function resolveCpuDecisionProcessCpuTurn(): any {
        const runtime = cfg.getRuntime();
        if (runtime && typeof runtime.processCpuTurn === 'function') {
            return runtime.processCpuTurn;
        }
        try {
            const legacyProcessCpuTurn = cfg.readLegacyProcessCpuTurn();
            if (typeof legacyProcessCpuTurn === 'function') return legacyProcessCpuTurn;
        } catch (e) { /* ignore */ }
        return null;
    }

    function isCpuSelectionHumanVsHumanModeEnabled(): any {
        const debugHvH = readCpuDecisionHumanVsHumanFlag();
        const matchMode = String(readCpuDecisionMatchMode() || '').trim().toLowerCase();
        return debugHvH || matchMode === 'network';
    }

    function publishCpuSelectionNetworkSnapshot(playerKey: any, action: any, playbackEvents: any, snapshotOverride?: any): any {
        if (isCpuSelectionRuntimeIntegrityBlocked()) {
            return { ok: false, reason: 'RUNTIME_UNAVAILABLE' };
        }
        const meta = {
            playerKey: playerKey || 'black',
            actionType: 'place',
            playbackEvents: Array.isArray(playbackEvents) ? playbackEvents : []
        };
        if (action && typeof action === 'object') (meta as any).action = action;
        if (snapshotOverride) (meta as any).snapshot = snapshotOverride;

        const runtime = cfg.getRuntime();
        if (runtime && typeof runtime.publishSnapshot === 'function') {
            if (typeof runtime.isNetworkPublishActive === 'function'
                && runtime.isNetworkPublishActive() !== true) {
                return undefined;
            }
            return runtime.publishSnapshot(meta);
        }
        const networkTurnHandoff = cfg.getNetworkTurnHandoff();
        if (networkTurnHandoff && typeof networkTurnHandoff.publishNetworkSnapshot === 'function') {
            return networkTurnHandoff.publishNetworkSnapshot(meta);
        }
        return undefined;
    }

    function isCpuSelectionNetworkPublishActive(): boolean {
        if (isCpuSelectionRuntimeIntegrityBlocked()) return false;
        const runtime = cfg.getRuntime();
        if (runtime && typeof runtime.publishSnapshot === 'function') {
            if (typeof runtime.isNetworkPublishActive === 'function') {
                try {
                    return runtime.isNetworkPublishActive() === true;
                } catch (e) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    async function waitForCpuSelectionPlaybackIdle(playbackEvents: any): Promise<any> {
        if (isCpuSelectionRuntimeIntegrityBlocked()) return;
        const networkTurnHandoff = cfg.getNetworkTurnHandoff();
        if (networkTurnHandoff && typeof networkTurnHandoff.waitForPlaybackIdleIfNeeded === 'function') {
            return networkTurnHandoff.waitForPlaybackIdleIfNeeded(playbackEvents);
        }
        if (!Array.isArray(playbackEvents) || !playbackEvents.length) return;

        const runtime = cfg.getRuntime();
        const waitForPlaybackFn = (runtime && typeof runtime.waitForPlaybackIdle === 'function')
            ? runtime.waitForPlaybackIdle
            : null;

        if (typeof waitForPlaybackFn !== 'function') return;

        try {
            await waitForPlaybackFn();
        } catch (e) { /* ignore */ }
    }

    function scheduleCpuSelectionWhiteTurn(delayMs: any, expectedTurnNumber: any): any {
        if (isCpuSelectionRuntimeIntegrityBlocked()) return false;
        const safeDelay = Number.isFinite(delayMs) ? delayMs : 0;
        const timerService = cfg.getTimerService();
        if (!timerService) return false;
        const tid = timerService.setTimeout(() => {
            if (isCpuSelectionRuntimeIntegrityBlocked()) return;
            const gameState = cfg.getGameState();
            const activePlayerKey = cfg.resolvePlayerKeyFromTurnValue(gameState ? gameState.currentPlayer : null);
            const currentTurnNumber = (gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null;
            if (activePlayerKey !== 'white') return;
            if (expectedTurnNumber !== null && currentTurnNumber !== null && expectedTurnNumber !== currentTurnNumber) return;
            const cpuTurnFn = resolveCpuDecisionProcessCpuTurn();
            if (isCpuSelectionRuntimeIntegrityBlocked()) return;
            if (cpuTurnFn) cpuTurnFn();
        }, safeDelay);
        if (tid && typeof tid.unref === 'function') tid.unref();
        return true;
    }

    async function continueCpuSelectionTurnHandoff(playerKey: any, playbackEvents: any, action: any): Promise<any> {
        if (isCpuSelectionRuntimeIntegrityBlocked()) return;
        const networkTurnHandoff = cfg.getNetworkTurnHandoff();
        const finalizeTurn = (networkTurnHandoff && typeof networkTurnHandoff.finalizeNetworkTurnHandoff === 'function')
            ? networkTurnHandoff.finalizeNetworkTurnHandoff
            : null;
        if (!finalizeTurn) return;

        await finalizeTurn({
            playerKey,
            actionType: 'place',
            action,
            playbackEvents,
            humanMode: isCpuSelectionHumanVsHumanModeEnabled(),
            publishSnapshot: ({ playerKey: publishPlayerKey, action: publishAction, playbackEvents: publishPlaybackEvents }: any) => {
                return publishCpuSelectionNetworkSnapshot(publishPlayerKey, publishAction || action, publishPlaybackEvents);
            },
            resolveCurrentPlayerKey: () => {
                const gameState = cfg.getGameState();
                return cfg.resolvePlayerKeyFromTurnValue(gameState ? gameState.currentPlayer : null);
            },
            scheduleCpuTurn: ({ delayMs: nextDelayMs, expectedTurnNumber: nextExpectedTurnNumber }: any) => {
                return scheduleCpuSelectionWhiteTurn(nextDelayMs, nextExpectedTurnNumber);
            },
            onHumanTurnReady: () => {
                emitBoardUpdateSafely();
            },
            isAborted: () => isCpuSelectionRuntimeIntegrityBlocked()
        });
    }

    function maybeContinueCpuSelectionTurnHandoff(playerKey: any, pendingType: any, playbackEvents: any, action?: any): any {
        if (isCpuSelectionRuntimeIntegrityBlocked()) return;
        if (!cfg.isSelectionOnlyEndTurnPendingType(pendingType)) return;
        const gameState = cfg.getGameState();
        const activePlayerKey = cfg.resolvePlayerKeyFromTurnValue(gameState ? gameState.currentPlayer : null);
        if (!activePlayerKey || activePlayerKey === playerKey) return;
        Promise.resolve(continueCpuSelectionTurnHandoff(playerKey, playbackEvents, action)).catch(() => {
            if (!isCpuSelectionRuntimeIntegrityBlocked()) emitBoardUpdateSafely();
        });
    }

    function finalizeCpuPendingSelectionFlow(playerKey: any, pendingType: any, playbackEvents: any, action: any): any {
        if (isCpuSelectionRuntimeIntegrityBlocked()) {
            return Promise.resolve({ ok: false, reason: 'runtime_unavailable' });
        }
        const normalizedPlaybackEvents = Array.isArray(playbackEvents) ? playbackEvents : [];
        const pendingSelectionFlow = cfg.resolvePendingSelectionFlow('finalizePendingSelectionFlow');

        if (pendingSelectionFlow && typeof pendingSelectionFlow.finalizePendingSelectionFlow === 'function') {
            let runtimeUnavailableReported = false;
            return Promise.resolve(pendingSelectionFlow.finalizePendingSelectionFlow({
                playerKey,
                pendingType,
                action,
                playbackEvents: normalizedPlaybackEvents,
                gameStateValue: cfg.getGameState(),
                cardStateValue: cfg.getCardState(),
                onHumanTurnReady: () => {
                    emitBoardUpdateSafely();
                },
                publishSnapshot: (publishMeta: any) => {
                    return publishCpuSelectionNetworkSnapshot(
                        publishMeta && publishMeta.playerKey,
                        (publishMeta && publishMeta.action) || action,
                        publishMeta && publishMeta.playbackEvents
                    );
                },
                readMatchMode: () => readCpuDecisionMatchMode(),
                isNetworkPublishActive: () => isCpuSelectionNetworkPublishActive(),
                onSettled: () => {
                    emitBoardUpdateSafely();
                },
                onRuntimeUnavailable: () => {
                    runtimeUnavailableReported = true;
                }
            })).then((result: any) => {
                if (runtimeUnavailableReported || isCpuSelectionRuntimeIntegrityBlocked()) {
                    return { ok: false, reason: 'runtime_unavailable' };
                }
                return result;
            }).catch(() => {
                if (runtimeUnavailableReported || isCpuSelectionRuntimeIntegrityBlocked()) {
                    return { ok: false, reason: 'runtime_unavailable' };
                }
                if (isCpuSelectionRuntimeIntegrityBlocked()) return;
                if (cfg.isSelectionOnlyEndTurnPendingType(pendingType)) {
                    maybeContinueCpuSelectionTurnHandoff(playerKey, pendingType, normalizedPlaybackEvents, action);
                    return;
                }

                Promise.resolve(waitForCpuSelectionPlaybackIdle(normalizedPlaybackEvents)).then(() => {
                    if (!isCpuSelectionRuntimeIntegrityBlocked()) {
                        publishCpuSelectionNetworkSnapshot(playerKey, action, normalizedPlaybackEvents);
                    }
                }).catch(() => { /* ignore */ });
            });
        }

        if (isCpuSelectionRuntimeIntegrityBlocked()) {
            return Promise.resolve({ ok: false, reason: 'runtime_unavailable' });
        }
        if (cfg.isSelectionOnlyEndTurnPendingType(pendingType)) {
            maybeContinueCpuSelectionTurnHandoff(playerKey, pendingType, normalizedPlaybackEvents, action);
            return Promise.resolve();
        }

        return Promise.resolve(waitForCpuSelectionPlaybackIdle(normalizedPlaybackEvents)).then(() => {
            if (!isCpuSelectionRuntimeIntegrityBlocked()) {
                publishCpuSelectionNetworkSnapshot(playerKey, action, normalizedPlaybackEvents);
            }
        }).catch(() => { /* ignore */ });
    }

    return {
        readCpuDecisionMatchMode,
        readCpuDecisionHumanVsHumanFlag,
        isCpuSelectionRuntimeIntegrityBlocked,
        resolveCpuDecisionProcessCpuTurn,
        isCpuSelectionHumanVsHumanModeEnabled,
        publishCpuSelectionNetworkSnapshot,
        waitForCpuSelectionPlaybackIdle,
        scheduleCpuSelectionWhiteTurn,
        continueCpuSelectionTurnHandoff,
        maybeContinueCpuSelectionTurnHandoff,
        finalizeCpuPendingSelectionFlow
    };
}
