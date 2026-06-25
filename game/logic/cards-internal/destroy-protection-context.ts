type Marker = {
    kind?: string;
    row?: number;
    col?: number;
    data?: {
        type?: unknown;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

type SpecialStoneRegistryLike = {
    getSpecialStoneInfo?: (type: string) => any;
    SPECIAL_STONE_REGISTRY?: Record<string, any>;
};

type ResolveOptions = {
    SpecialStoneRegistry?: SpecialStoneRegistryLike | null;
    markerKinds?: { SPECIAL_STONE?: string } | null;
    ignoreGuard?: boolean;
};

const DEFAULT_SPECIAL_MARKER_KIND = 'specialStone';

function normalizeSpecialStoneType(rawType: unknown): string | null {
    if (rawType === null || typeof rawType === 'undefined') return null;
    const normalized = String(rawType).trim().toUpperCase();
    return normalized || null;
}

function getSpecialStoneInfo(registry: SpecialStoneRegistryLike | null | undefined, type: string | null): any {
    if (!registry || !type) return null;
    if (typeof registry.getSpecialStoneInfo === 'function') {
        const info = registry.getSpecialStoneInfo(type);
        if (info) return info;
    }
    if (registry.SPECIAL_STONE_REGISTRY && registry.SPECIAL_STONE_REGISTRY[type]) {
        return registry.SPECIAL_STONE_REGISTRY[type];
    }
    return null;
}

function isSpecialMarkerAt(marker: Marker, row: number, col: number, options: ResolveOptions): boolean {
    if (!marker || marker.row !== row || marker.col !== col) return false;
    const specialKind = options.markerKinds && options.markerKinds.SPECIAL_STONE
        ? options.markerKinds.SPECIAL_STONE
        : DEFAULT_SPECIAL_MARKER_KIND;
    return marker.kind === specialKind || marker.kind === DEFAULT_SPECIAL_MARKER_KIND;
}

function getDestroyProtectionReasonForType(rawType: unknown, options: ResolveOptions = {}): string | null {
    const type = normalizeSpecialStoneType(rawType);
    if (!type) return null;
    if (type === 'GUARD') return options.ignoreGuard === true ? null : 'guard_protected';

    const info = getSpecialStoneInfo(options.SpecialStoneRegistry, type);
    if (info && info.destroyProtected === true) return 'destroy_protected';
    return null;
}

function resolveDestroyProtectionAt(cardState: any, row: number, col: number, options: ResolveOptions = {}) {
    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    for (const marker of markers) {
        if (!isSpecialMarkerAt(marker, row, col, options)) continue;
        const type = normalizeSpecialStoneType(marker && marker.data && marker.data.type);
        const reason = getDestroyProtectionReasonForType(type, options);
        if (reason) {
            return {
                marker,
                type,
                reason
            };
        }
    }
    return null;
}

export = {
    normalizeSpecialStoneType,
    getDestroyProtectionReasonForType,
    resolveDestroyProtectionAt
};
