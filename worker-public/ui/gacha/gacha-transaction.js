(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaTransactionModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const TRANSACTION_ERROR_CODES = Object.freeze({
        INIT_UNAVAILABLE: 'init-unavailable',
        CATALOG_EMPTY: 'catalog-empty',
        INSUFFICIENT_OBSERVATION_STONES: 'insufficient-observation-stones',
        ROLL_FAILED: 'roll-failed'
    });

    function resolveGachaHelpersModule() {
        if (typeof require === 'function') {
            try {
                return require('../../shared/gacha-helpers.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaHelpersModule) return globalThis.GachaHelpersModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaCatalogModule() {
        if (typeof require === 'function') {
            try {
                return require('../../shared/gacha-hand-catalog.generated.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaHandCatalogModule) return globalThis.GachaHandCatalogModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaCatalogSharedModule() {
        if (typeof require === 'function') {
            try {
                return require('../../shared/gacha-hand-catalog-shared.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaHandCatalogSharedModule) return globalThis.GachaHandCatalogSharedModule;
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

    function resolveGachaProgressStorageModule() {
        if (typeof require === 'function') {
            try {
                return require('../storage/gacha-progress.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaProgressStorage) return globalThis.GachaProgressStorage;
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

    function getCatalogItems(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (Array.isArray(opts.catalogItems)) {
            return opts.catalogItems.filter(Boolean);
        }

        const manifest = readLoadedAssetManifest(opts.root, opts);
        const catalogSharedModule = opts.catalogSharedModule || resolveGachaCatalogSharedModule();
        if (manifest && catalogSharedModule && typeof catalogSharedModule.buildCatalogFromAssetManifest === 'function') {
            const manifestCatalog = catalogSharedModule.buildCatalogFromAssetManifest(manifest, {
                generatedAt: manifest.generatedAt || manifest.version || null
            });
            const manifestItems = Array.isArray(manifestCatalog && manifestCatalog.items)
                ? manifestCatalog.items.filter(Boolean)
                : [];
            if (manifestItems.length) {
                return manifestItems;
            }
        }

        const items = (((opts.catalogModule || resolveGachaCatalogModule()) || {}).items || []);
        return Array.isArray(items) ? items.filter(Boolean) : [];
    }

    function getObservationStoneBalance(rootRef, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const storageModule = opts.storageModule || resolveGachaProgressStorageModule();
        if (!storageModule || typeof storageModule.getObservationStones !== 'function') return 0;
        return storageModule.getObservationStones(rootRef);
    }

    function normalizePullCount(value) {
        return value === 10 ? 10 : 1;
    }

    function buildFailure(code, messageData) {
        return {
            ok: false,
            code,
            messageData: (messageData && typeof messageData === 'object') ? messageData : {}
        };
    }

    function commitPullTransaction(rootRef, pullCount, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const helpersModule = opts.helpersModule || resolveGachaHelpersModule();
        const storageModule = opts.storageModule || resolveGachaProgressStorageModule();
        const catalogItems = getCatalogItems(Object.assign({ root: rootRef }, opts));

        if (!helpersModule || !storageModule) {
            return buildFailure(TRANSACTION_ERROR_CODES.INIT_UNAVAILABLE);
        }
        if (!catalogItems.length) {
            return buildFailure(TRANSACTION_ERROR_CODES.CATALOG_EMPTY);
        }

        const count = normalizePullCount(pullCount);
        const cost = count === 10
            ? helpersModule.OBSERVATION_STONE_TEN_PULL_COST
            : helpersModule.OBSERVATION_STONE_PULL_COST;
        const spendResult = storageModule.spendObservationStones(rootRef, cost);
        if (!spendResult || spendResult.ok !== true) {
            const missing = spendResult && Number.isFinite(Number(spendResult.missing))
                ? Math.max(0, Math.floor(Number(spendResult.missing)))
                : Math.max(0, cost - getObservationStoneBalance(rootRef, { storageModule }));
            return buildFailure(TRANSACTION_ERROR_CODES.INSUFFICIENT_OBSERVATION_STONES, {
                cost,
                missing
            });
        }

        const pulls = [];
        for (let i = 0; i < count; i += 1) {
            const pull = helpersModule.rollHandGacha(catalogItems, { randomFn: opts.randomFn });
            if (!pull || !pull.item) {
                storageModule.awardObservationStones(rootRef, cost);
                return buildFailure(TRANSACTION_ERROR_CODES.ROLL_FAILED, {
                    cost,
                    count
                });
            }
            pulls.push(pull);
        }

        const applyResult = storageModule.applyPullResults(rootRef, pulls);
        return {
            ok: true,
            code: 'ok',
            count,
            cost,
            pulls,
            newlyUnlockedIds: applyResult.newlyUnlockedIds,
            alreadyOwnedIds: applyResult.alreadyOwnedIds,
            state: applyResult.state,
            newCount: applyResult.newlyUnlockedIds.length,
            duplicateCount: pulls.length - applyResult.newlyUnlockedIds.length
        };
    }

    return {
        TRANSACTION_ERROR_CODES,
        getCatalogItems,
        getObservationStoneBalance,
        commitPullTransaction
    };
}));
