'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const STORAGE_KEY = 'othello.gacha.progress.v1';
const STATE_VERSION = 3;
const DEFAULT_OWNED_HAND_SKIN_IDS = Object.freeze(['default']);
const DEFAULT_OWNED_BACKGROUND_SKIN_IDS = Object.freeze(['default', 'unobserved-night']);
const DEFAULT_OWNED_PLACEMENT_SOUND_IDS = Object.freeze(['default']);
const OWNED_KIND_CONFIG = Object.freeze({
    hand_skin: Object.freeze({
        stateKey: 'ownedHandSkinIds',
        defaultIds: DEFAULT_OWNED_HAND_SKIN_IDS,
        sourceKeys: Object.freeze(['ownedHandSkinIds', 'ownedSkins', 'unlockedHandSkinIds'])
    }),
    background_skin: Object.freeze({
        stateKey: 'ownedBackgroundSkinIds',
        defaultIds: DEFAULT_OWNED_BACKGROUND_SKIN_IDS,
        sourceKeys: Object.freeze(['ownedBackgroundSkinIds', 'unlockedBackgroundSkinIds'])
    }),
    placement_sound: Object.freeze({
        stateKey: 'ownedPlacementSoundIds',
        defaultIds: DEFAULT_OWNED_PLACEMENT_SOUND_IDS,
        sourceKeys: Object.freeze(['ownedPlacementSoundIds', 'unlockedPlacementSoundIds'])
    })
});
const OWNED_KIND_ORDER = Object.freeze(['hand_skin', 'background_skin', 'placement_sound']);
let ObservationGachaCatalogSharedModule = null;
if (typeof _require === 'function') {
    try {
        ObservationGachaCatalogSharedModule = _require('../../shared/observation-gacha-catalog-shared.js');
    }
    catch (e) { /* ignore */ }
}
if (!ObservationGachaCatalogSharedModule) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.ObservationGachaCatalogSharedModule) {
            ObservationGachaCatalogSharedModule = globalThis.ObservationGachaCatalogSharedModule;
        }
    }
    catch (e) { /* ignore */ }
}
function toNonNegativeInteger(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return Math.max(0, Math.floor(Number(fallback) || 0));
    return Math.max(0, Math.floor(numeric));
}
function normalizeOwnedCatalogItemId(value) {
    const normalized = String(value || '').trim();
    if (!normalized)
        return '';
    if (ObservationGachaCatalogSharedModule && typeof ObservationGachaCatalogSharedModule.normalizeCatalogItemId === 'function') {
        return ObservationGachaCatalogSharedModule.normalizeCatalogItemId(normalized);
    }
    return normalized;
}
function normalizeCatalogItemKind(value) {
    if (ObservationGachaCatalogSharedModule && typeof ObservationGachaCatalogSharedModule.normalizeCatalogItemKind === 'function') {
        return ObservationGachaCatalogSharedModule.normalizeCatalogItemKind(value);
    }
    return String(value || '').trim().toLowerCase();
}
function getOwnedKindConfig(kind) {
    const normalizedKind = normalizeCatalogItemKind(kind);
    return normalizedKind && Object.prototype.hasOwnProperty.call(OWNED_KIND_CONFIG, normalizedKind)
        ? OWNED_KIND_CONFIG[normalizedKind]
        : null;
}
function normalizeOwnedIds(value, defaultIds) {
    const owned = {};
    (Array.isArray(defaultIds) ? defaultIds : []).forEach((itemId) => {
        const normalizedDefaultId = normalizeOwnedCatalogItemId(itemId);
        if (!normalizedDefaultId)
            return;
        owned[normalizedDefaultId] = true;
    });
    if (Array.isArray(value)) {
        value.forEach((itemId) => {
            const normalized = normalizeOwnedCatalogItemId(itemId);
            if (!normalized)
                return;
            owned[normalized] = true;
        });
        return owned;
    }
    if (!value || typeof value !== 'object')
        return owned;
    Object.entries(value).forEach(([itemId, flag]) => {
        const normalized = normalizeOwnedCatalogItemId(itemId);
        if (!normalized)
            return;
        owned[normalized] = owned[normalized] === true || flag === true;
    });
    (Array.isArray(defaultIds) ? defaultIds : []).forEach((itemId) => {
        const normalizedDefaultId = normalizeOwnedCatalogItemId(itemId);
        if (!normalizedDefaultId)
            return;
        owned[normalizedDefaultId] = true;
    });
    return owned;
}
function resolveOwnedValueFromSource(source, config) {
    const sourceRef = (source && typeof source === 'object') ? source : {};
    const safeConfig = (config && typeof config === 'object') ? config : null;
    const sourceKeys = safeConfig && Array.isArray(safeConfig.sourceKeys) ? safeConfig.sourceKeys : [];
    for (let index = 0; index < sourceKeys.length; index += 1) {
        const key = sourceKeys[index];
        if (Object.prototype.hasOwnProperty.call(sourceRef, key)) {
            return sourceRef[key];
        }
    }
    return null;
}
function createDefaultState() {
    const state = {
        version: STATE_VERSION,
        observationStones: 0,
        totalPullCount: 0,
        totalObservationEarned: 0
    };
    OWNED_KIND_ORDER.forEach((kind) => {
        const config = OWNED_KIND_CONFIG[kind];
        state[config.stateKey] = normalizeOwnedIds(null, config.defaultIds);
    });
    return state;
}
function normalizeState(rawState) {
    const source = (rawState && typeof rawState === 'object') ? rawState : {};
    const normalized = {
        version: STATE_VERSION,
        observationStones: toNonNegativeInteger(source.observationStones, 0),
        totalPullCount: toNonNegativeInteger(source.totalPullCount, 0),
        totalObservationEarned: toNonNegativeInteger(source.totalObservationEarned, 0)
    };
    OWNED_KIND_ORDER.forEach((kind) => {
        const config = OWNED_KIND_CONFIG[kind];
        normalized[config.stateKey] = normalizeOwnedIds(resolveOwnedValueFromSource(source, config), config.defaultIds);
    });
    return normalized;
}
function resolveStorage(rootRef) {
    try {
        if (rootRef && rootRef.localStorage)
            return rootRef.localStorage;
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof localStorage !== 'undefined' && localStorage)
            return localStorage;
    }
    catch (e) { /* ignore */ }
    return null;
}
function readState(rootRef) {
    const storage = resolveStorage(rootRef);
    if (!storage)
        return createDefaultState();
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw)
            return createDefaultState();
        return normalizeState(JSON.parse(raw));
    }
    catch (e) {
        return createDefaultState();
    }
}
function writeState(rootRef, nextState) {
    const normalized = normalizeState(nextState);
    const storage = resolveStorage(rootRef);
    if (!storage)
        return normalized;
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    catch (e) { /* ignore */ }
    return normalized;
}
function getObservationStones(rootRef) {
    return readState(rootRef).observationStones;
}
function listOwnedIds(rootRef, kind) {
    const config = getOwnedKindConfig(kind);
    if (!config)
        return [];
    const state = readState(rootRef);
    return Object.keys(state[config.stateKey]).filter((itemId) => state[config.stateKey][itemId] === true);
}
function listOwnedHandSkinIds(rootRef) {
    return listOwnedIds(rootRef, 'hand_skin');
}
function listOwnedPlacementSoundIds(rootRef) {
    return listOwnedIds(rootRef, 'placement_sound');
}
function listOwnedBackgroundSkinIds(rootRef) {
    return listOwnedIds(rootRef, 'background_skin');
}
function isOwnedId(rootRef, kind, itemId) {
    const config = getOwnedKindConfig(kind);
    if (!config)
        return false;
    const normalized = normalizeOwnedCatalogItemId(itemId);
    if (!normalized)
        return false;
    const state = readState(rootRef);
    return state[config.stateKey][normalized] === true;
}
function isHandSkinOwned(rootRef, skinId) {
    return isOwnedId(rootRef, 'hand_skin', skinId);
}
function isPlacementSoundOwned(rootRef, soundId) {
    return isOwnedId(rootRef, 'placement_sound', soundId);
}
function isBackgroundSkinOwned(rootRef, skinId) {
    return isOwnedId(rootRef, 'background_skin', skinId);
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
function unlockOwnedIds(rootRef, kind, itemIds) {
    const config = getOwnedKindConfig(kind);
    if (!config) {
        return {
            state: readState(rootRef),
            newlyUnlockedIds: [],
            alreadyOwnedIds: []
        };
    }
    const state = readState(rootRef);
    const newlyUnlockedIds = [];
    const alreadyOwnedIds = [];
    const ownedRecord = state[config.stateKey];
    (Array.isArray(itemIds) ? itemIds : []).forEach((itemId) => {
        const normalized = normalizeOwnedCatalogItemId(itemId);
        if (!normalized)
            return;
        if (ownedRecord[normalized] === true) {
            alreadyOwnedIds.push(normalized);
            return;
        }
        ownedRecord[normalized] = true;
        newlyUnlockedIds.push(normalized);
    });
    return {
        state: writeState(rootRef, state),
        newlyUnlockedIds,
        alreadyOwnedIds
    };
}
function unlockHandSkinIds(rootRef, skinIds) {
    return unlockOwnedIds(rootRef, 'hand_skin', skinIds);
}
function unlockPlacementSoundIds(rootRef, soundIds) {
    return unlockOwnedIds(rootRef, 'placement_sound', soundIds);
}
function unlockBackgroundSkinIds(rootRef, skinIds) {
    return unlockOwnedIds(rootRef, 'background_skin', skinIds);
}
function resolveOwnedRecordForKind(state, kind) {
    const config = getOwnedKindConfig(kind);
    return config
        ? {
            ownedRecord: state[config.stateKey],
            normalizeId: normalizeOwnedCatalogItemId
        }
        : null;
}
function applyPullResults(rootRef, pulls) {
    const state = readState(rootRef);
    const newlyUnlockedIds = [];
    const alreadyOwnedIds = [];
    const safePulls = Array.isArray(pulls) ? pulls : [];
    state.totalPullCount += safePulls.length;
    safePulls.forEach((pull) => {
        const item = pull && pull.item && typeof pull.item === 'object' ? pull.item : null;
        const kind = normalizeCatalogItemKind(item && item.kind);
        const candidateId = pull && pull.item ? pull.item.id : pull && pull.id;
        const target = resolveOwnedRecordForKind(state, kind);
        if (!target) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[gacha-progress] ignored pull result for unknown cosmetic kind', kind, candidateId);
            }
            return;
        }
        const normalized = target.normalizeId(candidateId);
        if (!normalized)
            return;
        const targetOwned = target.ownedRecord;
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
const GachaProgressStorage = {
    STORAGE_KEY,
    STATE_VERSION,
    DEFAULT_OWNED_HAND_SKIN_IDS,
    DEFAULT_OWNED_BACKGROUND_SKIN_IDS,
    createDefaultState,
    normalizeState,
    readState,
    writeState,
    getObservationStones,
    listOwnedHandSkinIds,
    listOwnedBackgroundSkinIds,
    listOwnedPlacementSoundIds,
    isHandSkinOwned,
    isBackgroundSkinOwned,
    isPlacementSoundOwned,
    awardObservationStones,
    spendObservationStones,
    unlockHandSkinIds,
    unlockBackgroundSkinIds,
    unlockPlacementSoundIds,
    applyPullResults
};
module.exports = GachaProgressStorage;
//# sourceMappingURL=gacha-progress.js.map