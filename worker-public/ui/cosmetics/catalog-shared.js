(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.CosmeticCatalogSharedModule = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    function resolveRootRef(rootRef) {
        if (rootRef && typeof rootRef === 'object') return rootRef;
        try {
            if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaProgressStorage(rootRef) {
        const ctx = resolveRootRef(rootRef);
        if (ctx && ctx.GachaProgressStorage) return ctx.GachaProgressStorage;
        if (ctx && ctx.GachaProgressStorageModule) return ctx.GachaProgressStorageModule;
        try {
            if (typeof globalThis !== 'undefined') {
                return globalThis.GachaProgressStorage || globalThis.GachaProgressStorageModule || null;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try { return require('../storage/gacha-progress.js'); } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveObservationGachaCatalogModule(rootRef) {
        const ctx = resolveRootRef(rootRef);
        if (ctx && ctx.ObservationGachaCatalogModule) return ctx.ObservationGachaCatalogModule;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.ObservationGachaCatalogModule) {
                return globalThis.ObservationGachaCatalogModule;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try { return require('../../shared/observation-gacha-catalog.generated.js'); } catch (e) { /* ignore */ }
        }
        return null;
    }

    function normalizeCatalogItemId(value) {
        return String(value || '').trim();
    }

    function cloneItem(item) {
        if (!item || typeof item !== 'object') return null;
        const id = normalizeCatalogItemId(item.id);
        if (!id) return null;
        const imagePath = String(item.imagePath || item.previewImagePath || item.assetPath || '').trim();
        const out = {
            id,
            label: String(item.label || id).trim() || id,
            note: String(item.note || '').trim(),
            imagePath
        };
        if (item.previewImagePath !== undefined) out.previewImagePath = String(item.previewImagePath || imagePath).trim();
        if (item.assetPath !== undefined) out.assetPath = String(item.assetPath || imagePath).trim();
        if (item.cssBackground !== undefined) out.cssBackground = String(item.cssBackground || '').trim();
        if (item.cssClass !== undefined) out.cssClass = String(item.cssClass || '').trim();
        return out;
    }

    function collectGeneratedItems(rootRef, kind) {
        const catalogModule = resolveObservationGachaCatalogModule(rootRef);
        const catalog = catalogModule && typeof catalogModule.getCatalog === 'function'
            ? catalogModule.getCatalog()
            : catalogModule;
        const items = Array.isArray(catalog && catalog.items) ? catalog.items : [];
        return items
            .filter((item) => item && item.kind === kind)
            .map(cloneItem)
            .filter(Boolean);
    }

    function dedupeItems(items) {
        const byId = new Map();
        (Array.isArray(items) ? items : []).forEach((item) => {
            const cloned = cloneItem(item);
            if (!cloned) return;
            if (!byId.has(cloned.id)) byId.set(cloned.id, cloned);
        });
        return Array.from(byId.values());
    }

    function createOwnedCosmeticCatalogApi(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const kind = String(opts.kind || '').trim();
        const defaultId = normalizeCatalogItemId(opts.defaultId) || 'default';
        const baseItems = dedupeItems(opts.baseItems || []);
        const listOwnedMethodName = String(opts.listOwnedMethodName || '').trim();
        const isOwnedMethodName = String(opts.isOwnedMethodName || '').trim();

        function getAllItems(rootRef) {
            return dedupeItems(baseItems.concat(collectGeneratedItems(rootRef, kind)));
        }

        function getDefinition(itemId, rootRef, optionsArg) {
            const normalized = normalizeCatalogItemId(itemId) || defaultId;
            const allowUnowned = !!(optionsArg && optionsArg.allowUnowned);
            const items = getAllItems(rootRef);
            const found = items.find((item) => item.id === normalized) || items.find((item) => item.id === defaultId) || items[0] || null;
            if (!found) return null;
            if (allowUnowned || isOwned(rootRef, found.id) || found.id === defaultId) return { ...found };
            const fallback = items.find((item) => item.id === defaultId) || items[0];
            return fallback ? { ...fallback } : null;
        }

        function listOwnedIds(rootRef) {
            const storage = resolveGachaProgressStorage(rootRef);
            if (storage && listOwnedMethodName && typeof storage[listOwnedMethodName] === 'function') {
                return storage[listOwnedMethodName](rootRef).map(normalizeCatalogItemId).filter(Boolean);
            }
            return [defaultId];
        }

        function isOwned(rootRef, itemId) {
            const normalized = normalizeCatalogItemId(itemId);
            if (!normalized) return false;
            if (normalized === defaultId) return true;
            const storage = resolveGachaProgressStorage(rootRef);
            if (storage && isOwnedMethodName && typeof storage[isOwnedMethodName] === 'function') {
                return !!storage[isOwnedMethodName](rootRef, normalized);
            }
            return listOwnedIds(rootRef).includes(normalized);
        }

        function getOwnedItems(rootRef) {
            const owned = new Set(listOwnedIds(rootRef));
            owned.add(defaultId);
            return getAllItems(rootRef).filter((item) => owned.has(item.id));
        }

        function normalizeSelectedId(value, rootRef, optionsArg) {
            const normalized = normalizeCatalogItemId(value) || defaultId;
            const allowUnowned = !!(optionsArg && optionsArg.allowUnowned);
            const definition = getAllItems(rootRef).find((item) => item.id === normalized);
            if (definition && (allowUnowned || isOwned(rootRef, normalized))) return normalized;
            return defaultId;
        }

        return {
            ALL_ITEMS: baseItems.slice(),
            DEFAULT_ID: defaultId,
            normalizeCatalogItemId,
            getAllItems,
            listOwnedIds,
            isOwned,
            getOwnedItems,
            normalizeSelectedId,
            getDefinition
        };
    }

    return {
        createOwnedCosmeticCatalogApi,
        normalizeCatalogItemId
    };
}));