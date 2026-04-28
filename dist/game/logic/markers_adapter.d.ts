/**
 * @file markers_adapter.ts
 * @description Adapter layer for transitioning from specialStones/bombs to unified markers[].
 * Provides bidirectional conversion during the migration period.
 */
interface Marker {
    id?: number;
    row: number;
    col: number;
    kind: string;
    owner?: string;
    createdSeq?: number;
    data?: Record<string, any>;
}
interface SpecialStone {
    row: number;
    col: number;
    type?: string;
    category?: string;
    owner?: string;
    remainingOwnerTurns?: number;
    expiresForPlayer?: string;
    autoRemove?: boolean;
    hyperactiveSeq?: number;
    regenRemaining?: number;
    ownerColor?: string;
    chainPriority?: number;
    createdSeq?: number;
}
interface Bomb {
    row: number;
    col: number;
    type?: string;
    category?: string;
    remainingTurns?: number;
    placedTurn?: number;
    createdSeq?: number;
    owner?: string;
}
interface MarkerKinds {
    SPECIAL_STONE: string;
}
interface MarkerCategories {
    BOMB: string;
}
declare function getMarkerCategory(marker: Marker): string | null;
declare function isBombCategoryMarker(marker: Marker): boolean;
declare function isSpecialStoneMarker(marker: Marker): boolean;
declare function getBombMarkerType(marker: Marker): string | null;
interface NormalizedMarkerInput {
    kind: string;
    data: Record<string, any>;
    row?: number;
    col?: number;
}
declare function normalizeMarkerInput(kind: string, data: Record<string, any>): NormalizedMarkerInput;
declare function fromSpecialStone(stone: SpecialStone, id: number): Marker;
declare function fromBomb(bomb: Bomb, id: number): Marker;
declare function toSpecialStone(marker: Marker): SpecialStone | null;
declare function toBomb(marker: Marker): Bomb | null;
declare function markersToSpecialStones(markers: Marker[]): SpecialStone[];
declare function markersToBombs(markers: Marker[]): Bomb[];
interface ToMarkersResult {
    markers: Marker[];
    nextId: number;
}
declare function toMarkers(specialStones: SpecialStone[] | null | undefined, bombs: Bomb[] | null | undefined, startId?: number): ToMarkersResult;
declare function syncMarkersToLegacy(cardState: any): void;
declare function syncLegacyToMarkers(cardState: any): void;
declare function ensureMarkers(cardState: any): void;
declare function getMarkers(cardState: any): Marker[];
declare function getSpecialMarkers(cardState: any): Marker[];
declare function getBombMarkers(cardState: any): Marker[];
declare function findSpecialMarkerAt(cardState: any, row: number, col: number, type?: string, owner?: string): Marker | undefined;
declare function findBombMarkerAt(cardState: any, row: number, col: number): Marker | undefined;
declare function removeMarkers(cardState: any, predicate: (m: Marker) => boolean): void;
interface RemoveMarkersOptions {
    kind?: string;
    category?: string;
    type?: string;
    owner?: string;
}
declare function removeMarkersAt(cardState: any, row: number, col: number, options?: RemoveMarkersOptions): void;
declare const _default: {
    MARKER_KINDS: MarkerKinds;
    MARKER_CATEGORIES: MarkerCategories;
    fromSpecialStone: typeof fromSpecialStone;
    fromBomb: typeof fromBomb;
    toSpecialStone: typeof toSpecialStone;
    toBomb: typeof toBomb;
    markersToSpecialStones: typeof markersToSpecialStones;
    markersToBombs: typeof markersToBombs;
    toMarkers: typeof toMarkers;
    syncMarkersToLegacy: typeof syncMarkersToLegacy;
    syncLegacyToMarkers: typeof syncLegacyToMarkers;
    ensureMarkers: typeof ensureMarkers;
    getMarkers: typeof getMarkers;
    getMarkerCategory: typeof getMarkerCategory;
    getBombMarkerType: typeof getBombMarkerType;
    isBombCategoryMarker: typeof isBombCategoryMarker;
    isSpecialStoneMarker: typeof isSpecialStoneMarker;
    normalizeMarkerInput: typeof normalizeMarkerInput;
    getSpecialMarkers: typeof getSpecialMarkers;
    getBombMarkers: typeof getBombMarkers;
    findSpecialMarkerAt: typeof findSpecialMarkerAt;
    findBombMarkerAt: typeof findBombMarkerAt;
    removeMarkers: typeof removeMarkers;
    removeMarkersAt: typeof removeMarkersAt;
};
export = _default;
//# sourceMappingURL=markers_adapter.d.ts.map