"use strict";
/**
 * @file hand-skin.ts
 * @description Hand skin UI handler
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function resolveCatalogModule() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.HandSkinCatalogModule) {
            return globalThis.HandSkinCatalogModule ?? null;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof _require === 'function') {
        try {
            return _require('../hand-skin/catalog.js') ?? null;
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
function resolveSelectionModule() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.HandSkinSelectionModule) {
            return globalThis.HandSkinSelectionModule ?? null;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof _require === 'function') {
        try {
            return _require('../hand-skin/selection.js') ?? null;
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
function resolveRuntimeModule() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.HandSkinRuntimeModule) {
            return globalThis.HandSkinRuntimeModule ?? null;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof _require === 'function') {
        try {
            return _require('../hand-skin/runtime.js') ?? null;
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
function resolveControllerModule() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.HandSkinControllerModule) {
            return globalThis.HandSkinControllerModule ?? null;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof _require === 'function') {
        try {
            return _require('../hand-skin/controller.js') ?? null;
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
const catalogModule = resolveCatalogModule();
const selectionModule = resolveSelectionModule();
const runtimeModule = resolveRuntimeModule();
const controllerModule = resolveControllerModule();
const handSkinExports = {
    BASE_HAND_SKINS: catalogModule ? catalogModule.BASE_HAND_SKINS : [],
    HAND_SKINS: catalogModule ? catalogModule.HAND_SKINS : [],
    DEFAULT_HAND_SKIN_ID: catalogModule ? catalogModule.DEFAULT_HAND_SKIN_ID : 'default',
    HAND_SKIN_STORAGE_KEY: selectionModule ? selectionModule.HAND_SKIN_STORAGE_KEY : '',
    getAllHandSkins: function (rootRef, options) {
        return catalogModule ? catalogModule.getAllHandSkins(rootRef, options) : [];
    },
    applyHandSkin: function (handImageEl, skinId, rootRef) {
        return runtimeModule ? runtimeModule.applyHandSkin(handImageEl, skinId, rootRef) : null;
    },
    resolveHandAnimationContext: function (rootRef, preferredSkinId, options) {
        return runtimeModule ? runtimeModule.resolveHandAnimationContext(rootRef, preferredSkinId, options) : null;
    },
    resolveHandVisualOptions: function (rootRef, ownerKey, options) {
        return runtimeModule ? runtimeModule.resolveHandVisualOptions(rootRef, ownerKey, options) : null;
    },
    syncDisplayedHandSkin: function (rootRef, preferredSkinId, handImageEl, options) {
        return runtimeModule ? runtimeModule.syncDisplayedHandSkin(rootRef, preferredSkinId, handImageEl, options) : null;
    },
    normalizeHandSkinId: function (value, rootRef, options) {
        return catalogModule ? catalogModule.normalizeHandSkinId(value, rootRef, options) : 'default';
    },
    readStoredHandSkinId: function (rootRef) {
        return selectionModule ? selectionModule.readStoredHandSkinId(rootRef) : 'default';
    },
    setupHandSkinControls: function (options) {
        return controllerModule ? controllerModule.setupHandSkinControls(options) : null;
    }
};
if (typeof window !== 'undefined') {
    window.HandSkinUiModule = handSkinExports;
    window.setupHandSkinControls = handSkinExports.setupHandSkinControls;
    window.syncDisplayedHandSkin = handSkinExports.syncDisplayedHandSkin;
    window.resolveHandAnimationContext = handSkinExports.resolveHandAnimationContext;
    window.resolveHandVisualOptions = handSkinExports.resolveHandVisualOptions;
}
module.exports = handSkinExports;
//# sourceMappingURL=hand-skin.js.map