export {};

type PendingPublishDeps = {
    getCardStateValue?: () => any;
    renderCardUiSafely: () => any;
    setPendingSelectionBusy: (active: any) => any;
    normalizeOwnerKey: (ownerKey: any) => any;
    publishLocks: Record<string, boolean>;
    isCardRuntimeIntegrityBlocked?: () => boolean;
    syncPendingSelectionActionCache?: (cardStateValue: any) => any;
};

type PendingPublishPorts = {
    getActiveNetworkMatchClient: () => any;
    waitForAuthoritativeVisualPlaybackDrain: (deps: any, publishResult?: any) => Promise<any>;
    clearOrphanNetworkPlaybackQueues: (deps: any) => any;
};

function startPendingSelectionPublish(options: any, deps: PendingPublishDeps, ports: PendingPublishPorts) {
    const opts = (options && typeof options === 'object') ? options : {};
    const isIntegrityBlocked = () => {
        if (typeof deps.isCardRuntimeIntegrityBlocked !== 'function') return false;
        try { return deps.isCardRuntimeIntegrityBlocked() === true; } catch (_error) { return true; }
    };
    if (isIntegrityBlocked()) {
        deps.setPendingSelectionBusy(false);
        return false;
    }
    const networkClient = ports.getActiveNetworkMatchClient();
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
    const syncPendingSelectionCacheAfterAuthorityResponse = async () => {
        // Let a latch already queued immediately behind the authority/drain
        // promise win before the cache can be cleared.
        await Promise.resolve();
        if (isIntegrityBlocked()) return false;
        let cacheSyncFailed = false;
        if (
            typeof deps.getCardStateValue === 'function'
            && typeof deps.syncPendingSelectionActionCache === 'function'
        ) {
            try {
                deps.syncPendingSelectionActionCache(deps.getCardStateValue());
            } catch (_error) {
                cacheSyncFailed = true;
                // Preserve any unsettled cache and let the next authoritative
                // sync retry it without converting the server response locally.
            }
        }
        if (cacheSyncFailed) await Promise.resolve();
        return !isIntegrityBlocked();
    };

    const finishSuccessSettlement = async () => {
        if (terminalSettled) return;
        terminalSettled = true;
        clearPublishLock();
        deps.setPendingSelectionBusy(false);
        if (!await syncPendingSelectionCacheAfterAuthorityResponse() || isIntegrityBlocked()) return;
        deps.renderCardUiSafely();
    };

    const finishIntegritySettlement = () => {
        if (terminalSettled) return;
        terminalSettled = true;
        clearPublishLock();
        deps.setPendingSelectionBusy(false);
    };

    const handlePublishSuccess = (publishResult: any) => {
        if (typeof opts.onSuccess === 'function') {
            opts.onSuccess(publishResult);
        }
    };

    const finishVisualSettlementFailure = async () => {
        // Allow an integrity latch queued immediately behind the rejected
        // settlement promise to win before preserving the ordinary busy lock.
        await Promise.resolve();
        if (isIntegrityBlocked()) {
            finishIntegritySettlement();
            return;
        }
        if (terminalSettled) return;
        terminalSettled = true;
        clearPublishLock();
    };

    const settleSuccessAfterPublish = (publishResult: any) => {
        try {
            ports.waitForAuthoritativeVisualPlaybackDrain(deps, publishResult)
                .then(() => {
                    if (isIntegrityBlocked()) {
                        finishIntegritySettlement();
                    } else {
                        return finishSuccessSettlement();
                    }
                })
                .catch(() => finishVisualSettlementFailure());
        } catch (e) {
            void finishVisualSettlementFailure();
        }
    };

    const finishFailureSettlement = async (publishResult: any) => {
        if (terminalSettled) return;
        terminalSettled = true;
        clearPublishLock();
        deps.setPendingSelectionBusy(false);
        if (!await syncPendingSelectionCacheAfterAuthorityResponse() || isIntegrityBlocked()) return;
        if (typeof opts.onFailure === 'function') {
            opts.onFailure(publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' });
        }
    };

    Promise.resolve()
        .then(() => {
            if (isIntegrityBlocked()) {
                finishIntegritySettlement();
                return null;
            }
            return networkClient.publishSnapshot({
                playerKey: opts.playerKey,
                actionType: 'place',
                playbackEvents: [],
                action: opts.action
            });
        })
        .then((publishResult: any) => {
            if (terminalSettled) return;
            if (!publishResult || publishResult.ok !== true) {
                const reason = String(publishResult && (publishResult.reason || publishResult.rejectedReason) || '').toUpperCase();
                if (isIntegrityBlocked() || reason === 'RUNTIME_UNAVAILABLE') {
                    finishIntegritySettlement();
                    return;
                }
                return finishFailureSettlement(publishResult);
            }
            if (isIntegrityBlocked()) {
                // The authority accepted this action. Drain the accepted visual
                // sequence, but suppress success/UI callbacks after the latch.
                settleSuccessAfterPublish(publishResult);
                return;
            }
            handlePublishSuccess(publishResult);
            settleSuccessAfterPublish(publishResult);
        })
        .catch(() => {
            if (isIntegrityBlocked()) finishIntegritySettlement();
            else return finishFailureSettlement({ ok: false, reason: 'NETWORK_PUBLISH_FAILED' });
        });

    return true;
}

module.exports = {
    startPendingSelectionPublish
};
