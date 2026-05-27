export {};

type PendingNetworkDeps = {
    getUiRootRef: () => any;
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
    const rootRef = deps.getUiRootRef();
    const direct = (typeof deps.readDirectWaitForPlaybackIdle === 'function')
        ? deps.readDirectWaitForPlaybackIdle()
        : null;
    const waitForPlaybackFn = (typeof direct === 'function')
        ? direct
        : ((typeof window !== 'undefined' && typeof (window as any).waitForPlaybackIdle === 'function') ? (window as any).waitForPlaybackIdle : null);
    if (typeof waitForPlaybackFn !== 'function') return null;
    if ((waitForPlaybackFn as any).__cardInteractionTracked === true) {
        return waitForPlaybackFn;
    }
    const trackedWaitForPlaybackIdle = function trackedWaitForPlaybackIdle(this: any, ...args: any[]) {
        const result = waitForPlaybackFn.apply(this, args);
        try {
            const promise = Promise.resolve(result);
            if (rootRef) {
                (rootRef as any).__lastWaitForPlaybackIdlePromise = promise;
            } else if (typeof globalThis !== 'undefined' && globalThis) {
                (globalThis as any).__lastWaitForPlaybackIdlePromise = promise;
            }
        } catch (e) { /* ignore */ }
        return result;
    };
    (trackedWaitForPlaybackIdle as any).__cardInteractionTracked = true;
    if ((waitForPlaybackFn as any)._isMockFunction === true) {
        (trackedWaitForPlaybackIdle as any)._isMockFunction = true;
        (trackedWaitForPlaybackIdle as any).mock = (waitForPlaybackFn as any).mock;
        const mockMethodNames = [
            'getMockImplementation',
            'getMockName',
            'mockClear',
            'mockReset',
            'mockRestore',
            'mockImplementation',
            'mockImplementationOnce',
            'mockName',
            'mockRejectedValue',
            'mockRejectedValueOnce',
            'mockResolvedValue',
            'mockResolvedValueOnce',
            'mockReturnThis',
            'mockReturnValue',
            'mockReturnValueOnce'
        ];
        for (let index = 0; index < mockMethodNames.length; index += 1) {
            const methodName = mockMethodNames[index];
            if (typeof (waitForPlaybackFn as any)[methodName] === 'function') {
                (trackedWaitForPlaybackIdle as any)[methodName] = (waitForPlaybackFn as any)[methodName].bind(waitForPlaybackFn);
            }
        }
    }
    try {
        if (rootRef) {
            rootRef.waitForPlaybackIdle = trackedWaitForPlaybackIdle as any;
        }
        if (typeof globalThis !== 'undefined' && globalThis) {
            (globalThis as any).waitForPlaybackIdle = trackedWaitForPlaybackIdle;
        }
    } catch (e) { /* ignore */ }
    return trackedWaitForPlaybackIdle;
}

function getTrackedWaitForPlaybackIdlePromise(deps: PendingNetworkDeps) {
    const rootRef = deps.getUiRootRef();
    const trackedPromise = rootRef
        ? (rootRef as any).__lastWaitForPlaybackIdlePromise
        : ((typeof globalThis !== 'undefined' && globalThis) ? (globalThis as any).__lastWaitForPlaybackIdlePromise : null);
    return trackedPromise && typeof trackedPromise.then === 'function'
        ? trackedPromise
        : null;
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
    getWaitForPlaybackIdleFn(deps);
    const clearPublishLock = () => {
        if (!publishLockPlayerKey) return;
        deps.publishLocks[publishLockPlayerKey] = false;
    };

    const settleSuccessAfterPublish = () => {
                const finish = () => {
                    clearPublishLock();
                    try {
                        if (deps.playbackStateManager && typeof deps.playbackStateManager.clearPlaybackLock === 'function') {
                            deps.playbackStateManager.clearPlaybackLock({ preserveSelectionSettlementLock: true });
                        }
                    } catch (e) { /* ignore */ }
                    deps.setPendingSelectionBusy(false);
            deps.renderCardUiSafely();
        };
        try {
            Promise.resolve().then(() => {
                const trackedWait = getTrackedWaitForPlaybackIdlePromise(deps);
                if (!trackedWait) {
                    finish();
                    return;
                }
                Promise.resolve(trackedWait).then(finish).catch(finish);
            }).catch(finish);
        } catch (e) {
            finish();
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
            if (!publishResult || publishResult.ok !== true) {
                clearPublishLock();
                if (typeof opts.onFailure === 'function') {
                    opts.onFailure(publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' });
                }
                return;
            }
            if (typeof opts.onSuccess === 'function') {
                opts.onSuccess(publishResult);
            }
            settleSuccessAfterPublish();
        })
        .catch(() => {
            clearPublishLock();
            if (typeof opts.onFailure === 'function') {
                opts.onFailure({ ok: false, reason: 'NETWORK_PUBLISH_FAILED' });
            }
        });

    return true;
}

module.exports = {
    getWaitForPlaybackIdleFn,
    getTrackedWaitForPlaybackIdlePromise,
    waitForCardUseAnimationIdle,
    getNetworkMatchClientRoot,
    getActiveNetworkMatchClient,
    startNetworkOnlyPendingSelectionPublish
};
