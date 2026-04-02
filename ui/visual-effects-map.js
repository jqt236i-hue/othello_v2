// UI implementation for visual-effects-map
// This file contains DOM-manipulating visual helpers intended to run in the browser UI.
function shouldLogVisualEffectsBootstrap() {
    try {
        if (typeof window !== 'undefined' && window) {
            if (window.DEBUG_WORK_VISUALS === true || window.DEBUG_MODE_ALLOWED === true) return true;
        }
    } catch (e) { /* ignore */ }
    try {
        const qs = (typeof location !== 'undefined' && location && typeof location.search === 'string')
            ? location.search
            : '';
        return /[?&]debug=(?:1|true)\b/i.test(qs);
    } catch (e) { /* ignore */ }
    return false;
}

if (shouldLogVisualEffectsBootstrap() && typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log('[VISUAL_EFFECTS] ui/visual-effects-map.js loaded');
}

// Single source: consume maps from game/visual-effects-map.js (globals or require)
function getSharedVisualEffectsMap() {
    try {
        if (typeof window !== 'undefined' && window.GameVisualEffectsMap && window.GameVisualEffectsMap.STONE_VISUAL_EFFECTS) {
            return window.GameVisualEffectsMap;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof require === 'function') {
            const mod = require('../game/visual-effects-map');
            if (mod && mod.STONE_VISUAL_EFFECTS) return mod;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.STONE_VISUAL_EFFECTS) {
            return { STONE_VISUAL_EFFECTS: window.STONE_VISUAL_EFFECTS };
        }
    } catch (e) { /* ignore */ }
    return { STONE_VISUAL_EFFECTS: {} };
}

const SHARED_MAP = getSharedVisualEffectsMap();
function getUiStoneVisualEffects() {
    const map = getSharedVisualEffectsMap();
    return (map && map.STONE_VISUAL_EFFECTS) ? map.STONE_VISUAL_EFFECTS : {};
}

function getUiPendingTypeToEffectKey() {
    const map = getSharedVisualEffectsMap();
    return (map && map.PENDING_TYPE_TO_EFFECT_KEY) ? map.PENDING_TYPE_TO_EFFECT_KEY : {};
}

function getUiSpecialTypeToEffectKey() {
    const map = getSharedVisualEffectsMap();
    return (map && map.SPECIAL_TYPE_TO_EFFECT_KEY) ? map.SPECIAL_TYPE_TO_EFFECT_KEY : {};
}

function getEffectKeyForPendingType(pendingType) {
    const pendingMap = getUiPendingTypeToEffectKey();
    return pendingMap[pendingType] || null;
}

function getEffectKeyForSpecialType(type) {
    const specialMap = getUiSpecialTypeToEffectKey();
    return specialMap[type] || null;
} 

function normalizeOwnerValue(owner) {
    if (owner === 1 || owner === '1' || owner === 'black') return 1;
    if (owner === -1 || owner === '-1' || owner === 'white') return -1;
    const n = Number(owner);
    if (Number.isFinite(n) && (n === 1 || n === -1)) return n;
    return 1;
}

var DiscRenderHelpersModule = null;
if (typeof require === 'function') {
    try { DiscRenderHelpersModule = require('./board-renderer'); } catch (e) { /* ignore */ }
}

function getDiscRenderHelper(name) {
    if (DiscRenderHelpersModule && typeof DiscRenderHelpersModule[name] === 'function') {
        return DiscRenderHelpersModule[name];
    }
    try {
        if (typeof window !== 'undefined' && typeof window[name] === 'function') {
            return window[name];
        }
    } catch (e) { /* ignore */ }
    return null;
}

function normalizeOwnerKey(owner) {
    if (owner === undefined || owner === null) return null;
    if (owner === 1 || owner === '1' || owner === 'black') return '1';
    if (owner === -1 || owner === '-1' || owner === 'white') return '-1';
    const s = String(owner).trim().toLowerCase();
    if (s === 'black') return '1';
    if (s === 'white') return '-1';
    if (s === '1') return '1';
    if (s === '-1') return '-1';
    return String(owner);
}

