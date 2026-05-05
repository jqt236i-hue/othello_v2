declare const pendingCoordinatorModule: {
    readPendingEffect: (cardState: any, playerKey: any) => any;
    getPendingEffectType: (cardState: any, playerKey: any) => any;
    writePendingEffect: (cardState: any, playerKey: any, pendingEffect: any, options: any) => {
        ok: boolean;
        reason: string;
        playerKey?: undefined;
        pendingEffect?: undefined;
    } | {
        ok: boolean;
        playerKey: any;
        pendingEffect: any;
        reason?: undefined;
    };
    clearPendingEffect: (cardState: any, playerKey: any, options: any) => {
        ok: boolean;
        reason: string;
        playerKey?: undefined;
    } | {
        ok: boolean;
        playerKey: any;
        reason?: undefined;
    };
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
    syncPendingSelectionActionCache: (pendingState: any, options: any) => {
        cleared: string[];
        retained: string[];
    };
    shouldRetainPendingSelectionAction: (cardStateValue: any, playerKey: any, pendingType: any) => boolean;
    createPendingSelectionAction: (playerKey: any, pendingType: any, actionPayload: any, options: any) => any;
    clearPendingSelectionFailureState: (cardState: any, playerKey: any, options: any) => ({
        ok: boolean;
        reason: string;
        playerKey?: undefined;
    } | {
        ok: boolean;
        playerKey: any;
        reason?: undefined;
    }) & {
        clearedPendingEffect: boolean;
    };
};
export = pendingCoordinatorModule;
//# sourceMappingURL=pending-coordinator.d.ts.map