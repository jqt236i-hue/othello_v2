/**
 * @file markers_adapter.ts
 * @description Adapter layer for transitioning from specialStones/bombs to unified markers[].
 * Provides bidirectional conversion during the migration period.
 */

interface Marker {
    id?: number;
    markerId?: string;
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

interface CardState {
    markers?: Marker[];
    specialStones?: SpecialStone[];
    bombs?: Bomb[];
    _nextMarkerId?: number;
}

interface MarkerKinds {
    SPECIAL_STONE: string;
    MANIFEST_STONE: string;
}

interface MarkerCategories {
    BOMB: string;
}

const MARKER_KINDS: MarkerKinds = {
    SPECIAL_STONE: 'specialStone',
    MANIFEST_STONE: 'manifestStone'
};

const MARKER_CATEGORIES: MarkerCategories = {
    BOMB: 'bomb'
};

function normalizeMarkerId(value: unknown): string | null {
    if (value === undefined || value === null || value === '') return null;
    return String(value);
}

function readPositiveInteger(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const integer = Math.trunc(n);
    return integer >= 1 ? integer : null;
}

function reserveMarkerId(cardState: CardState, id: number | null): void {
    if (!cardState || id === null) return;
    const next = readPositiveInteger(cardState._nextMarkerId) || 1;
    if (id >= next) cardState._nextMarkerId = id + 1;
}

function assignMarkerIdentity(cardState: CardState, marker: Marker): Marker {
    if (!marker || typeof marker !== 'object') return marker;

    const existing = normalizeMarkerId((marker as any).markerId);
    if (existing) {
        marker.markerId = existing;
        const numericExisting = readPositiveInteger(existing);
        if (marker.id === undefined && numericExisting !== null) marker.id = numericExisting;
        reserveMarkerId(cardState, readPositiveInteger(marker.id));
        reserveMarkerId(cardState, numericExisting);
        return marker;
    }

    const legacy = normalizeMarkerId(marker.id);
    if (legacy) {
        marker.markerId = legacy;
        reserveMarkerId(cardState, readPositiveInteger(marker.id));
        return marker;
    }

    const nextId = readPositiveInteger(cardState && cardState._nextMarkerId) || 1;
    marker.id = nextId;
    marker.markerId = String(nextId);
    cardState._nextMarkerId = nextId + 1;
    return marker;
}

const DEFAULT_BOMB_TYPE = 'TIME_BOMB';
const LEGACY_BOMB_KIND = 'bomb';
const FALLBACK_MANIFEST_STONE_TYPES = Object.freeze([
    'THEORY_INCARNATION',
    'BOARD_EXECUTOR',
    'OBSERVER_WILL'
]);
const ManifestStoneRegistry = (() => {
    try { return require('../../shared/manifest-stone-registry'); } catch (e) { return null; }
})();

function isManifestStoneType(rawType: unknown): boolean {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneType === 'function') {
        return ManifestStoneRegistry.isManifestStoneType(rawType) === true;
    }
    const type = String(rawType || '').trim().toUpperCase();
    return FALLBACK_MANIFEST_STONE_TYPES.includes(type);
}

function getMarkerData(marker: Marker): Record<string, any> | null {
    return (marker && marker.data && typeof marker.data === 'object') ? marker.data : null;
}

function isLegacyBombMarker(marker: Marker): boolean {
    return !!(marker && marker.kind === LEGACY_BOMB_KIND);
}

function getMarkerCategory(marker: Marker): string | null {
    const data = getMarkerData(marker);
    const category = data && typeof data.category === 'string'
        ? String(data.category).trim()
        : '';
    if (category) return category;
    return isLegacyBombMarker(marker) ? MARKER_CATEGORIES.BOMB : null;
}

function isBombCategoryMarker(marker: Marker): boolean {
    return getMarkerCategory(marker) === MARKER_CATEGORIES.BOMB;
}

function isManifestStoneMarker(marker: Marker): boolean {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneMarker === 'function') {
        return ManifestStoneRegistry.isManifestStoneMarker(marker) === true;
    }
    const type = String(marker && marker.data && marker.data.type || '').toUpperCase();
    return !!(
        marker &&
        (marker.kind === MARKER_KINDS.MANIFEST_STONE || marker.kind === MARKER_KINDS.SPECIAL_STONE) &&
        isManifestStoneType(type)
    );
}

function isSpecialStoneMarker(marker: Marker): boolean {
    return !!(
        marker &&
        marker.kind === MARKER_KINDS.SPECIAL_STONE &&
        !isBombCategoryMarker(marker) &&
        !isManifestStoneMarker(marker)
    );
}

function getBombMarkerType(marker: Marker): string | null {
    if (!isBombCategoryMarker(marker)) return null;
    const data = getMarkerData(marker);
    return (data && data.type) ? String(data.type) : DEFAULT_BOMB_TYPE;
}