function resolveStoneEffectImagePath(effect, options = {}) {
    if (!effect || typeof effect !== 'object') return null;
    if (effect.imagePathByOwner) {
        const ownerKey = normalizeOwnerKey(options.owner);
        return ownerKey ? (effect.imagePathByOwner[ownerKey] || null) : null;
    }
    if (effect.imagePathByPlayer) {
        const playerKey = normalizeOwnerKey(options.player);
        return playerKey ? (effect.imagePathByPlayer[playerKey] || null) : null;
    }
    return effect.imagePath || null;
}

function resolveRenderMode(effect) {
    return (effect && typeof effect.renderMode === 'string' && effect.renderMode)
        ? effect.renderMode
        : 'replace';
}

function resolveOverlayScale(effect) {
    const n = Number(effect && effect.scale);
    return (Number.isFinite(n) && n > 0) ? n : 1;
}

function resolveOwnerClassSuffix(owner) {
    return normalizeOwnerValue(owner) === -1 ? 'white' : 'black';
}

function applyOwnerMetadataForEffect(discElement, effectKey, effect, options = {}) {
    if (!discElement || !effect || !effect.imagePathByOwner || options.owner === undefined) return;
    const ownerSuffix = resolveOwnerClassSuffix(options.owner);
    if (effectKey === 'breedingStone') {
        discElement.classList.remove('breeding-black', 'breeding-white');
        discElement.classList.add(`breeding-${ownerSuffix}`);
        discElement.dataset.breeding = ownerSuffix;
        return;
    }
    discElement.classList.remove('ud-black', 'ud-white');
    discElement.classList.add(`ud-${ownerSuffix}`);
    discElement.dataset.ud = ownerSuffix;
}

function clearOwnerMetadataForEffect(discElement, effectKey) {
    if (!discElement) return;
    if (effectKey === 'breedingStone') {
        discElement.classList.remove('breeding-black', 'breeding-white');
        delete discElement.dataset.breeding;
        return;
    }
    discElement.classList.remove('ud-black', 'ud-white');
    delete discElement.dataset.ud;
}

function getStoneVisualPathsForEffectKey(effectKey) {
    const visualMap = getUiStoneVisualEffects();
    const effect = visualMap[effectKey];
    if (!effect || typeof effect !== 'object') return [];

    const paths = [];
    if (typeof effect.imagePath === 'string' && effect.imagePath) {
        paths.push(effect.imagePath);
    }
    if (effect.imagePathByOwner && typeof effect.imagePathByOwner === 'object') {
        for (const value of Object.values(effect.imagePathByOwner)) {
            if (typeof value === 'string' && value) paths.push(value);
        }
    }
    if (effect.imagePathByPlayer && typeof effect.imagePathByPlayer === 'object') {
        for (const value of Object.values(effect.imagePathByPlayer)) {
            if (typeof value === 'string' && value) paths.push(value);
        }
    }

    return Array.from(new Set(paths));
}

function preloadStoneVisualEffectKeys(effectKeys) {
    const root = (typeof window !== 'undefined' && window)
        ? window
        : ((typeof globalThis !== 'undefined' && globalThis) ? globalThis : null);
    const ImageCtor = root && typeof root.Image === 'function'
        ? root.Image
        : ((typeof Image === 'function') ? Image : null);
    const keys = Array.isArray(effectKeys) ? effectKeys : [effectKeys];
    const paths = Array.from(new Set(
        keys
            .map((key) => String(key || '').trim())
            .filter((key) => !!key)
            .flatMap((key) => getStoneVisualPathsForEffectKey(key))
    ));

    if (!paths.length || !ImageCtor || !root) {
        return { started: [], skipped: paths };
    }

    const cache = root.__preloadedStoneVisualPaths || (root.__preloadedStoneVisualPaths = Object.create(null));
    const imageRefs = root.__preloadedStoneVisualImages || (root.__preloadedStoneVisualImages = Object.create(null));
    const started = [];
    const skipped = [];

    for (const src of paths) {
        const cacheKey = String(src);
        if (cache[cacheKey] === 'started' || cache[cacheKey] === 'loaded') {
            skipped.push(src);
            continue;
        }

        cache[cacheKey] = 'started';
        started.push(src);

        try {
            const img = new ImageCtor();
            imageRefs[cacheKey] = img;
            img.onload = function () {
                cache[cacheKey] = 'loaded';
            };
            img.onerror = function () {
                cache[cacheKey] = 'error';
                try { delete imageRefs[cacheKey]; } catch (e) { /* ignore */ }
            };
            try { img.decoding = 'async'; } catch (e) { /* ignore */ }
            img.src = src;
        } catch (e) {
            cache[cacheKey] = 'error';
        }
    }

    return { started, skipped };
}

