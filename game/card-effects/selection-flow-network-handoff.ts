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
    setSelectionBusy?: (nextValue: any) => any;
    isCardRuntimeIntegrityBlocked?: () => boolean;
    publishPendingSelectionSnapshot: (meta: any) => any;
    waitForPlaybackViaBridge?: (playbackEvents: any) => Promise<any>;
    waitForAuthoritativeVisualSettlement?: (publishResult: any) => Promise<any>;
    scheduleWhiteCpuTurn: (options: any) => boolean;
}

async function waitForSelectionPlaybackIdle(playbackEvents: any, deps: SelectionFlowNetworkHandoffDeps, options?: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    if ((!Array.isArray(playbackEvents) || playbackEvents.length === 0) && opts.force !== true) return;

    if (deps && typeof deps.waitForPlaybackViaBridge === 'function') {
        try {
            await deps.waitForPlaybackViaBridge(playbackEvents);
            return;
        } catch (e) {
            // A runtime failure can latch in the microtask immediately behind
            // the rejected bridge promise. Recheck before starting a local
            // fallback for an action the authority has not accepted.
            await Promise.resolve();
            if (
                isSelectionRuntimeIntegrityBlocked(deps)
                && opts.authorityAccepted !== true
            ) return;
        }
    }

    const networkTurnHandoff = deps.getNetworkTurnHandoff();
    if (networkTurnHandoff && typeof networkTurnHandoff.waitForPlaybackIdleIfNeeded === 'function') {
        return networkTurnHandoff.waitForPlaybackIdleIfNeeded(playbackEvents);
    }
}

function shouldReleaseSelectionBusyBeforePlaybackWait(contract: any) {
    return !!(contract && contract.kind === 'hand_overlay' && contract.waitForPlaybackIdle === true);
}

function releaseSelectionBusyForPlaybackWait(deps: SelectionFlowNetworkHandoffDeps, clearCardAnimatingOnFinish: boolean) {
    if (typeof deps.setSelectionBusy === 'function') {
        deps.setSelectionBusy(false);
        return;
    }
    deps.setSelectionProcessing(false);
    if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);
}

function isSelectionRuntimeIntegrityBlocked(deps: SelectionFlowNetworkHandoffDeps): boolean {
    if (!deps || typeof deps.isCardRuntimeIntegrityBlocked !== 'function') return false;
    try {
        return deps.isCardRuntimeIntegrityBlocked() === true;
    } catch (_error) {
        return true;
    }
}

function abortSelectionRuntimeIntegrity(deps: SelectionFlowNetworkHandoffDeps): false {
    // Canonical/pending state and the cached action stay intact for reload
    // recovery; only presentation/input locks are terminally released.
    try { deps.setSelectionProcessing(false); } catch (_error) { /* best-effort lock settlement */ }
    try { deps.setSelectionCardAnimating(false); } catch (_error) { /* best-effort lock settlement */ }
    if (typeof deps.setSelectionBusy === 'function') {
        try { deps.setSelectionBusy(false); } catch (_error) { /* best-effort lock settlement */ }
    }
    return false;
}

function restorePendingSelectionActionForIntegrity(
    deps: SelectionFlowNetworkHandoffDeps,
    playerKey: any,
    pendingAction: any,
    pendingType: any
): void {
    if (!pendingAction) return;
    try { deps.storePendingSelectionAction(playerKey, pendingAction, pendingType); } catch (_error) { /* best-effort recovery cache */ }
}

function notifySelectionRuntimeUnavailable(options: any, result: any): void {
    if (!options || typeof options.onRuntimeUnavailable !== 'function') return;
    try { options.onRuntimeUnavailable(result); } catch (_error) { /* reporting must not replace fail-closed settlement */ }
}

function isRuntimeUnavailablePublishResult(result: any): boolean {
    if (!result || typeof result !== 'object' || result.ok !== false) return false;
    const reason = String(result.reason || result.rejectedReason || '').trim().toUpperCase();
    return reason === 'RUNTIME_UNAVAILABLE';
}

