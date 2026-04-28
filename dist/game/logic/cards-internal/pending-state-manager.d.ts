/**
 * @file pending-state-manager.ts
 * @description Pending selection state management shared between Browser and Headless.
 */
interface PendingSelectionContract {
    kind: string;
    turnOutcome: string;
    deferNetworkPublish: boolean;
    waitForPlaybackIdle: boolean;
}
interface PendingEffectState {
    type: string;
    cardId?: string;
    pendingEffectId?: string;
    sourceHandIndex?: number;
    stage: string | null;
    offers?: string[];
    selectedCount?: number;
    maxSelections?: number;
    selectedTargets?: any[];
    placementsRemaining?: number;
}
interface CancelResult {
    canceled: boolean;
    reason?: string;
    cardId?: string;
}
interface CancelOptions {
    refundCost?: boolean;
    resetUsage?: boolean;
    noConsume?: boolean;
}
interface CancelContext {
    helpers?: {
        getCardDef?: (cardId: string) => any;
        addChargeValue?: (cardState: any, playerKey: string, amount: number, reason: string) => void;
        moveDiscardCardToHandByCardId?: (cardState: any, handKey: string, cardId: string, opts: any) => any;
    };
}
declare function requiresTargetSelection(cardType: string): boolean;
declare function isCancellablePendingType(cardType: string): boolean;
declare function resolvePendingSelectionContract(cardType: string): PendingSelectionContract | null;
declare function isSelectionOnlyEndTurnPendingType(cardType: string): boolean;
declare function shouldDeferNetworkPublishForPendingType(cardType: string): boolean;
declare function shouldWaitForPlaybackIdleForPendingType(cardType: string): boolean;
declare function resolvePendingSelectionDispatchKey(cardType: string): string | null;
declare function createPendingEffectState(options?: any): PendingEffectState | null;
declare function cancelPendingSelection(cardState: any, playerKey: string, opts?: CancelOptions, context?: CancelContext): CancelResult;
declare const _default: {
    PENDING_SELECTION_CONTRACTS: Record<string, PendingSelectionContract>;
    requiresTargetSelection: typeof requiresTargetSelection;
    isCancellablePendingType: typeof isCancellablePendingType;
    resolvePendingSelectionContract: typeof resolvePendingSelectionContract;
    isSelectionOnlyEndTurnPendingType: typeof isSelectionOnlyEndTurnPendingType;
    shouldDeferNetworkPublishForPendingType: typeof shouldDeferNetworkPublishForPendingType;
    shouldWaitForPlaybackIdleForPendingType: typeof shouldWaitForPlaybackIdleForPendingType;
    resolvePendingSelectionDispatchKey: typeof resolvePendingSelectionDispatchKey;
    createPendingEffectState: typeof createPendingEffectState;
    cancelPendingSelection: typeof cancelPendingSelection;
};
export = _default;
//# sourceMappingURL=pending-state-manager.d.ts.map