/**
 * Robust fallback for trap reveal visuals.
 * Used when normal map application/DI timing fails and we still need the trap icon visible.
 */
function applyTrapStoneFallbackVisual(discElement, owner) {
    try {
        return applyStoneVisualEffect(discElement, 'trapStone', { owner });
    } catch (e) {
        return false;
    }
}

function clearStoneVisualEffectState(discElement, options = {}) {
    if (!discElement) return;

    const visualMap = getUiStoneVisualEffects();
    discElement.classList.remove('special-stone', 'ud-black', 'ud-white', 'breeding-black', 'breeding-white');
    delete discElement.dataset.ud;
    delete discElement.dataset.breeding;

    for (const effect of Object.values(visualMap)) {
        if (!effect || !effect.cssClass) continue;
        discElement.classList.remove(effect.cssClass);
        Object.keys(effect.dataAttributes || {}).forEach((key) => {
            delete discElement.dataset[key];
        });
        Object.keys(effect.clearStyles || {}).forEach((property) => {
            try { discElement.style.removeProperty(property); } catch (e) { /* ignore */ }
        });
    }

    try { discElement.style.removeProperty('--special-stone-image'); } catch (e) { /* ignore */ }
    try { discElement.style.removeProperty('--disc-overlay-image'); } catch (e) { /* ignore */ }
    try { discElement.style.removeProperty('--disc-overlay-scale'); } catch (e) { /* ignore */ }
    try { discElement.style.removeProperty('--dragon-image-path'); } catch (e) { /* ignore */ }
    try { discElement.style.removeProperty('--breeding-image-path'); } catch (e) { /* ignore */ }
    if (options.skipRenderReset) return;

    const applyDiscRenderState = getDiscRenderHelper('applyDiscRenderState');
    const owner = discElement.classList && discElement.classList.contains('white') ? -1 : 1;
    if (applyDiscRenderState) {
        applyDiscRenderState(discElement, {
            owner,
            renderMode: 'base-only',
            effectKey: 'normal'
        });
        return;
    }
    try {
        discElement.dataset.renderMode = 'base-only';
        discElement.dataset.effect = 'normal';
    } catch (e) { /* ignore */ }
}

