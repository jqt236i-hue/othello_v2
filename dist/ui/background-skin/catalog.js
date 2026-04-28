"use strict";
/**
 * @file catalog.ts
 * @description Background skin catalog
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const BASE_BACKGROUND_SKINS = Object.freeze([
    Object.freeze({
        id: 'default',
        label: '既定背景',
        note: '初期所持',
        imagePath: 'assets/images/background/default.png'
    }),
    Object.freeze({
        id: 'observation-desk',
        label: '観測の机',
        note: '初期所持',
        imagePath: 'assets/images/background-skin/観測の机.png'
    })
]);
function resolveCosmeticCatalogSharedModule() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.CosmeticCatalogSharedModule) {
            return globalThis.CosmeticCatalogSharedModule ?? null;
        }
    }
    catch (e) { /* ignore */ }
    if (typeof _require === 'function') {
        try {
            return _require('../cosmetics/catalog-shared.js');
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
const sharedModule = resolveCosmeticCatalogSharedModule();
if (!sharedModule || typeof sharedModule.createOwnedCosmeticCatalogApi !== 'function') {
    throw new Error('[background-skin/catalog] missing CosmeticCatalogSharedModule');
}
const catalogApi = sharedModule.createOwnedCosmeticCatalogApi({
    kind: 'background_skin',
    baseItems: BASE_BACKGROUND_SKINS,
    defaultId: BASE_BACKGROUND_SKINS[0].id,
    listOwnedMethodName: 'listOwnedBackgroundSkinIds',
    isOwnedMethodName: 'isBackgroundSkinOwned'
});
const BACKGROUND_SKINS = catalogApi.ALL_ITEMS;
const DEFAULT_BACKGROUND_SKIN_ID = catalogApi.DEFAULT_ID;
function normalizeCatalogBackgroundSkinId(value, rootRef) {
    return catalogApi.normalizeCatalogItemId(value, rootRef);
}
function getAllBackgroundSkins(rootRef, options) {
    return catalogApi.getAllItems(rootRef, options);
}
function listOwnedBackgroundSkinIds(rootRef) {
    return catalogApi.listOwnedIds(rootRef);
}
function isBackgroundSkinOwned(rootRef, skinId) {
    return catalogApi.isOwned(rootRef, skinId);
}
function getOwnedBackgroundSkins(rootRef) {
    return catalogApi.getOwnedItems(rootRef);
}
function normalizeBackgroundSkinId(value, rootRef, options) {
    return catalogApi.normalizeSelectedId(value, rootRef, options);
}
function getBackgroundSkinDefinition(skinId, rootRef, options) {
    return catalogApi.getDefinition(skinId, rootRef, options);
}
module.exports = {
    BASE_BACKGROUND_SKINS,
    BACKGROUND_SKINS,
    DEFAULT_BACKGROUND_SKIN_ID,
    normalizeCatalogBackgroundSkinId,
    getAllBackgroundSkins,
    listOwnedBackgroundSkinIds,
    isBackgroundSkinOwned,
    getOwnedBackgroundSkins,
    normalizeBackgroundSkinId,
    getBackgroundSkinDefinition
};
//# sourceMappingURL=catalog.js.map