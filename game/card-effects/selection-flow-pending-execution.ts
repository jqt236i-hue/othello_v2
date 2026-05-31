interface SelectionPendingExecutionDeps {
    normalizePendingType: (pendingType: any) => string;
    normalizeSelectionPlayerKey: (playerKey: any) => string;
    resolveSelectionStateRefs: (options?: any) => { cardState: any; gameState: any };
    getPendingCoordinator: () => any;
    shouldAllowSelectionEntryDuringPlayback: (playerKey: any, pendingType: any) => boolean;
    readSelectionBusyState: () => { processing: boolean; cardAnimating: boolean };
    beginSelectionSettlementLock: (meta: any) => any;
    endSelectionSettlementLock: (token: any) => boolean;
    clearSelectionEntryDuringPlayback: () => any;
    setSelectionProcessing: (nextValue: any) => any;
    setSelectionCardAnimating: (nextValue: any) => any;
    createPendingSelectionAction: (playerKey: any, pendingType: any, actionPayload: any, options: any) => any;
    resolvePendingSelectionContract: (pendingType: any) => any;
    shouldUseNetworkPublishOnlyPendingSelection: (pendingType: any) => boolean;
    shouldUsePreviewThenPublishOnlyPendingSelection: (pendingType: any) => boolean;
    shouldSuppressLocalPlaybackForDeferredNetworkSelection: (pendingType: any) => boolean;
    publishPendingSelectionSnapshot: (meta: any) => any;
    readMatchMode: () => any;
    hasActiveNetworkPublishClient: () => boolean;
    resolveAuthoritativeSelectionState: () => { cardState: any; gameState: any };
    shouldRetainPendingSelectionAction: (cardStateValue: any, playerKey: any, pendingType: any) => boolean;
    clearPendingSelectionAction: (playerKey: any) => boolean;
    applySelectionStateResult: (result: any, options: any) => { cardState: any; gameState: any };
    emitSelectionPlaybackEvents: (playbackEvents: any, meta: any, cardStateValue: any) => boolean;
    emitSelectionStateChangeSignals: (playbackEvents: any) => boolean;
    resolveTurnPipelineUIAdapter: () => any;
    resolveTurnPipeline: () => any;
    cloneData: (value: any) => any;
    clonePendingSelectionAction: (action: any) => any;
    emitSelectionMessage: (message: any, context: any) => boolean;
    resolveRootFunction: (name: any) => any;
    finalizePendingSelectionFlow: (options: any) => Promise<any>;
    clearPendingSelectionFailureState: (cardStateValue: any, playerKey: any, options: any) => any;
}

function buildPendingTypeAllowList(options: any, fallbackPendingType: any, deps: SelectionPendingExecutionDeps) {
    const opts = (options && typeof options === 'object') ? options : {};
    const list = Array.isArray(opts.pendingTypes)
        ? opts.pendingTypes.slice()
        : (typeof opts.pendingType === 'string' && opts.pendingType ? [opts.pendingType] : []);
    if (typeof fallbackPendingType === 'string' && fallbackPendingType) {
        list.push(fallbackPendingType);
    }
    return Array.from(new Set(list.map(deps.normalizePendingType).filter((value: any) => !!value)));
}

function getSelectionPending(playerKey: any, options: any, deps: SelectionPendingExecutionDeps) {
    const normalizedPlayerKey = deps.normalizeSelectionPlayerKey(playerKey);
    const opts = (options && typeof options === 'object') ? options : {};
    const stateRefs = deps.resolveSelectionStateRefs(opts);
    const pendingCoordinator = deps.getPendingCoordinator();
    const pending = (pendingCoordinator && typeof pendingCoordinator.readPendingEffect === 'function')
        ? pendingCoordinator.readPendingEffect(stateRefs.cardState, normalizedPlayerKey)
        : (stateRefs.cardState && stateRefs.cardState.pendingEffectByPlayer
            ? stateRefs.cardState.pendingEffectByPlayer[normalizedPlayerKey]
            : null);
    if (!pending || typeof pending !== 'object') {
        return { pending: null, pendingType: null };
    }
    const pendingType = deps.normalizePendingType(pending.type);
    const allowList = buildPendingTypeAllowList(opts, pendingType, deps);
    const requiredStage = typeof opts.stage === 'string' && opts.stage
        ? opts.stage
        : 'selectTarget';
    if (requiredStage && pending.stage !== requiredStage) {
        return { pending: null, pendingType };
    }
    if (allowList.length > 0 && allowList.indexOf(pendingType) === -1) {
        return { pending: null, pendingType };
    }
    return { pending, pendingType };
}