async function applyStoneVisualEffect(discElement, effectKey, options = {}) {
    const debugVisual = (typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true);
    if (debugVisual) console.log('[VISUAL_DEBUG] applyStoneVisualEffect called', effectKey, options);
    const visualMap = getUiStoneVisualEffects();
    const effect = visualMap[effectKey];
    try { if (!discElement && debugVisual) console.warn('[VISUAL_DEBUG] applyStoneVisualEffect: discElement missing for', effectKey); } catch (e) {}
    try { if (debugVisual) console.log('[VISUAL_DEBUG] effect lookup:', effectKey, effect ? effect.cssClass : null); } catch (e) {}
    if (!effect) {
        console.warn(`[VISUAL_EFFECTS] Unknown effect key: ${effectKey}`);
        return false;
    }

    if (debugVisual && effectKey === 'workStone') {
        console.log('[VISUAL_DEBUG] applyStoneVisualEffect(workStone) called, options:', options, 'effect:', effect);
        try { window._lastApplyWorkTs = Date.now(); } catch (e) {}
    }

    const ensureDiscSkeleton = getDiscRenderHelper('ensureDiscSkeleton');
    const applyDiscRenderState = getDiscRenderHelper('applyDiscRenderState');
    if (ensureDiscSkeleton) ensureDiscSkeleton(discElement);

    discElement.classList.add('special-stone');
    discElement.classList.add(effect.cssClass);
    applyOwnerMetadataForEffect(discElement, effectKey, effect, options);

    try { if (debugVisual) console.log('[VISUAL_DEBUG] after apply classes:', discElement.className, 'cssVar:', discElement.style.getPropertyValue('--special-stone-image')); } catch(e){}
    const imagePath = resolveStoneEffectImagePath(effect, options);
    let overlayImage = null;
    if (imagePath) {
        let resolvedPath = imagePath;
        try {
            if (typeof document !== 'undefined' && document.baseURI) {
                resolvedPath = new URL(imagePath, document.baseURI).href;
            }
        } catch (e) { /* ignore */ }
        overlayImage = `url('${resolvedPath}')`;
        try { discElement.style.setProperty('--special-stone-image', overlayImage); } catch (e) { /* ignore */ }
        try { discElement.style.setProperty('--disc-overlay-image', overlayImage); } catch (e) { /* ignore */ }
        if (effectKey === 'ultimateDragon' || effectKey === 'destroyDragonStone' || effectKey === 'ultimateDestroyGod') {
            try { discElement.style.setProperty('--dragon-image-path', overlayImage); } catch (e) { /* ignore */ }
        }
        if (effectKey === 'breedingStone') {
            try { discElement.style.setProperty('--breeding-image-path', overlayImage); } catch (e) { /* ignore */ }
        }
    }

    if (applyDiscRenderState) {
        applyDiscRenderState(discElement, {
            owner: options.owner,
            renderMode: resolveRenderMode(effect),
            overlayImage,
            scale: resolveOverlayScale(effect),
            imageState: overlayImage ? 'loaded' : undefined,
            effectKey
        });
    } else {
        try {
            discElement.dataset.renderMode = resolveRenderMode(effect);
            discElement.dataset.effect = effectKey;
            if (overlayImage) discElement.style.setProperty('--disc-overlay-image', overlayImage);
        } catch (e) { /* ignore */ }
    }

    Object.entries(effect.dataAttributes || {}).forEach(([key, value]) => {
        discElement.dataset[key] = value;
    });

    if (effect.clearStyles) {
        Object.entries(effect.clearStyles).forEach(([property, value]) => {
            discElement.style.setProperty(property, value, 'important');
        });
    }

    return !!(overlayImage || !effect.imagePath && !effect.imagePathByOwner && !effect.imagePathByPlayer);
}

function removeStoneVisualEffect(discElement, effectKey) {
    const visualMap = getUiStoneVisualEffects();
    const effect = visualMap[effectKey];
    if (!effect) return;

    discElement.classList.remove('special-stone');
    discElement.classList.remove(effect.cssClass);
    clearOwnerMetadataForEffect(discElement, effectKey);

    Object.keys(effect.dataAttributes || {}).forEach(key => {
        delete discElement.dataset[key];
    });

    Object.keys(effect.clearStyles || {}).forEach((property) => {
        try { discElement.style.removeProperty(property); } catch (e) { /* ignore */ }
    });

    try { discElement.style.removeProperty('--special-stone-image'); } catch (e) { /* ignore */ }
    try { discElement.style.removeProperty('--disc-overlay-image'); } catch (e) { /* ignore */ }
    try { discElement.style.removeProperty('--disc-overlay-scale'); } catch (e) { /* ignore */ }
    try { discElement.style.removeProperty('--dragon-image-path'); } catch (e) { /* ignore */ }
    try { discElement.style.removeProperty('--breeding-image-path'); } catch (e) { /* ignore */ }
    const applyDiscRenderState = getDiscRenderHelper('applyDiscRenderState');
    const owner = discElement.classList && discElement.classList.contains('white') ? -1 : 1;
    if (applyDiscRenderState) {
        applyDiscRenderState(discElement, {
            owner,
            renderMode: 'base-only',
            effectKey: 'normal'
        });
    } else {
        try {
            discElement.dataset.renderMode = 'base-only';
            discElement.dataset.effect = 'normal';
        } catch (e) { /* ignore */ }
    }
}

