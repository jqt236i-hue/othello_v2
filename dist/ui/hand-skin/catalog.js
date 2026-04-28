"use strict";
/**
 * @file catalog.ts
 * @description Hand skin catalog
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const BASE_HAND_SKINS = Object.freeze([
    Object.freeze({
        id: 'default',
        label: '勇者の手',
        note: '初期所持',
        imagePath: 'assets/images/hand-skin/勇者の手.png'
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
            return _require('../cosmetics/catalog-shared.js') ?? null;
        }
        catch (e) { /* ignore */ }
    }
    return null;
}
const sharedModule = resolveCosmeticCatalogSharedModule();
if (!sharedModule || typeof sharedModule.createOwnedCosmeticCatalogApi !== 'function') {
    throw new Error('[hand-skin/catalog] missing CosmeticCatalogSharedModule');
}
const catalogApi = sharedModule.createOwnedCosmeticCatalogApi({
    kind: 'hand_skin',
    baseItems: BASE_HAND_SKINS,
    defaultId: BASE_HAND_SKINS[0].id,
    includePreviewImagePath: false,
    listOwnedMethodName: 'listOwnedHandSkinIds',
    isOwnedMethodName: 'isHandSkinOwned'
});
const HAND_SKINS = catalogApi.ALL_ITEMS;
const DEFAULT_HAND_SKIN_ID = catalogApi.DEFAULT_ID;
function normalizeCatalogHandSkinId(value, rootRef) {
    return catalogApi.normalizeCatalogItemId(value, rootRef);
}
function getAllHandSkins(rootRef, options) {
    return catalogApi.getAllItems(rootRef, options);
}
function listOwnedHandSkinIds(rootRef) {
    return catalogApi.listOwnedIds(rootRef);
}
function isHandSkinOwned(rootRef, skinId) {
    return catalogApi.isOwned(rootRef, skinId);
}
function getOwnedHandSkins(rootRef) {
    return catalogApi.getOwnedItems(rootRef);
}
function normalizeHandSkinId(value, rootRef, options) {
    return catalogApi.normalizeSelectedId(value, rootRef, options);
}
function getHandSkinDefinition(skinId, rootRef, options) {
    return catalogApi.getDefinition(skinId, rootRef, options);
}
module.exports = {
    BASE_HAND_SKINS,
    HAND_SKINS,
    DEFAULT_HAND_SKIN_ID,
    normalizeCatalogHandSkinId,
    getAllHandSkins,
    listOwnedHandSkinIds,
    isHandSkinOwned,
    getOwnedHandSkins,
    normalizeHandSkinId,
    getHandSkinDefinition
};
//# sourceMappingURL=catalog.js.map