function invokeSelectionEnsure(
    ensureFn: any,
    useBlackDelay: boolean,
    deps: SelectionFlowNetworkHandoffDeps
): boolean {
    if (typeof ensureFn === 'function') {
        try { ensureFn({ useBlackDelay }); } catch (_error) { /* preserve ordinary compatibility fallback */ }
    }
    return !isSelectionRuntimeIntegrityBlocked(deps);
}

async function settleAcceptedAuthoritativePublish(
    publishResult: any,
    playbackEvents: any[],
    deps: SelectionFlowNetworkHandoffDeps
): Promise<void> {
    if (typeof deps.waitForAuthoritativeVisualSettlement === 'function') {
        try {
            const settlement = await deps.waitForAuthoritativeVisualSettlement(publishResult);
            if (settlement && typeof settlement === 'object' && settlement.ok === true) {
                return;
            }
        } catch (_error) { /* fall through to the legacy visual waiter */ }
    }
    await waitForSelectionPlaybackIdle(playbackEvents, deps, {
        force: true,
        authorityAccepted: true
    });
}

function readSelectionPublishMatchMode(opts: any, deps: SelectionFlowNetworkHandoffDeps) {
    if (opts && typeof opts.readMatchMode === 'function') {
        try {
            const mode = opts.readMatchMode();
            if (typeof mode !== 'undefined' && mode !== null) return mode;
        } catch (e) { /* ignore and fall back to bridge */ }
    }
    return deps.readMatchMode();
}

function hasActiveSelectionPublishClient(opts: any, deps: SelectionFlowNetworkHandoffDeps) {
    if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
    if (deps.hasActiveNetworkPublishClient()) return true;
    if (opts && typeof opts.isNetworkPublishActive === 'function') {
        try {
            return opts.isNetworkPublishActive() === true;
        } catch (e) {
            return false;
        }
    }
    return false;
}