function getSupportedEffectKeys() {
    return Object.keys(getUiStoneVisualEffects());
}

if (typeof module === 'object' && module.exports) {
    module.exports = {
        UI_STONE_VISUAL_EFFECTS: getUiStoneVisualEffects(),
        PENDING_TYPE_TO_EFFECT_KEY: getUiPendingTypeToEffectKey(),
        getEffectKeyForPendingType,
        SPECIAL_TYPE_TO_EFFECT_KEY: getUiSpecialTypeToEffectKey(),
        getEffectKeyForSpecialType,
        getStoneVisualPathsForEffectKey,
        preloadStoneVisualEffectKeys,
        normalizeOwnerValue,
        applyTrapStoneFallbackVisual,
        clearStoneVisualEffectState,
        applyStoneVisualEffect,
        removeStoneVisualEffect,
        getSupportedEffectKeys
    };
}

// In UI, export globals for backward compatibility (ensure we don't overwrite an existing global)
if (typeof window !== 'undefined') {
    const currentVisualMap = getUiStoneVisualEffects();
    const currentPendingMap = getUiPendingTypeToEffectKey();
    const currentSpecialMap = getUiSpecialTypeToEffectKey();

    if (typeof window.STONE_VISUAL_EFFECTS === 'undefined' && Object.keys(currentVisualMap || {}).length > 0) {
        window.STONE_VISUAL_EFFECTS = currentVisualMap;
    }
    // Do not overwrite existing globals if present; prefer existing definitions.
    if (Object.keys(currentPendingMap || {}).length > 0) {
        window.PENDING_TYPE_TO_EFFECT_KEY = window.PENDING_TYPE_TO_EFFECT_KEY || currentPendingMap;
        window.getEffectKeyForPendingType = window.getEffectKeyForPendingType || getEffectKeyForPendingType;
    }
    if (Object.keys(currentSpecialMap || {}).length > 0) {
        window.SPECIAL_TYPE_TO_EFFECT_KEY = window.SPECIAL_TYPE_TO_EFFECT_KEY || currentSpecialMap;
        window.getEffectKeyForSpecialType = window.getEffectKeyForSpecialType || getEffectKeyForSpecialType;
    }
    window.normalizeOwnerValue = window.normalizeOwnerValue || normalizeOwnerValue;
    window.getStoneVisualPathsForEffectKey = window.getStoneVisualPathsForEffectKey || getStoneVisualPathsForEffectKey;
    window.preloadStoneVisualEffectKeys = window.preloadStoneVisualEffectKeys || preloadStoneVisualEffectKeys;
    window.applyTrapStoneFallbackVisual = window.applyTrapStoneFallbackVisual || applyTrapStoneFallbackVisual;
    window.clearStoneVisualEffectState = window.clearStoneVisualEffectState || clearStoneVisualEffectState;
    window.applyStoneVisualEffect = applyStoneVisualEffect;
    window.removeStoneVisualEffect = removeStoneVisualEffect;
    window.getSupportedEffectKeys = getSupportedEffectKeys;
}

window.setSpecialStoneScale = function setSpecialStoneScale(scale) {
    const n = Number(scale);
    if (!Number.isFinite(n) || n <= 0) {
        console.warn('[VISUAL_EFFECTS] Invalid special stone scale:', scale);
        return;
    }
    if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.style.setProperty('--special-stone-scale', String(n));
    }
};

// Notify game/ module that UI implementations are available so game can delegate without using window.
try {
    const gameVisualsMap = require('../game/visual-effects-map');
    if (gameVisualsMap && typeof gameVisualsMap.setUIImpl === 'function') {
        gameVisualsMap.setUIImpl({
            applyStoneVisualEffect,
            removeStoneVisualEffect,
            getSupportedEffectKeys,
            // Expose any UI-level helpers that might be useful
            __setSpecialStoneScaleImpl__: function(scale) { window.setSpecialStoneScale(scale); }
        });
    }
} catch (e) { /* ignore in non-module UI contexts */ }
