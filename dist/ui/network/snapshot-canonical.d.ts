declare function normalizeSeatKey(value: any): string | null;
interface SnapshotMeta {
    authority: string;
    version: number | null;
    projectedForSeat: string | null;
    turnStartReconciled: boolean;
    projectedSnapshotHash: string | null;
}
declare function getSnapshotMeta(snapshot: any): SnapshotMeta | null;
declare function getSnapshotVersion(snapshot: any): number | null;
declare function inspectAuthoritativeSnapshot(snapshot: any, options?: any): any;
declare function normalizeChargeDeltaEvent(event: any, fallbackSeq: number): any;
declare function normalizeChargeDeltaEventList(events: any[]): any[];
declare function normalizeChargeDataForSnapshot(cardState: any): any;
declare function buildMissingChargeDeltaEvents(previousCardState: any, nextCardState: any, options?: any): any[];
declare function sanitizeIncomingSnapshot(snapshot: any, options?: any): any;
declare const SnapshotCanonical: {
    normalizeSeatKey: typeof normalizeSeatKey;
    getSnapshotMeta: typeof getSnapshotMeta;
    getSnapshotVersion: typeof getSnapshotVersion;
    inspectAuthoritativeSnapshot: typeof inspectAuthoritativeSnapshot;
    normalizeChargeDeltaEvent: typeof normalizeChargeDeltaEvent;
    normalizeChargeDeltaEventList: typeof normalizeChargeDeltaEventList;
    normalizeChargeDataForSnapshot: typeof normalizeChargeDataForSnapshot;
    buildMissingChargeDeltaEvents: typeof buildMissingChargeDeltaEvents;
    sanitizeIncomingSnapshot: typeof sanitizeIncomingSnapshot;
};
export = SnapshotCanonical;
//# sourceMappingURL=snapshot-canonical.d.ts.map