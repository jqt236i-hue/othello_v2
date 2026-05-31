export {};

type PendingNetworkDeps = {
    getUiRootRef: () => any;
    getCardStateValue?: () => any;
    readDirectWaitForPlaybackIdle?: () => any;
    isCardAnimatingNow: () => boolean;
    isStaleVisualPlaybackLock: () => boolean;
    releaseStaleVisualPlaybackLock: () => any;
    renderCardUiSafely: () => any;
    playbackStateManager?: any;
    setPendingSelectionBusy: (active: any) => any;
    normalizeOwnerKey: (ownerKey: any) => any;
    publishLocks: Record<string, boolean>;
};

function getWaitForPlaybackIdleFn(deps: PendingNetworkDeps) {
    const direct = (typeof deps.readDirectWaitForPlaybackIdle === 'function')
        ? deps.readDirectWaitForPlaybackIdle()
        : null;
    const waitForPlaybackFn = (typeof direct === 'function')
        ? direct
        : ((typeof window !== 'undefined' && typeof (window as any).waitForPlaybackIdle === 'function') ? (window as any).waitForPlaybackIdle : null);
    return typeof waitForPlaybackFn === 'function' ? waitForPlaybackFn : null;
}

function waitForCardUseAnimationIdle(deps: PendingNetworkDeps) {
    const scheduleNextTick = (callback: any) => {
        try {
            const rootRef = deps.getUiRootRef();
            if (rootRef && typeof rootRef.requestAnimationFrame === 'function') {
                rootRef.requestAnimationFrame(callback);
                return;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(callback);
                return;
            }
        } catch (e) { /* ignore */ }
        setTimeout(callback, 16);
    };

    const waitForCardAnimationIdle = () => new Promise<void>((resolve) => {
        const tick = () => {
            try {
                if (!deps.isCardAnimatingNow()) {
                    resolve();
                    return;
                }
                if (deps.isStaleVisualPlaybackLock()) {
                    deps.releaseStaleVisualPlaybackLock();
                    if (!deps.isCardAnimatingNow()) {
                        resolve();
                        return;
                    }
                }
            } catch (e) {
                resolve();
                return;
            }
            scheduleNextTick(tick);
        };
        tick();
    });
    return waitForCardAnimationIdle();
}

function clearOrphanNetworkPlaybackQueues(deps: PendingNetworkDeps) {
    const rootRef = deps.getUiRootRef();
    const cardStateRef = typeof deps.getCardStateValue === 'function'
        ? deps.getCardStateValue()
        : (rootRef && rootRef.cardState
            ? rootRef.cardState
            : ((typeof globalThis !== 'undefined' && globalThis) ? (globalThis as any).cardState : null));
    if (!cardStateRef || typeof cardStateRef !== 'object') return false;

    const removeFromQueue = (queue: any) => {
        if (!Array.isArray(queue)) return 0;
        const before = queue.length;
        for (let index = queue.length - 1; index >= 0; index -= 1) {
            const entry = queue[index];
            if (entry && entry.type === 'PLAYBACK_EVENTS') {
                queue.splice(index, 1);
            }
        }
        return before - queue.length;
    };

    const removed = removeFromQueue(cardStateRef.presentationEvents)
        + removeFromQueue(cardStateRef._presentationEventsPersist);
    return removed > 0;
}

function getPendingSelectionPublishSettleTimeoutMs(deps: PendingNetworkDeps) {
    const rootRef = deps.getUiRootRef();
    const readValue = (source: any) => {
        const raw = source && typeof source === 'object'
            ? Number(source.__pendingSelectionPublishSettleTimeoutMs)
            : NaN;
        return Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : null;
    };
    return readValue(rootRef) ?? readValue(typeof globalThis !== 'undefined' ? globalThis : null) ?? 1500;
}

function waitForAuthoritativeVisualPlaybackDrain(deps: PendingNetworkDeps) {
    const playbackStateManager = deps.playbackStateManager;
    if (!playbackStateManager || typeof playbackStateManager.waitForVisualPlaybackDrain !== 'function') {
        return Promise.resolve();
    }
    return Promise.resolve(playbackStateManager.waitForVisualPlaybackDrain({
        getCardState: typeof deps.getCardStateValue === 'function' ? deps.getCardStateValue : undefined,
        timeoutMs: getPendingSelectionPublishSettleTimeoutMs(deps)
    }));
}