interface NormalizedMarkerInput {
    kind: string;
    data: Record<string, any>;
    row?: number;
    col?: number;
}

function normalizeMarkerInput(kind: string, data: Record<string, any>): NormalizedMarkerInput {
    const requestedKind = (typeof kind === 'string' && kind) ? kind : MARKER_KINDS.SPECIAL_STONE;
    const normalizedData = (data && typeof data === 'object') ? { ...data } : {};
    const type = normalizedData && normalizedData.type ? String(normalizedData.type) : '';
    const isBombInput =
        requestedKind === LEGACY_BOMB_KIND ||
        getMarkerCategory({ kind: requestedKind, data: normalizedData, row: 0, col: 0 }) === MARKER_CATEGORIES.BOMB ||
        type === DEFAULT_BOMB_TYPE;
    if (isBombInput) {
        normalizedData.category = MARKER_CATEGORIES.BOMB;
        if (!normalizedData.type) normalizedData.type = DEFAULT_BOMB_TYPE;
        return {
        kind: MARKER_KINDS.SPECIAL_STONE,
        data: normalizedData,
        row: 0,
        col: 0
    };
    }
    return {
        kind: requestedKind,
        data: normalizedData,
        row: 0,
        col: 0
    };
}

function fromSpecialStone(stone: SpecialStone, id: number): Marker {
    const normalized = normalizeMarkerInput(MARKER_KINDS.SPECIAL_STONE, {
        type: stone.type,
        category: stone.category,
        remainingOwnerTurns: stone.remainingOwnerTurns,
        expiresForPlayer: stone.expiresForPlayer,
        autoRemove: stone.autoRemove,
        hyperactiveSeq: stone.hyperactiveSeq,
        regenRemaining: stone.regenRemaining,
        ownerColor: stone.ownerColor,
        chainPriority: stone.chainPriority
    });
    return {
        id,
        markerId: String(id),
        row: stone.row,
        col: stone.col,
        kind: normalized.kind,
        owner: stone.owner,
        createdSeq: (typeof stone.createdSeq === 'number') ? stone.createdSeq : id,
        data: normalized.data
    };
}

function fromBomb(bomb: Bomb, id: number): Marker {
    const normalized = normalizeMarkerInput(LEGACY_BOMB_KIND, {
        type: bomb.type,
        category: bomb.category,
        remainingTurns: bomb.remainingTurns,
        placedTurn: bomb.placedTurn
    });
    return {
        id,
        markerId: String(id),
        row: bomb.row,
        col: bomb.col,
        kind: normalized.kind,
        owner: bomb.owner,
        createdSeq: (typeof bomb.createdSeq === 'number') ? bomb.createdSeq : id,
        data: normalized.data
    };
}

function toSpecialStone(marker: Marker): SpecialStone | null {
    if (!isSpecialStoneMarker(marker)) return null;
    const data = getMarkerData(marker) || {};

    return {
        row: marker.row,
        col: marker.col,
        type: data.type,
        owner: marker.owner,
        remainingOwnerTurns: data.remainingOwnerTurns,
        expiresForPlayer: data.expiresForPlayer,
        autoRemove: data.autoRemove,
        hyperactiveSeq: data.hyperactiveSeq,
        regenRemaining: data.regenRemaining,
        ownerColor: data.ownerColor,
        chainPriority: data.chainPriority,
        createdSeq: marker.createdSeq
    };
}

function toBomb(marker: Marker): Bomb | null {
    if (!isBombCategoryMarker(marker)) return null;
    const data = getMarkerData(marker) || {};

    return {
        row: marker.row,
        col: marker.col,
        remainingTurns: data.remainingTurns,
        owner: marker.owner,
        placedTurn: data.placedTurn,
        createdSeq: marker.createdSeq
    };
}

function markersToSpecialStones(markers: Marker[]): SpecialStone[] {
    return markers
        .filter(isSpecialStoneMarker)
        .map(toSpecialStone)
        .filter((s): s is SpecialStone => s !== null);
}

function markersToBombs(markers: Marker[]): Bomb[] {
    return markers
        .filter(isBombCategoryMarker)
        .map(toBomb)
        .filter((b): b is Bomb => b !== null);
}

interface ToMarkersResult {
    markers: Marker[];
    nextId: number;
}

function toMarkers(specialStones: SpecialStone[] | null | undefined, bombs: Bomb[] | null | undefined, startId: number = 1): ToMarkersResult {
    let id = startId;
    const markers: Marker[] = [];

    for (const stone of (specialStones || [])) {
        markers.push(fromSpecialStone(stone, id++));
    }

    for (const bomb of (bombs || [])) {
        markers.push(fromBomb(bomb, id++));
    }

    return { markers, nextId: id };
}

