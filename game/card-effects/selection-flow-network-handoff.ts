interface SelectionFlowNetworkHandoffDeps {
    normalizePendingType: (pendingType: any) => string;
    resolvePendingSelectionContract: (pendingType: any) => any;
    resolveCurrentCardState: () => any;
    syncPendingSelectionActionCache: (pendingEffectByPlayer: any) => any;
    storePendingSelectionAction: (playerKey: any, action: any, pendingType: any) => any;
    readPendingSelectionAction: (playerKey: any) => any;
    shouldRetainPendingSelectionAction: (cardStateValue: any, playerKey: any, pendingType: any) => boolean;
    clearPendingSelectionAction: (playerKey: any) => boolean;
    readMatchMode: () => any;
    hasActiveNetworkPublishClient: () => boolean;
    isHumanVsHumanModeEnabled: () => boolean;
    getNetworkTurnHandoff: () => any;
    setSelectionProcessing: (nextValue: any) => any;
    setSelectionCardAnimating: (nextValue: any) => any;
    publishPendingSelectionSnapshot: (meta: any) => any;
    waitForPlaybackViaBridge?: (playbackEvents: any) => Promise<any>;
    scheduleWhiteCpuTurn: (options: any) => boolean;
}

async function waitForSelectionPlaybackIdle(playbackEvents: any, deps: SelectionFlowNetworkHandoffDeps) {
    if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return;

    if (deps && typeof deps.waitForPlaybackViaBridge === 'function') {
        try {
            await deps.waitForPlaybackViaBridge(playbackEvents);
            return;
        } catch (e) { /* ignore */ }
    }

    const networkTurnHandoff = deps.getNetworkTurnHandoff();
    if (networkTurnHandoff && typeof networkTurnHandoff.waitForPlaybackIdleIfNeeded === 'function') {
        return networkTurnHandoff.waitForPlaybackIdleIfNeeded(playbackEvents);
    }
}

