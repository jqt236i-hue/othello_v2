import createSpecialStoneRegistry = require('./special-stone-registry-factory');

function readLegacyRuntimeValue(key: string): unknown {
    try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as Record<string, unknown>)[key] !== 'undefined') {
            return (globalThis as Record<string, unknown>)[key];
        }
    } catch (_error) { /* compatibility lookup is best-effort */ }
    try {
        if (typeof self !== 'undefined' && typeof (self as unknown as Record<string, unknown>)[key] !== 'undefined') {
            return (self as unknown as Record<string, unknown>)[key];
        }
    } catch (_error) { /* compatibility lookup is best-effort */ }
    return null;
}

function isUsableEvasionStatus(candidate: unknown): boolean {
    if (!candidate || typeof candidate !== 'object') return false;
    const value = candidate as { getFlipEvadeDefault?: unknown; getDestroyEvadeDefault?: unknown };
    return typeof value.getFlipEvadeDefault === 'function'
        && typeof value.getDestroyEvadeDefault === 'function';
}

function isUsableManifestStoneRegistry(candidate: unknown): boolean {
    if (!candidate || typeof candidate !== 'object') return false;
    const value = candidate as {
        MANIFEST_STONE_METADATA?: unknown;
        isManifestStoneType?: unknown;
        getManifestStoneMetadata?: unknown;
    };
    return !!value.MANIFEST_STONE_METADATA
        && typeof value.MANIFEST_STONE_METADATA === 'object'
        && typeof value.isManifestStoneType === 'function'
        && typeof value.getManifestStoneMetadata === 'function';
}

let EvasionStatus: unknown = null;
try {
    EvasionStatus = require('./evasion-status');
} catch (_error) { /* optional compatibility dependency */ }

let ManifestStoneRegistry: unknown = null;
try {
    ManifestStoneRegistry = require('./manifest-stone-registry');
} catch (_error) { /* optional compatibility dependency */ }

const MultiCellStone = require('./multi-cell-stone');

const SpecialStoneRegistry = (
    isUsableEvasionStatus(EvasionStatus)
    && isUsableManifestStoneRegistry(ManifestStoneRegistry)
)
    ? require('./special-stone-registry-static')
    : createSpecialStoneRegistry(
        EvasionStatus,
        ManifestStoneRegistry,
        MultiCellStone,
        {
            readEvasionStatus: () => readLegacyRuntimeValue('EvasionStatus'),
            readManifestStoneRegistry: () => readLegacyRuntimeValue('ManifestStoneRegistry')
        }
    );

export = SpecialStoneRegistry;