async function finalizePendingSelectionFlow(options: any, deps: SelectionFlowNetworkHandoffDeps) {
    const opts = (options && typeof options === 'object') ? options : {};
    // Integrity failure is terminal until reload. Stop before touching the
    // pending-action cache or invoking any local/network settlement path.
    if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
    const pendingType = deps.normalizePendingType(opts.pendingType);
    const contract = deps.resolvePendingSelectionContract(pendingType);
    const playerKey = opts.playerKey || 'black';
    const actionType = opts.actionType || 'place';
    const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents.slice() : [];
    const cardStateValue = opts.cardStateValue || deps.resolveCurrentCardState();
    if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
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
    if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
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

    const publishMatchMode = readSelectionPublishMatchMode(opts, deps);
    const hasActivePublishClient = hasActiveSelectionPublishClient(opts, deps);
    if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);

    if (contract && contract.turnOutcome === 'end_turn') {
        const networkTurnHandoff = deps.getNetworkTurnHandoff();
        if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
        let publishFailureHandled = false;
        const shouldPublishNetworkHandoff = !!(
            !skipNetworkPublish
            && hasActivePublishClient
        );
        if (!networkTurnHandoff || typeof networkTurnHandoff.finalizeNetworkTurnHandoff !== 'function') {
            deps.setSelectionProcessing(false);
            if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);
            if (!invokeSelectionEnsure(ensureFn, opts.useBlackDelay !== false, deps)) {
                return abortSelectionRuntimeIntegrity(deps);
            }
            return false;
        }

        const shouldAwaitPublish = shouldPublishNetworkHandoff
            && publishMatchMode === 'network'
            && contract.deferNetworkPublish === true;
        if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
        const handoffResult = await networkTurnHandoff.finalizeNetworkTurnHandoff({
            awaitPublishResult: shouldAwaitPublish,
            deferResultToAuthoritativeSnapshot: shouldAwaitPublish,
            playerKey,
            actionType,
            action: pendingAction,
            playbackEvents,
            skipLocalPlaybackWait: shouldAwaitPublish,
            humanMode: deps.isHumanVsHumanModeEnabled(),
            setProcessing: deps.setSelectionProcessing,
            onPublishFailed: (failureInfo: any) => {
                publishFailureHandled = true;
                if (isRuntimeUnavailablePublishResult(failureInfo && failureInfo.publishResult)) {
                    notifySelectionRuntimeUnavailable(opts, failureInfo.publishResult);
                    abortSelectionRuntimeIntegrity(deps);
                    return;
                }
                if (
                    isSelectionRuntimeIntegrityBlocked(deps)
                ) {
                    abortSelectionRuntimeIntegrity(deps);
                    return;
                }
                deps.clearPendingSelectionAction(playerKey);
                if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);
                if (!invokeSelectionEnsure(ensureFn, opts.useBlackDelay !== false, deps)) {
                    if (pendingAction) deps.storePendingSelectionAction(playerKey, pendingAction, pendingType);
                    abortSelectionRuntimeIntegrity(deps);
                }
            },
            publishSnapshot: shouldPublishNetworkHandoff ? ({ playerKey: publishPlayerKey, action: publishAction, playbackEvents: publishPlaybackEvents }: { playerKey: any; action: any; playbackEvents: any }) => {
                if (isSelectionRuntimeIntegrityBlocked(deps)) {
                    return Promise.resolve({ ok: false, reason: 'RUNTIME_UNAVAILABLE' });
                }
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
            } : null,
            scheduleCpuTurn: (scheduleOptions: any) => {
                if (isSelectionRuntimeIntegrityBlocked(deps)) {
                    abortSelectionRuntimeIntegrity(deps);
                    return false;
                }
                return deps.scheduleWhiteCpuTurn(scheduleOptions);
            },
            onHumanTurnReady: (readyMeta: any) => {
                if (isSelectionRuntimeIntegrityBlocked(deps)) return;
                if (typeof opts.onHumanTurnReady === 'function') opts.onHumanTurnReady(readyMeta);
            },
            isAborted: () => isSelectionRuntimeIntegrityBlocked(deps)
        });
        if (isSelectionRuntimeIntegrityBlocked(deps)) {
            restorePendingSelectionActionForIntegrity(deps, playerKey, pendingAction, pendingType);
            if (handoffResult && handoffResult.authoritativePublishAccepted === true) {
                const acceptedPlaybackEvents = Array.isArray(handoffResult.playbackEvents)
                    ? handoffResult.playbackEvents
                    : playbackEvents;
                await settleAcceptedAuthoritativePublish(
                    handoffResult.publishResult,
                    acceptedPlaybackEvents,
                    deps
                );
            }
            return abortSelectionRuntimeIntegrity(deps);
        }
        if (isRuntimeUnavailablePublishResult(handoffResult)) {
            notifySelectionRuntimeUnavailable(opts, handoffResult);
            restorePendingSelectionActionForIntegrity(deps, playerKey, pendingAction, pendingType);
            return abortSelectionRuntimeIntegrity(deps);
        }
        if (shouldAwaitPublish) {
            if (!handoffResult || handoffResult.ok !== true) {
                if (!publishFailureHandled) {
                    deps.clearPendingSelectionAction(playerKey);
                    deps.setSelectionProcessing(false);
                    if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);
                    if (!invokeSelectionEnsure(ensureFn, opts.useBlackDelay !== false, deps)) {
                        if (pendingAction) deps.storePendingSelectionAction(playerKey, pendingAction, pendingType);
                        abortSelectionRuntimeIntegrity(deps);
                    }
                }
                return false;
            }
            if (contract.waitForPlaybackIdle === true) {
                if (shouldReleaseSelectionBusyBeforePlaybackWait(contract)) {
                    releaseSelectionBusyForPlaybackWait(deps, clearCardAnimatingOnFinish);
                }
                const authoritativePlaybackEvents = Array.isArray(handoffResult.playbackEvents)
                    ? handoffResult.playbackEvents
                    : playbackEvents;
                await waitForSelectionPlaybackIdle(authoritativePlaybackEvents, deps, {
                    authorityAccepted: handoffResult.authoritativePublishAccepted === true
                });
                if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
            }
        }
        const shouldRetainPendingAction = deps.shouldRetainPendingSelectionAction(cardStateValue, playerKey, pendingType);
        if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
        if (!shouldRetainPendingAction) {
            deps.clearPendingSelectionAction(playerKey);
        }
        if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);
        return true;
    }

    const shouldDeferPlaybackWaitUntilAfterPublish = !!(
        publishMatchMode === 'network'
        && contract
        && contract.deferNetworkPublish === true
        && hasActivePublishClient
        && !skipNetworkPublish
    );
    if (contract && contract.waitForPlaybackIdle && !shouldDeferPlaybackWaitUntilAfterPublish) {
        if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
        if (shouldReleaseSelectionBusyBeforePlaybackWait(contract)) {
            releaseSelectionBusyForPlaybackWait(deps, clearCardAnimatingOnFinish);
        }
        await waitForSelectionPlaybackIdle(playbackEvents, deps);
        if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
    }

    let acceptedDeferredPublish = false;
    if (
        contract
        && contract.deferNetworkPublish
        && !skipNetworkPublish
        && hasActivePublishClient
    ) {
        if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
        const publishMeta = {
            playerKey,
            actionType,
            action: pendingAction,
            playbackEvents
        };
        const publishResult = await Promise.resolve(deps.publishPendingSelectionSnapshot(publishMeta));
        if (isSelectionRuntimeIntegrityBlocked(deps)) {
            if (publishResult && publishResult.ok === true) {
                await settleAcceptedAuthoritativePublish(publishResult, playbackEvents, deps);
            }
            return abortSelectionRuntimeIntegrity(deps);
        }
        if (isRuntimeUnavailablePublishResult(publishResult)) {
            notifySelectionRuntimeUnavailable(opts, publishResult);
            return abortSelectionRuntimeIntegrity(deps);
        }
        if (!publishResult || publishResult.ok !== true) {
            deps.clearPendingSelectionAction(playerKey);
            deps.setSelectionProcessing(false);
            if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);
            if (!invokeSelectionEnsure(ensureFn, opts.useBlackDelay !== false, deps)) {
                restorePendingSelectionActionForIntegrity(deps, playerKey, pendingAction, pendingType);
                return abortSelectionRuntimeIntegrity(deps);
            }
            return false;
        }
        acceptedDeferredPublish = true;
    }

    if (contract && contract.waitForPlaybackIdle && shouldDeferPlaybackWaitUntilAfterPublish) {
        if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
        if (shouldReleaseSelectionBusyBeforePlaybackWait(contract)) {
            releaseSelectionBusyForPlaybackWait(deps, clearCardAnimatingOnFinish);
        }
        await waitForSelectionPlaybackIdle(playbackEvents, deps, {
            authorityAccepted: acceptedDeferredPublish
        });
        if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
    }

    if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
    const shouldRetainPendingAction = deps.shouldRetainPendingSelectionAction(cardStateValue, playerKey, pendingType);
    if (isSelectionRuntimeIntegrityBlocked(deps)) return abortSelectionRuntimeIntegrity(deps);
    if (!shouldRetainPendingAction) {
        deps.clearPendingSelectionAction(playerKey);
    }

    deps.setSelectionProcessing(false);
    if (clearCardAnimatingOnFinish) deps.setSelectionCardAnimating(false);

    if (isSelectionRuntimeIntegrityBlocked(deps)) {
        restorePendingSelectionActionForIntegrity(deps, playerKey, pendingAction, pendingType);
        return abortSelectionRuntimeIntegrity(deps);
    }
    if (typeof opts.onSettled === 'function') {
        try { await opts.onSettled(); } catch (e) { /* ignore */ }
    }

    if (isSelectionRuntimeIntegrityBlocked(deps)) {
        restorePendingSelectionActionForIntegrity(deps, playerKey, pendingAction, pendingType);
        return abortSelectionRuntimeIntegrity(deps);
    }
    if (!invokeSelectionEnsure(ensureFn, opts.useBlackDelay !== false, deps)) {
        restorePendingSelectionActionForIntegrity(deps, playerKey, pendingAction, pendingType);
        return abortSelectionRuntimeIntegrity(deps);
    }

    return true;
}

const SelectionFlowNetworkHandoffModule = {
    waitForSelectionPlaybackIdle,
    shouldReleaseSelectionBusyBeforePlaybackWait,
    finalizePendingSelectionFlow
};

const handoffRoot = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);
if (handoffRoot && !handoffRoot.SelectionFlowNetworkHandoff) {
    handoffRoot.SelectionFlowNetworkHandoff = SelectionFlowNetworkHandoffModule;
}

export = SelectionFlowNetworkHandoffModule;
