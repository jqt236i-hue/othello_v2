// UI implementation for visual-effects-map
// This file contains DOM-manipulating visual helpers intended to run in the browser UI.
console.log('[VISUAL_EFFECTS] ui/visual-effects-map.js loaded');

// Attempt to use UIBootstrap registration first for canonical UI globals
let _registerUIGlobals_visual = null;
let _getUIBootstrapGlobals_visual = null;
try {
    const uiBootstrap = require('./bootstrap');
    if (uiBootstrap) {
        if (typeof uiBootstrap.registerUIGlobals === 'function') _registerUIGlobals_visual = uiBootstrap.registerUIGlobals;
        if (typeof uiBootstrap.getRegisteredUIGlobals === 'function') _getUIBootstrapGlobals_visual = uiBootstrap.getRegisteredUIGlobals;
    }
} catch (e) { /* ignore - headless or non-UI context */ }

function setUIGlobal(key, value) {
    try {
        if (_registerUIGlobals_visual) {
            const p = {};
            p[key] = value;
            _registerUIGlobals_visual(p);
            return;
        }
    } catch (e) { /* ignore */ }
    try { if (typeof window !== 'undefined') window[key] = value; } catch (e) { }
}

// Single source: consume maps from game/visual-effects-map.js (UI registration, globals or require)
function getSharedVisualEffectsMap() {
    try {
        if (_getUIBootstrapGlobals_visual) {
            const g = _getUIBootstrapGlobals_visual() || {};
            if (g.GameVisualEffectsMap && g.GameVisualEffectsMap.STONE_VISUAL_EFFECTS) return g.GameVisualEffectsMap;
        }
    } catch (e) { /* ignore */ }

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
// Keep these mutable so we can synchronously refresh when game map becomes available
let UI_STONE_VISUAL_EFFECTS = SHARED_MAP.STONE_VISUAL_EFFECTS || {};
let UI_PENDING_TYPE_TO_EFFECT_KEY = SHARED_MAP.PENDING_TYPE_TO_EFFECT_KEY || {};
let UI_SPECIAL_TYPE_TO_EFFECT_KEY = SHARED_MAP.SPECIAL_TYPE_TO_EFFECT_KEY || {};

// Synchronously refresh shared maps and preload images to ensure immediate visuals on placement
function refreshSharedVisualMaps() {
    const shared = getSharedVisualEffectsMap();
    UI_STONE_VISUAL_EFFECTS = (shared && shared.STONE_VISUAL_EFFECTS) || {};
    UI_PENDING_TYPE_TO_EFFECT_KEY = (shared && shared.PENDING_TYPE_TO_EFFECT_KEY) || {};
    UI_SPECIAL_TYPE_TO_EFFECT_KEY = (shared && shared.SPECIAL_TYPE_TO_EFFECT_KEY) || {};

    // Preload all referenced images so they appear immediately when applied
    try {
        const paths = new Set();
        Object.values(UI_STONE_VISUAL_EFFECTS || {}).forEach(effect => {
            if (effect.imagePath) paths.add(effect.imagePath);
            if (effect.imagePathByOwner) Object.values(effect.imagePathByOwner).forEach(p => paths.add(p));
            if (effect.imagePathByPlayer) Object.values(effect.imagePathByPlayer).forEach(p => paths.add(p));
        });
        paths.forEach(p => {
            try {
                const img = new Image();
                // Resolve against document.baseURI if available
                img.src = (typeof document !== 'undefined' && document.baseURI) ? new URL(p, document.baseURI).href : p;
            } catch (e) { /* ignore preload failures */ }
        });
    } catch (e) { /* ignore */ }
}

// Expose a notify function so game map can synchronously inform UI when it's ready
try {
    if (_registerUIGlobals_visual) {
        _registerUIGlobals_visual({ __visualEffectsMapReady: refreshSharedVisualMaps });
    }
} catch (e) { /* ignore */ }
// Fallback for legacy consumers
try { if (typeof window !== 'undefined') window.__visualEffectsMapReady = refreshSharedVisualMaps; } catch (e) {}

// Call once at load in case game map was already present
try { refreshSharedVisualMaps(); } catch (e) { /* ignore */ }

function getEffectKeyForPendingType(pendingType) {
    return UI_PENDING_TYPE_TO_EFFECT_KEY[pendingType] || null;
}

function getEffectKeyForSpecialType(type) {
    return UI_SPECIAL_TYPE_TO_EFFECT_KEY[type] || null;
} 

async function applyStoneVisualEffect(discElement, effectKey, options = {}) {
    console.log('[VISUAL_DEBUG] applyStoneVisualEffect called', effectKey, options);
    // Re-read shared map at call time to handle late registration from game/visual-effects-map.js
    const shared = getSharedVisualEffectsMap();
    const effect = (shared && shared.STONE_VISUAL_EFFECTS && shared.STONE_VISUAL_EFFECTS[effectKey]) || UI_STONE_VISUAL_EFFECTS[effectKey];
    try { if (!discElement) console.warn('[VISUAL_DEBUG] applyStoneVisualEffect: discElement missing for', effectKey); } catch (e) {}
    try { console.log('[VISUAL_DEBUG] effect lookup:', effectKey, effect ? effect.cssClass : null); } catch (e) {}
    if (!effect) {
        console.warn(`[VISUAL_EFFECTS] Unknown effect key: ${effectKey}`);
        return false;
    }

    if (effectKey === 'workStone') {
        console.log('[VISUAL_DEBUG] applyStoneVisualEffect(workStone) called, options:', options, 'effect:', effect);
        try { setUIGlobal('_lastApplyWorkTs', Date.now()); } catch (e) {}
    }

    discElement.classList.add('special-stone');
    discElement.classList.add(effect.cssClass);

    try { console.log('[VISUAL_DEBUG] after apply classes:', discElement.className, 'cssVar:', discElement.style.getPropertyValue('--special-stone-image')); } catch(e){}

    // Helper: wait for paint using rAF + short timeout
    async function waitForNextPaint() {
        return new Promise(resolve => {
            try {
                requestAnimationFrame(() => setTimeout(resolve, 20));
            } catch (e) { setTimeout(resolve, 20); }
        });
    }

    // detect function for current painting state
    function hasVisibleBackground(discEl) {
        try {
            const beforeBg = getComputedStyle(discEl, '::before').getPropertyValue('background-image');
            const inlineBg = discEl.style.backgroundImage || '';
            const hasBefore = beforeBg && beforeBg !== 'none' && beforeBg.trim().length > 0;
            const hasInline = inlineBg && inlineBg !== 'none' && inlineBg.trim().length > 0;
            return { hasBefore, hasInline };
        } catch (e) { return { hasBefore: false, hasInline: false }; }
    }

    // Background-based effects
    if (effect.cssMethod === 'background') {
        let imagePath = effect.imagePath;
        if (effect.imagePathByOwner && options.owner !== undefined) {
            const ownerKey = options.owner.toString();
            imagePath = effect.imagePathByOwner[ownerKey];
            console.log(`[VISUAL_EFFECTS] PermaProtected stone - owner: ${options.owner}, ownerKey: "${ownerKey}", imagePath: "${imagePath}"`);
        } else if (effect.imagePathByPlayer && options.player !== undefined) {
            imagePath = effect.imagePathByPlayer[options.player];
        }
        if (imagePath) {
            // Resolve relative paths against document.baseURI to avoid file:// / server mismatches
            let resolvedPath = imagePath;
            try {
                if (typeof document !== 'undefined' && document.baseURI) {
                    resolvedPath = new URL(imagePath, document.baseURI).href;
                }
            } catch (e) { /* ignore: fallback to original imagePath */ }

            // Apply inline CSS immediately so the visual appears as soon as possible.
            discElement.style.setProperty('--special-stone-image', `url('${resolvedPath}')`);
            try { discElement.style.backgroundImage = `url('${resolvedPath}')`; } catch (e) { }

            // Immediate fallback image injection (guarantee visible even if pseudo/::before hasn't painted yet)
            // We add the fallback and remove it later if CSS pseudo/inline background wins.
            let existing = discElement.querySelector('.special-stone-img');
            if (!existing) {
                const img = document.createElement('img');
                img.className = 'special-stone-img';
                img.src = resolvedPath;
                img.alt = effectKey;
                img.setAttribute('aria-hidden', 'true');
                img.style.position = 'absolute';
                img.style.top = '0';
                img.style.left = '0';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                img.style.pointerEvents = 'none';
                img.style.zIndex = '60';
                discElement.appendChild(img);
                existing = img;
            }

            // When the image loads, check whether the pseudo/inline background is already in place; if so remove the fallback to avoid duplication.
            existing.addEventListener('load', () => {
                // Use rAF to allow CSS painting to occur
                requestAnimationFrame(() => {
                    const { hasBefore, hasInline } = hasVisibleBackground(discElement);
                    if (hasBefore || hasInline) {
                        try { existing.remove(); } catch (e) {}
                    }
                });
            });

            return true;
        } else {
            console.warn(`[VISUAL_EFFECTS] No imagePath found for effect: ${effectKey}, options:`, options);
            return false;
        }
    } else if (effect.cssMethod === 'pseudoElement') {
        if (effect.imagePathByOwner && options.owner !== undefined) {
            let ownerKey;
            let ownerNum;
            if (options.owner === 'black' || options.owner === '1' || options.owner === 1) {
                ownerKey = '1';
                ownerNum = 1;
            } else if (options.owner === 'white' || options.owner === '-1' || options.owner === -1) {
                ownerKey = '-1';
                ownerNum = -1;
            } else {
                const s = String(options.owner);
                ownerKey = (s === '-1') ? '-1' : '1';
                ownerNum = (ownerKey === '1') ? 1 : -1;
            }
            const ownerClass = ownerNum === 1 ? 'ud-black' : 'ud-white';
            const dataUdValue = ownerNum === 1 ? 'black' : 'white';

            discElement.classList.add(ownerClass);
            discElement.dataset.ud = dataUdValue;

            let imagePath = effect.imagePathByOwner[ownerKey];
            if (imagePath) {
                // Resolve path
                let resolvedPath = imagePath;
                try {
                    if (typeof document !== 'undefined' && document.baseURI) {
                        resolvedPath = new URL(imagePath, document.baseURI).href;
                    }
                } catch (e) {}

                discElement.style.setProperty('--dragon-image-path', `url('${resolvedPath}')`);
                discElement.style.setProperty('--special-stone-image', `url('${resolvedPath}')`);
                try { discElement.style.backgroundImage = `url('${resolvedPath}')`; } catch (e) { }

                // Wait for paint similar to background
                let success = false;
                const maxAttempts = 6;
                for (let i = 0; i < maxAttempts; i++) {
                    const { hasBefore, hasInline } = hasVisibleBackground(discElement);
                    if (hasBefore || hasInline) { success = true; break; }
                    await waitForNextPaint();
                }

                const existing = discElement.querySelector('.special-stone-img');
                if (!success) {
                    if (!existing) {
                        const img = document.createElement('img');
                        img.className = 'special-stone-img';
                        img.src = resolvedPath;
                        img.alt = effectKey;
                        img.setAttribute('aria-hidden', 'true');
                        img.style.position = 'absolute';
                        img.style.top = '0';
                        img.style.left = '0';
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.objectFit = 'contain';
                        img.style.pointerEvents = 'none';
                        img.style.zIndex = '60';
                        discElement.appendChild(img);
                        console.warn('[VISUAL_EFFECTS] Injected fallback image for', effectKey, resolvedPath);
                        try { setUIGlobal('_lastWorkInjected', { key: effectKey, imgPath: resolvedPath, ts: Date.now() }); } catch (e) {}
                    }
                    return true;
                }

                if (existing) existing.remove();
                return true;
            } else {
                console.warn(`[VISUAL_EFFECTS] No imagePath found for ownerKey=${ownerKey}`);
                return false;
            }
        }
    }

    if (effectKey === 'breedingStone' && effect.imagePathByOwner && options.owner !== undefined) {
        const breedingClass = options.owner === 1 ? 'breeding-black' : 'breeding-white';
        const dataBreedingValue = options.owner === 1 ? 'black' : 'white';
        discElement.classList.add(breedingClass);
        discElement.dataset.breeding = dataBreedingValue;
        const imagePath = effect.imagePathByOwner[options.owner.toString()];
        if (imagePath) {
            discElement.style.setProperty('--breeding-image-path', `url('${imagePath}')`);
            discElement.style.setProperty('--special-stone-image', `url('${imagePath}')`);
        }
    }

    Object.entries(effect.dataAttributes || {}).forEach(([key, value]) => {
        discElement.dataset[key] = value;
    });

    if (effect.clearStyles) {
        Object.entries(effect.clearStyles).forEach(([property, value]) => {
            discElement.style.setProperty(property, value, 'important');
        });
    }

    // Default success if we reached here (some effects are purely class-based)
    return true;
}

function removeStoneVisualEffect(discElement, effectKey) {
    const effect = UI_STONE_VISUAL_EFFECTS[effectKey];
    if (!effect) return;

    discElement.classList.remove(effect.cssClass);

    if (effect.cssMethod === 'background') {
        discElement.style.backgroundImage = '';
        discElement.style.backgroundSize = '';
        discElement.style.backgroundPosition = '';
        discElement.style.backgroundRepeat = '';
    } else if (effect.cssMethod === 'pseudoElement') {
        discElement.classList.remove('ud-black', 'ud-white');
        delete discElement.dataset.ud;
    }

    Object.keys(effect.dataAttributes || {}).forEach(key => {
        delete discElement.dataset[key];
    });
}

function getSupportedEffectKeys() {
    return Object.keys(UI_STONE_VISUAL_EFFECTS);
}

if (typeof module === 'object' && module.exports) {
    module.exports = {
        UI_STONE_VISUAL_EFFECTS,
        PENDING_TYPE_TO_EFFECT_KEY: UI_PENDING_TYPE_TO_EFFECT_KEY,
        getEffectKeyForPendingType,
        SPECIAL_TYPE_TO_EFFECT_KEY: UI_SPECIAL_TYPE_TO_EFFECT_KEY,
        getEffectKeyForSpecialType,
        applyStoneVisualEffect,
        removeStoneVisualEffect,
        getSupportedEffectKeys
    };
}

// In UI, export globals for backward compatibility (prefer UIBootstrap registration)
try {
    if (_registerUIGlobals_visual) {
        const payload = {};
        if (Object.keys(UI_STONE_VISUAL_EFFECTS || {}).length > 0) payload.STONE_VISUAL_EFFECTS = UI_STONE_VISUAL_EFFECTS;
        if (Object.keys(UI_PENDING_TYPE_TO_EFFECT_KEY || {}).length > 0) {
            payload.PENDING_TYPE_TO_EFFECT_KEY = UI_PENDING_TYPE_TO_EFFECT_KEY;
            payload.getEffectKeyForPendingType = getEffectKeyForPendingType;
        }
        if (Object.keys(UI_SPECIAL_TYPE_TO_EFFECT_KEY || {}).length > 0) {
            payload.SPECIAL_TYPE_TO_EFFECT_KEY = UI_SPECIAL_TYPE_TO_EFFECT_KEY;
            payload.getEffectKeyForSpecialType = getEffectKeyForSpecialType;
        }
        payload.applyStoneVisualEffect = applyStoneVisualEffect;
        payload.removeStoneVisualEffect = removeStoneVisualEffect;
        payload.getSupportedEffectKeys = getSupportedEffectKeys;
        _registerUIGlobals_visual(payload);
    }
} catch (e) { /* ignore */ }
// Fallback to window globals for legacy consumers
try {
    if (typeof window !== 'undefined') {
        if (typeof window.STONE_VISUAL_EFFECTS === 'undefined' && Object.keys(UI_STONE_VISUAL_EFFECTS || {}).length > 0) {
            window.STONE_VISUAL_EFFECTS = UI_STONE_VISUAL_EFFECTS;
        }
        if (Object.keys(UI_PENDING_TYPE_TO_EFFECT_KEY || {}).length > 0) {
            window.PENDING_TYPE_TO_EFFECT_KEY = window.PENDING_TYPE_TO_EFFECT_KEY || UI_PENDING_TYPE_TO_EFFECT_KEY;
            window.getEffectKeyForPendingType = window.getEffectKeyForPendingType || getEffectKeyForPendingType;
        }
        if (Object.keys(UI_SPECIAL_TYPE_TO_EFFECT_KEY || {}).length > 0) {
            window.SPECIAL_TYPE_TO_EFFECT_KEY = window.SPECIAL_TYPE_TO_EFFECT_KEY || UI_SPECIAL_TYPE_TO_EFFECT_KEY;
            window.getEffectKeyForSpecialType = window.getEffectKeyForSpecialType || getEffectKeyForSpecialType;
        }
        window.applyStoneVisualEffect = applyStoneVisualEffect;
        window.removeStoneVisualEffect = removeStoneVisualEffect;
        window.getSupportedEffectKeys = getSupportedEffectKeys;
    }
} catch (e) { /* ignore */ }

function setSpecialStoneScale(scale) {
    const n = Number(scale);
    if (!Number.isFinite(n) || n <= 0) {
        console.warn('[VISUAL_EFFECTS] Invalid special stone scale:', scale);
        return;
    }
    if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.style.setProperty('--special-stone-scale', String(n));
    }
}
// Expose to UIBootstrap when available and fallback to window
try { if (_registerUIGlobals_visual) _registerUIGlobals_visual({ setSpecialStoneScale }); } catch (e) {}
try { if (typeof window !== 'undefined') window.setSpecialStoneScale = setSpecialStoneScale; } catch (e) {}

// Notify game/ module that UI implementations are available so game can delegate without using window.
try {
    const gameVisualsMap = require('../game/visual-effects-map');
    if (gameVisualsMap && typeof gameVisualsMap.setUIImpl === 'function') {
        gameVisualsMap.setUIImpl({
            applyStoneVisualEffect,
            removeStoneVisualEffect,
            getSupportedEffectKeys,
            // Expose any UI-level helpers that might be useful
            __setSpecialStoneScaleImpl__: function(scale) { return setSpecialStoneScale(scale); }
        });
    }
} catch (e) { /* ignore in non-module UI contexts */ }
