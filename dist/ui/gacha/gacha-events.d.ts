/**
 * @file gacha-events.ts
 * @description Gacha event dispatching utilities
 */
interface GachaInventoryDetail {
    pulls: unknown[];
    newlyUnlockedIds: string[];
    alreadyOwnedIds: string[];
    state: Record<string, unknown> | null;
}
declare function buildGachaInventoryUpdatedDetail(detail: unknown): GachaInventoryDetail;
declare function dispatchGachaInventoryUpdated(rootRef: Window & {
    dispatchEvent?: (event: Event) => boolean;
    CustomEvent?: typeof CustomEvent;
}, detail: unknown): boolean;
declare function addGachaInventoryUpdatedListener(rootRef: Window & {
    addEventListener?: (type: string, handler: EventListener) => void;
    removeEventListener?: (type: string, handler: EventListener) => void;
}, listener: (detail: GachaInventoryDetail) => void): () => void;
declare const _default: {
    GACHA_INVENTORY_UPDATED_EVENT: string;
    buildGachaInventoryUpdatedDetail: typeof buildGachaInventoryUpdatedDetail;
    dispatchGachaInventoryUpdated: typeof dispatchGachaInventoryUpdated;
    addGachaInventoryUpdatedListener: typeof addGachaInventoryUpdatedListener;
};
export = _default;
//# sourceMappingURL=gacha-events.d.ts.map