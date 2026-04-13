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

    const HAND_SKIN_STORAGE_KEY = 'othello.handSkin';
    let OwnerHelpersModule = null;
    if (typeof require === 'function') {
        try {
            OwnerHelpersModule = require('../../utils/owner-helpers.js');
        } catch (e) { /* ignore */ }
    }
    if (!OwnerHelpersModule) {
        try {
            if (typeof globalThis !== 'undefined' && globalThis.OwnerHelpers) OwnerHelpersModule = globalThis.OwnerHelpers;
        } catch (e) { /* ignore */ }
    }
    const BASE_HAND_SKINS = Object.freeze([
        Object.freeze({
            id: 'default',
            label: '勇者の手',
            note: '初期所持',
            imagePath: 'assets/images/hand-skin/勇者の手.png'
        })
    ]);
    const CPU_HAND_SKINS = Object.freeze([
        Object.freeze({
            id: 'cpu-lv1-2',
            label: 'CPU Lv1-2',
            note: 'CPU 固定',
            imagePath: 'assets/images/hand-skin/lv1-2.png'
        }),
        Object.freeze({
            id: 'cpu-lv3-5',
            label: 'CPU Lv3-5',
            note: 'CPU 固定',
            imagePath: 'assets/images/hand-skin/lv3-5.png'
        }),
        Object.freeze({
            id: 'cpu-lv4',
            label: 'CPU Lv4',
            note: 'CPU 固定',
            imagePath: 'assets/images/hand-skin/lv4.png'
        }),
        Object.freeze({
            id: 'cpu-lv6',
            label: 'CPU Lv6',
            note: 'CPU 固定',
            imagePath: 'assets/images/hand-skin/lv6.png'
        })
    ]);
    const CPU_HAND_SKIN_BY_ID = Object.freeze(CPU_HAND_SKINS.reduce((acc, skin) => {
        acc[skin.id] = skin;
        return acc;
    }, {}));
    const CPU_HAND_SKIN_BY_LEVEL = Object.freeze({
        1: 'cpu-lv1-2',
        2: 'cpu-lv1-2',
        3: 'cpu-lv3-5',
        4: 'cpu-lv4',
        5: 'cpu-lv3-5',
        6: 'cpu-lv6'
    });
    const DEFAULT_HAND_SKIN_ID = BASE_HAND_SKINS[0].id;

    function resolveDocument(rootRef) {
        if (rootRef && rootRef.document) return rootRef.document;
        if (typeof document !== 'undefined') return document;
        return null;
    }

    function canUseStorage(rootRef) {
        try {
            return !!(rootRef && rootRef.localStorage);
        } catch (e) {
            return false;
        }
    }

    function resolveGachaCatalogModule() {
        if (typeof require === 'function') {
            try {
                return require('../../shared/gacha-hand-catalog.generated.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaHandCatalogModule) return globalThis.GachaHandCatalogModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaProgressStorageModule() {
        if (typeof require === 'function') {
            try {
                return require('../storage/gacha-progress.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaProgressStorage) return globalThis.GachaProgressStorage;
        } catch (e) { /* ignore */ }
        return null;
    }

    function readLoadedAssetManifest(rootRef, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.assetManifest && typeof opts.assetManifest === 'object') {
            return opts.assetManifest;
        }

        const uiBootstrap = opts.uiBootstrap || resolveUIBootstrapModule();
        if (uiBootstrap && typeof uiBootstrap.getLoadedAssetManifest === 'function') {
            try {
                const manifest = uiBootstrap.getLoadedAssetManifest();
                if (manifest && typeof manifest === 'object' && Array.isArray(manifest.files)) {
                    return manifest;
                }
            } catch (e) { /* ignore */ }
        }

        const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
        if (ctx && ctx.UIBootstrap && typeof ctx.UIBootstrap.getLoadedAssetManifest === 'function') {
            try {
                const manifest = ctx.UIBootstrap.getLoadedAssetManifest();
                if (manifest && typeof manifest === 'object' && Array.isArray(manifest.files)) {
                    return manifest;
                }
            } catch (e) { /* ignore */ }
        }

        return null;
    }

    function buildHandSkinDefinitions(items) {
        return (Array.isArray(items) ? items : [])
            .map((item) => {
                if (!item || typeof item !== 'object') return null;
                const id = normalizeCatalogHandSkinId(item.id);
                const label = String(item.label || '').trim();
                const imagePath = String(item.imagePath || '').trim();
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

    function buildGeneratedHandSkins() {
        const catalogModule = resolveGachaCatalogModule();
        const items = Array.isArray(catalogModule && catalogModule.items) ? catalogModule.items : [];
        return buildHandSkinDefinitions(items);
    }

    function buildManifestHandSkins(rootRef, options) {
        const manifest = readLoadedAssetManifest(rootRef, options);
        const catalogSharedModule = resolveGachaCatalogSharedModule();
        if (!manifest || !catalogSharedModule || typeof catalogSharedModule.buildCatalogFromAssetManifest !== 'function') {
            return [];
        }
        const catalog = catalogSharedModule.buildCatalogFromAssetManifest(manifest, {
            generatedAt: manifest.generatedAt || manifest.version || null
        });
        return buildHandSkinDefinitions(catalog && catalog.items);
    }

    function getDynamicHandSkins(rootRef, options) {
        const manifestHandSkins = buildManifestHandSkins(rootRef, options);
        if (manifestHandSkins.length) return manifestHandSkins;
        return buildGeneratedHandSkins();
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
        const normalizedId = normalizeCatalogHandSkinId(skinId);
        if (!normalizedId) return null;
        return getAllHandSkins(rootRef, options).find((skin) => skin.id === normalizedId) || null;
    }

    function normalizeKnownHandSkinId(value, rootRef, options) {
        const definition = getKnownHandSkinDefinition(value, rootRef, options);
        return definition ? definition.id : DEFAULT_HAND_SKIN_ID;
    }

    function clampCpuLevel(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 1;
        return Math.max(1, Math.min(6, Math.floor(n)));
    }

    function resolveRootRef(rootRef) {
        if (rootRef && typeof rootRef === 'object') return rootRef;
        try {
            if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveRegisteredUIGlobal(rootRef, key) {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey) return null;
        const candidates = [];
        const pushCandidate = (candidate) => {
            if (!candidate || typeof candidate.getRegisteredUIGlobals !== 'function') return;
            if (candidates.indexOf(candidate) >= 0) return;
            candidates.push(candidate);
        };
        const ctx = resolveRootRef(rootRef);
        if (ctx && typeof ctx === 'object') {
            pushCandidate(ctx.UIBootstrap);
            pushCandidate(ctx.SharedUIBootstrap);
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis === 'object') {
                pushCandidate(globalThis.UIBootstrap);
                pushCandidate(globalThis.SharedUIBootstrap);
            }
        } catch (e) { /* ignore */ }
        for (let index = 0; index < candidates.length; index += 1) {
            try {
                const registry = candidates[index].getRegisteredUIGlobals();
                if (registry && typeof registry === 'object' && Object.prototype.hasOwnProperty.call(registry, normalizedKey)) {
                    return registry[normalizedKey];
                }
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveGachaCatalogSharedModule() {
        if (typeof require === 'function') {
            try {
                return require('../../shared/gacha-hand-catalog-shared.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaHandCatalogSharedModule) return globalThis.GachaHandCatalogSharedModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function normalizeCatalogHandSkinId(value) {
        const normalized = String(value || '').trim();
        if (!normalized) return '';
        const catalogSharedModule = resolveGachaCatalogSharedModule();
        if (catalogSharedModule && typeof catalogSharedModule.normalizeCatalogItemId === 'function') {
            return catalogSharedModule.normalizeCatalogItemId(normalized);
        }
        return normalized;
    }

    function resolveUIBootstrapModule() {
        if (typeof require === 'function') {
            try {
                return require('../bootstrap.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.UIBootstrap) return globalThis.UIBootstrap;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveGachaEventsModule() {
        if (typeof require === 'function') {
            try {
                return require('../gacha/gacha-events.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.GachaEventsModule) return globalThis.GachaEventsModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveStateObject(rootRef, key) {
        const ctx = resolveRootRef(rootRef);
        if (ctx && ctx[key] && typeof ctx[key] === 'object') return ctx[key];
        const registered = resolveRegisteredUIGlobal(rootRef, key);
        if (registered && typeof registered === 'object') return registered;
        try {
            if (typeof globalThis !== 'undefined' && globalThis[key] && typeof globalThis[key] === 'object') {
                return globalThis[key];
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function normalizeOwnerKey(value) {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            const normalized = OwnerHelpersModule.normalizePlayerKeyOptional(value);
            if (normalized) return normalized;
        }
        if (value === -1 || value === '-1' || value === 'white') return 'white';
        if (value === 1 || value === '1' || value === 'black') return 'black';
        return null;
    }

    function resolveCurrentTurnControllerKey(rootRef, turnOwnerKey) {
        if (!turnOwnerKey) return null;
        const cardState = resolveStateObject(rootRef, 'cardState');
        if (!cardState) return null;
        if (OwnerHelpersModule && typeof OwnerHelpersModule.getFateWillControllerForTurnOwner === 'function') {
            return OwnerHelpersModule.getFateWillControllerForTurnOwner(cardState, turnOwnerKey);
        }
        const controllerMap = (cardState.fateWillControllerByTurnOwner && typeof cardState.fateWillControllerByTurnOwner === 'object')
            ? cardState.fateWillControllerByTurnOwner
            : null;
        if (!controllerMap) return null;
        const rawController = controllerMap[turnOwnerKey];
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            return OwnerHelpersModule.normalizePlayerKeyOptional(rawController);
        }
        return rawController === 'white' ? 'white' : (rawController === 'black' ? 'black' : null);
    }

    function resolveLocalPlayerKey(rootRef) {
        if (!isNetworkMode(rootRef)) {
            return 'black';
        }
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return OwnerHelpersModule.resolveLocalPlayerKey(resolveRootRef(rootRef));
        }
        return 'black';
    }

    function resolveNetworkMatchClient(rootRef) {
        const ctx = resolveRootRef(rootRef);
        if (ctx && ctx.NetworkMatchClient && typeof ctx.NetworkMatchClient === 'object') {
            return ctx.NetworkMatchClient;
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkMatchClient) {
                return globalThis.NetworkMatchClient;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveNetworkSeatHandSkins(rootRef) {
        const client = resolveNetworkMatchClient(rootRef);
        if (!client || typeof client.getSeatHandSkins !== 'function') {
            return { black: '', white: '' };
        }
        try {
            return client.getSeatHandSkins();
        } catch (e) { /* ignore */ }
        return { black: '', white: '' };
    }

    function isNetworkMode(rootRef) {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function') {
            return !!OwnerHelpersModule.isNetworkMode(resolveRootRef(rootRef));
        }
        const ctx = resolveRootRef(rootRef);
        return !!(ctx && (ctx.MATCH_MODE === 'network' || ctx.__MATCH_MODE === 'network'));
    }

    function isDebugHumanVsHumanEnabled(rootRef) {
        const ctx = resolveRootRef(rootRef);
        return !!(ctx && ctx.DEBUG_HUMAN_VS_HUMAN === true);
    }

    function isOwnerOnBottomSlot(rootRef, ownerKey) {
        const normalizedOwnerKey = normalizeOwnerKey(ownerKey) || 'black';
        const docRef = resolveDocument(resolveRootRef(rootRef));
        if (!docRef) return normalizedOwnerKey === 'black';
        const bottomEl = docRef.getElementById('hand-black');
        const topEl = docRef.getElementById('hand-white');
        const bottomOwnerKey = normalizeOwnerKey(bottomEl && bottomEl.dataset ? bottomEl.dataset.ownerKey : null) || 'black';
        const topOwnerKey = normalizeOwnerKey(topEl && topEl.dataset ? topEl.dataset.ownerKey : null) || 'white';
        if (bottomOwnerKey === normalizedOwnerKey) return true;
        if (topOwnerKey === normalizedOwnerKey) return false;
        return normalizedOwnerKey === 'black';
    }

    function resolveCpuLevel(rootRef, ownerKey, explicitLevel) {
        if (Number.isFinite(Number(explicitLevel))) {
            return clampCpuLevel(explicitLevel);
        }
        const normalizedOwnerKey = normalizeOwnerKey(ownerKey) || 'white';
        const smartness = resolveCpuSmartnessState(rootRef);
        const level = smartness && Object.prototype.hasOwnProperty.call(smartness, normalizedOwnerKey)
            ? smartness[normalizedOwnerKey]
            : 1;
        return clampCpuLevel(level);
    }

    function resolveCpuLevelFromSelect(rootRef, ownerKey) {
        const normalizedOwnerKey = normalizeOwnerKey(ownerKey) || 'white';
        const docRef = resolveDocument(resolveRootRef(rootRef));
        if (!docRef || typeof docRef.getElementById !== 'function') return null;
        const selectId = normalizedOwnerKey === 'black' ? 'smartBlack' : 'smartWhite';
        const selectEl = docRef.getElementById(selectId);
        if (!selectEl) return null;
        const rawValue = typeof selectEl.value === 'string' ? selectEl.value.trim() : String(selectEl.value || '').trim();
        if (!rawValue) return null;
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return null;
        return clampCpuLevel(value);
    }

    function resolveCpuSmartnessState(rootRef) {
        const smartness = resolveStateObject(rootRef, 'cpuSmartness');
        if (smartness && typeof smartness === 'object') return smartness;
        const blackLevel = resolveCpuLevelFromSelect(rootRef, 'black');
        const whiteLevel = resolveCpuLevelFromSelect(rootRef, 'white');
        if (!Number.isFinite(blackLevel) && !Number.isFinite(whiteLevel)) return null;
        return {
            black: Number.isFinite(blackLevel) ? blackLevel : 1,
            white: Number.isFinite(whiteLevel) ? whiteLevel : 1
        };
    }

    function isCpuMatchMode(rootRef) {
        const ctx = resolveRootRef(rootRef);
        const rawMode = ctx && (ctx.MATCH_MODE || ctx.__MATCH_MODE);
        return String(rawMode || '').trim().toLowerCase() === 'cpu';
    }

    function getCpuHandSkinDefinition(level) {
        const normalizedLevel = clampCpuLevel(level);
        const id = CPU_HAND_SKIN_BY_LEVEL[normalizedLevel] || CPU_HAND_SKIN_BY_LEVEL[1];
        return CPU_HAND_SKIN_BY_ID[id] || CPU_HAND_SKIN_BY_ID['cpu-lv1-2'];
    }

    function shouldUseCpuHandSkin(rootRef, ownerKey) {
        if (isNetworkMode(rootRef) || isDebugHumanVsHumanEnabled(rootRef)) return false;
        const normalizedOwnerKey = normalizeOwnerKey(ownerKey) || 'white';
        const smartness = resolveCpuSmartnessState(rootRef);
        const hasCpuConfig = !!(smartness && typeof smartness === 'object');
        const ctx = resolveRootRef(rootRef);
        const autoModeActive = !!(ctx && ctx.AUTO_MODE_ACTIVE === true);
        const cpuMatchMode = isCpuMatchMode(rootRef);
        if (isOwnerOnBottomSlot(rootRef, normalizedOwnerKey) === false) {
            return hasCpuConfig || cpuMatchMode || autoModeActive;
        }
        if (normalizedOwnerKey === 'black') {
            return autoModeActive;
        }
        if (normalizedOwnerKey !== 'white') return false;
        const controllerKey = resolveCurrentTurnControllerKey(rootRef, normalizedOwnerKey);
        const localPlayerKey = resolveLocalPlayerKey(rootRef);
        if (controllerKey && controllerKey === localPlayerKey) return false;
        return hasCpuConfig || cpuMatchMode;
    }

    function resolveHandVisualOptions(rootRef, ownerKey, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const normalizedOwnerKey = normalizeOwnerKey(ownerKey);
        if (!normalizedOwnerKey) {
            return { ownerKey: null, cpu: false, cpuLevel: null };
        }
        if (opts.forceCpu === true) {
            return {
                ownerKey: normalizedOwnerKey,
                cpu: true,
                cpuLevel: resolveCpuLevel(rootRef, normalizedOwnerKey, opts.cpuLevel)
            };
        }
        if (shouldUseCpuHandSkin(rootRef, normalizedOwnerKey)) {
            return {
                ownerKey: normalizedOwnerKey,
                cpu: true,
                cpuLevel: resolveCpuLevel(rootRef, normalizedOwnerKey, opts.cpuLevel)
            };
        }
        return {
            ownerKey: normalizedOwnerKey,
            cpu: false,
            cpuLevel: null
        };
    }

    function resolveHandAnimationContext(rootRef, preferredSkinId, options) {
        const ctx = resolveRootRef(rootRef);
        const opts = (options && typeof options === 'object') ? options : {};
        const explicitOwnerKey = normalizeOwnerKey(opts.ownerKey);
        const ownerKey = explicitOwnerKey || (
            isNetworkMode(ctx)
                ? resolveLocalPlayerKey(ctx)
                : (shouldUseCpuHandSkin(ctx, 'white') ? 'white' : 'black')
        );
        const visual = resolveHandVisualOptions(ctx, ownerKey, Object.assign({}, opts, {
            forceCpu: opts.forceCpu === true || opts.cpu === true
        }));
        const localSelectedSkinId = normalizeHandSkinId(preferredSkinId || readStoredHandSkinId(ctx), ctx);
        const isRemoteNetworkSeat = (
            visual.cpu !== true
            && isNetworkMode(ctx)
            && visual.ownerKey
            && visual.ownerKey !== resolveLocalPlayerKey(ctx)
        );
        const seatHandSkins = isRemoteNetworkSeat ? resolveNetworkSeatHandSkins(ctx) : null;
        const selectedSkinId = isRemoteNetworkSeat
            ? normalizeHandSkinId(seatHandSkins && seatHandSkins[visual.ownerKey], null, { allowUnowned: true })
            : localSelectedSkinId;
        const renderedDefinition = visual.cpu
            ? getCpuHandSkinDefinition(visual.cpuLevel)
            : getHandSkinDefinition(selectedSkinId, ctx, { allowUnowned: isRemoteNetworkSeat });
        return {
            ownerKey: visual.ownerKey,
            cpu: visual.cpu === true,
            cpuLevel: visual.cpu === true ? visual.cpuLevel : null,
            selectedSkinId,
            renderedSkinId: renderedDefinition.id,
            renderedImagePath: renderedDefinition.imagePath,
            renderedDefinition
        };
    }

    function resolveDisplayedHandDefinition(skinId, rootRef, options) {
        return resolveHandAnimationContext(rootRef, skinId, options).renderedDefinition;
    }

    function listOwnedHandSkinIds(rootRef) {
        const storageModule = resolveGachaProgressStorageModule();
        if (storageModule && typeof storageModule.listOwnedHandSkinIds === 'function') {
            const owned = storageModule.listOwnedHandSkinIds(rootRef);
            if (Array.isArray(owned) && owned.length) return owned;
        }
        return getBaseHandSkinIds();
    }

    function isHandSkinOwned(rootRef, skinId) {
        const normalized = normalizeCatalogHandSkinId(skinId);
        if (!normalized) return false;

        const storageModule = resolveGachaProgressStorageModule();
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

    function readStoredHandSkinId(rootRef) {
        if (!canUseStorage(rootRef)) return DEFAULT_HAND_SKIN_ID;
        try {
            return normalizeHandSkinId(rootRef.localStorage.getItem(HAND_SKIN_STORAGE_KEY), rootRef);
        } catch (e) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[hand-skin] failed to read storage', e);
            }
            return DEFAULT_HAND_SKIN_ID;
        }
    }

    function writeStoredHandSkinId(rootRef, skinId) {
        if (!canUseStorage(rootRef)) return false;
        const definition = getHandSkinDefinition(skinId, rootRef);
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

    function applyHandSkin(handImageEl, skinId, rootRef) {
        if (!handImageEl) return null;
        const definition = getHandSkinDefinition(skinId, rootRef);
        handImageEl.setAttribute('src', definition.imagePath);
        handImageEl.setAttribute('data-hand-skin-id', definition.id);
        handImageEl.setAttribute('data-hand-selected-skin-id', definition.id);
        return definition;
    }

    function syncDisplayedHandSkin(rootRef, preferredSkinId, handImageEl, options) {
        const ctx = resolveRootRef(rootRef);
        const docRef = resolveDocument(ctx);
        const imageEl = handImageEl || (docRef ? docRef.getElementById('handImage') : null);
        if (!imageEl) return null;
        const handContext = resolveHandAnimationContext(ctx, preferredSkinId, options);
        imageEl.setAttribute('src', handContext.renderedImagePath);
        imageEl.setAttribute('data-hand-skin-id', handContext.renderedSkinId);
        imageEl.setAttribute('data-hand-selected-skin-id', handContext.selectedSkinId);
        return handContext.renderedDefinition;
    }

    function createOptionButton(docRef, skin) {
        const button = docRef.createElement('button');
        button.type = 'button';
        button.className = 'hand-skin-option';
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', 'false');
        button.setAttribute('data-hand-skin-id', skin.id);
        button.setAttribute('aria-label', `手の見た目 ${skin.label}`);

        const preview = docRef.createElement('img');
        preview.className = 'hand-skin-option-preview';
        preview.src = skin.imagePath;
        preview.alt = '';
        preview.loading = 'lazy';
        preview.decoding = 'async';
        preview.draggable = false;
        button.appendChild(preview);

        const copy = docRef.createElement('span');
        copy.className = 'hand-skin-option-copy';

        const label = docRef.createElement('span');
        label.className = 'hand-skin-option-label';
        label.textContent = skin.label;
        copy.appendChild(label);

        const note = docRef.createElement('span');
        note.className = 'hand-skin-option-note';
        note.textContent = skin.note;
        copy.appendChild(note);

        button.appendChild(copy);
        return button;
    }

    function setupHandSkinControls(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
        const docRef = opts.document || resolveDocument(rootRef);
        const uiBootstrap = resolveUIBootstrapModule();
        const assetManifestUpdatedEventName = (
            uiBootstrap && typeof uiBootstrap.ASSET_MANIFEST_UPDATED_EVENT === 'string' && uiBootstrap.ASSET_MANIFEST_UPDATED_EVENT
        ) || 'asset-manifest:updated';
        if (!docRef) return null;

        const button = opts.button || docRef.getElementById('handSkinBtn');
        const panel = opts.panel || docRef.getElementById('handSkinPanel');
        const closeBtn = opts.closeBtn || docRef.getElementById('handSkinCloseBtn');
        const optionsEl = opts.optionsEl || docRef.getElementById('handSkinOptions');
        const handImageEl = opts.handImage || docRef.getElementById('handImage');
        if (!button || !panel || !optionsEl || !handImageEl) return null;

        let isOpen = false;
        let selectedSkin = null;

        function syncButtonLabel() {
            const label = selectedSkin ? selectedSkin.label : getHandSkinDefinition(DEFAULT_HAND_SKIN_ID, rootRef).label;
            button.title = `手の見た目: ${label}`;
            button.setAttribute('aria-label', `手の見た目設定（現在: ${label}）`);
        }

        function syncOptionState() {
            const optionButtons = Array.from(optionsEl.querySelectorAll('.hand-skin-option'));
            optionButtons.forEach((optionButton) => {
                const active = !!(selectedSkin && optionButton.getAttribute('data-hand-skin-id') === selectedSkin.id);
                optionButton.classList.toggle('is-selected', active);
                optionButton.setAttribute('aria-checked', active ? 'true' : 'false');
            });
        }

        function applySelection(skinId, persist) {
            const definition = getHandSkinDefinition(skinId, rootRef);
            if (!definition) return null;
            selectedSkin = definition;
            syncDisplayedHandSkin(rootRef, definition.id, handImageEl);
            syncOptionState();
            syncButtonLabel();
            if (persist === true) {
                writeStoredHandSkinId(rootRef, definition.id);
                const networkClient = resolveNetworkMatchClient(rootRef);
                if (
                    isNetworkMode(rootRef)
                    && networkClient
                    && typeof networkClient.updateHandSkin === 'function'
                ) {
                    try {
                        const result = networkClient.updateHandSkin(definition.id);
                        if (result && typeof result.then === 'function') {
                            result.catch(function (error) {
                                if (typeof console !== 'undefined' && console.warn) {
                                    console.warn('[hand-skin] failed to sync network hand skin', error);
                                }
                            });
                        }
                    } catch (error) {
                        if (typeof console !== 'undefined' && console.warn) {
                            console.warn('[hand-skin] failed to sync network hand skin', error);
                        }
                    }
                }
            }
            return definition;
        }

        function renderOptions() {
            optionsEl.innerHTML = '';
            getOwnedHandSkins(rootRef).forEach((skin) => {
                const optionButton = createOptionButton(docRef, skin);
                optionButton.addEventListener('click', function (event) {
                    if (event && typeof event.preventDefault === 'function') event.preventDefault();
                    applySelection(skin.id, true);
                });
                optionsEl.appendChild(optionButton);
            });
        }

        function refreshOptions(preferredSkinId) {
            renderOptions();
            const nextSkinId = normalizeHandSkinId(preferredSkinId || (selectedSkin && selectedSkin.id) || readStoredHandSkinId(rootRef), rootRef);
            applySelection(nextSkinId, false);
        }

        function openPanel() {
            refreshOptions(selectedSkin && selectedSkin.id);
            isOpen = true;
            panel.classList.add('is-open');
            panel.setAttribute('aria-hidden', 'false');
            button.setAttribute('aria-expanded', 'true');
        }

        function closePanel() {
            isOpen = false;
            panel.classList.remove('is-open');
            panel.setAttribute('aria-hidden', 'true');
            button.setAttribute('aria-expanded', 'false');
        }

        button.addEventListener('click', function (event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (isOpen) {
                closePanel();
            } else {
                openPanel();
            }
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', function (event) {
                if (event && typeof event.preventDefault === 'function') event.preventDefault();
                closePanel();
            });
        }

        docRef.addEventListener('pointerdown', function (event) {
            if (!isOpen) return;
            const target = event ? event.target : null;
            if (!target) return;
            if (panel.contains(target) || button.contains(target)) return;
            closePanel();
        }, true);

        docRef.addEventListener('keydown', function (event) {
            if (!isOpen || !event || event.key !== 'Escape') return;
            closePanel();
        });

        const gachaEventsModule = resolveGachaEventsModule();
        if (gachaEventsModule && typeof gachaEventsModule.addGachaInventoryUpdatedListener === 'function') {
            gachaEventsModule.addGachaInventoryUpdatedListener(rootRef, function () {
                refreshOptions(selectedSkin && selectedSkin.id);
            });
        } else if (rootRef && typeof rootRef.addEventListener === 'function') {
            rootRef.addEventListener('gacha:inventory-updated', function () {
                refreshOptions(selectedSkin && selectedSkin.id);
            });
        }

        if (rootRef && typeof rootRef.addEventListener === 'function') {
            rootRef.addEventListener(assetManifestUpdatedEventName, function () {
                refreshOptions(readStoredHandSkinId(rootRef));
            });
        }

        refreshOptions(readStoredHandSkinId(rootRef));
        closePanel();

        return {
            closePanel,
            openPanel,
            refreshOptions,
            getSelectedSkinId: function () {
                return selectedSkin ? selectedSkin.id : DEFAULT_HAND_SKIN_ID;
            },
            syncDisplayedSkin: function () {
                return syncDisplayedHandSkin(rootRef, selectedSkin ? selectedSkin.id : DEFAULT_HAND_SKIN_ID, handImageEl);
            },
            selectSkin: function (skinId) {
                return applySelection(skinId, true);
            }
        };
    }

    return {
        BASE_HAND_SKINS,
        HAND_SKINS,
        DEFAULT_HAND_SKIN_ID,
        HAND_SKIN_STORAGE_KEY,
        getAllHandSkins,
        applyHandSkin,
        resolveHandAnimationContext,
        resolveHandVisualOptions,
        syncDisplayedHandSkin,
        normalizeHandSkinId,
        readStoredHandSkinId,
        setupHandSkinControls
    };
}));
