'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

let pendingStateManagerModule: any = null;

function resolvePendingStateManager(): any {
    if (pendingStateManagerModule) return pendingStateManagerModule;
    try {
        pendingStateManagerModule = _require('../logic/cards-internal/pending-state-manager');
    } catch (e) { /* ignore */ }
    return pendingStateManagerModule || null;
}

function getPendingSelectionContract(cardType: any): any {
    const pendingStateManager = resolvePendingStateManager();
    if (!pendingStateManager || typeof pendingStateManager.resolvePendingSelectionContract !== 'function') {
        return null;
    }
    try {
        return pendingStateManager.resolvePendingSelectionContract(cardType) || null;
    } catch (e) {
        return null;
    }
}

function shouldDeferNetworkPublishForPendingType(cardType: any): boolean {
    const pendingStateManager = resolvePendingStateManager();
    if (pendingStateManager && typeof pendingStateManager.shouldDeferNetworkPublishForPendingType === 'function') {
        try {
            return pendingStateManager.shouldDeferNetworkPublishForPendingType(cardType) === true;
        } catch (e) {
            return false;
        }
    }
    const contract = getPendingSelectionContract(cardType);
    return !!(contract && contract.deferNetworkPublish === true);
}

export = {
    getPendingSelectionContract,
    shouldDeferNetworkPublishForPendingType
};
