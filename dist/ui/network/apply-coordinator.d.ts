/**
 * @file apply-coordinator.ts
 * @description Network snapshot apply coordination
 */
interface TrackedPublishEntry {
    sequence: number;
    selfSnapshotReceived?: boolean;
    selfSnapshotVersion?: number;
    appliedVersion?: number;
}
interface ApplySnapshotOptions {
    trackedPublish?: TrackedPublishEntry | null;
    source?: string;
    applyOptions?: Record<string, unknown>;
    getSnapshotStateVersion?: (snapshot: unknown) => number | null;
    applySnapshot?: (snapshot: unknown, options: Record<string, unknown>) => boolean;
    hasNewerQueuedPublish?: (sequence: number) => boolean;
    markTrackedPublishSnapshotApplied?: (entry: TrackedPublishEntry, snapshot: unknown, source: string) => void;
    onAppliedVersion?: (version: number) => void;
}
declare function shouldApplyTrackedPublishSnapshot(entry: TrackedPublishEntry | null, snapshotVersion: number | null, source: string, options: {
    hasNewerQueuedPublish?: (sequence: number) => boolean;
}): boolean;
declare function applySnapshotThroughCoordinator(snapshot: unknown, options: ApplySnapshotOptions): boolean;
declare const _default: {
    shouldApplyTrackedPublishSnapshot: typeof shouldApplyTrackedPublishSnapshot;
    applySnapshotThroughCoordinator: typeof applySnapshotThroughCoordinator;
};
export = _default;
//# sourceMappingURL=apply-coordinator.d.ts.map