export {};

type PendingSettlementDeps = {
    getUiRootRef: () => any;
    getCardStateValue?: () => any;
    readDirectWaitForPlaybackIdle?: () => any;
    isCardAnimatingNow: () => boolean;
    isStaleVisualPlaybackLock: () => boolean;
    releaseStaleVisualPlaybackLock: () => any;
    playbackStateManager?: any;
};

function getWaitForPlaybackIdleFn(deps: PendingSettlementDeps) {
    const direct = (typeof deps.readDirectWaitForPlaybackIdle === 'function')
        ? deps.readDirectWaitForPlaybackIdle()
        : null;
    const waitForPlaybackFn = (typeof direct === 'function')
        ? direct
        : ((typeof window !== 'undefined' && typeof (window as any).waitForPlaybackIdle === 'function') ? (window as any).waitForPlaybackIdle : null);
    if (typeof waitForPlaybackFn === 'function') return waitForPlaybackFn;

    const playbackState = deps && deps.playbackStateManager;
    if (playbackState && typeof playbackState.waitForVisualPlaybackDrain === 'function') {
        return () => playbackState.waitForVisualPlaybackDrain({
            root: typeof deps.getUiRootRef === 'function' ? deps.getUiRootRef() : null,
            getCardState: typeof deps.getCardStateValue === 'function' ? deps.getCardStateValue : null
        });
    }
    return null;
}

function getVisualPlaybackDrainFn(deps: PendingSettlementDeps) {
    const playbackState = deps && deps.playbackStateManager;
    if (playbackState && typeof playbackState.waitForVisualPlaybackDrain === 'function') {
        return () => playbackState.waitForVisualPlaybackDrain({
            root: typeof deps.getUiRootRef === 'function' ? deps.getUiRootRef() : null,
            getCardState: typeof deps.getCardStateValue === 'function' ? deps.getCardStateValue : null
        });
    }
    return getWaitForPlaybackIdleFn(deps);
}

function waitForCardUseAnimationIdle(deps: PendingSettlementDeps) {
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

function clearOrphanNetworkPlaybackQueues(deps: PendingSettlementDeps) {
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

function getPendingSelectionPublishSettleTimeoutMs(deps: PendingSettlementDeps) {
    const rootRef = deps.getUiRootRef();
    const readValue = (source: any) => {
        const raw = source && typeof source === 'object'
            ? Number(source.__pendingSelectionPublishSettleTimeoutMs)
            : NaN;
        return Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : null;
    };
    return readValue(rootRef) ?? readValue(typeof globalThis !== 'undefined' ? globalThis : null) ?? 1500;
}

function readPositiveInteger(value: any): number | null {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return null;
    const next = Math.trunc(numberValue);
    return next > 0 ? next : null;
}

function getPublishResultVisualSeq(publishResult: any): number | null {
    const result = (publishResult && typeof publishResult === 'object') ? publishResult : {};
    const cursor = result.presentationCursor && typeof result.presentationCursor === 'object'
        ? result.presentationCursor
        : null;
    const dataCursor = result.data && result.data.presentationCursor && typeof result.data.presentationCursor === 'object'
        ? result.data.presentationCursor
        : null;
    return readPositiveInteger(result.visualSeq)
        ?? readPositiveInteger(cursor && cursor.visualSeq)
        ?? readPositiveInteger(dataCursor && dataCursor.visualSeq);
}

function getPublishResultOperationId(publishResult: any): string | null {
    const result = (publishResult && typeof publishResult === 'object') ? publishResult : {};
    const raw = result.operationId ?? (result.data && result.data.operationId);
    const normalized = String(raw || '').trim();
    return normalized || null;
}

function waitForAuthoritativeVisualPlaybackDrain(deps: PendingSettlementDeps, publishResult?: any) {
    const playbackStateManager = deps.playbackStateManager;
    const visualSeq = getPublishResultVisualSeq(publishResult);
    if (
        visualSeq !== null
        && playbackStateManager
        && typeof playbackStateManager.waitForNetworkVisualSeq === 'function'
    ) {
        return Promise.resolve(playbackStateManager.waitForNetworkVisualSeq(visualSeq, {
            timeoutMs: getPendingSelectionPublishSettleTimeoutMs(deps),
            operationId: getPublishResultOperationId(publishResult)
        }));
    }
    if (!playbackStateManager || typeof playbackStateManager.waitForVisualPlaybackDrain !== 'function') {
        return Promise.resolve();
    }
    return Promise.resolve(playbackStateManager.waitForVisualPlaybackDrain({
        getCardState: typeof deps.getCardStateValue === 'function' ? deps.getCardStateValue : undefined,
        timeoutMs: getPendingSelectionPublishSettleTimeoutMs(deps)
    }));
}

function clearAuthoritativeVisualPlaybackFlag(deps: PendingSettlementDeps) {
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

module.exports = {
    getWaitForPlaybackIdleFn,
    getVisualPlaybackDrainFn,
    waitForAuthoritativeVisualPlaybackDrain,
    clearAuthoritativeVisualPlaybackFlag,
    waitForCardUseAnimationIdle,
    clearOrphanNetworkPlaybackQueues
};
