type CpuDecisionPendingPipelineConfig = {
    readRuntimeModule: (moduleKey: any) => any;
    resolveModuleReference: (currentValue: any, options: any) => any;
    readTurnPipelineAdapterLocal: () => any;
    readTurnPipelineLocal: () => any;
    resolvePendingSelectionFlow: (requiredFunctionName: any) => any;
    createPlaceAction: (playerKey: any, actionPayload: any) => any;
    getCardState: () => any;
    getGameState: () => any;
    setCardState: (nextCardState: any) => void;
    setGameState: (nextGameState: any) => void;
    emitPresentationEventForCpu: (event: any) => any;
    emitCpuSelectionStateChange: () => any;
    finalizeCpuPendingSelectionFlow: (playerKey: any, pendingType: any, playbackEvents: any, action: any) => Promise<any> | any;
};

export function createCpuDecisionPendingPipeline(config: CpuDecisionPendingPipelineConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionPendingPipelineConfig;
    let cachedTurnPipelineAdapter: any = null;
    let cachedTurnPipeline: any = null;

    function isRuntimeUnavailableResult(value: any): boolean {
        if (!value || typeof value !== 'object') return false;
        const reason = String(value.reason || value.rejectedReason || '').trim().toUpperCase();
        return reason === 'RUNTIME_UNAVAILABLE';
    }

    function resolveTurnPipelineAdapter(): any {
        const globalAdapter = cfg.readRuntimeModule('TurnPipelineUIAdapter');
        if (globalAdapter) {
            cachedTurnPipelineAdapter = globalAdapter;
            return globalAdapter;
        }
        const localAdapter = (typeof cfg.readTurnPipelineAdapterLocal === 'function')
            ? cfg.readTurnPipelineAdapterLocal()
            : null;
        if (localAdapter) {
            cachedTurnPipelineAdapter = localAdapter;
            return localAdapter;
        }
        const resolved = cfg.resolveModuleReference(cachedTurnPipelineAdapter, {
            requirePath: './turn/pipeline_ui_adapter',
            globalKey: 'TurnPipelineUIAdapter',
            isValid: (moduleRef: any) => !!moduleRef
        });
        if (resolved) cachedTurnPipelineAdapter = resolved;
        return resolved;
    }

    function resolveTurnPipeline(): any {
        const globalPipeline = cfg.readRuntimeModule('TurnPipeline');
        if (globalPipeline) {
            cachedTurnPipeline = globalPipeline;
            return globalPipeline;
        }
        const localPipeline = (typeof cfg.readTurnPipelineLocal === 'function')
            ? cfg.readTurnPipelineLocal()
            : null;
        if (localPipeline) {
            cachedTurnPipeline = localPipeline;
            return localPipeline;
        }
        const resolved = cfg.resolveModuleReference(cachedTurnPipeline, {
            requirePath: './turn/turn_pipeline',
            globalKey: 'TurnPipeline',
            isValid: (moduleRef: any) => !!moduleRef
        });
        if (resolved) cachedTurnPipeline = resolved;
        return resolved;
    }

    async function runCpuPendingSelectionViaPipeline(playerKey: any, actionPayload: any, pendingType: any): Promise<any> {
        const adapter = resolveTurnPipelineAdapter();
        const pipeline = resolveTurnPipeline();
        const pendingSelectionFlow = cfg.resolvePendingSelectionFlow('createPendingSelectionAction');
        if (!adapter || !pipeline || typeof adapter.runTurnWithAdapter !== 'function') return null;

        const cardState = cfg.getCardState();
        const gameState = cfg.getGameState();
        const normalizedActionPayload = Object.assign({}, actionPayload || {});
        normalizedActionPayload.deferNetworkPublish = true;

        const action = (pendingSelectionFlow && typeof pendingSelectionFlow.createPendingSelectionAction === 'function')
            ? pendingSelectionFlow.createPendingSelectionAction(playerKey, pendingType, normalizedActionPayload, { cardState })
            : cfg.createPlaceAction(playerKey, normalizedActionPayload);
        if (action) {
            action.deferNetworkPublish = true;
        }
        if ((!pendingSelectionFlow || typeof pendingSelectionFlow.createPendingSelectionAction !== 'function')
            && action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const res = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline);
        if (!res || res.ok === false) {
            if (isRuntimeUnavailableResult(res)) {
                return { ok: false, handled: true, reason: 'runtime_unavailable', res };
            }
            return { ok: false, res };
        }

        if (res.nextCardState) cfg.setCardState(res.nextCardState);
        if (res.nextGameState) cfg.setGameState(res.nextGameState);
        if (res.playbackEvents && res.playbackEvents.length) {
            cfg.emitPresentationEventForCpu({
                type: 'PLAYBACK_EVENTS',
                events: res.playbackEvents,
                meta: { source: 'cpu_pending_selection', pendingType: pendingType || null }
            });
        }
        cfg.emitCpuSelectionStateChange();
        const finalizationResult = await cfg.finalizeCpuPendingSelectionFlow(
            playerKey,
            pendingType,
            res.playbackEvents,
            action
        );
        if (isRuntimeUnavailableResult(finalizationResult)) {
            return { ok: false, handled: true, reason: 'runtime_unavailable', res };
        }
        if (finalizationResult === false) {
            return { ok: false, handled: true, reason: 'finalization_failed', res };
        }
        return { ok: true, res };
    }

    return {
        resolveTurnPipelineAdapter,
        resolveTurnPipeline,
        runCpuPendingSelectionViaPipeline
    };
}
