type Marker = {
    kind?: string;
    row?: number;
    col?: number;
    owner?: unknown;
    data?: Record<string, unknown> | null;
    createdSeq?: unknown;
};

type ConstantsLike = {
    BLACK?: unknown;
    WHITE?: unknown;
};

type SpecialStoneRegistryLike = {
    getSpecialStoneInfo(rawType: unknown): { flipProtected?: boolean } | null;
    getSpecialStoneFootprint?(marker: Marker): Array<{ row: number; col: number }>;
    isInviolableStoneEffect?(rawType: unknown, markerData?: unknown): boolean;
    normalizeSpecialStoneType?(rawType: unknown): string | null;
    SPECIAL_STONE_REGISTRY?: Record<string, { flipProtected?: boolean } | null>;
};

type ManifestStoneRegistryLike = {
    isManifestStoneType?(rawType: unknown): boolean;
};

type ProtectionContextDeps = {
    constants?: ConstantsLike;
    SpecialStoneRegistry?: SpecialStoneRegistryLike | null;
    ManifestStoneRegistry?: ManifestStoneRegistryLike | null;
    getSpecialMarkers?(cardState: unknown): Marker[];
    getManifestMarkers?(cardState: unknown): Marker[];
    getBombMarkers?(cardState: unknown): Marker[];
    getBlockingMarkers?(cardState: unknown): Marker[];
    isFrozenCellForCard?(cardState: unknown, row: number, col: number): boolean;
    isAdditionalPermaProtectedMarker?(marker: Marker, cardState: unknown): boolean;
    createMarkerContextIndex?(cardState: unknown, options?: unknown): MarkerContextIndex;
};

type MarkerContextIndex = {
    specialMarkers?: Marker[];
    manifestMarkers?: Marker[];
    bombMarkers?: Marker[];
    blockingMarkers?: Marker[];
    isFrozenCell?(row: unknown, col: unknown): boolean;
};

function resolveMarkerContextIndexFactory(deps: ProtectionContextDeps): ((cardState: unknown, options?: unknown) => MarkerContextIndex) | null {
    if (deps && typeof deps.createMarkerContextIndex === 'function') return deps.createMarkerContextIndex;
    try {
        if (typeof require === 'function') {
            const markersModule = require('../cards/markers');
            if (markersModule && typeof markersModule.createMarkerContextIndex === 'function') {
                return markersModule.createMarkerContextIndex;
            }
        }
    } catch (e) { /* fall through to compatibility index */ }
    return null;
}

function buildCompatibilityMarkerContextIndex(cardState: any, deps: ProtectionContextDeps): MarkerContextIndex {
    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    const specialMarkers: Marker[] = [];
    const manifestMarkers: Marker[] = [];
    const bombMarkers: Marker[] = [];
    const blockingMarkers: Marker[] = [];
    const frozenKeys = new Set<string>();
    const manifestRegistry = deps.ManifestStoneRegistry || null;
    for (const marker of markers) {
        if (!marker) continue;
        const data = marker.data && typeof marker.data === 'object' ? marker.data : {};
        const type = String(data.type || '').trim().toUpperCase();
        const bomb = marker.kind === 'bomb' || data.category === 'bomb' || type === 'TIME_BOMB';
        const manifest = !bomb && (marker.kind === 'manifestStone' || (
            marker.kind === 'specialStone' && isManifestStoneType(type, manifestRegistry)
        ));
        const special = !bomb && !manifest && marker.kind === 'specialStone';
        if (special) specialMarkers.push(marker);
        if (manifest) manifestMarkers.push(marker);
        if (bomb) bombMarkers.push(marker);
        if (special && (type === 'BLOCKADE' || type === 'METEOR_HOLE' || type === 'FREEZE')) {
            blockingMarkers.push(marker);
        }
        if (special && type === 'FREEZE') {
            frozenKeys.add(`${typeof marker.row}:${String(marker.row)},${typeof marker.col}:${String(marker.col)}`);
        }
    }
    return {
        specialMarkers,
        manifestMarkers,
        bombMarkers,
        blockingMarkers,
        isFrozenCell(row: unknown, col: unknown): boolean {
            return frozenKeys.has(`${typeof row}:${String(row)},${typeof col}:${String(col)}`);
        }
    };
}

function requireSpecialStoneRegistry(deps: ProtectionContextDeps): SpecialStoneRegistryLike {
    const registry = deps && deps.SpecialStoneRegistry;
    if (!registry || typeof registry.getSpecialStoneInfo !== 'function') {
        throw new Error('[protection-context] SpecialStoneRegistry.getSpecialStoneInfo required');
    }
    return registry;
}

function toNumberOrFallback(value: unknown, fallback: number): number {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : fallback;
}

function ownerValue(owner: unknown, constants: ConstantsLike = {}): unknown {
    const black = toNumberOrFallback(constants.BLACK, 1);
    const white = toNumberOrFallback(constants.WHITE, -1);
    if (owner === 'black' || Number(owner) === black) return black;
    if (owner === 'white' || Number(owner) === white) return white;
    return owner;
}

function normalizeMarkerType(marker: Marker, registry?: SpecialStoneRegistryLike): string {
    const rawType = marker && marker.data ? marker.data.type : null;
    if (registry && typeof registry.normalizeSpecialStoneType === 'function') {
        const normalized = registry.normalizeSpecialStoneType(rawType);
        return normalized ? String(normalized) : '';
    }
    return String(rawType || '').trim().toUpperCase();
}

function isManifestStoneType(rawType: unknown, manifestRegistry?: ManifestStoneRegistryLike | null): boolean {
    if (manifestRegistry && typeof manifestRegistry.isManifestStoneType === 'function') {
        return manifestRegistry.isManifestStoneType(rawType) === true;
    }
    const type = String(rawType || '').trim().toUpperCase();
    return type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL';
}

