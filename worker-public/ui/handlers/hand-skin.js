(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        const exports = factory();
        root.HandSkinUiModule = exports;
        root.setupHandSkinControls = exports.setupHandSkinControls;
        root.syncDisplayedHandSkin = exports.syncDisplayedHandSkin;
        root.resolveHandAnimationContext = exports.resolveHandAnimationContext;
        root.resolveHandVisualOptions = exports.resolveHandVisualOptions;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function resolveCatalogModule() {
        try {
            if (typeof globalThis !== 'undefined' && globalThis.HandSkinCatalogModule) {
                return globalThis.HandSkinCatalogModule;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try {
                return require('../hand-skin/catalog.js');
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveSelectionModule() {
        try {
            if (typeof globalThis !== 'undefined' && globalThis.HandSkinSelectionModule) {
                return globalThis.HandSkinSelectionModule;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try {
                return require('../hand-skin/selection.js');
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveRuntimeModule() {
        try {
            if (typeof globalThis !== 'undefined' && globalThis.HandSkinRuntimeModule) {
                return globalThis.HandSkinRuntimeModule;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try {
                return require('../hand-skin/runtime.js');
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveControllerModule() {
        try {
            if (typeof globalThis !== 'undefined' && globalThis.HandSkinControllerModule) {
                return globalThis.HandSkinControllerModule;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try {
                return require('../hand-skin/controller.js');
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    const catalogModule = resolveCatalogModule();
    const selectionModule = resolveSelectionModule();
    const runtimeModule = resolveRuntimeModule();
    const controllerModule = resolveControllerModule();

    return {
        BASE_HAND_SKINS: catalogModule.BASE_HAND_SKINS,
        HAND_SKINS: catalogModule.HAND_SKINS,
        DEFAULT_HAND_SKIN_ID: catalogModule.DEFAULT_HAND_SKIN_ID,
        HAND_SKIN_STORAGE_KEY: selectionModule.HAND_SKIN_STORAGE_KEY,
        getAllHandSkins: function (rootRef, options) {
            return catalogModule.getAllHandSkins(rootRef, options);
        },
        applyHandSkin: function (handImageEl, skinId, rootRef) {
            return runtimeModule.applyHandSkin(handImageEl, skinId, rootRef);
        },
        resolveHandAnimationContext: function (rootRef, preferredSkinId, options) {
            return runtimeModule.resolveHandAnimationContext(rootRef, preferredSkinId, options);
        },
        resolveHandVisualOptions: function (rootRef, ownerKey, options) {
            return runtimeModule.resolveHandVisualOptions(rootRef, ownerKey, options);
        },
        syncDisplayedHandSkin: function (rootRef, preferredSkinId, handImageEl, options) {
            return runtimeModule.syncDisplayedHandSkin(rootRef, preferredSkinId, handImageEl, options);
        },
        normalizeHandSkinId: function (value, rootRef, options) {
            return catalogModule.normalizeHandSkinId(value, rootRef, options);
        },
        readStoredHandSkinId: function (rootRef) {
            return selectionModule.readStoredHandSkinId(rootRef);
        },
        setupHandSkinControls: function (options) {
            return controllerModule.setupHandSkinControls(options);
        }
    };
}));
