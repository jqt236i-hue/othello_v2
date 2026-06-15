declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

type SpecialStoneRegistryModule = {
    normalizeSpecialStoneType?: (rawType: unknown) => string | null;
    getSpecialStoneInfo?: (rawType: unknown) => { flipProtected?: boolean } | null;
};

let cachedSpecialStoneRegistry: SpecialStoneRegistryModule | null | undefined;

/**
 * @file helpers.js
 * @description Shared helpers for special effects
 */

/**
 * Clear all special effects (protection, bombs, dragons) at a specific position
 * Used by DESTROY effect
 * @param {number} row 
 * @param {number} col 
 */
function clearSpecialAt(row: number, col: number) {
    // Use local implementation (matches card-effects-applier.js)
    local_clearSpecialAt(row, col);
}

// Monkey-patch generic data cleanup into CardLogic or just implement locally?
// CardLogic doesn't have 'removeSpecialsAt'.
// We'll implement it locally using direct array manipulation for now, 
// matching previous behavior.

function local_clearSpecialAt(row: number, col: number) {
    if (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
        MarkersAdapter.removeMarkersAt(cardState, row, col);
        return;
    }
    if (cardState && cardState.markers) {
        cardState.markers = cardState.markers.filter((m: any) => !(m.row === row && m.col === col));
    }
}

function readGlobalValue(key: string): any {
    if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) {
        return (globalThis as any)[key];
    }
    if (typeof self !== 'undefined' && (self as any)[key]) {
        return (self as any)[key];
    }
    return null;
}

function getSpecialStoneRegistry(): SpecialStoneRegistryModule | null {
    if (cachedSpecialStoneRegistry !== undefined) return cachedSpecialStoneRegistry;
    let registry: SpecialStoneRegistryModule | null = null;
    try {
        registry = _require('../../shared/special-stone-registry');
    } catch (_e) {
        registry = null;
    }
    if (!registry || typeof registry.getSpecialStoneInfo !== 'function') {
        const globalRegistry = readGlobalValue('SpecialStoneRegistry');
        registry = globalRegistry && typeof globalRegistry.getSpecialStoneInfo === 'function'
            ? globalRegistry
            : null;
    }
    cachedSpecialStoneRegistry = registry;
    return registry;
}

function normalizeSpecialType(rawType: unknown): string {
    const registry = getSpecialStoneRegistry();
    if (registry && typeof registry.normalizeSpecialStoneType === 'function') {
        const normalized = registry.normalizeSpecialStoneType(rawType);
        return normalized ? String(normalized) : '';
    }
    if (rawType === null || typeof rawType === 'undefined') return '';
    const asString = String(rawType).trim();
    return asString ? asString.toUpperCase() : '';
}

function isRegistryFlipBlocker(marker: any): boolean {
    if (!marker || !marker.data) return false;
    const type = normalizeSpecialType(marker.data.type);
    if (!type || type === 'PROTECTED') return false;
    const registry = getSpecialStoneRegistry();
    const info = registry && typeof registry.getSpecialStoneInfo === 'function'
        ? registry.getSpecialStoneInfo(type)
        : null;
    return !!(info && info.flipProtected === true);
}

function isAdditionalFlipBlocker(marker: any): boolean {
    if (!marker || !marker.data) return false;
    if (normalizeSpecialType(marker.data.type) !== 'ULTIMATE_HYPERACTIVE') return false;
    const remaining = Number(marker.data.remainingOwnerTurns);
    return !Number.isFinite(remaining) || remaining > 0;
}

function getFlipBlockers() {
    if (!cardState || !cardState.markers) return [];
    const specials = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
        ? MarkersAdapter.getSpecialMarkers(cardState)
        : cardState.markers.filter((m: any) => m.kind === 'specialStone');
    return specials
        .filter((s: any) => {
            if (isRegistryFlipBlocker(s)) return true;
            return isAdditionalFlipBlocker(s);
        })
        .map((s: any) => ({ row: s.row, col: s.col, owner: s.owner }));
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        clearSpecialAt: local_clearSpecialAt,
        getFlipBlockers
    };
}

export {};
