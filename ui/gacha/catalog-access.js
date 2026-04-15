(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.ObservationGachaCatalogAccessModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function resolveObservationCatalogModule() {
        if (typeof require === 'function') {
            try {
                return require('../../shared/observation-gacha-catalog.generated.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.ObservationGachaCatalogModule) {
                return globalThis.ObservationGachaCatalogModule;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveObservationCatalogSharedModule() {
        if (typeof require === 'function') {
            try {
                return require('../../shared/observation-gacha-catalog-shared.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.ObservationGachaCatalogSharedModule) {
                return globalThis.ObservationGachaCatalogSharedModule;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveUIBootstrapModule() {
        if (typeof require === 'function') {
            try {
                return require('../bootstrap.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.UIBootstrap) return globalThis.UIBootstrap;
        } catch (e) { /* ignore */ }
        return null;
    }

    function readLoadedAssetManifest(rootRef, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.assetManifest && typeof opts.assetManifest === 'object') {
            return opts.assetManifest;
        }

        const uiBootstrap = opts.uiBootstrap || resolveUIBootstrapModule();
        if (uiBootstrap && typeof uiBootstrap.getLoadedAssetManifest === 'function') {
            try {
                const manifest = uiBootstrap.getLoadedAssetManifest();
                if (manifest && typeof manifest === 'object' && Array.isArray(manifest.files)) {
                    return manifest;
                }
            } catch (e) { /* ignore */ }
        }

        const ctx = opts.root || rootRef || (typeof window !== 'undefined' ? window : null);
        if (ctx && ctx.UIBootstrap && typeof ctx.UIBootstrap.getLoadedAssetManifest === 'function') {
            try {
                const manifest = ctx.UIBootstrap.getLoadedAssetManifest();
                if (manifest && typeof manifest === 'object' && Array.isArray(manifest.files)) {
                    return manifest;
                }
            } catch (e) { /* ignore */ }
        }

        return null;
    }

    function getObservationCatalog(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.catalog && typeof opts.catalog === 'object' && Array.isArray(opts.catalog.items)) {
            return opts.catalog;
        }

        const sharedModule = opts.catalogSharedModule || resolveObservationCatalogSharedModule();
        const manifest = readLoadedAssetManifest(opts.root, opts);
        if (manifest && sharedModule && typeof sharedModule.buildCatalogFromAssetManifest === 'function') {
            const manifestCatalog = sharedModule.buildCatalogFromAssetManifest(manifest, {
                generatedAt: manifest.generatedAt || manifest.version || null
            });
            if (Array.isArray(manifestCatalog && manifestCatalog.items) && manifestCatalog.items.length) {
                return manifestCatalog;
            }
        }

        const generatedModule = opts.catalogModule || resolveObservationCatalogModule();
        if (generatedModule && Array.isArray(generatedModule.items)) {
            return generatedModule;
        }

        return {
            version: 1,
            generatedAt: '',
            sourceDir: '',
            items: []
        };
    }

    function getObservationCatalogItems(options) {
        const catalog = getObservationCatalog(options);
        return Array.isArray(catalog && catalog.items) ? catalog.items.filter(Boolean) : [];
    }

    function getObservationCatalogItemsByKind(kind, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const sharedModule = opts.catalogSharedModule || resolveObservationCatalogSharedModule();
        const items = getObservationCatalogItems(opts);
        if (!sharedModule || typeof sharedModule.filterCatalogItemsByKind !== 'function') {
            return items;
        }
        return sharedModule.filterCatalogItemsByKind(items, kind);
    }

    return {
        readLoadedAssetManifest,
        getObservationCatalog,
        getObservationCatalogItems,
        getObservationCatalogItemsByKind
    };
}));
