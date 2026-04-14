(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaHandCatalogSharedModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Compatibility adapter: canonical parsing lives in observation-gacha-catalog-shared.
    let ObservationGachaCatalogSharedModule = null;
    if (typeof require === 'function') {
        try {
            ObservationGachaCatalogSharedModule = require('./observation-gacha-catalog-shared.js');
        } catch (e) { /* ignore */ }
    }
    if (!ObservationGachaCatalogSharedModule) {
        try {
            if (typeof globalThis !== 'undefined' && globalThis.ObservationGachaCatalogSharedModule) {
                ObservationGachaCatalogSharedModule = globalThis.ObservationGachaCatalogSharedModule;
            }
        } catch (e) { /* ignore */ }
    }

    const SOURCE_DIR = ObservationGachaCatalogSharedModule && ObservationGachaCatalogSharedModule.SOURCE_DIR
        ? ObservationGachaCatalogSharedModule.SOURCE_DIR
        : 'assets/images/Gacha';
    const RARITY_ORDER = ObservationGachaCatalogSharedModule && Array.isArray(ObservationGachaCatalogSharedModule.RARITY_ORDER)
        ? ObservationGachaCatalogSharedModule.RARITY_ORDER
        : Object.freeze(['EXR', 'UR', 'SSR', 'SR', 'R', 'N']);
    const IMAGE_EXTENSIONS = ObservationGachaCatalogSharedModule && Array.isArray(ObservationGachaCatalogSharedModule.IMAGE_EXTENSIONS)
        ? ObservationGachaCatalogSharedModule.IMAGE_EXTENSIONS
        : Object.freeze(['.png', '.jpg', '.jpeg', '.webp']);

    function createCatalogItemId(rarity, label) {
        if (!ObservationGachaCatalogSharedModule || typeof ObservationGachaCatalogSharedModule.createCatalogItemId !== 'function') {
            return '';
        }
        return ObservationGachaCatalogSharedModule.createCatalogItemId(
            rarity,
            label,
            ObservationGachaCatalogSharedModule.ITEM_KIND_HAND_SKIN
        );
    }

    function normalizeRarity(value) {
        if (!ObservationGachaCatalogSharedModule || typeof ObservationGachaCatalogSharedModule.normalizeRarity !== 'function') {
            const normalized = String(value || '').trim().toUpperCase();
            return RARITY_ORDER.includes(normalized) ? normalized : null;
        }
        return ObservationGachaCatalogSharedModule.normalizeRarity(value);
    }

    function normalizeCatalogItemId(value) {
        if (!ObservationGachaCatalogSharedModule || typeof ObservationGachaCatalogSharedModule.normalizeCatalogItemId !== 'function') {
            return String(value || '').trim();
        }
        return ObservationGachaCatalogSharedModule.normalizeCatalogItemId(value);
    }

    function createCatalogItemFromAssetPath(assetPath) {
        if (!ObservationGachaCatalogSharedModule || typeof ObservationGachaCatalogSharedModule.createCatalogItemFromAssetPath !== 'function') {
            return null;
        }
        const item = ObservationGachaCatalogSharedModule.createCatalogItemFromAssetPath(assetPath);
        if (!item || item.kind !== ObservationGachaCatalogSharedModule.ITEM_KIND_HAND_SKIN) return null;
        return item;
    }

    function extractCatalogParts(assetPath) {
        const item = createCatalogItemFromAssetPath(assetPath);
        if (!item) return null;
        return {
            rarity: item.rarity,
            label: item.label,
            imagePath: item.imagePath
        };
    }

    function collectCatalogItemsFromPaths(paths) {
        if (!ObservationGachaCatalogSharedModule || typeof ObservationGachaCatalogSharedModule.collectCatalogItemsFromPaths !== 'function') {
            return [];
        }
        const items = ObservationGachaCatalogSharedModule.collectCatalogItemsFromPaths(paths);
        return ObservationGachaCatalogSharedModule.filterCatalogItemsByKind(
            items,
            ObservationGachaCatalogSharedModule.ITEM_KIND_HAND_SKIN
        );
    }

    function buildCatalogFromAssetManifest(manifest, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (!ObservationGachaCatalogSharedModule || typeof ObservationGachaCatalogSharedModule.buildCatalogFromAssetManifest !== 'function') {
            return {
                version: 1,
                generatedAt: opts.generatedAt ? String(opts.generatedAt) : new Date().toISOString(),
                sourceDir: SOURCE_DIR,
                items: []
            };
        }
        const catalog = ObservationGachaCatalogSharedModule.buildCatalogFromAssetManifest(manifest, opts);
        return {
            version: catalog.version,
            generatedAt: catalog.generatedAt,
            sourceDir: catalog.sourceDir,
            items: ObservationGachaCatalogSharedModule.filterCatalogItemsByKind(
                catalog.items,
                ObservationGachaCatalogSharedModule.ITEM_KIND_HAND_SKIN
            )
        };
    }

    return Object.freeze({
        SOURCE_DIR,
        RARITY_ORDER,
        IMAGE_EXTENSIONS,
        normalizeRarity,
        normalizeCatalogItemId,
        createCatalogItemId,
        extractCatalogParts,
        createCatalogItemFromAssetPath,
        collectCatalogItemsFromPaths,
        buildCatalogFromAssetManifest
    });
}));