function clearAuthoritativeVisualPlaybackFlag(deps: PendingNetworkDeps) {
    const playbackStateManager = deps.playbackStateManager;
    if (!playbackStateManager || typeof playbackStateManager !== 'object') return false;
    try {
        if (typeof playbackStateManager.setPlaybackActive === 'function') {
            playbackStateManager.setPlaybackActive(false);
        }
        if (typeof playbackStateManager.setPlaybackStartedAt === 'function') {
            playbackStateManager.setPlaybackStartedAt(null);
        }
        return true;
    } catch (e) {
        return false;
    }
}

function getNetworkMatchClientRoot() {
    if (typeof window !== 'undefined' && window && (window as any).NetworkMatchClient) {
        return window;
    }
    return (typeof globalThis !== 'undefined' && globalThis && (globalThis as any).NetworkMatchClient)
        ? globalThis
        : null;
}

function getActiveNetworkMatchClient() {
    const networkRoot = getNetworkMatchClientRoot();
    const networkClient = networkRoot ? (networkRoot as any).NetworkMatchClient : null;
    if (!networkClient) return null;
    if (typeof networkClient.publishSnapshot !== 'function') return null;
    if (typeof networkClient.isActive !== 'function' || networkClient.isActive() !== true) return null;
    return networkClient;
}

function startNetworkOnlyPendingSelectionPublish(options: any, deps: PendingNetworkDeps) {
    const opts = (options && typeof options === 'object') ? options : {};
    const networkClient = getActiveNetworkMatchClient();
    if (!networkClient) return false;
    const publishLockPlayerKey = deps.normalizeOwnerKey(opts.playerKey);
    if (publishLockPlayerKey && deps.publishLocks[publishLockPlayerKey] === true) {
        return true;
    }
    if (publishLockPlayerKey) {
        deps.publishLocks[publishLockPlayerKey] = true;
    }
    const clearPublishLock = () => {
        if (!publishLockPlayerKey) return;
        deps.publishLocks[publishLockPlayerKey] = false;
    };

    let terminalSettled = false;
    const finishSuccessSettlement = () => {
        if (terminalSettled) return;
        terminalSettled = true;
        clearPublishLock();
        clearAuthoritativeVisualPlaybackFlag(deps);
        clearOrphanNetworkPlaybackQueues(deps);
        deps.setPendingSelectionBusy(false);
        deps.renderCardUiSafely();
    };

    const handlePublishSuccess = (publishResult: any) => {
        if (typeof opts.onSuccess === 'function') {
            opts.onSuccess(publishResult);
        }
    };

    const settleSuccessAfterPublish = () => {
        try {
            waitForAuthoritativeVisualPlaybackDrain(deps)
                .then(finishSuccessSettlement)
                .catch(finishSuccessSettlement);
        } catch (e) {
            finishSuccessSettlement();
        }
    };

    const finishFailureSettlement = (publishResult: any) => {
        if (terminalSettled) return;
        terminalSettled = true;
        clearPublishLock();
        deps.setPendingSelectionBusy(false);
        if (typeof opts.onFailure === 'function') {
            opts.onFailure(publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' });
        }
    };

    Promise.resolve()
        .then(() => networkClient.publishSnapshot({
            playerKey: opts.playerKey,
            actionType: 'place',
            playbackEvents: [],
            action: opts.action
        }))
        .then((publishResult: any) => {
            if (terminalSettled) return;
            if (!publishResult || publishResult.ok !== true) {
                finishFailureSettlement(publishResult);
                return;
            }
            handlePublishSuccess(publishResult);
            settleSuccessAfterPublish();
        })
        .catch(() => {
            finishFailureSettlement({ ok: false, reason: 'NETWORK_PUBLISH_FAILED' });
        });

    return true;
}

module.exports = {
    getWaitForPlaybackIdleFn,
    waitForAuthoritativeVisualPlaybackDrain,
    clearAuthoritativeVisualPlaybackFlag,
    waitForCardUseAnimationIdle,
    clearOrphanNetworkPlaybackQueues,
    getNetworkMatchClientRoot,
    getActiveNetworkMatchClient,
    startNetworkOnlyPendingSelectionPublish
};
