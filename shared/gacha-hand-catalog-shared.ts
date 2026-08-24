(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaHandCatalogSharedModule = factory();
    }
}(typeof self !== 'undefined' ? self : globalThis as Record<string, unknown>, function () {
    'use strict';

    interface CatalogItem {
        id: string;
        label: string;
        note: string;
        rarity: string;
        kind: string;
        assetPath: string;
        imagePath: string;
        previewImagePath: string;
        soundPath: string;
    }

    interface CatalogParts {
        rarity: string;
        label: string;
        imagePath: string;
    }

    interface BuildCatalogOptions {
        generatedAt?: string;
    }

    interface CatalogResult {
        version: number;
        generatedAt: string;
        sourceDir: string;
        items: CatalogItem[];
    }

    // Compatibility adapter: canonical parsing lives in observation-gacha-catalog-shared.
    let ObservationGachaCatalogSharedModule: Record<string, unknown> | null = null;
    if (typeof require === 'function') {
        try {
            ObservationGachaCatalogSharedModule = require('./observation-gacha-catalog-shared.js') as Record<string, unknown>;
        } catch (e) { /* ignore */ }
    }
    if (!ObservationGachaCatalogSharedModule) {
        try {
            if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).ObservationGachaCatalogSharedModule) {
                ObservationGachaCatalogSharedModule = (globalThis as Record<string, unknown>).ObservationGachaCatalogSharedModule as Record<string, unknown>;
            }
        } catch (e) { /* ignore */ }
    }

    const SOURCE_DIR = ObservationGachaCatalogSharedModule && ObservationGachaCatalogSharedModule.SOURCE_DIR
        ? String(ObservationGachaCatalogSharedModule.SOURCE_DIR)
        : 'assets/images/Gacha';
    const RARITY_ORDER = ObservationGachaCatalogSharedModule && Array.isArray(ObservationGachaCatalogSharedModule.RARITY_ORDER)
        ? ObservationGachaCatalogSharedModule.RARITY_ORDER as readonly string[]
        : Object.freeze(['EXR', 'UR', 'SSR', 'SR', 'R', 'N']);
    const IMAGE_EXTENSIONS = ObservationGachaCatalogSharedModule && Array.isArray(ObservationGachaCatalogSharedModule.IMAGE_EXTENSIONS)
        ? ObservationGachaCatalogSharedModule.IMAGE_EXTENSIONS as readonly string[]
        : Object.freeze(['.png', '.jpg', '.jpeg', '.webp']);

    function createCatalogItemId(rarity: unknown, label: unknown): string {
        if (
            !ObservationGachaCatalogSharedModule ||
            typeof ObservationGachaCatalogSharedModule.createCatalogItemId !== 'function'
        ) {
            return '';
        }
        return (ObservationGachaCatalogSharedModule.createCatalogItemId as (r: unknown, l: unknown, k: unknown) => string)(
            rarity,
            label,
            ObservationGachaCatalogSharedModule.ITEM_KIND_HAND_SKIN
        );
    }

    function normalizeRarity(value: unknown): string | null {
        if (!ObservationGachaCatalogSharedModule || typeof ObservationGachaCatalogSharedModule.normalizeRarity !== 'function') {
            const normalized = String(value || '').trim().toUpperCase();
            return RARITY_ORDER.includes(normalized) ? normalized : null;
        }
        return (ObservationGachaCatalogSharedModule.normalizeRarity as (v: unknown) => string | null)(value);
    }

    function normalizeCatalogItemId(value: unknown): string {
        if (!ObservationGachaCatalogSharedModule || typeof ObservationGachaCatalogSharedModule.normalizeCatalogItemId !== 'function') {
            return String(value || '').trim();
        }
        return (ObservationGachaCatalogSharedModule.normalizeCatalogItemId as (v: unknown) => string)(value);
    }

    function createCatalogItemFromAssetPath(assetPath: unknown): CatalogItem | null {
        if (!ObservationGachaCatalogSharedModule || typeof ObservationGachaCatalogSharedModule.createCatalogItemFromAssetPath !== 'function') {
            return null;
        }
        const item = (ObservationGachaCatalogSharedModule.createCatalogItemFromAssetPath as (v: unknown) => CatalogItem | null)(assetPath);
        if (!item || item.kind !== ObservationGachaCatalogSharedModule.ITEM_KIND_HAND_SKIN) return null;
        return item;
    }

    function extractCatalogParts(assetPath: unknown): CatalogParts | null {
        const item = createCatalogItemFromAssetPath(assetPath);
        if (!item) return null;
        return {
            rarity: item.rarity,
            label: item.label,
            imagePath: item.imagePath
        };
    }

    function collectCatalogItemsFromPaths(paths: unknown[]): CatalogItem[] {
        if (!ObservationGachaCatalogSharedModule || typeof ObservationGachaCatalogSharedModule.collectCatalogItemsFromPaths !== 'function') {
            return [];
        }
        const items = (ObservationGachaCatalogSharedModule.collectCatalogItemsFromPaths as (v: unknown[]) => CatalogItem[])(paths);
        return (ObservationGachaCatalogSharedModule.filterCatalogItemsByKind as (items: CatalogItem[], kind: unknown) => CatalogItem[])(
            items,
            ObservationGachaCatalogSharedModule.ITEM_KIND_HAND_SKIN
        );
    }

    function buildCatalogFromAssetManifest(manifest: unknown, options: unknown): CatalogResult {
        const opts = (options && typeof options === 'object') ? options as BuildCatalogOptions : {};
        if (!ObservationGachaCatalogSharedModule || typeof ObservationGachaCatalogSharedModule.buildCatalogFromAssetManifest !== 'function') {
            return {
                version: 1,
                generatedAt: opts.generatedAt ? String(opts.generatedAt) : new Date().toISOString(),
                sourceDir: SOURCE_DIR,
                items: []
            };
        }
        const catalog = (ObservationGachaCatalogSharedModule.buildCatalogFromAssetManifest as (m: unknown, o: unknown) => CatalogResult)(manifest, opts);
        return {
            version: catalog.version,
            generatedAt: catalog.generatedAt,
            sourceDir: catalog.sourceDir,
            items: (ObservationGachaCatalogSharedModule.filterCatalogItemsByKind as (items: CatalogItem[], kind: unknown) => CatalogItem[])(
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

export {};