function isRegistryFlipProtectedMarker(marker: Marker, registry: SpecialStoneRegistryLike): boolean {
    const type = normalizeMarkerType(marker, registry);
    if (!type || type === 'PROTECTED') return false;
    const info = registry.getSpecialStoneInfo(type);
    return !!(info && info.flipProtected === true);
}

function isRegistryFlipProtectedType(type: string, registry: SpecialStoneRegistryLike): boolean {
    if (!type || type === 'PROTECTED') return false;
    const table = registry.SPECIAL_STONE_REGISTRY;
    const info = table && Object.prototype.hasOwnProperty.call(table, type)
        ? table[type]
        : registry.getSpecialStoneInfo(type);
    return !!(info && info.flipProtected === true);
}

function mapPosition(marker: Marker) {
    return { row: marker.row, col: marker.col, owner: marker.owner };
}

function mapOwnerPosition(marker: Marker, constants: ConstantsLike) {
    return { row: marker.row, col: marker.col, owner: ownerValue(marker.owner, constants) };
}

function mapFootprintPositions(marker: Marker, registry: SpecialStoneRegistryLike): Array<{ row?: number; col?: number; owner?: unknown }> {
    const footprint = typeof registry.getSpecialStoneFootprint === 'function'
        ? registry.getSpecialStoneFootprint(marker)
        : [marker];
    return footprint.map((cell) => ({ row: cell.row, col: cell.col, owner: marker.owner }));
}

function mapOwnerFootprintPositions(marker: Marker, constants: ConstantsLike, registry: SpecialStoneRegistryLike): Array<{ row?: number; col?: number; owner?: unknown }> {
    return mapFootprintPositions(marker, registry).map((cell) => ({
        row: cell.row,
        col: cell.col,
        owner: ownerValue(marker.owner, constants)
    }));
}

function buildCardProtectionContext(cardState: unknown, deps: ProtectionContextDeps = {}) {
    const registry = requireSpecialStoneRegistry(deps);
    const constants = deps.constants || {};
    const createMarkerContextIndex = resolveMarkerContextIndexFactory(deps);
    const markerIndex = createMarkerContextIndex
        ? createMarkerContextIndex(cardState, { includeCellIndex: false })
        : buildCompatibilityMarkerContextIndex(cardState, deps);
    const specials = Array.isArray(markerIndex.specialMarkers) ? markerIndex.specialMarkers : [];
    const manifests = Array.isArray(markerIndex.manifestMarkers) ? markerIndex.manifestMarkers : [];

    const protectedStones: Array<{ row?: number; col?: number; owner?: unknown }> = [];
    const permaProtectedStones: Array<{ row?: number; col?: number; owner?: unknown }> = [];
    for (const entry of specials) {
        if (!entry || !entry.data) continue;
        const type = normalizeMarkerType(entry, registry);
        if (type === 'PROTECTED') protectedStones.push(...mapFootprintPositions(entry, registry));
        if (
            isRegistryFlipProtectedType(type, registry) ||
            type === 'FREEZE' ||
            (typeof markerIndex.isFrozenCell === 'function' && markerIndex.isFrozenCell(entry.row, entry.col)) ||
            (typeof deps.isAdditionalPermaProtectedMarker === 'function' && deps.isAdditionalPermaProtectedMarker(entry, cardState) === true)
        ) {
            permaProtectedStones.push(...mapOwnerFootprintPositions(entry, constants, registry));
        }
    }

    const inviolableStoneByKey = new Map<string, { row?: number; col?: number; owner?: unknown }>();
    const addInviolableStone = (entry: { row?: number; col?: number; owner?: unknown }) => {
        const key = `${Number(entry && entry.row)},${Number(entry && entry.col)}`;
        if (!inviolableStoneByKey.has(key)) inviolableStoneByKey.set(key, entry);
    };
    for (const entry of manifests) {
        addInviolableStone(mapOwnerPosition(entry, constants));
    }
    for (const entry of specials) {
        if (!entry || !entry.data) continue;
        const type = normalizeMarkerType(entry, registry);
        if (
            !registry
            || typeof registry.isInviolableStoneEffect !== 'function'
            || registry.isInviolableStoneEffect(type, entry.data) !== true
        ) {
            continue;
        }
        for (const position of mapOwnerFootprintPositions(entry, constants, registry)) {
            addInviolableStone(position);
        }
    }
    const inviolableStones = Array.from(inviolableStoneByKey.values());

    permaProtectedStones.push(...inviolableStones);

    const bombs = (Array.isArray(markerIndex.bombMarkers) ? markerIndex.bombMarkers : []).map((entry) => ({
        row: entry.row,
        col: entry.col,
        remainingTurns: entry.data ? entry.data.remainingTurns : undefined,
        owner: entry.owner,
        placedTurn: entry.data ? entry.data.placedTurn : undefined,
        createdSeq: entry.createdSeq
    }));

    const blockedCells = (Array.isArray(markerIndex.blockingMarkers) ? markerIndex.blockingMarkers : []).map((entry) => ({
        row: entry.row,
        col: entry.col,
        type: entry.data ? entry.data.type : null,
        remainingOwnerTurns: entry.data ? entry.data.remainingOwnerTurns : undefined,
        owner: entry.owner
    }));

    return {
        cardState,
        protectedStones,
        inviolableStones,
        permaProtectedStones,
        bombs,
        blockedCells
    };
}

export = {
    buildCardProtectionContext,
    isRegistryFlipProtectedMarker,
    normalizeMarkerType
};
