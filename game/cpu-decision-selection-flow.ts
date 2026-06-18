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

    function emitBoardUpdateSafely(): void {
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
        const safeDelay = Number.isFinite(delayMs) ? delayMs : 0;
        const timerService = cfg.getTimerService();
        if (!timerService) return;
        const tid = timerService.setTimeout(() => {
            const gameState = cfg.getGameState();
            const activePlayerKey = cfg.resolvePlayerKeyFromTurnValue(gameState ? gameState.currentPlayer : null);
            const currentTurnNumber = (gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null;
            if (activePlayerKey !== 'white') return;
            if (expectedTurnNumber !== null && currentTurnNumber !== null && expectedTurnNumber !== currentTurnNumber) return;
            const cpuTurnFn = resolveCpuDecisionProcessCpuTurn();
            if (cpuTurnFn) cpuTurnFn();
        }, safeDelay);
        if (tid && typeof tid.unref === 'function') tid.unref();
    }

    async function continueCpuSelectionTurnHandoff(playerKey: any, playbackEvents: any, action: any): Promise<any> {
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
                publishCpuSelectionNetworkSnapshot(publishPlayerKey, publishAction || action, publishPlaybackEvents);
            },
            resolveCurrentPlayerKey: () => {
                const gameState = cfg.getGameState();
                return cfg.resolvePlayerKeyFromTurnValue(gameState ? gameState.currentPlayer : null);
            },
            scheduleCpuTurn: ({ delayMs: nextDelayMs, expectedTurnNumber: nextExpectedTurnNumber }: any) => {
                scheduleCpuSelectionWhiteTurn(nextDelayMs, nextExpectedTurnNumber);
            },
            onHumanTurnReady: () => {
                emitBoardUpdateSafely();
            }
        });
    }

    function maybeContinueCpuSelectionTurnHandoff(playerKey: any, pendingType: any, playbackEvents: any, action?: any): any {
        if (!cfg.isSelectionOnlyEndTurnPendingType(pendingType)) return;
        const gameState = cfg.getGameState();
        const activePlayerKey = cfg.resolvePlayerKeyFromTurnValue(gameState ? gameState.currentPlayer : null);
        if (!activePlayerKey || activePlayerKey === playerKey) return;
        Promise.resolve(continueCpuSelectionTurnHandoff(playerKey, playbackEvents, action)).catch(() => {
            emitBoardUpdateSafely();
        });
    }

    function finalizeCpuPendingSelectionFlow(playerKey: any, pendingType: any, playbackEvents: any, action: any): any {
        const normalizedPlaybackEvents = Array.isArray(playbackEvents) ? playbackEvents : [];
        const pendingSelectionFlow = cfg.resolvePendingSelectionFlow('finalizePendingSelectionFlow');

        if (pendingSelectionFlow && typeof pendingSelectionFlow.finalizePendingSelectionFlow === 'function') {
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
                }
            })).catch(() => {
                if (cfg.isSelectionOnlyEndTurnPendingType(pendingType)) {
                    maybeContinueCpuSelectionTurnHandoff(playerKey, pendingType, normalizedPlaybackEvents, action);
                    return;
                }

                Promise.resolve(waitForCpuSelectionPlaybackIdle(normalizedPlaybackEvents)).then(() => {
                    publishCpuSelectionNetworkSnapshot(playerKey, action, normalizedPlaybackEvents);
                }).catch(() => { /* ignore */ });
            });
        }

        if (cfg.isSelectionOnlyEndTurnPendingType(pendingType)) {
            maybeContinueCpuSelectionTurnHandoff(playerKey, pendingType, normalizedPlaybackEvents, action);
            return Promise.resolve();
        }

        return Promise.resolve(waitForCpuSelectionPlaybackIdle(normalizedPlaybackEvents)).then(() => {
            publishCpuSelectionNetworkSnapshot(playerKey, action, normalizedPlaybackEvents);
        }).catch(() => { /* ignore */ });
    }

    return {
        readCpuDecisionMatchMode,
        readCpuDecisionHumanVsHumanFlag,
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
