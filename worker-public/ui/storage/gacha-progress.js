(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        const api = factory();
        root.GachaProgressStorage = api;
        root.GachaProgressStorageModule = api;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const STORAGE_KEY = 'othello.gacha.progress.v1';
    const STATE_VERSION = 2;
    const DEFAULT_OWNED_HAND_SKIN_IDS = Object.freeze(['default']);
    const DEFAULT_OWNED_PLACEMENT_SOUND_IDS = Object.freeze(['default']);
    let GachaHandCatalogSharedModule = null;
    if (typeof require === 'function') {
        try {
            GachaHandCatalogSharedModule = require('../../shared/gacha-hand-catalog-shared.js');
        } catch (e) { /* ignore */ }
    }
    if (!GachaHandCatalogSharedModule) {
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaHandCatalogSharedModule) {
                GachaHandCatalogSharedModule = globalThis.GachaHandCatalogSharedModule;
            }
        } catch (e) { /* ignore */ }
    }

    function toNonNegativeInteger(value, fallback) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return Math.max(0, Math.floor(Number(fallback) || 0));
        return Math.max(0, Math.floor(numeric));
    }

    function normalizeOwnedHandSkinId(value) {
        const normalized = String(value || '').trim();
        if (!normalized) return '';
        if (GachaHandCatalogSharedModule && typeof GachaHandCatalogSharedModule.normalizeCatalogItemId === 'function') {
            return GachaHandCatalogSharedModule.normalizeCatalogItemId(normalized);
        }
        return normalized;
    }

    function normalizeOwnedHandSkinIds(value) {
        const owned = {};
        DEFAULT_OWNED_HAND_SKIN_IDS.forEach((skinId) => {
            owned[skinId] = true;
        });

        if (Array.isArray(value)) {
            value.forEach((skinId) => {
                const normalized = normalizeOwnedHandSkinId(skinId);
                if (!normalized) return;
                owned[normalized] = true;
            });
            return owned;
        }

        if (!value || typeof value !== 'object') return owned;

        Object.entries(value).forEach(([skinId, flag]) => {
            const normalized = normalizeOwnedHandSkinId(skinId);
            if (!normalized) return;
            owned[normalized] = owned[normalized] === true || flag === true;
        });
        DEFAULT_OWNED_HAND_SKIN_IDS.forEach((skinId) => {
            owned[skinId] = true;
        });
        return owned;
    }

    function normalizeOwnedPlacementSoundId(value) {
        const normalized = String(value || '').trim();
        if (!normalized) return '';
        if (GachaHandCatalogSharedModule && typeof GachaHandCatalogSharedModule.normalizeCatalogItemId === 'function') {
            return GachaHandCatalogSharedModule.normalizeCatalogItemId(normalized);
        }
        return normalized;
    }

    function normalizeOwnedPlacementSoundIds(value) {
        const owned = {};
        DEFAULT_OWNED_PLACEMENT_SOUND_IDS.forEach((soundId) => {
            owned[soundId] = true;
        });

        if (Array.isArray(value)) {
            value.forEach((soundId) => {
                const normalized = normalizeOwnedPlacementSoundId(soundId);
                if (!normalized) return;
                owned[normalized] = true;
            });
            return owned;
        }

        if (!value || typeof value !== 'object') return owned;

        Object.entries(value).forEach(([soundId, flag]) => {
            const normalized = normalizeOwnedPlacementSoundId(soundId);
            if (!normalized) return;
            owned[normalized] = owned[normalized] === true || flag === true;
        });
        DEFAULT_OWNED_PLACEMENT_SOUND_IDS.forEach((soundId) => {
            owned[soundId] = true;
        });
        return owned;
    }

    function createDefaultState() {
        return {
            version: STATE_VERSION,
            observationStones: 0,
            ownedHandSkinIds: normalizeOwnedHandSkinIds(null),
            ownedPlacementSoundIds: normalizeOwnedPlacementSoundIds(null),
            totalPullCount: 0,
            totalObservationEarned: 0
        };
    }

    function normalizeState(rawState) {
        const source = (rawState && typeof rawState === 'object') ? rawState : {};
        return {
            version: STATE_VERSION,
            observationStones: toNonNegativeInteger(source.observationStones, 0),
            ownedHandSkinIds: normalizeOwnedHandSkinIds(source.ownedHandSkinIds || source.ownedSkins || source.unlockedHandSkinIds),
            ownedPlacementSoundIds: normalizeOwnedPlacementSoundIds(source.ownedPlacementSoundIds || source.unlockedPlacementSoundIds),
            totalPullCount: toNonNegativeInteger(source.totalPullCount, 0),
            totalObservationEarned: toNonNegativeInteger(source.totalObservationEarned, 0)
        };
    }

    function resolveStorage(rootRef) {
        try {
            if (rootRef && rootRef.localStorage) return rootRef.localStorage;
        } catch (e) { /* ignore */ }

        try {
            if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
        } catch (e) { /* ignore */ }

        return null;
    }

    function readState(rootRef) {
        const storage = resolveStorage(rootRef);
        if (!storage) return createDefaultState();
        try {
            const raw = storage.getItem(STORAGE_KEY);
            if (!raw) return createDefaultState();
            return normalizeState(JSON.parse(raw));
        } catch (e) {
            return createDefaultState();
        }
    }

    function writeState(rootRef, nextState) {
        const normalized = normalizeState(nextState);
        const storage = resolveStorage(rootRef);
        if (!storage) return normalized;
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch (e) { /* ignore */ }
        return normalized;
    }

    function getObservationStones(rootRef) {
        return readState(rootRef).observationStones;
    }

    function listOwnedHandSkinIds(rootRef) {
        const state = readState(rootRef);
        return Object.keys(state.ownedHandSkinIds).filter((skinId) => state.ownedHandSkinIds[skinId] === true);
    }

    function listOwnedPlacementSoundIds(rootRef) {
        const state = readState(rootRef);
        return Object.keys(state.ownedPlacementSoundIds).filter((soundId) => state.ownedPlacementSoundIds[soundId] === true);
    }

    function isHandSkinOwned(rootRef, skinId) {
        const normalized = normalizeOwnedHandSkinId(skinId);
        if (!normalized) return false;
        const state = readState(rootRef);
        return state.ownedHandSkinIds[normalized] === true;
    }

    function isPlacementSoundOwned(rootRef, soundId) {
        const normalized = normalizeOwnedPlacementSoundId(soundId);
        if (!normalized) return false;
        const state = readState(rootRef);
        return state.ownedPlacementSoundIds[normalized] === true;
    }

    function awardObservationStones(rootRef, amount) {
        const add = toNonNegativeInteger(amount, 0);
        const state = readState(rootRef);
        state.observationStones += add;
        state.totalObservationEarned += add;
        return writeState(rootRef, state);
    }

    function spendObservationStones(rootRef, amount) {
        const cost = toNonNegativeInteger(amount, 0);
        const state = readState(rootRef);
        if (state.observationStones < cost) {
            return {
                ok: false,
                state,
                missing: cost - state.observationStones
            };
        }

        state.observationStones -= cost;
        return {
            ok: true,
            state: writeState(rootRef, state)
        };
    }

    function unlockHandSkinIds(rootRef, skinIds) {
        const state = readState(rootRef);
        const newlyUnlockedIds = [];
        const alreadyOwnedIds = [];

        (Array.isArray(skinIds) ? skinIds : []).forEach((skinId) => {
            const normalized = normalizeOwnedHandSkinId(skinId);
            if (!normalized) return;
            if (state.ownedHandSkinIds[normalized] === true) {
                alreadyOwnedIds.push(normalized);
                return;
            }
            state.ownedHandSkinIds[normalized] = true;
            newlyUnlockedIds.push(normalized);
        });

        return {
            state: writeState(rootRef, state),
            newlyUnlockedIds,
            alreadyOwnedIds
        };
    }

    function unlockPlacementSoundIds(rootRef, soundIds) {
        const state = readState(rootRef);
        const newlyUnlockedIds = [];
        const alreadyOwnedIds = [];

        (Array.isArray(soundIds) ? soundIds : []).forEach((soundId) => {
            const normalized = normalizeOwnedPlacementSoundId(soundId);
            if (!normalized) return;
            if (state.ownedPlacementSoundIds[normalized] === true) {
                alreadyOwnedIds.push(normalized);
                return;
            }
            state.ownedPlacementSoundIds[normalized] = true;
            newlyUnlockedIds.push(normalized);
        });

        return {
            state: writeState(rootRef, state),
            newlyUnlockedIds,
            alreadyOwnedIds
        };
    }

    function applyPullResults(rootRef, pulls) {
        const state = readState(rootRef);
        const newlyUnlockedIds = [];
        const alreadyOwnedIds = [];
        const safePulls = Array.isArray(pulls) ? pulls : [];

        state.totalPullCount += safePulls.length;
        safePulls.forEach((pull) => {
            const item = pull && pull.item && typeof pull.item === 'object' ? pull.item : null;
            const kind = String(item && item.kind || '').trim().toLowerCase();
            const candidateId = pull && pull.item ? pull.item.id : pull && pull.id;
            const normalized = kind === 'placement_sound'
                ? normalizeOwnedPlacementSoundId(candidateId)
                : normalizeOwnedHandSkinId(candidateId);
            if (!normalized) return;
            const targetOwned = kind === 'placement_sound'
                ? state.ownedPlacementSoundIds
                : state.ownedHandSkinIds;
            if (targetOwned[normalized] === true) {
                alreadyOwnedIds.push(normalized);
                return;
            }
            targetOwned[normalized] = true;
            newlyUnlockedIds.push(normalized);
        });

        return {
            state: writeState(rootRef, state),
            newlyUnlockedIds,
            alreadyOwnedIds
        };
    }

    return {
        STORAGE_KEY,
        STATE_VERSION,
        DEFAULT_OWNED_HAND_SKIN_IDS,
        createDefaultState,
        normalizeState,
        readState,
        writeState,
        getObservationStones,
        listOwnedHandSkinIds,
        listOwnedPlacementSoundIds,
        isHandSkinOwned,
        isPlacementSoundOwned,
        awardObservationStones,
        spendObservationStones,
        unlockHandSkinIds,
        unlockPlacementSoundIds,
        applyPullResults
    };
}));
