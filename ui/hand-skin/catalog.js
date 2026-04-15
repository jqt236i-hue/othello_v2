(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.HandSkinCatalogModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const BASE_HAND_SKINS = Object.freeze([
        Object.freeze({
            id: 'default',
            label: '勇者の手',
            note: '初期所持',
            imagePath: 'assets/images/hand-skin/勇者の手.png'
        })
    ]);
    const DEFAULT_HAND_SKIN_ID = BASE_HAND_SKINS[0].id;

    function resolveRootRef(rootRef) {
        if (rootRef && typeof rootRef === 'object') return rootRef;
        try {
            if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveObservationCatalogAccessModule(rootRef) {
        const ctx = resolveRootRef(rootRef);
        if (ctx && ctx.ObservationGachaCatalogAccessModule) return ctx.ObservationGachaCatalogAccessModule;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.ObservationGachaCatalogAccessModule) {
                return globalThis.ObservationGachaCatalogAccessModule;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try {
                return require('../gacha/catalog-access.js');
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveObservationCatalogSharedModule(rootRef) {
        const ctx = resolveRootRef(rootRef);
        if (ctx && ctx.ObservationGachaCatalogSharedModule) return ctx.ObservationGachaCatalogSharedModule;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.ObservationGachaCatalogSharedModule) {
                return globalThis.ObservationGachaCatalogSharedModule;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try {
                return require('../../shared/observation-gacha-catalog-shared.js');
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveGachaProgressStorageModule(rootRef) {
        const ctx = resolveRootRef(rootRef);
        if (ctx && ctx.GachaProgressStorageModule) return ctx.GachaProgressStorageModule;
        if (ctx && ctx.GachaProgressStorage) return ctx.GachaProgressStorage;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaProgressStorageModule) {
                return globalThis.GachaProgressStorageModule;
            }
            if (typeof globalThis !== 'undefined' && globalThis.GachaProgressStorage) {
                return globalThis.GachaProgressStorage;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try {
                return require('../storage/gacha-progress.js');
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function normalizeCatalogHandSkinId(value, rootRef) {
        const normalized = String(value || '').trim();
        if (!normalized) return '';
        const sharedModule = resolveObservationCatalogSharedModule(rootRef);
        if (sharedModule && typeof sharedModule.normalizeCatalogItemId === 'function') {
            return sharedModule.normalizeCatalogItemId(normalized);
        }
        return normalized;
    }

    function buildHandSkinDefinitions(items, rootRef) {
        return (Array.isArray(items) ? items : [])
            .map((item) => {
                if (!item || typeof item !== 'object') return null;
                const id = normalizeCatalogHandSkinId(item.id, rootRef);
                const label = String(item.label || '').trim();
                const imagePath = String(item.previewImagePath || item.imagePath || item.assetPath || '').trim();
                if (!id || !label || !imagePath) return null;
                return Object.freeze({
                    id,
                    label,
                    note: String(item.note || `レアリティ ${String(item.rarity || '').trim()}`).trim(),
                    imagePath,
                    rarity: String(item.rarity || '').trim().toUpperCase()
                });
            })
            .filter(Boolean);
    }

    function getDynamicHandSkins(rootRef, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const accessModule = resolveObservationCatalogAccessModule(rootRef);
        if (!accessModule || typeof accessModule.getObservationCatalogItemsByKind !== 'function') {
            return [];
        }
        const items = accessModule.getObservationCatalogItemsByKind('hand_skin', Object.assign({}, opts, {
            root: resolveRootRef(rootRef)
        }));
        return buildHandSkinDefinitions(items, rootRef);
    }

    function getAllHandSkins(rootRef, options) {
        const byId = new Map();
        BASE_HAND_SKINS.forEach((skin) => {
            byId.set(skin.id, skin);
        });
        getDynamicHandSkins(rootRef, options).forEach((skin) => {
            if (!byId.has(skin.id)) {
                byId.set(skin.id, skin);
            }
        });
        return Array.from(byId.values());
    }

    const HAND_SKINS = Object.freeze(getAllHandSkins());

    function getBaseHandSkinIds() {
        return BASE_HAND_SKINS.map((skin) => skin.id);
    }

    function getKnownHandSkinDefinition(skinId, rootRef, options) {
        const normalizedId = normalizeCatalogHandSkinId(skinId, rootRef);
        if (!normalizedId) return null;
        return getAllHandSkins(rootRef, options).find((skin) => skin.id === normalizedId) || null;
    }

    function normalizeKnownHandSkinId(value, rootRef, options) {
        const definition = getKnownHandSkinDefinition(value, rootRef, options);
        return definition ? definition.id : DEFAULT_HAND_SKIN_ID;
    }

    function listOwnedHandSkinIds(rootRef) {
        const storageModule = resolveGachaProgressStorageModule(rootRef);
        if (storageModule && typeof storageModule.listOwnedHandSkinIds === 'function') {
            const owned = storageModule.listOwnedHandSkinIds(rootRef);
            if (Array.isArray(owned) && owned.length) return owned;
        }
        return getBaseHandSkinIds();
    }

    function isHandSkinOwned(rootRef, skinId) {
        const normalized = normalizeCatalogHandSkinId(skinId, rootRef);
        if (!normalized) return false;
        const storageModule = resolveGachaProgressStorageModule(rootRef);
        if (storageModule && typeof storageModule.isHandSkinOwned === 'function') {
            return storageModule.isHandSkinOwned(rootRef, normalized);
        }
        return getBaseHandSkinIds().includes(normalized);
    }

    function getOwnedHandSkins(rootRef) {
        const ownedSet = new Set(listOwnedHandSkinIds(rootRef));
        const skins = getAllHandSkins(rootRef).filter((skin) => ownedSet.has(skin.id));
        if (!skins.some((skin) => skin.id === DEFAULT_HAND_SKIN_ID)) {
            return BASE_HAND_SKINS.slice(0, 1);
        }
        return skins;
    }

    function normalizeHandSkinId(value, rootRef, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const normalized = normalizeKnownHandSkinId(value, rootRef, opts);
        if (opts.allowUnowned === true) return normalized;
        if (rootRef && !isHandSkinOwned(rootRef, normalized)) return DEFAULT_HAND_SKIN_ID;
        return normalized;
    }

    function getHandSkinDefinition(skinId, rootRef, options) {
        const normalizedId = normalizeHandSkinId(skinId, rootRef, options);
        return getKnownHandSkinDefinition(normalizedId, rootRef, options) || BASE_HAND_SKINS[0];
    }

    return {
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
}));
