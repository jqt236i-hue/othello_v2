export function readPendingEffect(cardState: any, playerKey: any): any;
export function getPendingEffectType(cardState: any, playerKey: any): any;
export function writePendingEffect(cardState: any, playerKey: any, pendingEffect: any, options: any): {
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
export function clearPendingEffect(cardState: any, playerKey: any, options: any): {
    ok: boolean;
    reason: string;
    playerKey?: undefined;
} | {
    ok: boolean;
    playerKey: any;
    reason?: undefined;
};
export function requiresPendingTarget(cardType: any): boolean;
export function getPendingSelectionContract(cardType: any): any;
export function isSelectionOnlyEndTurnPendingType(cardType: any): any;
export function shouldDeferNetworkPublishForPendingType(cardType: any): any;
export function shouldWaitForPlaybackIdleForPendingType(cardType: any): any;
export function resolvePendingSelectionDispatchKey(cardType: any): any;
export function applyPendingSelectionCardContext(target: any, playerKey: any, pendingLike: any, options: any): any;
export function storePendingSelectionAction(playerKey: any, action: any, pendingType: any): any;
export function readPendingSelectionAction(playerKey: any): any;
export function clearPendingSelectionAction(playerKey: any): boolean;
export function clearPendingSelectionActionCache(): boolean;
export function syncPendingSelectionActionCache(pendingState: any, options: any): {
    cleared: never[];
    retained: never[];
};
export function shouldRetainPendingSelectionAction(cardStateValue: any, playerKey: any, pendingType: any): boolean;
export function createPendingSelectionAction(playerKey: any, pendingType: any, actionPayload: any, options: any): any;
export function clearPendingSelectionFailureState(cardState: any, playerKey: any, options: any): ({
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
//# sourceMappingURL=pending-coordinator.d.ts.map