async function finalizePendingSelectionFlow(options: any, deps: SelectionFlowNetworkHandoffDeps) {
    const opts = (options && typeof options === 'object') ? options : {};
    const pendingType = deps.normalizePendingType(opts.pendingType);
    const contract = deps.resolvePendingSelectionContract(pendingType);
    const playerKey = opts.playerKey || 'black';
    const actionType = opts.actionType || 'place';
    const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents.slice() : [];
    const cardStateValue = opts.cardStateValue || deps.resolveCurrentCardState();
    const pendingByPlayer = cardStateValue && cardStateValue.pendingEffectByPlayer;
    if (
        !(opts.action && typeof opts.action === 'object')
        && pendingByPlayer
        && pendingByPlayer[playerKey]
    ) {
        deps.syncPendingSelectionActionCache(cardStateValue);
    }
    const pendingAction = (opts.action && typeof opts.action === 'object')
        ? deps.storePendingSelectionAction(playerKey, opts.action, pendingType)
        : deps.readPendingSelectionAction(playerKey);
    const ensureFn = typeof opts.ensureCurrentPlayerCanActOrPass === 'function'
        ? opts.ensureCurrentPlayerCanActOrPass
        : null;
    let skipNetworkPublish = opts.skipNetworkPublish === true;
    const clearCardAnimatingOnFinish = opts.clearCardAnimatingOnFinish !== false;
    const currentPending = pendingByPlayer ? pendingByPlayer[playerKey] : null;
    if (
        !skipNetworkPublish
        && contract
        && contract.deferNetworkPublish === true
        && contract.kind === 'multi_stage'
        && pendingAction
        && pendingAction.deferNetworkPublish === true
        && deps.normalizePendingType(currentPending && currentPending.type) === pendingType
        && String(currentPending && currentPending.stage || '') === 'selectTarget'
    ) {
        skipNetworkPublish = true;
    }

    if (contract && contract.turnOutcome === 'end_turn') {
        const networkTurnHandoff = deps.getNetworkTurnHandoff();
        let publishFailureHandled = false;
        if (!networkTurnHandoff || typeof networkTurnHandoff.finalizeNetworkTurnHandoff !== 'function') {
            deps.setSelectionProcessing(false);
            if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);
            if (ensureFn) {
                try { ensureFn({ useBlackDelay: opts.useBlackDelay !== false }); } catch (e) { /* ignore */ }
            }
            return false;
        }

        const shouldAwaitPublish = deps.readMatchMode() === 'network' && contract.deferNetworkPublish === true && deps.hasActiveNetworkPublishClient();
        const handoffResult = await networkTurnHandoff.finalizeNetworkTurnHandoff({
            awaitPublishResult: shouldAwaitPublish,
            playerKey,
            actionType,
            action: pendingAction,
            playbackEvents,
            skipLocalPlaybackWait: shouldAwaitPublish,
            humanMode: deps.isHumanVsHumanModeEnabled(),
            setProcessing: deps.setSelectionProcessing,
            onPublishFailed: () => {
                publishFailureHandled = true;
                deps.clearPendingSelectionAction(playerKey);
                if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);
                if (ensureFn) {
                    try { ensureFn({ useBlackDelay: opts.useBlackDelay !== false }); } catch (e) { /* ignore */ }
                }
            },
            publishSnapshot: ({ playerKey: publishPlayerKey, action: publishAction, playbackEvents: publishPlaybackEvents }: { playerKey: any; action: any; playbackEvents: any }) => {
                const publishMeta = {
                    playerKey: publishPlayerKey,
                    actionType,
                    action: publishAction || pendingAction,
                    playbackEvents: publishPlaybackEvents
                };
                if (typeof opts.publishSnapshot === 'function') {
                    return opts.publishSnapshot(publishMeta);
                }
                return deps.publishPendingSelectionSnapshot(publishMeta);
            },
            scheduleCpuTurn: deps.scheduleWhiteCpuTurn,
            onHumanTurnReady: opts.onHumanTurnReady
        });
        if (shouldAwaitPublish) {
            if (!handoffResult || handoffResult.ok !== true) {
                if (!publishFailureHandled) {
                    deps.clearPendingSelectionAction(playerKey);
                    deps.setSelectionProcessing(false);
                    if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);
                    if (ensureFn) {
                        try { ensureFn({ useBlackDelay: opts.useBlackDelay !== false }); } catch (e) { /* ignore */ }
                    }
                }
                return false;
            }
        }
        if (!deps.shouldRetainPendingSelectionAction(cardStateValue, playerKey, pendingType)) {
            deps.clearPendingSelectionAction(playerKey);
        }
        if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);
        return true;
    }

    if (contract && contract.waitForPlaybackIdle && !(deps.readMatchMode() === 'network' && contract.deferNetworkPublish === true && deps.hasActiveNetworkPublishClient())) {
        await waitForSelectionPlaybackIdle(playbackEvents, deps);
    }

    if (contract && contract.deferNetworkPublish && !skipNetworkPublish) {
        const publishMeta = {
            playerKey,
            actionType,
            action: pendingAction,
            playbackEvents
        };
        deps.publishPendingSelectionSnapshot(publishMeta);
    }

    if (!deps.shouldRetainPendingSelectionAction(cardStateValue, playerKey, pendingType)) {
        deps.clearPendingSelectionAction(playerKey);
    }

    deps.setSelectionProcessing(false);
    if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);

    if (typeof opts.onSettled === 'function') {
        try { await opts.onSettled(); } catch (e) { /* ignore */ }
    }

    if (ensureFn) {
        try { ensureFn({ useBlackDelay: opts.useBlackDelay !== false }); } catch (e) { /* ignore */ }
    }

    return true;
}

const SelectionFlowNetworkHandoffModule = {
    waitForSelectionPlaybackIdle,
    finalizePendingSelectionFlow
};

const handoffRoot = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);
if (handoffRoot && !handoffRoot.SelectionFlowNetworkHandoff) {
    handoffRoot.SelectionFlowNetworkHandoff = SelectionFlowNetworkHandoffModule;
}

export = SelectionFlowNetworkHandoffModule;
