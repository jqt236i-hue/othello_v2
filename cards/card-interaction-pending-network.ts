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

let NetworkClientAdapter: any = null;
try {
    NetworkClientAdapter = require('./card-interaction-network-client');
} catch (e) {
    NetworkClientAdapter = null;
}

let PendingSettlement: any = null;
try {
    PendingSettlement = require('./card-interaction-pending-settlement');
} catch (e) {
    PendingSettlement = null;
}

let PendingPublish: any = null;
try {
    PendingPublish = require('./card-interaction-pending-publish');
} catch (e) {
    PendingPublish = null;
}

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

function waitForAuthoritativeVisualPlaybackDrain(deps: PendingNetworkDeps) {
    return PendingSettlement.waitForAuthoritativeVisualPlaybackDrain(deps);
}

function clearAuthoritativeVisualPlaybackFlag(deps: PendingNetworkDeps) {
    return PendingSettlement.clearAuthoritativeVisualPlaybackFlag(deps);
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
        clearAuthoritativeVisualPlaybackFlag,
        clearOrphanNetworkPlaybackQueues
    });
}

module.exports = {
    getWaitForPlaybackIdleFn,
    getVisualPlaybackDrainFn,
    waitForAuthoritativeVisualPlaybackDrain,
    clearAuthoritativeVisualPlaybackFlag,
    waitForCardUseAnimationIdle,
    clearOrphanNetworkPlaybackQueues,
    getNetworkMatchClientRoot,
    getActiveNetworkMatchClient,
    isNetworkSpectatorActive,
    publishNetworkDebugFillHand,
    startNetworkOnlyPendingSelectionPublish
};
