declare function clearTransientPresentationQueues(cardStateRef: any): void;
declare function captureTransientPresentationQueues(cardStateRef: any, cloneFn?: any): any;
declare function restoreTransientPresentationQueues(cardStateRef: any, queues: any): void;
declare function getTransientPresentationQueueSignature(source: any): string | null;
declare function hasPendingPresentationEvents(source: any): boolean;
declare function reconcilePresentationQueues(cardStateRef: any, options?: any): any;
declare function shouldReleaseRestoredQueueBusyState(options?: any): boolean;
declare function shouldReleaseStalePlaybackLockAfterSnapshot(options?: any): boolean;
declare function shouldReleaseUnclaimedPlaybackBusyState(options?: any): boolean;
declare function shouldClearUndrainedPlaybackQueues(options?: any): boolean;
declare const SnapshotPresentation: {
    clearTransientPresentationQueues: typeof clearTransientPresentationQueues;
    captureTransientPresentationQueues: typeof captureTransientPresentationQueues;
    restoreTransientPresentationQueues: typeof restoreTransientPresentationQueues;
    getTransientPresentationQueueSignature: typeof getTransientPresentationQueueSignature;
    hasPendingPresentationEvents: typeof hasPendingPresentationEvents;
    reconcilePresentationQueues: typeof reconcilePresentationQueues;
    shouldReleaseRestoredQueueBusyState: typeof shouldReleaseRestoredQueueBusyState;
    shouldReleaseStalePlaybackLockAfterSnapshot: typeof shouldReleaseStalePlaybackLockAfterSnapshot;
    shouldReleaseUnclaimedPlaybackBusyState: typeof shouldReleaseUnclaimedPlaybackBusyState;
    shouldClearUndrainedPlaybackQueues: typeof shouldClearUndrainedPlaybackQueues;
};
export = SnapshotPresentation;
//# sourceMappingURL=snapshot-presentation.d.ts.map