(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.HandSkinSelectionModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const HAND_SKIN_STORAGE_KEY = 'othello.handSkin';

    function resolveCatalogModule(rootRef) {
        const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
        if (ctx && ctx.HandSkinCatalogModule) return ctx.HandSkinCatalogModule;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.HandSkinCatalogModule) {
                return globalThis.HandSkinCatalogModule;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try {
                return require('./catalog.js');
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function canUseStorage(rootRef) {
        try {
            return !!(rootRef && rootRef.localStorage);
        } catch (e) {
            return false;
        }
    }

    function readStoredHandSkinId(rootRef) {
        const catalogModule = resolveCatalogModule(rootRef);
        const fallbackId = String((catalogModule && catalogModule.DEFAULT_HAND_SKIN_ID) || 'default').trim() || 'default';
        if (!canUseStorage(rootRef)) return fallbackId;
        try {
            if (catalogModule && typeof catalogModule.normalizeHandSkinId === 'function') {
                return catalogModule.normalizeHandSkinId(rootRef.localStorage.getItem(HAND_SKIN_STORAGE_KEY), rootRef);
            }
            return String(rootRef.localStorage.getItem(HAND_SKIN_STORAGE_KEY) || '').trim() || fallbackId;
        } catch (e) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[hand-skin] failed to read storage', e);
            }
            return fallbackId;
        }
    }

    function writeStoredHandSkinId(rootRef, skinId) {
        if (!canUseStorage(rootRef)) return false;
        const catalogModule = resolveCatalogModule(rootRef);
        const definition = catalogModule && typeof catalogModule.getHandSkinDefinition === 'function'
            ? catalogModule.getHandSkinDefinition(skinId, rootRef)
            : { id: 'default' };
        try {
            rootRef.localStorage.setItem(HAND_SKIN_STORAGE_KEY, definition.id);
            return true;
        } catch (e) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[hand-skin] failed to write storage', e);
            }
            return false;
        }
    }

    return {
        HAND_SKIN_STORAGE_KEY,
        readStoredHandSkinId,
        writeStoredHandSkinId
    };
}));
