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
    isCardRuntimeIntegrityBlocked?: () => boolean;
};

const NetworkClientAdapter: any = require('./card-interaction-network-client');
const PendingSettlement: any = require('./card-interaction-pending-settlement');
const PendingPublish: any = require('./card-interaction-pending-publish');

function getWaitForPlaybackIdleFn(deps: PendingNetworkDeps) {
    return PendingSettlement.getWaitForPlaybackIdleFn(deps);
}

function getVisualPlaybackDrainFn(deps: PendingNetworkDeps) {
    return PendingSettlement.getVisualPlaybackDrainFn(deps);
}

function waitForCardUseAnimationIdle(deps: PendingNetworkDeps) {
    return PendingSettlement.waitForCardUseAnimationIdle(deps);
}

function clearOrphanNetworkPlaybackQueues(deps: PendingNetworkDeps) {
    return PendingSettlement.clearOrphanNetworkPlaybackQueues(deps);
}

function waitForAuthoritativeVisualPlaybackDrain(deps: PendingNetworkDeps, publishResult?: any) {
    return PendingSettlement.waitForAuthoritativeVisualPlaybackDrain(deps, publishResult);
}

function getNetworkMatchClientRoot() {
    return NetworkClientAdapter && typeof NetworkClientAdapter.getNetworkMatchClientRoot === 'function'
        ? NetworkClientAdapter.getNetworkMatchClientRoot()
        : null;
}

function getActiveNetworkMatchClient() {
    return NetworkClientAdapter && typeof NetworkClientAdapter.getActiveNetworkMatchClient === 'function'
        ? NetworkClientAdapter.getActiveNetworkMatchClient()
        : null;
}

function isNetworkSpectatorActive(): boolean {
    return !!(NetworkClientAdapter && typeof NetworkClientAdapter.isNetworkSpectatorActive === 'function'
        && NetworkClientAdapter.isNetworkSpectatorActive() === true);
}

function publishNetworkDebugFillHand() {
    return NetworkClientAdapter && typeof NetworkClientAdapter.publishNetworkDebugFillHand === 'function'
        ? NetworkClientAdapter.publishNetworkDebugFillHand()
        : null;
}

function startNetworkOnlyPendingSelectionPublish(options: any, deps: PendingNetworkDeps) {
    return PendingPublish.startPendingSelectionPublish(options, deps, {
        getActiveNetworkMatchClient,
        waitForAuthoritativeVisualPlaybackDrain,
        clearOrphanNetworkPlaybackQueues
    });
}

module.exports = {
    getWaitForPlaybackIdleFn,
    getVisualPlaybackDrainFn,
    waitForAuthoritativeVisualPlaybackDrain,
    waitForCardUseAnimationIdle,
    clearOrphanNetworkPlaybackQueues,
    getNetworkMatchClientRoot,
    getActiveNetworkMatchClient,
    isNetworkSpectatorActive,
    publishNetworkDebugFillHand,
    startNetworkOnlyPendingSelectionPublish
};
