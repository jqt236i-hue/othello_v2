(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.BackgroundSkinSelectionModule = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    const BACKGROUND_SKIN_STORAGE_KEY = 'othello.backgroundSkin';

    function resolveCatalogModule(rootRef) {
        const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
        if (ctx && ctx.BackgroundSkinCatalogModule) return ctx.BackgroundSkinCatalogModule;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.BackgroundSkinCatalogModule) {
                return globalThis.BackgroundSkinCatalogModule;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try { return require('./catalog.js'); } catch (e) { /* ignore */ }
        }
        return null;
    }

    function canUseStorage(rootRef) {
        try { return !!(rootRef && rootRef.localStorage); } catch (e) { return false; }
    }

    function readStoredBackgroundSkinId(rootRef) {
        const catalogModule = resolveCatalogModule(rootRef);
        const fallbackId = String((catalogModule && catalogModule.DEFAULT_BACKGROUND_SKIN_ID) || 'default').trim() || 'default';
        if (!canUseStorage(rootRef)) return fallbackId;
        try {
            if (catalogModule && typeof catalogModule.normalizeBackgroundSkinId === 'function') {
                return catalogModule.normalizeBackgroundSkinId(rootRef.localStorage.getItem(BACKGROUND_SKIN_STORAGE_KEY), rootRef);
            }
            return String(rootRef.localStorage.getItem(BACKGROUND_SKIN_STORAGE_KEY) || '').trim() || fallbackId;
        } catch (e) {
            return fallbackId;
        }
    }

    function writeStoredBackgroundSkinId(rootRef, skinId) {
        if (!canUseStorage(rootRef)) return false;
        const catalogModule = resolveCatalogModule(rootRef);
        const definition = catalogModule && typeof catalogModule.getBackgroundSkinDefinition === 'function'
            ? catalogModule.getBackgroundSkinDefinition(skinId, rootRef)
            : { id: 'default' };
        try {
            rootRef.localStorage.setItem(BACKGROUND_SKIN_STORAGE_KEY, definition.id);
            return true;
        } catch (e) {
            return false;
        }
    }

    return {
        BACKGROUND_SKIN_STORAGE_KEY,
        readStoredBackgroundSkinId,
        writeStoredBackgroundSkinId
    };
}));