async function previewPendingSelectionExecution(options: any, deps: SelectionPendingExecutionDeps) {
    const opts = (options && typeof options === 'object') ? options : {};
    const adapter = deps.resolveTurnPipelineUIAdapter();
    const pipeline = deps.resolveTurnPipeline();
    if (!adapter || typeof adapter.runTurnWithAdapter !== 'function' || !pipeline) {
        return {
            ok: true,
            result: null,
            appliedSelection: true
        };
    }

    const previewCardState = deps.cloneData(opts.cardState);
    const previewGameState = deps.cloneData(opts.gameState);
    const previewAction = deps.clonePendingSelectionAction(opts.action) || {};
    previewAction.__suppressUiLogs = true;

    const previewResult = adapter.runTurnWithAdapter(
        previewCardState,
        previewGameState,
        opts.playerKey,
        previewAction,
        pipeline
    );
    if (!previewResult || previewResult.ok === false) {
        return {
            ok: false,
            result: previewResult || { ok: false, reason: 'selection_preview_failed' },
            appliedSelection: false
        };
    }

    const previewContext = Object.assign({}, opts.context || {}, {
        action: previewAction,
        result: previewResult,
        cardState: previewResult.nextCardState || previewCardState,
        gameState: previewResult.nextGameState || previewGameState,
        playbackEvents: Array.isArray(previewResult.playbackEvents) ? previewResult.playbackEvents : []
    });
    const appliedSelection = (typeof opts.validateResult === 'function')
        ? (await opts.validateResult(previewContext))
        : true;
    return {
        ok: !!appliedSelection,
        result: previewResult,
        appliedSelection: !!appliedSelection
    };
}

