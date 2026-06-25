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
    normalizeSpecialStoneType?(rawType: unknown): string | null;
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
};

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

function defaultSpecialMarkers(cardState: any): Marker[] {
    return cardState && Array.isArray(cardState.markers)
        ? cardState.markers.filter((entry: Marker) => entry && entry.kind === 'specialStone')
        : [];
}

function defaultManifestMarkers(cardState: any, manifestRegistry?: ManifestStoneRegistryLike | null): Marker[] {
    return cardState && Array.isArray(cardState.markers)
        ? cardState.markers.filter((entry: Marker) => (
            entry &&
            (entry.kind === 'manifestStone' || entry.kind === 'specialStone') &&
            entry.data &&
            isManifestStoneType(entry.data.type, manifestRegistry)
        ))
        : [];
}

function defaultBombMarkers(cardState: any): Marker[] {
    return cardState && Array.isArray(cardState.markers)
        ? cardState.markers.filter((entry: Marker) => entry && entry.data && entry.data.category === 'bomb')
        : [];
}

function defaultBlockingMarkers(cardState: any, registry: SpecialStoneRegistryLike): Marker[] {
    return cardState && Array.isArray(cardState.markers)
        ? cardState.markers.filter((entry: Marker) => {
            const type = normalizeMarkerType(entry, registry);
            return entry && entry.kind === 'specialStone' && (
                type === 'BLOCKADE' ||
                type === 'METEOR_HOLE' ||
                type === 'FREEZE'
            );
        })
        : [];
}

function isRegistryFlipProtectedMarker(marker: Marker, registry: SpecialStoneRegistryLike): boolean {
    const type = normalizeMarkerType(marker, registry);
    if (!type || type === 'PROTECTED') return false;
    const info = registry.getSpecialStoneInfo(type);
    return !!(info && info.flipProtected === true);
}

function mapPosition(marker: Marker) {
    return { row: marker.row, col: marker.col, owner: marker.owner };
}

function mapOwnerPosition(marker: Marker, constants: ConstantsLike) {
    return { row: marker.row, col: marker.col, owner: ownerValue(marker.owner, constants) };
}

function buildCardProtectionContext(cardState: unknown, deps: ProtectionContextDeps = {}) {
    const registry = requireSpecialStoneRegistry(deps);
    const constants = deps.constants || {};
    const manifestRegistry = deps.ManifestStoneRegistry || null;
    const getSpecialMarkers = typeof deps.getSpecialMarkers === 'function'
        ? deps.getSpecialMarkers
        : defaultSpecialMarkers;
    const getManifestMarkers = typeof deps.getManifestMarkers === 'function'
        ? deps.getManifestMarkers
        : ((state: unknown) => defaultManifestMarkers(state, manifestRegistry));
    const getBombMarkers = typeof deps.getBombMarkers === 'function'
        ? deps.getBombMarkers
        : defaultBombMarkers;
    const getBlockingMarkers = typeof deps.getBlockingMarkers === 'function'
        ? deps.getBlockingMarkers
        : ((state: unknown) => defaultBlockingMarkers(state, registry));

    const specials = getSpecialMarkers(cardState) || [];
    const manifests = getManifestMarkers(cardState) || [];

    const protectedStones = specials
        .filter((entry) => normalizeMarkerType(entry, registry) === 'PROTECTED')
        .map(mapPosition);

    const inviolableStones = manifests
        .map((entry) => mapOwnerPosition(entry, constants));

    const permaProtectedStones = specials
        .filter((entry) => {
            if (!entry || !entry.data) return false;
            const type = normalizeMarkerType(entry, registry);
            if (isRegistryFlipProtectedMarker(entry, registry)) return true;
            if (type === 'FREEZE') return true;
            if (
                typeof deps.isFrozenCellForCard === 'function' &&
                typeof entry.row === 'number' &&
                typeof entry.col === 'number' &&
                deps.isFrozenCellForCard(cardState, entry.row, entry.col)
            ) {
                return true;
            }
            if (typeof deps.isAdditionalPermaProtectedMarker === 'function') {
                return deps.isAdditionalPermaProtectedMarker(entry, cardState) === true;
            }
            return false;
        })
        .concat(manifests)
        .map((entry) => mapOwnerPosition(entry, constants));

    const bombs = getBombMarkers(cardState).map((entry) => ({
        row: entry.row,
        col: entry.col,
        remainingTurns: entry.data ? entry.data.remainingTurns : undefined,
        owner: entry.owner,
        placedTurn: entry.data ? entry.data.placedTurn : undefined,
        createdSeq: entry.createdSeq
    }));

    const blockedCells = getBlockingMarkers(cardState).map((entry) => ({
        row: entry.row,
        col: entry.col,
        type: entry.data ? entry.data.type : null,
        remainingOwnerTurns: entry.data ? entry.data.remainingOwnerTurns : undefined,
        owner: entry.owner
    }));

    return {
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
