'use strict';

import PendingStateManager = require('../logic/cards-internal/pending-state-manager');

function resolvePendingStateManager(): any {
    return PendingStateManager;
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