function syncMarkersToLegacy(cardState: any): void {
    if (!cardState.markers) return;
    cardState.specialStones = markersToSpecialStones(cardState.markers);
    cardState.bombs = markersToBombs(cardState.markers);
}

function syncLegacyToMarkers(cardState: any): void {
    const result = toMarkers(
        cardState.specialStones,
        cardState.bombs,
        cardState._nextMarkerId || 1
    );
    cardState.markers = result.markers;
    cardState._nextMarkerId = result.nextId;
}

function ensureMarkers(cardState: any): void {
    if (!cardState) return;
    if (!Array.isArray(cardState.markers)) cardState.markers = [];
    if (typeof cardState._nextMarkerId !== 'number') cardState._nextMarkerId = 1;
    for (const marker of cardState.markers) {
        assignMarkerIdentity(cardState, marker);
    }
}

function getMarkers(cardState: any): Marker[] {
    return (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
}

function getSpecialMarkers(cardState: any): Marker[] {
    return getMarkers(cardState).filter(isSpecialStoneMarker);
}

function getManifestMarkers(cardState: any): Marker[] {
    return getMarkers(cardState).filter(isManifestStoneMarker);
}

function getActiveManifestMarkers(cardState: any): Marker[] {
    return getManifestMarkers(cardState).filter((marker: any) => {
        if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isActiveManifestStoneMarker === 'function') {
            return ManifestStoneRegistry.isActiveManifestStoneMarker(marker) === true;
        }
        const remaining = Number(marker && marker.data && marker.data.remainingOwnerTurns);
        return !Number.isFinite(remaining) || remaining > 0;
    });
}

function getBombMarkers(cardState: any): Marker[] {
    return getMarkers(cardState).filter(isBombCategoryMarker);
}

function findSpecialMarkerAt(cardState: any, row: number, col: number, type?: string, owner?: string): Marker | undefined {
    return getMarkers(cardState).find(m => (
        isSpecialStoneMarker(m) &&
        m.row === row &&
        m.col === col &&
        (type ? (m.data && m.data.type === type) : true) &&
        (owner ? m.owner === owner : true)
    ));
}

function findBombMarkerAt(cardState: any, row: number, col: number): Marker | undefined {
    return getMarkers(cardState).find(m => isBombCategoryMarker(m) && m.row === row && m.col === col);
}

function removeMarkers(cardState: any, predicate: (m: Marker) => boolean): void {
    if (!cardState || !Array.isArray(cardState.markers)) return;
    cardState.markers = cardState.markers = cardState.markers.filter((m: Marker) => !predicate(m));
}

interface RemoveMarkersOptions {
    kind?: string;
    category?: string;
    type?: string;
    owner?: string;
    preserveTypes?: string[];
}

function removeMarkersAt(cardState: any, row: number, col: number, options?: RemoveMarkersOptions): void {
    const opts = options || {};
    const preserveTypes = new Set((opts.preserveTypes || []).map((type) => String(type).toUpperCase()));
    removeMarkers(cardState, (m: Marker) => {
        if (m.row !== row || m.col !== col) return false;
        if (preserveTypes.has(String(m.data && m.data.type || '').toUpperCase())) return false;
        if (opts.kind === LEGACY_BOMB_KIND && !isBombCategoryMarker(m)) return false;
        if (opts.kind === MARKER_KINDS.SPECIAL_STONE && !isSpecialStoneMarker(m)) return false;
        if (opts.kind === MARKER_KINDS.MANIFEST_STONE && !isManifestStoneMarker(m)) return false;
        if (
            opts.kind &&
            opts.kind !== LEGACY_BOMB_KIND &&
            opts.kind !== MARKER_KINDS.SPECIAL_STONE &&
            opts.kind !== MARKER_KINDS.MANIFEST_STONE &&
            m.kind !== opts.kind
        ) return false;
        if (opts.category && getMarkerCategory(m) !== opts.category) return false;
        if (opts.type && (!m.data || m.data.type !== opts.type)) return false;
        if (opts.owner && m.owner !== opts.owner) return false;
        return true;
    });
}

export = {
    MARKER_KINDS,
    MARKER_CATEGORIES,
    normalizeMarkerId,
    assignMarkerIdentity,
    fromSpecialStone,
    fromBomb,
    toSpecialStone,
    toBomb,
    markersToSpecialStones,
    markersToBombs,
    toMarkers,
    syncMarkersToLegacy,
    syncLegacyToMarkers,
    ensureMarkers,
    getMarkers,
    getMarkerCategory,
    getBombMarkerType,
    isBombCategoryMarker,
    isManifestStoneMarker,
    isSpecialStoneMarker,
    normalizeMarkerInput,
    getSpecialMarkers,
    getManifestMarkers,
    getActiveManifestMarkers,
    getBombMarkers,
    findSpecialMarkerAt,
    findBombMarkerAt,
    removeMarkers,
    removeMarkersAt
};
