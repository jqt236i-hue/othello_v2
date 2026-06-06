(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.ManifestStoneRegistry = factory();
    }
}(typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>, function () {
    'use strict';

    const MANIFEST_STONE_KIND = 'manifestStone';
    const LEGACY_SPECIAL_STONE_KIND = 'specialStone';

    const MANIFEST_STONE_METADATA = Object.freeze({
        THEORY_INCARNATION: Object.freeze({
            cardId: 'theory_incarnation_01',
            markerType: 'THEORY_INCARNATION',
            displayName: '理論の化身',
            displayCategoryName: '顕現石',
            durationOwnerTurns: 3,
            absoluteProtected: true,
            visualEffectKey: 'theoryIncarnationStone',
            imagePathByOwner: Object.freeze({
                black: 'assets/images/stones/theory_incarnation-black.png',
                white: 'assets/images/stones/theory_incarnation-white.png'
            })
        }),
        BOARD_EXECUTOR: Object.freeze({
            cardId: 'board_executor_01',
            markerType: 'BOARD_EXECUTOR',
            displayName: '盤界の執行者',
            displayCategoryName: '顕現石',
            durationOwnerTurns: 4,
            absoluteProtected: true,
            visualEffectKey: 'boardExecutorStone',
            imagePathByOwner: Object.freeze({
                black: 'assets/images/stones/board_executor-black.png',
                white: 'assets/images/stones/board_executor-white.png'
            })
        }),
        OBSERVER_WILL: Object.freeze({
            cardId: 'observer_will_01',
            markerType: 'OBSERVER_WILL',
            displayName: '盤理の観測者',
            displayCategoryName: '顕現石',
            durationOwnerTurns: 5,
            absoluteProtected: true,
            visualEffectKey: 'observerWillStone',
            imagePathByOwner: Object.freeze({
                black: 'assets/images/stones/OBSERVER_WILL-black.png',
                white: 'assets/images/stones/OBSERVER_WILL-white.png'
            })
        })
    });

    const MANIFEST_STONE_TYPES = Object.freeze(Object.keys(MANIFEST_STONE_METADATA));
    const MANIFEST_STONE_TYPE_SET: ReadonlySet<string> = new Set(MANIFEST_STONE_TYPES);

    function normalizeManifestStoneType(rawType: unknown): string | null {
        if (rawType === null || typeof rawType === 'undefined') return null;
        const type = String(rawType).trim().toUpperCase();
        return type || null;
    }

    function isManifestStoneType(rawType: unknown): boolean {
        const type = normalizeManifestStoneType(rawType);
        return !!type && MANIFEST_STONE_TYPE_SET.has(type);
    }

    function getManifestStoneMetadata(rawType: unknown): any {
        const type = normalizeManifestStoneType(rawType);
        return type ? (MANIFEST_STONE_METADATA as any)[type] || null : null;
    }

    function isManifestStoneMarker(marker: any): boolean {
        if (!marker || typeof marker !== 'object') return false;
        const type = marker.data ? marker.data.type : null;
        if (!isManifestStoneType(type)) return false;
        return marker.kind === MANIFEST_STONE_KIND || marker.kind === LEGACY_SPECIAL_STONE_KIND;
    }

    function isActiveManifestStoneMarker(marker: any): boolean {
        if (!isManifestStoneMarker(marker)) return false;
        if (Object.prototype.hasOwnProperty.call(marker.data || {}, 'remainingOwnerTurns')) {
            const remaining = Number(marker.data.remainingOwnerTurns);
            return Number.isFinite(remaining) && remaining > 0;
        }
        return true;
    }

    function isAbsoluteProtectedManifestStoneType(rawType: unknown): boolean {
        const metadata = getManifestStoneMetadata(rawType);
        return !!(metadata && metadata.absoluteProtected === true);
    }

    function createManifestStoneMarkerData(rawType: unknown, extra?: any): any {
        const metadata = getManifestStoneMetadata(rawType);
        if (!metadata) return null;
        const type = metadata.markerType;
        const data = {
            type,
            remainingOwnerTurns: metadata.durationOwnerTurns,
            absoluteProtected: metadata.absoluteProtected === true,
            sourceType: type,
            visualEffectKey: metadata.visualEffectKey
        };
        return Object.assign(data, (extra && typeof extra === 'object') ? extra : {});
    }

    return Object.freeze({
        MANIFEST_STONE_KIND,
        LEGACY_SPECIAL_STONE_KIND,
        MANIFEST_STONE_METADATA,
        MANIFEST_STONE_TYPES,
        normalizeManifestStoneType,
        isManifestStoneType,
        getManifestStoneMetadata,
        isManifestStoneMarker,
        isActiveManifestStoneMarker,
        isAbsoluteProtectedManifestStoneType,
        createManifestStoneMarkerData
    });
}));

export {};
