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

function getDirectWaitForPlaybackIdleFn(deps: PendingSettlementDeps) {
    const direct = (typeof deps.readDirectWaitForPlaybackIdle === 'function')
        ? deps.readDirectWaitForPlaybackIdle()
        : null;
    const waitForPlaybackFn = (typeof direct === 'function')
        ? direct
        : ((typeof window !== 'undefined' && typeof (window as any).waitForPlaybackIdle === 'function') ? (window as any).waitForPlaybackIdle : null);
    if (typeof waitForPlaybackFn === 'function') return waitForPlaybackFn;
    return null;
}

function getWaitForPlaybackIdleFn(deps: PendingSettlementDeps) {
    const directWaitForPlaybackIdle = getDirectWaitForPlaybackIdleFn(deps);
    if (directWaitForPlaybackIdle) return directWaitForPlaybackIdle;
    const playbackState = deps && deps.playbackStateManager;
    if (playbackState && typeof playbackState.waitForVisualPlaybackDrain === 'function') {
        return () => playbackState.waitForVisualPlaybackDrain({
            root: typeof deps.getUiRootRef === 'function' ? deps.getUiRootRef() : null,
            getCardState: typeof deps.getCardStateValue === 'function' ? deps.getCardStateValue : null,
            disableTimeout: true
        });
    }
    return null;
}

function waitForDirectPlaybackIdle(deps: PendingSettlementDeps): Promise<any> | null {
    const waitForPlaybackIdle = getDirectWaitForPlaybackIdleFn(deps);
    return waitForPlaybackIdle ? Promise.resolve(waitForPlaybackIdle()) : null;
}

function getVisualPlaybackDrainFn(deps: PendingSettlementDeps) {
    const playbackState = deps && deps.playbackStateManager;
    if (playbackState && typeof playbackState.waitForVisualPlaybackDrain === 'function') {
        return () => playbackState.waitForVisualPlaybackDrain({
            root: typeof deps.getUiRootRef === 'function' ? deps.getUiRootRef() : null,
            getCardState: typeof deps.getCardStateValue === 'function' ? deps.getCardStateValue : null,
            disableTimeout: true
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

function getPendingSelectionPublishSettleTimeoutMs(deps: PendingSettlementDeps): number | null {
    const rootRef = deps.getUiRootRef();
    const readValue = (source: any) => {
        const raw = source && typeof source === 'object'
            ? Number(source.__pendingSelectionPublishSettleTimeoutMs)
            : NaN;
        return Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : null;
    };
    return readValue(rootRef) ?? readValue(typeof globalThis !== 'undefined' ? globalThis : null);
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

async function waitForAuthoritativeVisualPlaybackDrain(deps: PendingSettlementDeps, publishResult?: any) {
    const playbackStateManager = deps.playbackStateManager;
    const visualSeq = getPublishResultVisualSeq(publishResult);
    if (
        visualSeq !== null
        && playbackStateManager
        && typeof playbackStateManager.waitForNetworkVisualSeq === 'function'
    ) {
        const timeoutMs = getPendingSelectionPublishSettleTimeoutMs(deps);
        const waitOptions: any = {
            operationId: getPublishResultOperationId(publishResult)
        };
        if (timeoutMs !== null) waitOptions.timeoutMs = timeoutMs;
        const result = await playbackStateManager.waitForNetworkVisualSeq(visualSeq, waitOptions);
        if (!result || result.ok !== true) {
            const reason = result && result.reason ? String(result.reason) : 'visual_settlement_failed';
            throw new Error(`network_visual_settlement_failed:${reason}`);
        }
        const directWait = waitForDirectPlaybackIdle(deps);
        if (directWait) await directWait;
        return { ok: true, visualSeq };
    }
    if (!playbackStateManager || typeof playbackStateManager.waitForVisualPlaybackDrain !== 'function') {
        throw new Error('network_visual_settlement_wait_unavailable');
    }
    await playbackStateManager.waitForVisualPlaybackDrain({
        getCardState: typeof deps.getCardStateValue === 'function' ? deps.getCardStateValue : undefined,
        disableTimeout: true
    });
    const directWait = waitForDirectPlaybackIdle(deps);
    if (directWait) await directWait;
    return { ok: true, visualSeq: 0, reason: 'visual_playback_drain_fallback' };
}

module.exports = {
    getWaitForPlaybackIdleFn,
    getVisualPlaybackDrainFn,
    waitForAuthoritativeVisualPlaybackDrain,
    waitForCardUseAnimationIdle,
    clearOrphanNetworkPlaybackQueues
};
