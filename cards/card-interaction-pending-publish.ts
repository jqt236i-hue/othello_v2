export {};

type PendingPublishDeps = {
    renderCardUiSafely: () => any;
    setPendingSelectionBusy: (active: any) => any;
    normalizeOwnerKey: (ownerKey: any) => any;
    publishLocks: Record<string, boolean>;
};

type PendingPublishPorts = {
    getActiveNetworkMatchClient: () => any;
    waitForAuthoritativeVisualPlaybackDrain: (deps: any) => Promise<any>;
    clearAuthoritativeVisualPlaybackFlag: (deps: any) => any;
    clearOrphanNetworkPlaybackQueues: (deps: any) => any;
};

function startPendingSelectionPublish(options: any, deps: PendingPublishDeps, ports: PendingPublishPorts) {
    const opts = (options && typeof options === 'object') ? options : {};
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
    const finishSuccessSettlement = () => {
        if (terminalSettled) return;
        terminalSettled = true;
        clearPublishLock();
        ports.clearAuthoritativeVisualPlaybackFlag(deps);
        ports.clearOrphanNetworkPlaybackQueues(deps);
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
            ports.waitForAuthoritativeVisualPlaybackDrain(deps)
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
    startPendingSelectionPublish
};
