declare const pendingCoordinatorModule: {
    readPendingEffect: (cardState: any, playerKey: any) => any;
    getPendingEffectType: (cardState: any, playerKey: any) => any;
    writePendingEffect: (cardState: any, playerKey: any, pendingEffect: any, options: any) => any;
    clearPendingEffect: (cardState: any, playerKey: any, options: any) => any;
    requiresPendingTarget: (cardType: any) => boolean;
    getPendingSelectionContract: (cardType: any) => any;
    isSelectionOnlyEndTurnPendingType: (cardType: any) => any;
    shouldDeferNetworkPublishForPendingType: (cardType: any) => any;
    shouldWaitForPlaybackIdleForPendingType: (cardType: any) => any;
    resolvePendingSelectionDispatchKey: (cardType: any) => any;
    applyPendingSelectionCardContext: (target: any, playerKey: any, pendingLike: any, options: any) => any;
    storePendingSelectionAction: (playerKey: any, action: any, pendingType: any) => any;
    readPendingSelectionAction: (playerKey: any) => any;
    clearPendingSelectionAction: (playerKey: any) => boolean;
    clearPendingSelectionActionCache: () => boolean;
    syncPendingSelectionActionCache: (pendingState: any, options: any) => any;
    shouldRetainPendingSelectionAction: (cardStateValue: any, playerKey: any, pendingType: any) => boolean;
    createPendingSelectionAction: (playerKey: any, pendingType: any, actionPayload: any, options: any) => any;
    clearPendingSelectionFailureState: (cardState: any, playerKey: any, options: any) => any;
};
export = pendingCoordinatorModule;
//# sourceMappingURL=pending-coordinator.d.ts.map