async function executePendingSelection(options: any, deps: SelectionPendingExecutionDeps) {
    const opts = (options && typeof options === 'object') ? options : {};
    const row = Number(opts.row);
    const col = Number(opts.col);
    const playerKey = deps.normalizeSelectionPlayerKey(opts.playerKey);
    const actionType = typeof opts.actionType === 'string' && opts.actionType
        ? opts.actionType
        : 'place';
    const stateRefs = deps.resolveSelectionStateRefs(opts);

    const pendingInfo = getSelectionPending(playerKey, opts, deps);
    const pending = pendingInfo.pending;
    const resolvedPendingType = pendingInfo.pendingType;
    const allowSelectionEntryDuringPlayback = deps.shouldAllowSelectionEntryDuringPlayback(playerKey, resolvedPendingType);
    const busyState = deps.readSelectionBusyState();
    if (
        allowSelectionEntryDuringPlayback !== true
        && (busyState.processing === true || busyState.cardAnimating === true)
    ) {
        return { ok: false, reason: 'busy' };
    }

    if (allowSelectionEntryDuringPlayback === true) {
        deps.clearSelectionEntryDuringPlayback();
    }
    const selectionSettlementLockToken = deps.beginSelectionSettlementLock({
        playerKey,
        pendingType: resolvedPendingType,
        actionType,
        source: 'selection_flow_pending_execution'
    });
    const ownsSelectionCardAnimating = allowSelectionEntryDuringPlayback !== true;
    deps.setSelectionProcessing(true);
    if (ownsSelectionCardAnimating) {
        deps.setSelectionCardAnimating(true);
    }

    let shouldFinalize = false;
    let pendingAction: any = null;
    let playbackEvents = [];
    let executionResult = null;
    let appliedSelection = null;
    let skipFinalizeNetworkPublish = false;
    let shouldClearPendingActionOnExit = false;
    let shouldClearPendingEffectOnExit = false;
    let pendingFailureReason = null;

    function markPendingActionFailure(reason: any) {
        if (!pendingAction || typeof pendingAction !== 'object') return;
        shouldClearPendingActionOnExit = true;
        pendingFailureReason = typeof reason === 'string' && reason ? reason : 'selection_failed';
    }

    try {
        if (!pending || !resolvedPendingType) {
            return { ok: false, reason: 'pending_unavailable' };
        }

        const baseContext = {
            row,
            col,
            playerKey,
            pending,
            pendingType: resolvedPendingType,
            cardState: stateRefs.cardState,
            gameState: stateRefs.gameState,
            stateRefs
        };

        if (typeof opts.beforeRun === 'function') {
            const beforeRunResult = await opts.beforeRun(baseContext);
            if (beforeRunResult === false) {
                return { ok: false, reason: 'before_run_rejected' };
            }
        }

        const actionPayload = (typeof opts.buildActionPayload === 'function')
            ? (await opts.buildActionPayload(baseContext))
            : Object.assign({}, opts.actionPayload || {});
        const normalizedActionPayload = (actionPayload && typeof actionPayload === 'object')
            ? actionPayload
            : {};

        pendingAction = deps.createPendingSelectionAction(playerKey, resolvedPendingType, normalizedActionPayload, {
            cardState: stateRefs.cardState,
            actionType
        });
        const contract = deps.resolvePendingSelectionContract(resolvedPendingType);

        if (deps.shouldUseNetworkPublishOnlyPendingSelection(resolvedPendingType)) {
            const publishResult = await Promise.resolve(deps.publishPendingSelectionSnapshot({
                playerKey,
                actionType,
                action: pendingAction,
                playbackEvents: []
            }));
            if (!publishResult || publishResult.ok !== true) {
                markPendingActionFailure('network_publish_failed');
                const ensureFn = deps.resolveRootFunction('ensureCurrentPlayerCanActOrPass');
                if (typeof ensureFn === 'function') {
                    ensureFn({ useBlackDelay: true });
                }
                return {
                    ok: false,
                    reason: 'network_publish_failed',
                    result: publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' }
                };
            }
            return {
                ok: true,
                pendingType: resolvedPendingType,
                action: pendingAction,
                result: publishResult,
                appliedSelection: true,
                playbackEvents: [],
                publishedByNetwork: true
            };
        }

        if (
            deps.readMatchMode() === 'network'
            && contract
            && contract.kind === 'multi_stage'
            && contract.deferNetworkPublish
            && deps.hasActiveNetworkPublishClient()
        ) {
            const preview = await previewPendingSelectionExecution({
                playerKey,
                action: pendingAction,
                cardState: stateRefs.cardState,
                gameState: stateRefs.gameState,
                context: baseContext,
                validateResult: opts.validateResult
            }, deps);
            if (!preview.ok) {
                markPendingActionFailure('selection_not_applied');
                deps.emitSelectionMessage(opts.invalidMessage, Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: preview.result
                }));
                return {
                    ok: false,
                    reason: 'selection_not_applied',
                    result: preview.result
                };
            }

            const previewPendingByPlayer = preview.result && preview.result.nextCardState && preview.result.nextCardState.pendingEffectByPlayer;
            const previewPending = previewPendingByPlayer ? previewPendingByPlayer[playerKey] : null;
            const previewPendingType = deps.normalizePendingType(previewPending && previewPending.type);
            const isIntermediateStage = !!previewPendingType && previewPendingType === resolvedPendingType;

            if (!isIntermediateStage) {
                const publishResult = await Promise.resolve(deps.publishPendingSelectionSnapshot({
                    playerKey,
                    actionType,
                    action: pendingAction,
                    playbackEvents: []
                }));
                if (!publishResult || publishResult.ok !== true) {
                    markPendingActionFailure('network_publish_failed');
                    const ensureFn = deps.resolveRootFunction('ensureCurrentPlayerCanActOrPass');
                    if (typeof ensureFn === 'function') {
                        ensureFn({ useBlackDelay: true });
                    }
                    return {
                        ok: false,
                        reason: 'network_publish_failed',
                        result: publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' }
                    };
                }

                const authoritativeState = deps.resolveAuthoritativeSelectionState();
                if (!deps.shouldRetainPendingSelectionAction(authoritativeState.cardState || stateRefs.cardState, playerKey, resolvedPendingType)) {
                    deps.clearPendingSelectionAction(playerKey);
                }

                return {
                    ok: true,
                    pendingType: resolvedPendingType,
                    action: pendingAction,
                    result: preview.result,
                    publishResult,
                    appliedSelection: preview.appliedSelection,
                    playbackEvents: [],
                    publishedByNetwork: true
                };
            }

            executionResult = preview.result;
            appliedSelection = preview.appliedSelection;
            const appliedState = deps.applySelectionStateResult(executionResult, stateRefs);
            playbackEvents = Array.isArray(executionResult.playbackEvents)
                ? executionResult.playbackEvents
                : [];

            const liveContext = Object.assign({}, baseContext, {
                action: pendingAction,
                result: executionResult,
                appliedSelection,
                cardState: appliedState.cardState,
                gameState: appliedState.gameState,
                playbackEvents
            });
            const playbackMeta = (typeof opts.buildPlaybackMeta === 'function')
                ? opts.buildPlaybackMeta(liveContext)
                : { cause: resolvedPendingType, target: { row, col } };
            deps.emitSelectionPlaybackEvents(playbackEvents, playbackMeta, appliedState.cardState);

            if (opts.emitStateChanges !== false) {
                deps.emitSelectionStateChangeSignals(playbackEvents);
            }

            if (typeof opts.afterStateChange === 'function') {
                await opts.afterStateChange(liveContext);
            }

            skipFinalizeNetworkPublish = true;
            shouldFinalize = contract.turnOutcome === 'end_turn' ? false : true;
            if (contract.turnOutcome === 'end_turn') {
                const ensureFn = deps.resolveRootFunction('ensureCurrentPlayerCanActOrPass');
                if (typeof ensureFn === 'function') {
                    ensureFn({ useBlackDelay: true });
                }
            }
            return {
                ok: true,
                pendingType: resolvedPendingType,
                action: pendingAction,
                result: executionResult,
                appliedSelection,
                playbackEvents,
                intermediatePreviewApplied: true
            };
        }

        if (deps.shouldUsePreviewThenPublishOnlyPendingSelection(resolvedPendingType)) {
            const preview = await previewPendingSelectionExecution({
                playerKey,
                action: pendingAction,
                cardState: stateRefs.cardState,
                gameState: stateRefs.gameState,
                context: baseContext,
                validateResult: opts.validateResult
            }, deps);
            if (!preview.ok) {
                markPendingActionFailure('selection_not_applied');
                deps.emitSelectionMessage(opts.invalidMessage, Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: preview.result
                }));
                return {
                    ok: false,
                    reason: 'selection_not_applied',
                    result: preview.result
                };
            }

            const previousCardStateSnapshot = deps.cloneData(stateRefs.cardState);
            const previousGameStateSnapshot = deps.cloneData(stateRefs.gameState);
            executionResult = preview.result;
            appliedSelection = preview.appliedSelection;
            const appliedState = deps.applySelectionStateResult(executionResult, stateRefs);
            playbackEvents = deps.shouldSuppressLocalPlaybackForDeferredNetworkSelection(resolvedPendingType)
                ? []
                : (Array.isArray(executionResult.playbackEvents) ? executionResult.playbackEvents : []);

            if (opts.emitStateChanges !== false) {
                deps.emitSelectionStateChangeSignals(playbackEvents);
            }

            const publishResult = await Promise.resolve(deps.publishPendingSelectionSnapshot({
                playerKey,
                actionType,
                action: pendingAction,
                playbackEvents: []
            }));
            if (!publishResult || publishResult.ok !== true) {
                deps.applySelectionStateResult({
                    nextCardState: previousCardStateSnapshot,
                    nextGameState: previousGameStateSnapshot
                }, stateRefs);
                if (opts.emitStateChanges !== false) {
                    deps.emitSelectionStateChangeSignals([]);
                }
                markPendingActionFailure('network_publish_failed');
                const ensureFn = deps.resolveRootFunction('ensureCurrentPlayerCanActOrPass');
                if (typeof ensureFn === 'function') {
                    ensureFn({ useBlackDelay: true });
                }
                return {
                    ok: false,
                    reason: 'network_publish_failed',
                    result: publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' }
                };
            }

            if (typeof opts.afterStateChange === 'function') {
                await opts.afterStateChange(Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: executionResult,
                    appliedSelection,
                    cardState: appliedState.cardState,
                    gameState: appliedState.gameState,
                    playbackEvents
                }));
            }

            skipFinalizeNetworkPublish = true;
            shouldFinalize = true;

            return {
                ok: true,
                pendingType: resolvedPendingType,
                action: pendingAction,
                result: executionResult,
                publishResult,
                appliedSelection,
                playbackEvents,
                publishedByNetwork: true
            };
        }

        const adapter = deps.resolveTurnPipelineUIAdapter();
        const pipeline = deps.resolveTurnPipeline();
        executionResult = (adapter && pipeline && typeof adapter.runTurnWithAdapter === 'function')
            ? adapter.runTurnWithAdapter(stateRefs.cardState, stateRefs.gameState, playerKey, pendingAction, pipeline)
            : null;

        if (!executionResult || executionResult.ok === false) {
            markPendingActionFailure('selection_rejected');
            deps.emitSelectionMessage(opts.invalidMessage, Object.assign({}, baseContext, {
                action: pendingAction,
                result: executionResult
            }));
            return {
                ok: false,
                reason: 'selection_rejected',
                result: executionResult
            };
        }

        appliedSelection = (typeof opts.validateResult === 'function')
            ? (await opts.validateResult(Object.assign({}, baseContext, {
                action: pendingAction,
                result: executionResult
            })))
            : true;

        if (!appliedSelection) {
            markPendingActionFailure('selection_not_applied');
            deps.emitSelectionMessage(opts.invalidMessage, Object.assign({}, baseContext, {
                action: pendingAction,
                result: executionResult
            }));
            return {
                ok: false,
                reason: 'selection_not_applied',
                result: executionResult
            };
        }

        const appliedState = deps.applySelectionStateResult(executionResult, stateRefs);
        playbackEvents = Array.isArray(executionResult.playbackEvents)
            ? executionResult.playbackEvents
            : [];
        const suppressLocalPlayback = deps.shouldSuppressLocalPlaybackForDeferredNetworkSelection(resolvedPendingType);
        if (suppressLocalPlayback) {
            playbackEvents = [];
        }

        const liveContext = Object.assign({}, baseContext, {
            action: pendingAction,
            result: executionResult,
            appliedSelection,
            cardState: appliedState.cardState,
            gameState: appliedState.gameState,
            playbackEvents
        });

        if (!suppressLocalPlayback) {
            const playbackMeta = (typeof opts.buildPlaybackMeta === 'function')
                ? opts.buildPlaybackMeta(liveContext)
                : { cause: resolvedPendingType, target: { row, col } };
            deps.emitSelectionPlaybackEvents(playbackEvents, playbackMeta, appliedState.cardState);
        }

        if (opts.emitStateChanges !== false) {
            deps.emitSelectionStateChangeSignals(playbackEvents);
        }

        if (typeof opts.afterStateChange === 'function') {
            await opts.afterStateChange(liveContext);
        }

        shouldFinalize = true;
        return {
            ok: true,
            pendingType: resolvedPendingType,
            action: pendingAction,
            result: executionResult,
            appliedSelection,
            playbackEvents
        };
    } finally {
        deps.endSelectionSettlementLock(selectionSettlementLockToken);
        if (shouldFinalize) {
            try {
                const finalizeOptions = Object.assign({
                    playerKey,
                    pendingType: resolvedPendingType,
                    actionType,
                    action: pendingAction,
                    playbackEvents,
                    gameStateValue: stateRefs.gameState,
                    cardStateValue: stateRefs.cardState,
                    onSettled: opts.defaultSelectionHandoffRender,
                    onHumanTurnReady: opts.defaultSelectionHandoffRender,
                    ensureCurrentPlayerCanActOrPass: deps.resolveRootFunction('ensureCurrentPlayerCanActOrPass'),
                    skipNetworkPublish: skipFinalizeNetworkPublish,
                    clearCardAnimatingOnFinish: true
                }, (opts.finalizeOptions && typeof opts.finalizeOptions === 'object') ? opts.finalizeOptions : {});
                await deps.finalizePendingSelectionFlow(finalizeOptions);
            } catch (e) {
                deps.setSelectionProcessing(false);
                deps.setSelectionCardAnimating(false);
                const ensureFn = deps.resolveRootFunction('ensureCurrentPlayerCanActOrPass');
                if (typeof ensureFn === 'function') {
                    try { ensureFn({ useBlackDelay: true }); } catch (ignore) { /* ignore */ }
                }
            }
        } else {
            if (shouldClearPendingActionOnExit) {
                deps.clearPendingSelectionFailureState(stateRefs.cardState, playerKey, {
                    clearPendingEffect: shouldClearPendingEffectOnExit,
                    failureReason: pendingFailureReason
                });
                pendingAction = null;
            }
            deps.setSelectionProcessing(false);
            deps.setSelectionCardAnimating(false);
        }
    }
}

const SelectionFlowPendingExecutionModule = {
    executePendingSelection
};

const pendingExecutionRoot = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);
if (pendingExecutionRoot && !pendingExecutionRoot.SelectionFlowPendingExecution) {
    pendingExecutionRoot.SelectionFlowPendingExecution = SelectionFlowPendingExecutionModule;
}

export = SelectionFlowPendingExecutionModule;
