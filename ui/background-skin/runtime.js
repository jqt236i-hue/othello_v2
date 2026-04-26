(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.BackgroundSkinRuntimeModule = factory();
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

    function resolveDocument(rootRef) {
        const ctx = resolveRootRef(rootRef);
        if (ctx && ctx.document) return ctx.document;
        if (typeof document !== 'undefined') return document;
        return null;
    }

    function resolveCatalogModule(rootRef) {
        const ctx = resolveRootRef(rootRef);
        if (ctx && ctx.BackgroundSkinCatalogModule) return ctx.BackgroundSkinCatalogModule;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.BackgroundSkinCatalogModule) return globalThis.BackgroundSkinCatalogModule;
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try { return require('./catalog.js'); } catch (e) { /* ignore */ }
        }
        return null;
    }

    function applyBackgroundSkin(rootRef, skinId) {
        const ctx = resolveRootRef(rootRef);
        const docRef = resolveDocument(ctx);
        const catalogModule = resolveCatalogModule(ctx);
        const definition = catalogModule && typeof catalogModule.getBackgroundSkinDefinition === 'function'
            ? catalogModule.getBackgroundSkinDefinition(skinId, ctx)
            : null;
        if (!docRef || !definition) return null;
        const body = docRef.body;
        const rootEl = docRef.documentElement;
        if (body) {
            body.setAttribute('data-background-skin-id', definition.id);
            if (definition.cssBackground) {
                body.style.setProperty('--selected-background-skin', definition.cssBackground);
                body.style.backgroundImage = 'var(--selected-background-skin)';
                body.style.backgroundPosition = 'center center';
                body.style.backgroundRepeat = 'no-repeat';
                body.style.backgroundSize = 'auto';
            } else if (definition.imagePath) {
                body.style.setProperty('--selected-background-skin', 'url("' + definition.imagePath + '")');
                body.style.backgroundImage = 'var(--selected-background-skin)';
                body.style.backgroundPosition = 'center center';
                body.style.backgroundRepeat = 'no-repeat';
                body.style.backgroundSize = 'auto';
            } else {
                body.style.removeProperty('--selected-background-skin');
                body.style.removeProperty('background-image');
                body.style.removeProperty('background-position');
                body.style.removeProperty('background-repeat');
                body.style.removeProperty('background-size');
            }
        }
        if (rootEl) rootEl.setAttribute('data-background-skin-id', definition.id);
        return definition;
    }

    function syncDisplayedBackgroundSkin(rootRef, preferredSkinId) {
        const catalogModule = resolveCatalogModule(rootRef);
        const fallbackId = String((catalogModule && catalogModule.DEFAULT_BACKGROUND_SKIN_ID) || 'default').trim() || 'default';
        const normalized = catalogModule && typeof catalogModule.normalizeBackgroundSkinId === 'function'
            ? catalogModule.normalizeBackgroundSkinId(preferredSkinId, rootRef)
            : fallbackId;
        return applyBackgroundSkin(rootRef, normalized);
    }

    return {
        resolveRootRef,
        resolveDocument,
        applyBackgroundSkin,
        syncDisplayedBackgroundSkin
    };
}));