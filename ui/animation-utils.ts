
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

declare var isCardAnimating: any;
declare var isProcessing: any;
declare const requestCardUiSync: (...args: any[]) => any;
declare const renderCardUI: (...args: any[]) => any;
declare const SoundEngine: any;
declare const BLACK: number;
declare const WHITE: number;
declare const EMPTY: number;
declare const cardState: any;
declare const OwnerHelpers: any;
declare const SharedConstants: any;
declare const CardLogic: any;
declare const TimerRegistry: any;
declare const boardEl: any;
declare const handLayer: any;
declare const handWrapper: any;
declare const heldStone: any;
declare const __uiImpl: any;
declare const applyStoneVisualEffect: (...args: any[]) => any;
declare const applyCardSpecialArtToFace: (...args: any[]) => any;
declare const createCardFaceElement: (...args: any[]) => any;
declare const fitCardNameElement: (...args: any[]) => any;

/**
 * @file animation-utils.js
 * @description アニメーションユーティリティ
 * 石の配置・破壊・フェードアウトアニメーションを担当
 */
// Shared animation helpers (normalized) - resolved lazily via AnimationResolver
let __anim_res_utils: any = null;
try { __anim_res_utils = (typeof require === 'function') ? require('./animation-resolver') : (typeof globalThis !== 'undefined' ? (globalThis as any).AnimationResolver : null); } catch (e: any) { __anim_res_utils = (typeof globalThis !== 'undefined' ? (globalThis as any).AnimationResolver : null); }
function _getAnimationShared() { return (__anim_res_utils && typeof __anim_res_utils.getAnimationShared === 'function') ? __anim_res_utils.getAnimationShared() : null; }
function _isNoAnim() { const fn = (__anim_res_utils && typeof __anim_res_utils.isNoAnim === 'function') ? __anim_res_utils.isNoAnim() : function () { return false; }; return fn(); }
function _Timer() { return (__anim_res_utils && typeof __anim_res_utils.getTimer === 'function') ? __anim_res_utils.getTimer() : (function () {
    if (typeof TimerRegistry !== 'undefined') return TimerRegistry;
    return {
        setTimeout: (fn: any, ms: any) => setTimeout(fn, ms),
        clearTimeout: (id: any) => clearTimeout(id),
        clearAll: () => {},
        pendingCount: () => 0,
        newScope: () => null,
        clearScope: () => {}
    };
})(); }
let __playback_state_utils: any = null;
try { __playback_state_utils = (typeof require === 'function') ? require('./playback-state-manager') : (typeof globalThis !== 'undefined' ? (globalThis as any).PlaybackStateManager : null); } catch (e: any) { __playback_state_utils = (typeof globalThis !== 'undefined' ? (globalThis as any).PlaybackStateManager : null); }
let __owner_helpers_utils: any = null;
try { __owner_helpers_utils = (typeof require === 'function') ? require('../utils/owner-helpers') : (typeof globalThis !== 'undefined' ? (globalThis as any).OwnerHelpers : null); } catch (e: any) { __owner_helpers_utils = (typeof globalThis !== 'undefined' ? (globalThis as any).OwnerHelpers : null); }
let __player_slot_elements_utils: any = null;
try { __player_slot_elements_utils = (typeof require === 'function') ? require('./player-slot-elements') : null; } catch (e: any) { __player_slot_elements_utils = null; }
let __element_cache_utils: any = null;
try { __element_cache_utils = (typeof require === 'function') ? require('./element-cache') : (typeof globalThis !== 'undefined' ? (globalThis as any).ElementCacheModule : null); } catch (e: any) { __element_cache_utils = (typeof globalThis !== 'undefined' ? (globalThis as any).ElementCacheModule : null); }
let __board_renderer_geometry_utils: any = null;
let __hand_fade_token_sequence_utils = 0;
let __legacy_board_animation_token_utils: any = null;
let __legacy_board_animation_ref_count_utils = 0;
let __legacy_board_animation_sequence_utils = 0;
let __legacy_board_animation_opening_utils: Promise<any> | null = null;
let __legacy_board_animation_closing_utils: Promise<any> | null = null;
let __legacy_board_animation_unresolved_error_utils: any = null;
let __hand_skin_utils: any = null;
let __hand_fade_state_utils: any = null;
try { __hand_fade_state_utils = (typeof require === 'function') ? require('./hand-animation/fade-state') : (typeof globalThis !== 'undefined' ? (globalThis as any).HandFadeStateModule : null); } catch (e: any) { __hand_fade_state_utils = (typeof globalThis !== 'undefined' ? (globalThis as any).HandFadeStateModule : null); }
let __hand_animation_preferences_utils: any = null;
try { __hand_animation_preferences_utils = (typeof require === 'function') ? require('./hand-animation-preferences.js') : (typeof globalThis !== 'undefined' ? (globalThis as any).HandAnimationPreferencesModule : null); } catch (e: any) { __hand_animation_preferences_utils = (typeof globalThis !== 'undefined' ? (globalThis as any).HandAnimationPreferencesModule : null); }
function _getOwnerHelpers() {
    if (__owner_helpers_utils) return __owner_helpers_utils;
    try {
        if (typeof OwnerHelpers !== 'undefined' && OwnerHelpers) return OwnerHelpers;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis && (globalThis as any).OwnerHelpers) return (globalThis as any).OwnerHelpers;
    } catch (e: any) { /* ignore */ }
    return null;
}
function _setCardAnimatingState(locked: any) {
    if (__playback_state_utils && typeof __playback_state_utils.setCardAnimating === 'function') {
        __playback_state_utils.setCardAnimating(locked);
        return;
    }
    if (typeof isCardAnimating !== 'undefined') isCardAnimating = !!locked;
    if (typeof window !== 'undefined') window.isCardAnimating = !!locked;
}

function _setProcessingState(locked: any) {
    if (__playback_state_utils && typeof __playback_state_utils.setProcessing === 'function') {
        __playback_state_utils.setProcessing(locked);
        return;
    }
    if (typeof isProcessing !== 'undefined') isProcessing = !!locked;
    if (typeof window !== 'undefined') window.isProcessing = !!locked;
}

function _requestCardUiSyncForAnimationUtils(reason: any) {
    const requestCardUiSyncFn = (typeof requestCardUiSync === 'function')
        ? requestCardUiSync
        : ((typeof window !== 'undefined' && typeof window.requestCardUiSync === 'function') ? window.requestCardUiSync : null);
    if (typeof requestCardUiSyncFn === 'function') {
        requestCardUiSyncFn(reason);
        return true;
    }
    try {
        if (typeof renderCardUI === 'function') {
            renderCardUI();
            return true;
        }
    } catch (e: any) { /* ignore */ }
    return false;
}

function _getHandAnimationRootRef() {
    try {
        if (typeof window !== 'undefined' && window) return window as any;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis) return globalThis as any;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _getCachedAnimationElement(cacheKey: any, elementId: any) {
    if (typeof document === 'undefined') return null;
    const id = String(elementId || '');
    if (!id) return null;
    let cached: any = null;
    try {
        if (__element_cache_utils && typeof __element_cache_utils.getElement === 'function') {
            cached = __element_cache_utils.getElement(cacheKey);
            if (cached && cached.ownerDocument === document) return cached;
        }
    } catch (e: any) { /* ignore */ }
    const resolved = document.getElementById(id);
    try {
        if (__element_cache_utils && __element_cache_utils.elementCache && cacheKey) {
            __element_cache_utils.elementCache[cacheKey] = resolved;
        }
    } catch (e: any) { /* ignore */ }
    return resolved;
}

function _setAttributeIfChanged(el: any, name: any, value: any) {
    if (!el || typeof el.getAttribute !== 'function' || typeof el.setAttribute !== 'function') return;
    const attrName = String(name || '');
    const nextValue = String(value);
    if (el.getAttribute(attrName) !== nextValue) {
        el.setAttribute(attrName, nextValue);
    }
}

function _readStoredHandAnimationEnabled(kind: any) {
    const rootRef = _getHandAnimationRootRef();
    if (__hand_animation_preferences_utils && typeof __hand_animation_preferences_utils.readHandAnimationPreference === 'function') {
        return __hand_animation_preferences_utils.readHandAnimationPreference(rootRef, kind === 'place' ? 'place' : 'draw');
    }
    return true;
}

function _isHandAnimationDisabled(kind: any) {
    const rootRef = _getHandAnimationRootRef();
    try {
        if (kind === 'place' && rootRef && rootRef.DISABLE_PLACE_HAND_ANIMATION === true) return true;
        if (kind === 'draw' && rootRef && rootRef.DISABLE_DRAW_HAND_ANIMATION === true) return true;
    } catch (e: any) { /* ignore */ }
    return !_readStoredHandAnimationEnabled(kind);
}

let __playerSlotElementResolver: any = null;
function _getPlayerSlotElementResolver() {
    if (__playerSlotElementResolver) return __playerSlotElementResolver;
    if (__player_slot_elements_utils && typeof __player_slot_elements_utils.createPlayerSlotElementResolver === 'function') {
        __playerSlotElementResolver = __player_slot_elements_utils.createPlayerSlotElementResolver({
            getDocumentRef: () => (typeof document !== 'undefined' ? document : null),
            getOwnerHelpersModule: _getOwnerHelpers
        });
        return __playerSlotElementResolver;
    }
    return null;
}

function _normalizeHandOwnerKey(value: any) {
    const resolver = _getPlayerSlotElementResolver();
    if (resolver && typeof resolver.normalizeOwnerKey === 'function') return resolver.normalizeOwnerKey(value);
    const ownerHelpers = _getOwnerHelpers();
    if (ownerHelpers && typeof ownerHelpers.normalizePlayerKey === 'function') {
        return ownerHelpers.normalizePlayerKey(value, 'black');
    }
    if (value === 'white' || value === -1 || value === '-1') return 'white';
    return 'black';
}

function _getHandElementsByOwner(playerKey: any) {
    const resolver = _getPlayerSlotElementResolver();
    if (resolver && typeof resolver.getHandElementsByOwner === 'function') return resolver.getHandElementsByOwner(playerKey);
    if (typeof document === 'undefined') return [];
    const ownerKey = _normalizeHandOwnerKey(playerKey);
    const handBlackEl = document.getElementById('hand-black');
    const handWhiteEl = document.getElementById('hand-white');
    const handElements = [handBlackEl, handWhiteEl].filter(Boolean);
    const ownerHelpers = _getOwnerHelpers();
    if (ownerHelpers && typeof ownerHelpers.filterOwnerMatchedElements === 'function') {
        const matched = ownerHelpers.filterOwnerMatchedElements(handElements, ownerKey);
        if (matched.length > 0) return matched;
    }
    const fallbackHandEl = document.getElementById(ownerKey === 'white' ? 'hand-white' : 'hand-black');
    return fallbackHandEl ? [fallbackHandEl] : [];
}

function _resolveHandElementByOwner(playerKey: any) {
    const resolver = _getPlayerSlotElementResolver();
    if (resolver && typeof resolver.resolveHandElementByOwner === 'function') return resolver.resolveHandElementByOwner(playerKey);
    const handElements = _getHandElementsByOwner(playerKey);
    return handElements.length > 0 ? handElements[0] : null;
}

function _resolveDeckElementByOwner(playerKey: any) {
    const resolver = _getPlayerSlotElementResolver();
    if (resolver && typeof resolver.resolveDeckElementByOwner === 'function') return resolver.resolveDeckElementByOwner(playerKey);
    if (typeof document === 'undefined') return null;
    const ownerKey = _normalizeHandOwnerKey(playerKey);
    const deckBlackEl = document.getElementById('deck-black');
    const deckWhiteEl = document.getElementById('deck-white');
    const deckElements = [deckBlackEl, deckWhiteEl].filter(Boolean);
    const ownerHelpers = _getOwnerHelpers();

    if (ownerHelpers && typeof ownerHelpers.resolveOwnerMatchedElement === 'function') {
        const fallbackDeckEl = document.getElementById(ownerKey === 'white' ? 'deck-white' : 'deck-black');
        return ownerHelpers.resolveOwnerMatchedElement(deckElements, ownerKey, fallbackDeckEl);
    }

    for (const deckEl of deckElements) {
        const slotOwnerKey = deckEl && deckEl.dataset && deckEl.dataset.ownerKey
            ? _normalizeHandOwnerKey(deckEl.dataset.ownerKey)
            : null;
        if (slotOwnerKey === ownerKey) return deckEl;
    }

    return document.getElementById(ownerKey === 'white' ? 'deck-white' : 'deck-black');
}

function _isOwnerOnBottomSlot(playerKey: any) {
    const resolver = _getPlayerSlotElementResolver();
    if (resolver && typeof resolver.isOwnerOnBottomSlot === 'function') return resolver.isOwnerOnBottomSlot(playerKey);
    const ownerKey = _normalizeHandOwnerKey(playerKey);
    if (typeof document === 'undefined') return ownerKey === 'black';

    const bottomEl = document.getElementById('hand-black');
    const topEl = document.getElementById('hand-white');
    const ownerHelpers = _getOwnerHelpers();
    if (ownerHelpers && typeof ownerHelpers.isOwnerOnBottomSlot === 'function') {
        return ownerHelpers.isOwnerOnBottomSlot(ownerKey, bottomEl, topEl, {
            defaultBottomOwnerKey: 'black',
            defaultTopOwnerKey: 'white'
        });
    }
    const bottomOwnerKey = (bottomEl && bottomEl.dataset && bottomEl.dataset.ownerKey)
        ? _normalizeHandOwnerKey(bottomEl.dataset.ownerKey)
        : 'black';
    const topOwnerKey = (topEl && topEl.dataset && topEl.dataset.ownerKey)
        ? _normalizeHandOwnerKey(topEl.dataset.ownerKey)
        : 'white';

    if (bottomOwnerKey === ownerKey) return true;
    if (topOwnerKey === ownerKey) return false;
    return ownerKey === 'black';
}

const HAND_WRAPPER_WIDTH = 180;
const HAND_TRAVEL_EASING = 'cubic-bezier(0.3, 0.2, 0.7, 0.8)';
const HAND_MOTION_SPEED_MULTIPLIER = 1.3;
const scaleHandMotionDuration = (baseMs: number): number => Math.max(1, Math.round(baseMs / HAND_MOTION_SPEED_MULTIPLIER));
const PLACE_HAND_SPEED_BOOST = 1.2;
const DRAW_HAND_SPEED_BOOST = 1.1;
const boostHandDuration = (baseMs: number, boost: number): number => Math.max(1, Math.round(baseMs / boost));
const HAND_ACTION_SPEED_BOOST = 1.3;
const applyHandActionSpeedBoost = (baseMs: number): number => Math.max(1, Math.round(baseMs / HAND_ACTION_SPEED_BOOST));
const PLACE_HAND_SPEED_FACTOR = 0.95;
const applyPlaceHandSpeedFactor = (baseMs: number): number => Math.max(1, Math.round(baseMs / PLACE_HAND_SPEED_FACTOR));
const DRAW_HAND_SPEED_FACTOR = 0.9;
const applyDrawHandSpeedFactor = (baseMs: number): number => Math.max(1, Math.round(baseMs / DRAW_HAND_SPEED_FACTOR));
const HAND_PLACE_APPROACH_MS = applyPlaceHandSpeedFactor(applyHandActionSpeedBoost(boostHandDuration(scaleHandMotionDuration(400), PLACE_HAND_SPEED_BOOST)));
const HAND_PLACE_BOB_MS = applyPlaceHandSpeedFactor(applyHandActionSpeedBoost(boostHandDuration(scaleHandMotionDuration(150), PLACE_HAND_SPEED_BOOST)));
const HAND_PLACE_RETREAT_MS = applyPlaceHandSpeedFactor(applyHandActionSpeedBoost(boostHandDuration(scaleHandMotionDuration(300), PLACE_HAND_SPEED_BOOST)));
const HAND_PLACE_FADE_OUT_PROGRESS = 0.45;
const HAND_PLACE_FADE_OUT_MS = Math.max(1, Math.round(HAND_PLACE_RETREAT_MS * HAND_PLACE_FADE_OUT_PROGRESS));
const HAND_PLACE_CLEANUP_FALLBACK_MS = HAND_PLACE_APPROACH_MS + HAND_PLACE_BOB_MS + HAND_PLACE_RETREAT_MS + 600;
const HAND_DRAW_PICKUP_MS = applyDrawHandSpeedFactor(applyHandActionSpeedBoost(boostHandDuration(140, DRAW_HAND_SPEED_BOOST)));
const HAND_DRAW_MOVE_MS = applyDrawHandSpeedFactor(applyHandActionSpeedBoost(boostHandDuration(360, DRAW_HAND_SPEED_BOOST)));
const HAND_DRAW_RETREAT_MS = applyDrawHandSpeedFactor(applyHandActionSpeedBoost(boostHandDuration(220, DRAW_HAND_SPEED_BOOST)));
const CARD_FACE_ART_REVEAL_WAIT_MS = 900;
const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):\d+$/;

function _resolveHandImageElement() {
    return _getCachedAnimationElement('handImage', 'handImage');
}

const HAND_ANIMATION_ACTOR_IMAGE_CLASS = 'hand-animation-actor-image';

function _resolveHandWrapperElement() {
    return (typeof handWrapper !== 'undefined' && handWrapper)
        ? handWrapper
        : _getCachedAnimationElement('handWrapper', 'handWrapper');
}

function _findCachedHandActorImage(wrapperEl: any, imagePath: any) {
    if (!wrapperEl || typeof wrapperEl.querySelectorAll !== 'function') return null;
    const normalizedPath = String(imagePath || '');
    const actorImages = Array.from(wrapperEl.querySelectorAll(`.${HAND_ANIMATION_ACTOR_IMAGE_CLASS}`));
    return actorImages.find((candidate: any) => (
        candidate
        && typeof candidate.getAttribute === 'function'
        && candidate.getAttribute('data-hand-animation-image-path') === normalizedPath
    )) || null;
}

function _createCachedHandActorImage(wrapperEl: any, handContext: any) {
    if (!wrapperEl || typeof document === 'undefined' || !handContext || !handContext.renderedImagePath) return null;
    const imagePath = String(handContext.renderedImagePath);
    let actorImageEl: any = _findCachedHandActorImage(wrapperEl, imagePath);
    if (!actorImageEl) {
        actorImageEl = document.createElement('img');
        actorImageEl.className = HAND_ANIMATION_ACTOR_IMAGE_CLASS;
        actorImageEl.alt = '';
        actorImageEl.setAttribute('aria-hidden', 'true');
        actorImageEl.setAttribute('draggable', 'false');
        actorImageEl.setAttribute('decoding', 'async');
        actorImageEl.setAttribute('data-hand-animation-image-path', imagePath);
        actorImageEl.setAttribute('data-hand-animation-active', 'false');
        actorImageEl.style.visibility = 'hidden';
        _setAttributeIfChanged(actorImageEl, 'src', imagePath);
        const heldStoneEl = (typeof heldStone !== 'undefined' && heldStone)
            ? heldStone
            : _getCachedAnimationElement('heldStone', 'heldStone');
        if (heldStoneEl && heldStoneEl.parentElement === wrapperEl) {
            wrapperEl.insertBefore(actorImageEl, heldStoneEl);
        } else {
            wrapperEl.appendChild(actorImageEl);
        }
    }
    if (handContext.renderedSkinId) {
        _setAttributeIfChanged(actorImageEl, 'data-hand-skin-id', handContext.renderedSkinId);
    }
    if (handContext.selectedSkinId) {
        _setAttributeIfChanged(actorImageEl, 'data-hand-selected-skin-id', handContext.selectedSkinId);
    }
    return actorImageEl;
}

function _setHandActorImageActive(actorImageEl: any, active: any) {
    if (!actorImageEl) return;
    const normalized = active === true;
    _setAttributeIfChanged(actorImageEl, 'data-hand-animation-active', normalized ? 'true' : 'false');
    const visibility = normalized ? 'visible' : 'hidden';
    if (actorImageEl.style && actorImageEl.style.visibility !== visibility) {
        actorImageEl.style.visibility = visibility;
    }
}

function _getHandSkinUiModule() {
    if (__hand_skin_utils && typeof __hand_skin_utils === 'object') return __hand_skin_utils;
    try {
        if (typeof require === 'function') {
            __hand_skin_utils = require('./handlers/hand-skin');
        }
    } catch (e: any) { /* ignore */ }
    if (!__hand_skin_utils) {
        try {
            if (typeof window !== 'undefined' && window && window.HandSkinUiModule) {
                __hand_skin_utils = window.HandSkinUiModule;
            }
        } catch (e: any) { /* ignore */ }
    }
    if (!__hand_skin_utils) {
        try {
            if (typeof globalThis !== 'undefined' && globalThis && (globalThis as any).HandSkinUiModule) {
                __hand_skin_utils = (globalThis as any).HandSkinUiModule;
            }
        } catch (e: any) { /* ignore */ }
    }
    return __hand_skin_utils;
}

function _getResolveHandAnimationContext() {
    const handSkinUi = _getHandSkinUiModule();
    if (handSkinUi && typeof handSkinUi.resolveHandAnimationContext === 'function') {
        return handSkinUi.resolveHandAnimationContext;
    }
    try {
        if (typeof window !== 'undefined' && window && typeof window.resolveHandAnimationContext === 'function') {
            return window.resolveHandAnimationContext;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveHandAnimationContext(ownerKey: any, visualOptions: any) {
    const normalizedOwnerKey = _normalizeHandOwnerKey(ownerKey);
    const options = (visualOptions && typeof visualOptions === 'object')
        ? Object.assign({}, visualOptions, { ownerKey: normalizedOwnerKey })
        : { ownerKey: normalizedOwnerKey };
    const resolveContext = _getResolveHandAnimationContext();
    if (typeof resolveContext === 'function') {
        try {
            const rootRef = (typeof window !== 'undefined' && window)
                ? window
                : ((typeof globalThis !== 'undefined' && globalThis) ? globalThis : null);
            const resolved = resolveContext(rootRef, null, options);
            if (resolved && typeof resolved === 'object') {
                return Object.assign({
                    ownerKey: normalizedOwnerKey,
                    cpu: false,
                    cpuLevel: null,
                    selectedSkinId: null,
                    renderedSkinId: null,
                    renderedImagePath: null
                }, resolved, {
                    ownerKey: _normalizeHandOwnerKey(resolved.ownerKey || normalizedOwnerKey)
                });
            }
        } catch (e: any) { /* ignore */ }
    }
    return {
        ownerKey: normalizedOwnerKey,
        cpu: options.cpu === true,
        cpuLevel: Number.isFinite(Number(options.cpuLevel)) ? Number(options.cpuLevel) : null,
        selectedSkinId: null,
        renderedSkinId: null,
        renderedImagePath: null
    };
}

function _applyResolvedHandAnimationContext(handContext: any) {
    const selectedImageEl = _resolveHandImageElement();
    const wrapperEl = _resolveHandWrapperElement();
    if (!selectedImageEl || !wrapperEl || !handContext || !handContext.renderedImagePath) return handContext;
    const selectedPath = String(selectedImageEl.getAttribute('src') || '');
    const actorPath = String(handContext.renderedImagePath || '');
    const selectedSkinId = String(selectedImageEl.getAttribute('data-hand-skin-id') || '');
    const actorSkinId = String(handContext.renderedSkinId || '');
    const usesSelectedImage = selectedPath === actorPath
        || (selectedSkinId !== '' && actorSkinId !== '' && selectedSkinId === actorSkinId);
    const actorImageEl = usesSelectedImage ? null : _createCachedHandActorImage(wrapperEl, handContext);
    const previousSelectedVisibility = selectedImageEl.style ? selectedImageEl.style.visibility : '';

    if (actorImageEl) {
        if (selectedImageEl.style && selectedImageEl.style.visibility !== 'hidden') {
            selectedImageEl.style.visibility = 'hidden';
        }
        _setHandActorImageActive(actorImageEl, true);
    }

    return Object.assign({}, handContext, {
        animationImageEl: actorImageEl || selectedImageEl,
        actorImageEl,
        selectedImageEl,
        previousSelectedVisibility
    });
}

function _syncDisplayedHandSkinForAnimation(ownerKey: any, visualOptions: any) {
    try {
        const handContext = _resolveHandAnimationContext(ownerKey, visualOptions);
        return _applyResolvedHandAnimationContext(handContext);
    } catch (e: any) { /* ignore */ }
    return _resolveHandAnimationContext(ownerKey, visualOptions);
}

function _restoreDisplayedHandSkinAfterAnimation(handContext: any) {
    try {
        const actorImageEl = handContext && handContext.actorImageEl;
        const selectedImageEl = (handContext && handContext.selectedImageEl) || _resolveHandImageElement();
        _setHandActorImageActive(actorImageEl, false);
        if (selectedImageEl && selectedImageEl.style) {
            const previousVisibility = handContext && typeof handContext.previousSelectedVisibility === 'string'
                ? handContext.previousSelectedVisibility
                : '';
            if (selectedImageEl.style.visibility !== previousVisibility) {
                selectedImageEl.style.visibility = previousVisibility;
            }
        }
    } catch (e: any) { /* ignore */ }
}

function _resolveHandLayerElements() {
    return {
        layerEl: (typeof handLayer !== 'undefined' && handLayer) ? handLayer : _getCachedAnimationElement('handLayer', 'handLayer'),
        wrapperEl: (typeof handWrapper !== 'undefined' && handWrapper) ? handWrapper : _getCachedAnimationElement('handWrapper', 'handWrapper'),
        handImageEl: _resolveHandImageElement(),
        heldStoneEl: (typeof heldStone !== 'undefined' && heldStone) ? heldStone : _getCachedAnimationElement('heldStone', 'heldStone')
    };
}

function _ensureHandAnimationLayerMounted(layerEl: any) {
    if (!layerEl || !layerEl.style) return;
    if (layerEl.style.display !== 'block') layerEl.style.display = 'block';
}

function _setHandWrapperPresentationActive(wrapperEl: any, active: boolean) {
    if (!wrapperEl || !wrapperEl.style) return;
    if (wrapperEl.style.display !== 'block') wrapperEl.style.display = 'block';
    const opacity = active ? '1' : '0';
    if (wrapperEl.style.opacity !== opacity) wrapperEl.style.opacity = opacity;
}

function _isHandWrapperPresentationActive(wrapperEl: any) {
    return !!(wrapperEl && wrapperEl.style && wrapperEl.style.opacity === '1');
}

function _cancelElementAnimations(el: any) {
    if (!el || typeof el.getAnimations !== 'function') return;
    let animations: any[] = [];
    try {
        animations = el.getAnimations() || [];
    } catch (e: any) {
        return;
    }
    animations.forEach((animation: any) => {
        try {
            if (animation && typeof animation.cancel === 'function') animation.cancel();
        } catch (e: any) { /* ignore */ }
    });
}

function _resolveHandSelectorByOwner(playerKey: any) {
    const handEl = _resolveHandElementByOwner(playerKey);
    if (handEl && handEl.id) {
        return `#${handEl.id}`;
    }
    const ownerKey = _normalizeHandOwnerKey(playerKey);
    return ownerKey === 'white' ? '#hand-white' : '#hand-black';
}

function _readUsableClientRect(el: any) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    try {
        const rect = el.getBoundingClientRect();
        const left = Number(rect && rect.left);
        const top = Number(rect && rect.top);
        const width = Number(rect && rect.width);
        const height = Number(rect && rect.height);
        if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
        return {
            left,
            top,
            right: left + width,
            bottom: top + height,
            width,
            height
        };
    } catch (e: any) {
        return null;
    }
}

function _resolvePlacementHandOriginCenter(playerKey: any) {
    const handEl = _resolveHandElementByOwner(playerKey);
    if (!handEl) return null;
    const handRect = _readUsableClientRect(handEl);

    let cardRects: any[] = [];
    if (typeof handEl.querySelectorAll === 'function') {
        try {
            cardRects = Array.from(handEl.querySelectorAll('.card-item:not(.card-use-ghost)'))
                .map((cardEl: any) => _readUsableClientRect(cardEl))
                .map((rect: any) => {
                    if (!rect || !handRect) return rect;
                    const left = Math.max(rect.left, handRect.left);
                    const top = Math.max(rect.top, handRect.top);
                    const right = Math.min(rect.right, handRect.right);
                    const bottom = Math.min(rect.bottom, handRect.bottom);
                    return right > left && bottom > top ? { left, top, right, bottom } : null;
                })
                .filter(Boolean);
        } catch (e: any) { /* use the hand container fallback */ }
    }

    const originRect = cardRects.length > 0
        ? cardRects.reduce((unionRect: any, rect: any) => ({
            left: Math.min(unionRect.left, rect.left),
            top: Math.min(unionRect.top, rect.top),
            right: Math.max(unionRect.right, rect.right),
            bottom: Math.max(unionRect.bottom, rect.bottom)
        }))
        : handRect;
    if (!originRect) return null;

    return {
        x: originRect.left + ((originRect.right - originRect.left) / 2),
        y: originRect.top + ((originRect.bottom - originRect.top) / 2)
    };
}

function _playEffectByKeySafe(soundKey: any) {
    const key = String(soundKey || '').trim();
    if (!key) return;
    try {
        if (typeof SoundEngine !== 'undefined' && SoundEngine && typeof SoundEngine.playEffectByKey === 'function') {
            if (typeof SoundEngine.init === 'function') SoundEngine.init();
            SoundEngine.playEffectByKey(key);
        }
    } catch (e: any) { /* ignore */ }
}

function _playStonePlaceSoundSafe() {
    try {
        if (typeof SoundEngine !== 'undefined' && SoundEngine) {
            SoundEngine.init();
            if (typeof SoundEngine.playStoneClack === 'function') {
                SoundEngine.playStoneClack();
            } else if (typeof SoundEngine.playEffectByKey === 'function') {
                SoundEngine.playEffectByKey('stone_place');
            }
        }
    } catch (e: any) { /* ignore */ }
}

function _getBoardRendererGeometryForAnimationUtils() {
    if (__board_renderer_geometry_utils) return __board_renderer_geometry_utils;
    try {
        const renderer = _require('./board-renderer');
        if (renderer) {
            __board_renderer_geometry_utils = renderer;
            return renderer;
        }
    } catch (e: any) { /* compatibility fallback below */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).BoardRenderer) {
            __board_renderer_geometry_utils = (globalThis as any).BoardRenderer;
            return __board_renderer_geometry_utils;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveBoardCellClientRectForAnimationUtils(row: any, col: any) {
    const normalizedRow = Number(row);
    const normalizedCol = Number(col);
    if (!Number.isInteger(normalizedRow) || !Number.isInteger(normalizedCol)) return null;

    const renderer = _getBoardRendererGeometryForAnimationUtils();
    try {
        if (renderer && typeof renderer.getBoardCellClientRect === 'function') {
            const rect = _normalizeCardSourceRect(renderer.getBoardCellClientRect(normalizedRow, normalizedCol));
            if (rect && rect.width > 0 && rect.height > 0) return rect;
        }
    } catch (e: any) { /* unavailable geometry settles through the caller's existing fallback */ }
    return null;
}

function _resolveBoardDiscClientRectFromCellRect(cellRect: any, boardRoot: any) {
    const normalized = _normalizeCardSourceRect(cellRect);
    if (!normalized || !(normalized.width > 0) || !(normalized.height > 0)) return null;

    let discWidth = 0;
    let discHeight = 0;
    let insetX = NaN;
    let insetY = NaN;
    try {
        const style = boardRoot && boardRoot.style;
        const size = Number.parseFloat(style && style.getPropertyValue('--board-disc-size-px') || '');
        const inset = Number.parseFloat(style && style.getPropertyValue('--board-disc-inset-px') || '');
        if (Number.isFinite(size) && size > 0) {
            discWidth = size;
            discHeight = size;
        }
        if (Number.isFinite(inset) && inset >= 0) {
            insetX = inset;
            insetY = inset;
        }
    } catch (e: any) { /* use the same CSS percentage defaults below */ }

    if (!(discWidth > 0)) discWidth = normalized.width * 0.899;
    if (!(discHeight > 0)) discHeight = normalized.height * 0.899;
    if (!Number.isFinite(insetX)) insetX = normalized.width * 0.0505;
    if (!Number.isFinite(insetY)) insetY = normalized.height * 0.0505;

    return _normalizeCardSourceRect({
        left: normalized.left + insetX,
        top: normalized.top + insetY,
        width: discWidth,
        height: discHeight,
        right: normalized.left + insetX + discWidth,
        bottom: normalized.top + insetY + discHeight
    });
}

function _createLegacyBoardWriterErrorForUtils(code: string, event: any, cause?: any) {
    const error: any = new Error(`${code}:${String(event && event.type || 'unknown').trim().toLowerCase() || 'unknown'}`);
    error.name = 'PresentationPlaybackError';
    error.code = code;
    error.eventType = String(event && event.type || 'unknown').trim().toLowerCase() || 'unknown';
    error.strictNetworkPlayback = false;
    if (cause !== undefined) {
        Object.defineProperty(error, 'cause', {
            value: cause,
            configurable: true,
            enumerable: false,
            writable: false
        });
    }
    return error;
}

function _throwIfLegacyBoardWriterRecoveryIsUnresolvedForUtils(event: any) {
    if (__legacy_board_animation_token_utils && __legacy_board_animation_unresolved_error_utils) {
        throw _createLegacyBoardWriterErrorForUtils(
            'board_writer_recovery_unresolved',
            event,
            __legacy_board_animation_unresolved_error_utils
        );
    }
}

async function _openLegacyBoardAnimationWriterForUtils(renderer: any, event: any) {
    if (__legacy_board_animation_closing_utils) {
        try {
            await __legacy_board_animation_closing_utils;
        } catch (error: any) {
            _throwIfLegacyBoardWriterRecoveryIsUnresolvedForUtils(event);
            throw error;
        }
    }
    _throwIfLegacyBoardWriterRecoveryIsUnresolvedForUtils(event);
    if (__legacy_board_animation_token_utils) {
        return { renderer, token: __legacy_board_animation_token_utils };
    }
    await renderer.getBoardVisualControllerReady();
    if (!__legacy_board_animation_token_utils) {
        __legacy_board_animation_token_utils = renderer.claimBoardVisualWriter(
            `local:legacy-board-animation:${++__legacy_board_animation_sequence_utils}`,
            'local'
        );
    }
    return { renderer, token: __legacy_board_animation_token_utils };
}

async function _acquireLegacyBoardAnimationWriterForUtils(event: any) {
    const renderer = _getBoardRendererGeometryForAnimationUtils();
    if (
        !renderer
        || typeof renderer.claimBoardVisualWriter !== 'function'
        || typeof renderer.getBoardVisualControllerReady !== 'function'
        || typeof renderer.settleBoardVisualWriter !== 'function'
        || typeof renderer.playBoardVisualPhase !== 'function'
    ) {
        throw new Error('legacy_board_animation_writer_unavailable');
    }
    _throwIfLegacyBoardWriterRecoveryIsUnresolvedForUtils(event);
    // Reserve the lease before awaiting readiness. Concurrent callers then
    // keep the shared token alive even if the first playback settles fast.
    __legacy_board_animation_ref_count_utils += 1;
    try {
        if (__legacy_board_animation_token_utils && !__legacy_board_animation_closing_utils) {
            return { renderer, token: __legacy_board_animation_token_utils };
        }
        if (!__legacy_board_animation_opening_utils) {
            const opening = _openLegacyBoardAnimationWriterForUtils(renderer, event);
            __legacy_board_animation_opening_utils = opening;
            void opening.then(
                () => { if (__legacy_board_animation_opening_utils === opening) __legacy_board_animation_opening_utils = null; },
                () => { if (__legacy_board_animation_opening_utils === opening) __legacy_board_animation_opening_utils = null; }
            );
        }
        return await __legacy_board_animation_opening_utils;
    } catch (error: any) {
        __legacy_board_animation_ref_count_utils = Math.max(0, __legacy_board_animation_ref_count_utils - 1);
        _throwIfLegacyBoardWriterRecoveryIsUnresolvedForUtils(event);
        throw error;
    }
}

async function _settleLegacyBoardAnimationWriterForUtils(claim: any, event: any) {
    __legacy_board_animation_ref_count_utils = Math.max(0, __legacy_board_animation_ref_count_utils - 1);
    if (__legacy_board_animation_ref_count_utils !== 0) return;
    const token = __legacy_board_animation_token_utils;
    if (!token || !claim || !claim.renderer) return;
    if (!__legacy_board_animation_closing_utils) {
        // Publish the closing promise before invoking settlement so a new
        // caller cannot claim a second writer while final-frame sync runs.
        const closing = Promise.resolve().then(async () => {
            let settlementError: any = null;
            try {
                await claim.renderer.settleBoardVisualWriter(token);
            } catch (error: any) {
                settlementError = error && error.name === 'PresentationPlaybackError'
                    ? error
                    : _createLegacyBoardWriterErrorForUtils('board_writer_settlement_failed', event, error);
            }
            if (settlementError) {
                try {
                    if (typeof claim.renderer.enterBoardVisualRecovery !== 'function') {
                        throw new Error('Board writer recovery API unavailable');
                    }
                    claim.renderer.enterBoardVisualRecovery(token, settlementError);
                    await claim.renderer.settleBoardVisualWriter(token);
                } catch (recoveryError: any) {
                    __legacy_board_animation_unresolved_error_utils = settlementError;
                    Object.defineProperty(settlementError, 'recoveryError', {
                        value: recoveryError,
                        configurable: true,
                        enumerable: false,
                        writable: false
                    });
                    throw settlementError;
                }
            }
            if (__legacy_board_animation_token_utils === token) {
                __legacy_board_animation_token_utils = null;
            }
            __legacy_board_animation_unresolved_error_utils = null;
            return settlementError;
        });
        __legacy_board_animation_closing_utils = closing;
    }
    const closing = __legacy_board_animation_closing_utils;
    let settlementError: any = null;
    try {
        settlementError = await closing;
    } finally {
        if (__legacy_board_animation_closing_utils === closing) {
            __legacy_board_animation_closing_utils = null;
        }
    }
    if (settlementError) throw settlementError;
}

async function _playLegacyBoardAnimationEventForUtils(event: any) {
    const claim = await _acquireLegacyBoardAnimationWriterForUtils(event);
    try {
        await claim.renderer.playBoardVisualPhase(claim.token, [event]);
    } finally {
        await _settleLegacyBoardAnimationWriterForUtils(claim, event);
    }
}

function _resolveCardStateForHandAnimations() {
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object') return window.cardState;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _normalizeCardSourceRect(rectLike: any) {
    if (!rectLike || typeof rectLike !== 'object') return null;
    const left = Number(rectLike.left);
    const top = Number(rectLike.top);
    const width = Number(rectLike.width);
    const height = Number(rectLike.height);
    const right = Number(rectLike.right);
    const bottom = Number(rectLike.bottom);
    if (![left, top, width, height, right, bottom].every(Number.isFinite)) return null;
    return { left, top, width, height, right, bottom };
}

function _snapRectToWholePixels(rectLike: any) {
    const rect = _normalizeCardSourceRect(rectLike);
    if (!rect) return null;
    const left = Math.round(rect.left);
    const top = Math.round(rect.top);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    return {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height
    };
}

function _resolveCardUseSourceRect(sourceCardEl: any, sourceCardRect: any) {
    const snapshotRect = _normalizeCardSourceRect(sourceCardRect);
    if (snapshotRect && snapshotRect.width > 0 && snapshotRect.height > 0) return snapshotRect;
    let liveRect: any = null;
    if (sourceCardEl && typeof sourceCardEl.getBoundingClientRect === 'function') {
        try {
            liveRect = _normalizeCardSourceRect(sourceCardEl.getBoundingClientRect());
        } catch (e: any) { /* ignore */ }
    }
    if (liveRect && liveRect.width > 0 && liveRect.height > 0) return liveRect;
    return liveRect;
}

function _resolveCreateCardFaceElement() {
    try {
        if (typeof createCardFaceElement === 'function') return createCardFaceElement;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window && typeof window.createCardFaceElement === 'function') {
            return window.createCardFaceElement;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis && typeof (globalThis as any).createCardFaceElement === 'function') {
            return (globalThis as any).createCardFaceElement;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _getCardFaceArtPreloadRoot() {
    try {
        if (typeof window !== 'undefined' && window) return window as any;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis) return globalThis as any;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _getCardFaceArtPreloadCache() {
    const root = _getCardFaceArtPreloadRoot();
    if (!root) return null;
    try {
        if (!root.__cardFaceArtPreloadCache || typeof root.__cardFaceArtPreloadCache !== 'object') {
            root.__cardFaceArtPreloadCache = Object.create(null);
        }
        return root.__cardFaceArtPreloadCache;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _getCardFaceArtPathCache() {
    const root = _getCardFaceArtPreloadRoot();
    if (!root) return null;
    try {
        if (!root.__cardFaceArtPathCache || typeof root.__cardFaceArtPathCache !== 'object') {
            root.__cardFaceArtPathCache = Object.create(null);
        }
        return root.__cardFaceArtPathCache;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveCardBackgroundArtPathFunction() {
    try {
        if (typeof window !== 'undefined' && window && typeof (window as any).resolveCardBackgroundArtPath === 'function') {
            return (window as any).resolveCardBackgroundArtPath;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).resolveCardBackgroundArtPath === 'function') {
            return (globalThis as any).resolveCardBackgroundArtPath;
        }
    } catch (e: any) { /* ignore */ }
    try {
        const cardRenderer = _require('../cards/card-renderer');
        if (cardRenderer && typeof cardRenderer.resolveCardBackgroundArtPath === 'function') {
            return cardRenderer.resolveCardBackgroundArtPath;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _getCardFaceArtImageCtor() {
    try {
        if (typeof window !== 'undefined' && window && typeof (window as any).Image === 'function') {
            return (window as any).Image;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).Image === 'function') {
            return (globalThis as any).Image;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _normalizeCardFaceArtPreloadPath(pathValue: any) {
    const raw = String(pathValue || '').trim();
    if (!raw) return '';
    const urlMatch = raw.match(/^url\((['"]?)(.*?)\1\)$/i);
    const pathText = urlMatch ? String(urlMatch[2] || '').trim() : raw;
    if (!pathText || pathText === 'none') return '';
    return pathText;
}

function _isHiddenHandTokenId(cardId: any) {
    return HIDDEN_HAND_TOKEN_RE.test(String(cardId || '').trim());
}

function _resolveCardFaceArtPreloadCardId(primaryCardId: any, descriptor: any = null) {
    const normalizedPrimaryCardId = String(primaryCardId || '').trim();
    if (normalizedPrimaryCardId && !_isHiddenHandTokenId(normalizedPrimaryCardId)) {
        return normalizedPrimaryCardId;
    }
    const descriptorCardId = descriptor && typeof descriptor === 'object'
        ? String(descriptor.cardId || '').trim()
        : '';
    if (descriptorCardId && !_isHiddenHandTokenId(descriptorCardId)) {
        return descriptorCardId;
    }
    return normalizedPrimaryCardId || descriptorCardId || '';
}

function _readCardFaceArtPathFromElement(cardEl: any) {
    if (!cardEl || typeof cardEl !== 'object') return '';
    try {
        const datasetPath = cardEl.dataset && cardEl.dataset.cardBackgroundImage;
        const normalized = _normalizeCardFaceArtPreloadPath(datasetPath);
        if (normalized) return normalized;
    } catch (e: any) { /* ignore */ }
    try {
        if (cardEl.style && typeof cardEl.style.getPropertyValue === 'function') {
            const stylePath = cardEl.style.getPropertyValue('--card-background-art-image');
            const normalized = _normalizeCardFaceArtPreloadPath(stylePath);
            if (normalized) return normalized;
        }
    } catch (e: any) { /* ignore */ }
    return '';
}

function _resolveCardFaceArtPathForPreload(cardId: any, options: any = {}) {
    const normalizedCardId = String(cardId || '').trim();
    if (!normalizedCardId || _isHiddenHandTokenId(normalizedCardId)) return '';
    const ownerKey = String(options && options.ownerKey || '').trim();
    const cacheKey = `${ownerKey}::${normalizedCardId}`;
    const pathCache = _getCardFaceArtPathCache();
    if (pathCache && Object.prototype.hasOwnProperty.call(pathCache, cacheKey)) {
        return pathCache[cacheKey] || '';
    }
    const resolveCardBackgroundArtPath = _resolveCardBackgroundArtPathFunction();
    if (typeof resolveCardBackgroundArtPath === 'function') {
        try {
            const resolvedPath = _normalizeCardFaceArtPreloadPath(
                resolveCardBackgroundArtPath(normalizedCardId, { ownerKey: ownerKey || undefined })
            );
            if (resolvedPath) {
                if (pathCache) pathCache[cacheKey] = resolvedPath;
                return resolvedPath;
            }
        } catch (e: any) { /* fall through to compatibility path */ }
    }
    const createCardFaceElement = _resolveCreateCardFaceElement();
    if (typeof createCardFaceElement !== 'function') return '';
    try {
        const cardEl = createCardFaceElement(normalizedCardId, { ownerKey: options.ownerKey });
        const resolvedPath = _readCardFaceArtPathFromElement(cardEl);
        if (pathCache) pathCache[cacheKey] = resolvedPath || '';
        return resolvedPath;
    } catch (e: any) { /* ignore */ }
    return '';
}

function preloadCardFaceArtForAnimation(cardId: any, options: any = {}) {
    const imagePath = _resolveCardFaceArtPathForPreload(cardId, options);
    if (!imagePath) {
        const skipped: any = Promise.resolve({ status: 'skipped', reason: 'no-card-art' });
        skipped.__cardFaceArtPreloadShouldWait = false;
        return skipped;
    }

    const cache = _getCardFaceArtPreloadCache();
    if (cache && cache[imagePath] && cache[imagePath].promise) {
        return cache[imagePath].promise;
    }

    const ImageCtor = _getCardFaceArtImageCtor();
    if (typeof ImageCtor !== 'function') {
        const skipped: any = Promise.resolve({ status: 'skipped', reason: 'image-unavailable', path: imagePath });
        skipped.__cardFaceArtPreloadShouldWait = false;
        return skipped;
    }

    let img: any = null;
    const cacheEntry: any = cache ? { promise: null, image: null } : null;
    const promise = new Promise((resolve) => {
        let settled = false;
        const settle = (status: string) => {
            if (settled) return;
            settled = true;
            if (cacheEntry) {
                cacheEntry.image = null;
            }
            resolve({ status, path: imagePath });
        };
        try {
            img = new ImageCtor();
            if (cacheEntry) {
                cacheEntry.image = img;
            }
            img.onload = () => settle('loaded');
            img.onerror = () => settle('error');
            try { img.decoding = 'async'; } catch (e: any) { /* ignore */ }
            try { img.loading = 'eager'; } catch (e: any) { /* ignore */ }
            try { img.fetchPriority = options.priority || 'high'; } catch (e: any) { /* ignore */ }
            img.src = imagePath;
            try {
                if (img.complete === true) settle('loaded');
            } catch (e: any) { /* ignore */ }
        } catch (e: any) {
            settle('error');
        }
    });

    if (cacheEntry) {
        cacheEntry.promise = promise;
        cache[imagePath] = cacheEntry;
    }
    (promise as any).__cardFaceArtPreloadShouldWait = true;
    return promise;
}

function _shouldWaitForCardFaceArtPreload(preloadPromise: any) {
    return !!(preloadPromise && preloadPromise.__cardFaceArtPreloadShouldWait === true);
}

function _waitForCardFaceArtPreload(preloadPromise: any, timeoutMs: number = CARD_FACE_ART_REVEAL_WAIT_MS) {
    if (!preloadPromise || typeof preloadPromise.then !== 'function') return Promise.resolve(null);
    const safeTimeoutMs = Number.isFinite(Number(timeoutMs)) ? Math.max(0, Math.floor(Number(timeoutMs))) : 0;
    if (safeTimeoutMs <= 0) {
        return Promise.resolve(preloadPromise).catch((error: any) => ({ status: 'error', error }));
    }
    return new Promise((resolve) => {
        let settled = false;
        let timeoutId: any = null;
        const finish = (value: any) => {
            if (settled) return;
            settled = true;
            if (timeoutId !== null) {
                try { clearTimeout(timeoutId); } catch (e: any) { /* ignore */ }
                timeoutId = null;
            }
            resolve(value);
        };
        timeoutId = setTimeout(() => finish({ status: 'timeout' }), safeTimeoutMs);
        Promise.resolve(preloadPromise).then(finish, (error: any) => finish({ status: 'error', error }));
    });
}

function _resolveApplyCardSpecialArtToFace() {
    try {
        if (typeof applyCardSpecialArtToFace === 'function') return applyCardSpecialArtToFace;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window && typeof window.applyCardSpecialArtToFace === 'function') {
            return window.applyCardSpecialArtToFace;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis && typeof (globalThis as any).applyCardSpecialArtToFace === 'function') {
            return (globalThis as any).applyCardSpecialArtToFace;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _getFallbackCardCostTier(cost: any) {
    const safeCost = Number.isFinite(Number(cost)) ? Number(cost) : null;
    if (safeCost === null) return null;
    if (safeCost === 0) return 'white';
    if (safeCost >= 31) return 'special';
    if (safeCost >= 21) return 'gold';
    if (safeCost >= 16) return 'purple';
    if (safeCost >= 11) return 'blue';
    if (safeCost >= 6) return 'red';
    return 'gray';
}

function _normalizeCardUseDisplayTypeLabel(label: any) {
    const normalized = String(label || '').trim();
    return normalized || '';
}

function _resolveCardUseDisplayTypeLabel(descriptor: any, cardId: any) {
    const directLabel = _normalizeCardUseDisplayTypeLabel(
        descriptor && (descriptor.display_type_ja || descriptor.displayTypeJa || descriptor.displayTypeLabel || descriptor.typeLabel)
    );
    if (directLabel) return directLabel;

    try {
        if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardDef === 'function' && cardId) {
            const cardDef = CardLogic.getCardDef(cardId);
            const cardLabel = _normalizeCardUseDisplayTypeLabel(cardDef && (cardDef.display_type_ja || cardDef.displayTypeJa));
            if (cardLabel) return cardLabel;
        }
    } catch (e: any) { /* ignore */ }

    try {
        if (typeof window !== 'undefined' && window.CardCatalog && Array.isArray(window.CardCatalog.cards) && cardId) {
            const catalogCard = window.CardCatalog.cards.find((entry: any) => entry && entry.id === cardId);
            const catalogLabel = _normalizeCardUseDisplayTypeLabel(catalogCard && (catalogCard.display_type_ja || catalogCard.displayTypeJa));
            if (catalogLabel) return catalogLabel;
        }
    } catch (e: any) { /* ignore */ }

    return '';
}

function _normalizeCardUseVisualDescriptor(descriptor: any, fallbackCardId: any, fallbackCardName: any, fallbackCardCost: any) {
    const resolved = (descriptor && typeof descriptor === 'object') ? Object.assign({}, descriptor) : {};
    if (!resolved.cardId && fallbackCardId) {
        resolved.cardId = fallbackCardId;
    }
    if (!resolved.name && fallbackCardName) {
        resolved.name = fallbackCardName;
    }
    if (!Number.isFinite(Number(resolved.cost)) && Number.isFinite(Number(fallbackCardCost))) {
        resolved.cost = Number(fallbackCardCost);
    }
    if (!resolved.costTier) {
        resolved.costTier = _getFallbackCardCostTier(resolved.cost);
    }
    return resolved;
}

function _readCardUseDescriptorFromSourceElement(sourceCardEl: any) {
    if (!sourceCardEl || typeof sourceCardEl.querySelector !== 'function') return {};
    const descriptor: any = {};
    try {
        if (sourceCardEl.dataset && sourceCardEl.dataset.cardId) {
            descriptor.cardId = String(sourceCardEl.dataset.cardId);
        }
    } catch (e: any) { /* ignore */ }
    try {
        const classList: string[] = sourceCardEl.classList ? Array.from(sourceCardEl.classList) : [];
        const costTierClass = classList.find((className) => /^cost-tier-/.test(className)) as string | undefined;
        if (costTierClass) {
            descriptor.costTier = costTierClass.replace(/^cost-tier-/, '');
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (sourceCardEl.dataset && sourceCardEl.dataset.cardType) {
            descriptor.cardType = String(sourceCardEl.dataset.cardType);
        }
    } catch (e: any) { /* ignore */ }
    try {
        const nameEl = sourceCardEl.querySelector('.card-name');
        const label = String(nameEl && nameEl.textContent || '').trim();
        if (label) descriptor.name = label;
    } catch (e: any) { /* ignore */ }
    try {
        const costValueEl = sourceCardEl.querySelector('.card-cost-badge .cost-value');
        const rawCost = String(costValueEl && costValueEl.textContent || '').trim();
        const parsedCost = Number(rawCost);
        if (Number.isFinite(parsedCost)) {
            descriptor.cost = parsedCost;
        }
    } catch (e: any) { /* ignore */ }
    return descriptor;
}

function _buildCardUseMovingElement(sourceCardEl: any, descriptor: any, ownerKey: any) {
    const elementDescriptor = _readCardUseDescriptorFromSourceElement(sourceCardEl);
    const visualDescriptor = _normalizeCardUseVisualDescriptor(
        Object.assign({}, elementDescriptor, descriptor || {}),
        elementDescriptor.cardId || (descriptor && descriptor.cardId) || null,
        elementDescriptor.name || (descriptor && descriptor.name) || null,
        Number.isFinite(Number(elementDescriptor.cost))
            ? Number(elementDescriptor.cost)
            : ((descriptor && Number.isFinite(Number(descriptor.cost))) ? Number(descriptor.cost) : null)
    );
    const movingCard = _buildFallbackCardUseElement(
        visualDescriptor.cardId || null,
        visualDescriptor.name || null,
        Number.isFinite(Number(visualDescriptor.cost)) ? Number(visualDescriptor.cost) : null,
        visualDescriptor,
        ownerKey
    );
    if (movingCard && movingCard.classList) {
        movingCard.classList.add('card-use-ghost');
        movingCard.classList.remove('clickable', 'usable', 'affordable', 'selected');
    }
    return movingCard;
}

function _buildFallbackCardUseElement(cardId: any, cardName: any, cardCost: any, descriptor: any, ownerKey: any) {
    const visualDescriptor = _normalizeCardUseVisualDescriptor(descriptor, cardId, cardName, cardCost);
    const resolvedCardId = visualDescriptor.cardId || null;
    const resolvedCardName = visualDescriptor.name || null;
    const resolvedCardCost = Number.isFinite(Number(visualDescriptor.cost)) ? Number(visualDescriptor.cost) : null;
    const resolvedCostTier = visualDescriptor.costTier || _getFallbackCardCostTier(resolvedCardCost);
    const resolvedTypeLabel = _resolveCardUseDisplayTypeLabel(visualDescriptor, resolvedCardId);
    const createCardFaceElement = _resolveCreateCardFaceElement();
    const applyCardSpecialArtToFace = _resolveApplyCardSpecialArtToFace();
    if (createCardFaceElement && resolvedCardId) {
        try {
            const rendered = createCardFaceElement(resolvedCardId, { ownerKey });
            if (rendered && rendered.nodeType === 1) {
                return rendered;
            }
        } catch (e: any) { /* ignore */ }
    }

    const cardEl = document.createElement('div');
    cardEl.className = 'card-item visible';
    if (resolvedCardId) {
        try { cardEl.dataset.cardId = String(resolvedCardId); } catch (e: any) { /* ignore */ }
    }
    if (resolvedCostTier) {
        const tierClass = `cost-tier-${resolvedCostTier}`;
        cardEl.classList.add(tierClass);
    }
    const _typeKeyMap: Record<string, string> = { '採掘':'mining', '守護':'guard', '戦闘':'battle', '執行':'judgment', '禁忌':'taboo', '殲滅':'annihilation', '繁栄':'prosperity', '特殊':'special' };
    const descriptorTypeKey = String(visualDescriptor.cardType || visualDescriptor.card_type || '').trim();
    const resolvedTypeKey = descriptorTypeKey || _typeKeyMap[resolvedTypeLabel] || '';
    if (resolvedTypeKey) {
        try { cardEl.dataset.cardType = resolvedTypeKey; } catch (e: any) { /* ignore */ }
    }

    if (resolvedCardName) {
        const label = document.createElement('span');
        label.className = 'card-name';
        label.textContent = resolvedCardName;
        cardEl.appendChild(label);
        try {
            if (typeof window !== 'undefined' && typeof window.fitCardNameElement === 'function') {
                window.fitCardNameElement(label);
            }
        } catch (e: any) { /* ignore */ }
    }
    if (resolvedCardCost !== null) {
        const badge = document.createElement('div');
        badge.className = 'card-cost-badge';
        if (resolvedCostTier) {
            badge.classList.add(`cost-tier-${resolvedCostTier}`);
        }
        const costValue = document.createElement('span');
        costValue.className = 'cost-value';
        costValue.textContent = String(resolvedCardCost);
        const costLabel = document.createElement('span');
        costLabel.className = 'cost-label';
        costLabel.textContent = 'cost';
        badge.appendChild(costValue);
        badge.appendChild(costLabel);
        cardEl.appendChild(badge);
    }
    if (applyCardSpecialArtToFace) {
        applyCardSpecialArtToFace(cardEl, visualDescriptor, { cardId: resolvedCardId, ownerKey });
    }
    return cardEl;
}

function _getHandRevealState() {
    try {
        if (typeof window === 'undefined') return null;
        const state = window.__handSequentialRevealState;
        return (state && typeof state === 'object') ? state : null;
    } catch (e: any) {
        return null;
    }
}

function _setHandRevealState(nextState: any) {
    try {
        if (typeof window === 'undefined') return;
        window.__handSequentialRevealState = nextState || null;
    } catch (e: any) { /* ignore */ }
}

function _setHandRevealCount(playerKey: any, visibleCount: any, reason: any) {
    const ownerKey = _normalizeHandOwnerKey(playerKey);
    const safeCount = Math.max(0, Math.trunc(Number(visibleCount) || 0));
    _setHandRevealState({ playerKey: ownerKey, visibleCount: safeCount, reason: reason || null });
}

const THROW_CHAIN_HAND_FADE_DURATION = '1s';
const DEFAULT_HAND_FADE_DURATION_MS = 500;

function _parseHandFadeDurationMs(rawValue: any, fallbackMs: any) {
    const value = String(rawValue || '').trim();
    if (!value) return fallbackMs;
    if (value.endsWith('ms')) {
        const parsedMs = Number.parseFloat(value.slice(0, -2));
        return Number.isFinite(parsedMs) ? Math.max(0, parsedMs) : fallbackMs;
    }
    if (value.endsWith('s')) {
        const parsedSeconds = Number.parseFloat(value.slice(0, -1));
        return Number.isFinite(parsedSeconds) ? Math.max(0, parsedSeconds * 1000) : fallbackMs;
    }
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallbackMs;
}

function _cancelHandFadeInCleanup(cardEl: any) {
    if (!cardEl || typeof cardEl.__cancelHandFadeInCleanup !== 'function') return;
    const cleanup = cardEl.__cancelHandFadeInCleanup;
    delete cardEl.__cancelHandFadeInCleanup;
    try { cleanup(); } catch (e: any) { /* ignore */ }
}

function _settleHandFadeInVisualState(cardEl: any) {
    if (!cardEl) return;
    _cancelHandFadeInCleanup(cardEl);
    cardEl.classList.remove('card-fade-prep');
    cardEl.classList.remove('card-fade-in');
    cardEl.style.removeProperty('--card-fade-in-duration');
}

function getQueuedHandFadeInState() {
    if (__hand_fade_state_utils && typeof __hand_fade_state_utils.getQueuedHandFadeInState === 'function') {
        return __hand_fade_state_utils.getQueuedHandFadeInState(typeof window !== 'undefined' ? window : null);
    }
    return null;
}

function _setQueuedHandFadeInState(fadeState: any) {
    if (__hand_fade_state_utils && typeof __hand_fade_state_utils.setQueuedHandFadeInState === 'function') {
        return __hand_fade_state_utils.setQueuedHandFadeInState(fadeState, typeof window !== 'undefined' ? window : null);
    }
    return null;
}

function _armHandFadeInVisualCleanup(cardEl: any) {
    if (!cardEl) return;
    _cancelHandFadeInCleanup(cardEl);
    const scope = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
    const token = {};
    let timeoutId: any = null;
    const cleanup = () => {
        if (cardEl.__handFadeInCleanupToken !== token) return;
        cardEl.removeEventListener('animationend', onEnd);
        if (timeoutId !== null) {
            try { _Timer().clearTimeout(timeoutId); } catch (e: any) { /* ignore */ }
            timeoutId = null;
        }
        delete cardEl.__handFadeInCleanupToken;
        delete cardEl.__cancelHandFadeInCleanup;
    };
    const settle = () => {
        if (cardEl.__handFadeInCleanupToken !== token) return;
        cleanup();
        cardEl.classList.remove('card-fade-prep');
        cardEl.classList.remove('card-fade-in');
        cardEl.style.removeProperty('--card-fade-in-duration');
    };
    const onEnd = (ev: any) => {
        if (ev && ev.target && ev.target !== cardEl) return;
        if (ev && ev.animationName && ev.animationName !== 'card-fade-in') return;
        settle();
    };
    cardEl.__handFadeInCleanupToken = token;
    cardEl.__cancelHandFadeInCleanup = cleanup;
    cardEl.addEventListener('animationend', onEnd);
    const durationMs = _parseHandFadeDurationMs(
        cardEl.style.getPropertyValue('--card-fade-in-duration'),
        DEFAULT_HAND_FADE_DURATION_MS
    );
    timeoutId = _Timer().setTimeout(() => {
        timeoutId = null;
        settle();
    }, durationMs + 120, scope);
}

function _clearHandFadeInState(criteria: any) {
    if (__hand_fade_state_utils && typeof __hand_fade_state_utils.clearQueuedHandFadeInState === 'function') {
        __hand_fade_state_utils.clearQueuedHandFadeInState(criteria, typeof window !== 'undefined' ? window : null);
    }
}

function _applyQueuedHandFadeIn(fadeState: any, payload: any) {
    if (!fadeState || !fadeState.token) return;
    try {
        const activeState = getQueuedHandFadeInState();
        if (!activeState || activeState.token !== fadeState.token) return;

        const handSelector = _resolveHandSelectorByOwner(fadeState.playerKey);
        const latestCard: HTMLElement | null = document.querySelector(`${handSelector} .card-item:last-child`);
        if (latestCard) {
            _settleHandFadeInVisualState(latestCard);
            if (payload && payload.reason === 'generated_throw_chain') {
                latestCard.style.setProperty('--card-fade-in-duration', THROW_CHAIN_HAND_FADE_DURATION);
            } else {
                latestCard.style.removeProperty('--card-fade-in-duration');
            }
            latestCard.classList.add('card-fade-in');
            _armHandFadeInVisualCleanup(latestCard);
        }
    } catch (e: any) { /* ignore */ }
    _clearHandFadeInState(fadeState.token);
}

function _queryOwnerHandFadeElements(playerKey: any) {
    const handElements = _getHandElementsByOwner(playerKey);
    const matches: any[] = [];
    handElements.forEach((handEl: any) => {
        matches.push(...Array.from(handEl.querySelectorAll('.card-item.card-fade-prep, .card-item.card-fade-in')));
    });
    return matches;
}

function settleOwnerHandFadeIn(playerKey: any) {
    const ownerKey = _normalizeHandOwnerKey(playerKey);
    _queryOwnerHandFadeElements(ownerKey).forEach((cardEl) => {
        _settleHandFadeInVisualState(cardEl);
    });
    _clearHandFadeInState({ ownerKey });
    return true;
}

function _scheduleQueuedHandFadeIn(fadeState: any, payload: any) {
    if (!fadeState || !fadeState.token) return;

    const run = () => _applyQueuedHandFadeIn(fadeState, payload || null);
    try {
        const raf = (typeof requestAnimationFrame === 'function')
            ? requestAnimationFrame
            : ((typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
                ? window.requestAnimationFrame.bind(window)
                : null);
        if (typeof raf === 'function') {
            raf(run);
            return;
        }
    } catch (e: any) { /* ignore */ }
    run();
}

function _installAnimationResolveFallback(done: any, timeoutMs: any) {
    if (typeof done !== 'function') return function () {};
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return function () {};

    let fallbackId: any = null;
    try {
        fallbackId = setTimeout(() => {
            fallbackId = null;
            done();
        }, timeoutMs);
    } catch (e: any) {
        fallbackId = null;
    }

    return function clearFallback() {
        if (fallbackId === null) return;
        try { clearTimeout(fallbackId); } catch (e: any) { /* ignore */ }
        fallbackId = null;
    };
}

function _getHandLayerAnimationRoot() {
    if (typeof window !== 'undefined' && window) return window;
    try {
        if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _getHandLayerAnimationQueueTail(rootRef: any) {
    if (!rootRef) return Promise.resolve();
    const tail = rootRef.__handLayerAnimationQueueTail;
    return (tail && typeof tail.then === 'function')
        ? tail.catch(() => {})
        : Promise.resolve();
}

function _setHandLayerAnimationQueueTail(rootRef: any, nextTail: any) {
    if (!rootRef) return;
    try {
        rootRef.__handLayerAnimationQueueTail = nextTail || null;
    } catch (e: any) { /* ignore */ }
}

function _enqueueHandLayerAnimation(task: any) {
    const runTask = (typeof task === 'function') ? task : function () { return Promise.resolve(); };
    const rootRef = _getHandLayerAnimationRoot();
    if (!rootRef) {
        return Promise.resolve().then(runTask);
    }

    const previousTail = _getHandLayerAnimationQueueTail(rootRef);
    let releaseQueue: (value?: unknown) => void = function () {};
    const gate = new Promise<void>((resolve) => {
        releaseQueue = resolve as (value?: unknown) => void;
    });
    const nextTail = previousTail.then(() => gate);
    _setHandLayerAnimationQueueTail(rootRef, nextTail);

    const clearTailIfCurrent = () => {
        try {
            if ((rootRef as any).__handLayerAnimationQueueTail === nextTail) {
                (rootRef as any).__handLayerAnimationQueueTail = null;
            }
        } catch (e: any) { /* ignore */ }
    };

    return previousTail.then(() => {
        return Promise.resolve(runTask()).finally(() => {
            releaseQueue();
            void nextTail.finally(clearTailIfCurrent);
        });
    });
}

function _animateCompat(el: any, keyframes: any, options: any, scope: any) {
    return new Promise<void>((resolve) => {
        if (!el) return resolve();
        const duration = Math.max(0, Number(options && options.duration) || 0);
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            resolve();
        };

        // Primary path: Web Animations API
        try {
            if (typeof el.animate === 'function') {
                const anim = el.animate(keyframes, options || {});
                if (anim) {
                    try { anim.addEventListener('finish', finish, { once: true }); } catch (e: any) { /* ignore */ }
                    try {
                        if (anim.finished && typeof anim.finished.then === 'function') {
                            anim.finished.then(finish).catch(finish);
                        }
                    } catch (e: any) { /* ignore */ }
                    _Timer().setTimeout(finish, duration + 140, scope);
                    return;
                }
            }
        } catch (e: any) { /* fallback below */ }

        // Fallback path: transition-based minimal animation
        const frames = Array.isArray(keyframes) ? keyframes : [];
        const first = frames.length ? frames[0] : {};
        const last = frames.length ? frames[frames.length - 1] : first;
        const easing = (options && options.easing) ? options.easing : 'linear';
        const requestedOpacityDuration = Number(options && options.opacityDuration);
        const opacityDuration = Number.isFinite(requestedOpacityDuration)
            ? Math.max(0, requestedOpacityDuration)
            : duration;
        const supportsStyle = !!(el && el.style);
        const prevTransition = supportsStyle ? (el.style.transition || '') : '';

        if (supportsStyle) {
            if (first && Object.prototype.hasOwnProperty.call(first, 'transform')) el.style.transform = first.transform;
            if (first && Object.prototype.hasOwnProperty.call(first, 'opacity')) el.style.opacity = first.opacity;
            try { void el.offsetHeight; } catch (e: any) { /* ignore */ }

            const transitionParts = [];
            if ((first && Object.prototype.hasOwnProperty.call(first, 'transform')) || (last && Object.prototype.hasOwnProperty.call(last, 'transform'))) {
                transitionParts.push(`transform ${duration}ms ${easing}`);
            }
            if ((first && Object.prototype.hasOwnProperty.call(first, 'opacity')) || (last && Object.prototype.hasOwnProperty.call(last, 'opacity'))) {
                transitionParts.push(`opacity ${opacityDuration}ms ${easing}`);
            }
            if (transitionParts.length) {
                el.style.transition = transitionParts.join(', ');
            }

            const applyLast = () => {
                try {
                    if (last && Object.prototype.hasOwnProperty.call(last, 'transform')) el.style.transform = last.transform;
                    if (last && Object.prototype.hasOwnProperty.call(last, 'opacity')) el.style.opacity = last.opacity;
                } catch (e: any) { /* ignore */ }
            };
            try {
                if (typeof requestAnimationFrame === 'function') requestAnimationFrame(applyLast);
                else _Timer().setTimeout(applyLast, 16, scope);
            } catch (e: any) {
                applyLast();
            }
        }

        _Timer().setTimeout(() => {
            try { if (supportsStyle) el.style.transition = prevTransition; } catch (e: any) { /* ignore */ }
            finish();
        }, duration + 40, scope);
    });
}
/**
 * 破壊アニメーション
 * Animate destruction at a single board cell (returns a Promise)
 * @param {number} row - 行
 * @param {number} col - 列
 * @returns {Promise<void>}
 */
function animateDestroyAt(row: any, col: any, options: any) {
    return animateFadeOutAt(row, col, options);
}

/**
 * フェードアウトアニメーション（破壊用）
 * Animate fade-out at a single board cell (returns a Promise)
 * @param {number} row - 行
 * @param {number} col - 列
 * @returns {Promise<void>}
 */
function animateFadeOutAt(row: any, col: any, options: any) {
    return _playLegacyBoardAnimationEventForUtils({
        type: 'legacy_fade_out',
        row,
        col,
        options: options || {}
    });
}

/**
 * 強い意志付与のフェードイン
 * @param {number} row
 * @param {number} col
 * @returns {Promise<void>}
 */
function animateStrongWillApply(row: any, col: any) {
    return _playLegacyBoardAnimationEventForUtils({
        type: 'legacy_strong_will_apply',
        row,
        col
    });
}

/**
 * 石配置アニメーション
 * Play hand animation for stone placement
 * @param {number} player - プレイヤー (BLACK or WHITE)
 * @param {number} row - 行
 * @param {number} col - 列
 * @param {Function} onComplete - 完了コールバック
 */
function playHandAnimation(player: any, row: any, col: any, onComplete: any, visualOptions: any) {
    return _enqueueHandLayerAnimation(() => new Promise<void>((resolveQueue) => {
        const preserveInputLock = visualOptions?.preserveInputLock === true;
        const placementApproval = visualOptions?.waitForPlacement;
        const signal = visualOptions?.signal;
        const syncCardAnimating = (locked: any) => {
            if (preserveInputLock) return;
            _setCardAnimatingState(locked);
        };
        const refreshCardUi = () => {
            _requestCardUiSyncForAnimationUtils('animation-utils:play-hand-animation');
        };
        const unlockProcessing = () => {
            if (preserveInputLock) return;
            _setProcessingState(false);
        };
        const releaseQueue = () => {
            try { resolveQueue(); } catch (e: any) { /* ignore */ }
        };
        const completeImmediately = () => {
            unlockProcessing();
            syncCardAnimating(false);
            refreshCardUi();
            try { if (typeof onComplete === 'function') onComplete(); } catch (e: any) { /* ignore */ }
            releaseQueue();
        };

        if (!preserveInputLock) _setProcessingState(true);
        if (signal?.aborted) {
            completeImmediately();
            return;
        }

        const boardRoot = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document.getElementById('board');
        const cellRect = _resolveBoardCellClientRectForAnimationUtils(row, col);
        if (!cellRect) {
            completeImmediately();
            return;
        }

        // No-Animation: short-circuit to immediate completion without toggling isCardAnimating
        if (_isNoAnim()) {
            completeImmediately();
            return;
        }

        if (_isHandAnimationDisabled('place')) {
            if (placementApproval) {
                Promise.resolve(placementApproval).then((accepted) => {
                    if (accepted && !signal?.aborted) _playStonePlaceSoundSafe();
                }).finally(completeImmediately);
            } else {
                _playStonePlaceSoundSafe();
                completeImmediately();
            }
            return;
        }

        const { layerEl, wrapperEl, heldStoneEl } = _resolveHandLayerElements();
        if (!layerEl || !wrapperEl || !heldStoneEl || !boardRoot) {
            completeImmediately();
            return;
        }

        // Mark that a UI card animation is in progress so Auto loop waits for visual completion
        syncCardAnimating(true);
        // Safety: clear the flag after a maximum duration in case animationend doesn't fire
        const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
        let handAnimationTimeout = _Timer().setTimeout(() => {
            syncCardAnimating(false);
            refreshCardUi();
        }, 3000, sc);

        const boardRect = boardRoot.getBoundingClientRect();
        const requestedOwnerKey = (visualOptions && typeof visualOptions === 'object' && visualOptions.ownerKey != null)
            ? visualOptions.ownerKey
            : player;
        const playerKey = _normalizeHandOwnerKey(requestedOwnerKey);
        const fromBottom = _isOwnerOnBottomSlot(playerKey);
        const handOriginCenter = _resolvePlacementHandOriginCenter(playerKey);
        const wrapperLayoutWidth = Number(wrapperEl.offsetWidth) > 0
            ? Number(wrapperEl.offsetWidth)
            : HAND_WRAPPER_WIDTH;
        const wrapperLayoutHeight = Number(wrapperEl.offsetHeight) > 0
            ? Number(wrapperEl.offsetHeight)
            : HAND_WRAPPER_WIDTH;

        const handContext = _syncDisplayedHandSkinForAnimation(player, visualOptions);
        // Prepare the next frame while hidden without tearing down the composited wrapper.
        _cancelElementAnimations(wrapperEl);
        _ensureHandAnimationLayerMounted(layerEl);
        _setHandWrapperPresentationActive(wrapperEl, false);
        heldStoneEl.style.display = 'block';
        heldStoneEl.className = 'held-stone ' + (player === BLACK ? 'black' : 'white');

        // Calculate Position
        const cellCenterX = cellRect.left + (cellRect.width / 2);
        const cellCenterY = cellRect.top + (cellRect.height / 2);
        const wrapW = HAND_WRAPPER_WIDTH;

        let startY;
        let dropY;
        let rotation;
        let scale;

        if (fromBottom) {
            // Bottom seat: from below board
            rotation = 0;
            scale = 0.8;
            dropY = cellCenterY - 55;
            startY = boardRect.bottom + 50;
        } else {
            // Top seat: from above board
            rotation = 180;
            scale = 0.7;
            dropY = cellCenterY - 290;
            startY = boardRect.top - 250;
        }

        const dropX = cellCenterX - (wrapW / 2);
        const startX = handOriginCenter
            ? handOriginCenter.x - (wrapperLayoutWidth / 2)
            : dropX;
        if (handOriginCenter) {
            const visualCenterOffsetY = fromBottom
                ? wrapperLayoutHeight - ((wrapperLayoutHeight * scale) / 2)
                : wrapperLayoutHeight + ((wrapperLayoutHeight * scale) / 2);
            startY = handOriginCenter.y - visualCenterOffsetY;
        }

        // Set initial state
        wrapperEl.style.transform = `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})`;
        _setHandWrapperPresentationActive(wrapperEl, true);
        let completed = false;
        let cleanupStarted = false;
        let clearCleanupFallback = function () {};
        const completeMove = () => {
            if (completed) return;
            completed = true;
            try { if (typeof onComplete === 'function') onComplete(); } catch (e: any) { /* ignore */ }
        };
        const cleanup = () => {
            if (cleanupStarted) return;
            cleanupStarted = true;
            signal?.removeEventListener('abort', cleanup);
            clearCleanupFallback();
            completeMove();
            _setHandWrapperPresentationActive(wrapperEl, false);
            heldStoneEl.style.display = 'none';
            _cancelElementAnimations(wrapperEl);
            _restoreDisplayedHandSkinAfterAnimation(handContext);
            if (handAnimationTimeout) {
                _Timer().clearTimeout(handAnimationTimeout);
                handAnimationTimeout = null;
            }
            syncCardAnimating(false);
            unlockProcessing();
            refreshCardUi();
            releaseQueue();
        };

        // The placement event settles at stone contact so board playback can continue
        // without waiting for the retreat. Its playback scope may therefore be cleared
        // while the hand is still leaving; keep this visual cleanup watchdog unscoped.
        clearCleanupFallback = _installAnimationResolveFallback(cleanup, HAND_PLACE_CLEANUP_FALLBACK_MS);
        signal?.addEventListener('abort', cleanup, { once: true });

        (async () => {
            // 1. Approach
            await _animateCompat(wrapperEl, [
                {
                    transform: `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})`,
                    opacity: 0
                },
                {
                    transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})`,
                    opacity: 1
                }
            ], {
                duration: HAND_PLACE_APPROACH_MS,
                easing: HAND_TRAVEL_EASING,
                fill: 'forwards'
            }, sc);
            if (!_isHandWrapperPresentationActive(wrapperEl)) return;

            // Start travelling at input time, but never drop a stone or play its
            // sound before the matching authoritative placement is ready.
            if (placementApproval) {
                clearCleanupFallback();
                if (await placementApproval !== true || signal?.aborted || cleanupStarted) return;
                clearCleanupFallback = _installAnimationResolveFallback(cleanup, HAND_PLACE_CLEANUP_FALLBACK_MS);
            }

            // 2. Place (Bobbing effect)
            const bobOffset = (player === BLACK) ? 10 : -10;
            const placeAnim = _animateCompat(wrapperEl, [
                { transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})` },
                { transform: `translate(${dropX}px, ${dropY + bobOffset}px) rotate(${rotation}deg) scale(${scale * 0.95})` },
                { transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})` }
            ], {
                duration: HAND_PLACE_BOB_MS,
                easing: 'ease-in-out'
            }, sc);

            // Reflect placement immediately when the hand starts the place motion.
            heldStoneEl.style.display = 'none';
            _playStonePlaceSoundSafe();
            completeMove();
            await placeAnim;
            if (!_isHandWrapperPresentationActive(wrapperEl)) return;

            // 3. Retreat
            const fadeOutX = dropX + ((startX - dropX) * HAND_PLACE_FADE_OUT_PROGRESS);
            const fadeOutY = dropY + ((startY - dropY) * HAND_PLACE_FADE_OUT_PROGRESS);
            await _animateCompat(wrapperEl, [
                {
                    transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})`,
                    opacity: 1
                },
                {
                    transform: `translate(${fadeOutX}px, ${fadeOutY}px) rotate(${rotation}deg) scale(${scale})`,
                    opacity: 0,
                    offset: HAND_PLACE_FADE_OUT_PROGRESS
                },
                {
                    transform: `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})`,
                    opacity: 0
                }
            ], {
                duration: HAND_PLACE_RETREAT_MS,
                opacityDuration: HAND_PLACE_FADE_OUT_MS,
                easing: HAND_TRAVEL_EASING,
                fill: 'forwards'
            }, sc);
        })().catch(() => {
            completeMove();
        }).finally(() => {
            cleanup();
        });
    }));
}

/**
 * 手札全消去アニメーション
 * @param {{player:string|number,count?:number,reason?:string}} payload
 * @returns {Promise<void>}
 */
function playClearHandAnimation(payload: any) {
    const data = payload || {};
    const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const ownerKey = (data.player === 'white' || data.player === -1 || data.player === '-1') ? 'white'
        : (data.player === 'black' || data.player === blackVal || data.player === 1) ? 'black'
            : 'black';
    const clearReason = data.reason || null;

    return new Promise<void>((resolve) => {
        let clearResolveFallback = function () {};
        if (clearReason === 'rebuild_will') {
            _setHandRevealCount(ownerKey, 0, clearReason);
        } else {
            _setHandRevealState(null);
        }

        const done = () => {
            clearResolveFallback();
            const resolvedCardState = _resolveCardStateForHandAnimations();
            const hand = (resolvedCardState && resolvedCardState.hands && Array.isArray(resolvedCardState.hands[ownerKey]))
                ? resolvedCardState.hands[ownerKey]
                : null;
            if (hand && hand.length === 0) {
                _setHandRevealState(null);
            }
            _requestCardUiSyncForAnimationUtils('animation-utils:clear-reveal');
            resolve();
        };

        if (_isNoAnim()) {
            done();
            return;
        }

        const handEl = _resolveHandElementByOwner(ownerKey);
        if (!handEl) {
            done();
            return;
        }

        const cards = Array.from(handEl.querySelectorAll('.card-item')) as HTMLElement[];
        if (!cards.length) {
            done();
            return;
        }

        const parsedCount = Number(data.count);
        const hasExplicitCount = Number.isFinite(parsedCount);
        const removalCount = hasExplicitCount
            ? Math.max(0, Math.min(cards.length, Math.trunc(parsedCount)))
            : cards.length;

        if (removalCount <= 0) {
            done();
            return;
        }

        const requestedIds = [];
        if (Array.isArray(data.cardIds)) {
            for (const id of data.cardIds) {
                if (id !== null && id !== undefined) requestedIds.push(String(id));
            }
        }
        if (data.cardId !== null && data.cardId !== undefined) {
            requestedIds.push(String(data.cardId));
        }

        const selectedCards = [];
        const usedIndices = new Set();
        if (requestedIds.length > 0) {
            for (const reqId of requestedIds) {
                if (selectedCards.length >= removalCount) break;
                for (let i = 0; i < cards.length; i++) {
                    if (usedIndices.has(i)) continue;
                    const cardEl = cards[i];
                    const cardId = (cardEl && cardEl.dataset && cardEl.dataset.cardId)
                        ? String(cardEl.dataset.cardId)
                        : null;
                    if (cardId !== reqId) continue;
                    usedIndices.add(i);
                    selectedCards.push(cardEl);
                    break;
                }
            }
        }
        for (let i = cards.length - 1; i >= 0 && selectedCards.length < removalCount; i--) {
            if (usedIndices.has(i)) continue;
            usedIndices.add(i);
            selectedCards.push(cards[i]);
        }
        const fadeTargets = selectedCards;
        if (!fadeTargets.length) {
            done();
            return;
        }

        const fromBottom = _isOwnerOnBottomSlot(ownerKey);
        const shiftY = fromBottom ? 16 : -16;
        const staggerMs = 70;
        const fadeMs = (typeof SharedConstants !== 'undefined' && SharedConstants.DESTROY_FADE_MS)
            ? SharedConstants.DESTROY_FADE_MS
            : ((typeof window !== 'undefined' && window.DESTROY_FADE_MS) ? window.DESTROY_FADE_MS : 500);
        const scope = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
        clearResolveFallback = _installAnimationResolveFallback(
            done,
            Math.max(1000, ((fadeTargets.length - 1) * staggerMs) + fadeMs + 400)
        );

        const animations = fadeTargets.map((cardEl, index) => {
            return new Promise<void>((resolveOne) => {
                _Timer().setTimeout(async () => {
                    try {
                        await _animateCompat(cardEl, [
                            { opacity: 1, transform: 'translateY(0px) scale(1)' },
                            { opacity: 0, transform: `translateY(${shiftY}px) scale(0.94)` }
                        ], {
                            duration: fadeMs,
                            easing: 'ease-in',
                            fill: 'forwards'
                        }, scope);
                    } catch (e: any) { /* ignore */ }
                    try {
                        if (cardEl && (cardEl as HTMLElement).parentElement) (cardEl as HTMLElement).parentElement!.removeChild(cardEl);
                    } catch (e: any) { /* ignore */ }
                    resolveOne();
                }, index * staggerMs, scope);
            });
        });

        Promise.all(animations).then(() => done()).catch(() => done());
    });
}

function _finalizeHandAddAnimation(payload: any, options: any) {
    const data = payload || {};
    const opts = options || {};
    const toPlayerKey = _normalizeHandOwnerKey(data.player);
    const fadeState = {
        playerKey: toPlayerKey,
        count: Number.isFinite(data.count) ? data.count : 1,
        token: `hand-fade-${++__hand_fade_token_sequence_utils}`
    };

    let revealState = _getHandRevealState();
    if (revealState && revealState.playerKey === toPlayerKey && Number.isFinite(revealState.visibleCount)) {
        const drawCount = Number.isFinite(data.count) ? Math.max(1, Math.trunc(data.count)) : 1;
        _setHandRevealCount(toPlayerKey, Number(revealState.visibleCount) + drawCount, revealState.reason || null);
    }

    _setQueuedHandFadeInState(fadeState);

    try {
        _requestCardUiSyncForAnimationUtils('animation-utils:finalize-hand-add');
        _scheduleQueuedHandFadeIn(fadeState, data);
    } catch (e: any) {
        _clearHandFadeInState(fadeState.token);
    }

    revealState = _getHandRevealState();
    if (revealState && revealState.playerKey === toPlayerKey && Number.isFinite(revealState.visibleCount)) {
        const resolvedCardState = _resolveCardStateForHandAnimations();
        const hand = (resolvedCardState && resolvedCardState.hands && Array.isArray(resolvedCardState.hands[toPlayerKey]))
            ? resolvedCardState.hands[toPlayerKey]
            : null;
        const handLen: number | null = hand ? hand.length : null;
        if (Number.isFinite(handLen) && handLen !== null && Number(revealState.visibleCount) >= handLen) {
            _setHandRevealState(null);
        }
    }

    if (opts.pulseDeck === false) return;

    try {
        if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.pulseDeckUI === 'function') {
            __uiImpl.pulseDeckUI();
        }
    } catch (e: any) { /* ignore */ }
}

function _finalizeHandAddAfterCardFaceArtReady(payload: any, options: any, preloadPromise: any) {
    const waitForPreload = _shouldWaitForCardFaceArtPreload(preloadPromise)
        ? _waitForCardFaceArtPreload(preloadPromise, CARD_FACE_ART_REVEAL_WAIT_MS)
        : Promise.resolve(preloadPromise);
    return waitForPreload
        .catch(() => null)
        .then(() => {
            _finalizeHandAddAnimation(payload, options);
        });
}

function _getCaptureReservedHandSlotState() {
    try {
        if (typeof window !== 'undefined' && window.__captureReservedHandSlotState && typeof window.__captureReservedHandSlotState === 'object') {
            return window.__captureReservedHandSlotState;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _clearCaptureReservedHandSlotState(expectedToken: any) {
    try {
        if (typeof window === 'undefined') return;
        if (!window.__captureReservedHandSlotState) return;
        if (expectedToken && window.__captureReservedHandSlotState.token && window.__captureReservedHandSlotState.token !== expectedToken) {
            return;
        }
        window.__captureReservedHandSlotState = null;
    } catch (e: any) { /* ignore */ }
}

function _finalizeCaptureToHandAnimation(payload: any) {
    const data = payload || {};
    _clearCaptureReservedHandSlotState(data.reservedToken || null);
    _requestCardUiSyncForAnimationUtils('animation-utils:finalize-capture-hand');
}

function _resolveCaptureTargetCardElement(playerKey: any, handIndex: any) {
    const handEl = _resolveHandElementByOwner(playerKey);
    if (!handEl || !Number.isInteger(handIndex)) return null;
    return handEl.querySelector(`.card-item[data-owner-key="${playerKey}"][data-hand-index="${handIndex}"]`)
        || handEl.querySelector(`.card-item[data-hand-index="${handIndex}"]`);
}

function playCaptureToHandAnimation(payload: any) {
    const data = payload || {};
    const toPlayerKey = _normalizeHandOwnerKey(data.player);
    const reservedState = _getCaptureReservedHandSlotState();
    const reservedToken = reservedState && reservedState.playerKey === toPlayerKey
        ? (reservedState.token || null)
        : null;

    return _enqueueHandLayerAnimation(() => new Promise<void>((resolve) => {
        const done = () => {
            _finalizeCaptureToHandAnimation(Object.assign({}, data, { reservedToken }));
            resolve();
        };

        if (_isNoAnim()) {
            done();
            return;
        }

        const layerEl = (typeof handLayer !== 'undefined' && handLayer) ? handLayer : document.getElementById('handLayer');
        const boardRoot = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document.getElementById('board');
        const sourceRow = Number(data.sourceRow);
        const sourceCol = Number(data.sourceCol);
        const insertIndex = Number(data.insertIndex);
        const targetCardEl = _resolveCaptureTargetCardElement(toPlayerKey, Number.isInteger(insertIndex) ? insertIndex : -1);
        const sourceCellRect = _resolveBoardCellClientRectForAnimationUtils(sourceRow, sourceCol);
        if (!layerEl || !targetCardEl || !sourceCellRect) {
            done();
            return;
        }

        const targetRect = _snapRectToWholePixels(targetCardEl.getBoundingClientRect());
        const sourceRect = _snapRectToWholePixels(
            _resolveBoardDiscClientRectFromCellRect(sourceCellRect, boardRoot)
            || sourceCellRect
        );
        if (!sourceRect || !targetRect) {
            done();
            return;
        }

        _setCardAnimatingState(true);
        _ensureHandAnimationLayerMounted(layerEl);

        const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
        let cleanupStarted = false;
        let movingStone: any = null;
        let revealCard: any = null;
        let timeoutId = _Timer().setTimeout(() => {
            void cleanup();
        }, 2600, sc);

        const cleanup = async () => {
            if (cleanupStarted) return;
            cleanupStarted = true;
            try {
                if (movingStone && movingStone.parentElement) movingStone.parentElement.removeChild(movingStone);
            } catch (e: any) { /* ignore */ }
            try {
                if (revealCard && revealCard.parentElement) revealCard.parentElement.removeChild(revealCard);
            } catch (e: any) { /* ignore */ }
            if (timeoutId) {
                _Timer().clearTimeout(timeoutId);
                timeoutId = null;
            }
            _setCardAnimatingState(false);
            done();
        };

        movingStone = document.createElement('div');
        const sourceOwnerKey = _normalizeHandOwnerKey(data.sourceOwner);
        movingStone.className = `disc ${sourceOwnerKey === 'white' ? 'white' : 'black'}`;
        if (data.sourceSpecialType && typeof applyStoneVisualEffect === 'function') {
            try {
                applyStoneVisualEffect(movingStone, data.sourceSpecialType, { owner: sourceOwnerKey });
            } catch (e: any) { /* ignore */ }
        }
        movingStone.style.position = 'fixed';
        movingStone.style.pointerEvents = 'none';
        movingStone.style.zIndex = '1300';
        movingStone.style.left = `${sourceRect.left}px`;
        movingStone.style.top = `${sourceRect.top}px`;
        movingStone.style.width = `${sourceRect.width}px`;
        movingStone.style.height = `${sourceRect.height}px`;
        movingStone.style.margin = '0';
        layerEl.appendChild(movingStone);

        const targetCenterX = targetRect.left + (targetRect.width / 2);
        const targetCenterY = targetRect.top + (targetRect.height / 2);
        const stoneCenterX = sourceRect.left + (sourceRect.width / 2);
        const stoneCenterY = sourceRect.top + (sourceRect.height / 2);
        const stoneDx = targetCenterX - stoneCenterX;
        const stoneDy = targetCenterY - stoneCenterY;

        const descriptor = _normalizeCardUseVisualDescriptor(data.visualDescriptor, data.cardId, data.sourceName, null);
        const cardDef = (typeof CardLogic !== 'undefined' && typeof CardLogic.getCardDef === 'function' && descriptor.cardId)
            ? CardLogic.getCardDef(descriptor.cardId)
            : null;
        const revealName = descriptor.name || (cardDef && cardDef.name) || '';
        const revealCost = Number.isFinite(Number(descriptor.cost))
            ? Number(descriptor.cost)
            : ((cardDef && Number.isFinite(Number(cardDef.cost))) ? Number(cardDef.cost) : null);

        (async () => {
            await _animateCompat(movingStone, [
                { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
                { transform: `translate(${stoneDx}px, ${stoneDy}px) scale(0.82)`, opacity: 1 }
            ], {
                duration: 360,
                easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)',
                fill: 'forwards'
            }, sc);

            movingStone.style.opacity = '0';
            revealCard = _buildFallbackCardUseElement(
                descriptor.cardId || null,
                revealName,
                revealCost,
                descriptor,
                _normalizeHandOwnerKey(data.sourceOwner)
            );
            revealCard.classList.add('visible');
            revealCard.style.position = 'fixed';
            revealCard.style.pointerEvents = 'none';
            revealCard.style.zIndex = '1301';
            revealCard.style.left = `${targetRect.left}px`;
            revealCard.style.top = `${targetRect.top}px`;
            revealCard.style.width = `${targetRect.width}px`;
            revealCard.style.height = `${targetRect.height}px`;
            revealCard.style.margin = '0';
            revealCard.style.opacity = '0';
            revealCard.style.transform = 'scale(0.72)';
            layerEl.appendChild(revealCard);

            await _animateCompat(revealCard, [
                { opacity: 0, transform: 'scale(0.72)' },
                { opacity: 1, transform: 'scale(1)' }
            ], {
                duration: 180,
                easing: 'ease-out',
                fill: 'forwards'
            }, sc);

            await _animateCompat(revealCard, [
                { opacity: 1, transform: 'scale(1)' },
                { opacity: 1, transform: 'scale(1)' }
            ], {
                duration: 120,
                easing: 'linear',
                fill: 'forwards'
            }, sc);
        })().catch(() => {
            // no-op
        }).finally(() => {
            void cleanup();
        });
    }));
}

/**
 * ドロー時のハンド演出
 * Hand carries a card from deck to hand area.
 * @param {{player:string|number, cardId?:string|null, count?:number}} payload
 * @returns {Promise<void>}
 */
function playDrawCardHandAnimation(payload: any) {
    const data = payload || {};
    const toPlayerKey = _normalizeHandOwnerKey(data.player);
    if (_isHandAnimationDisabled('draw')) {
        return Promise.resolve().then(() => {
            _finalizeHandAddAnimation(data, { pulseDeck: true });
        });
    }
    const cardFaceArtPreload = preloadCardFaceArtForAnimation(data.cardId, {
        ownerKey: toPlayerKey,
        priority: 'high'
    });

    try {
        if (typeof window !== 'undefined') {
            if (window.__drawHandAnimActive) {
                return _finalizeHandAddAfterCardFaceArtReady(data, { pulseDeck: true }, cardFaceArtPreload);
            }
            const now = Date.now();
            const last = Number(window.__lastDrawAnimAt || 0);
            if (last > 0 && now >= last && now - last < 80) {
                return _finalizeHandAddAfterCardFaceArtReady(data, { pulseDeck: true }, cardFaceArtPreload);
            }
            window.__lastDrawAnimAt = now;
        }
    } catch (e: any) { /* ignore */ }

    return _enqueueHandLayerAnimation(() => new Promise<void>(resolve=> {
        let clearResolveFallback = function () {};
        const done = () => {
            clearResolveFallback();
            try {
                if (typeof window !== 'undefined') window.__drawHandAnimActive = false;
            } catch (e: any) { /* ignore */ }

            _finalizeHandAddAfterCardFaceArtReady(data, { pulseDeck: true }, cardFaceArtPreload)
                .then(() => resolve());
        };

        try {
            if (typeof window !== 'undefined') {
                window.__drawHandAnimActive = true;
            }
        } catch (e: any) { /* ignore */ }

        if (_isNoAnim()) {
            done();
            return;
        }

        const handContext = _syncDisplayedHandSkinForAnimation(toPlayerKey, {
            cpu: data.cpu === true,
            cpuLevel: data.cpuLevel
        });
        const ownerKey = handContext && handContext.ownerKey ? handContext.ownerKey : toPlayerKey;
        const deckEl = _resolveDeckElementByOwner(ownerKey);
        const handEl = _resolveHandElementByOwner(ownerKey);
        const { layerEl, wrapperEl, heldStoneEl } = _resolveHandLayerElements();

        if (!deckEl || !handEl || !layerEl || !wrapperEl) {
            _restoreDisplayedHandSkinAfterAnimation(handContext);
            done();
            return;
        }

        // Draw animation should never show placement stone visual.
        if (heldStoneEl) heldStoneEl.style.display = 'none';

        // Keep lock local to this animation only.
        _setCardAnimatingState(true);
        const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
        let heldCard: any = null;
        let cleanupStarted = false;
        let timeoutId: any = null;
        const deckRect = deckEl.getBoundingClientRect();
        const handRect = handEl.getBoundingClientRect();

        const startX = deckRect.left + deckRect.width / 2 - (HAND_WRAPPER_WIDTH / 2);
        const endX = handRect.left + handRect.width / 2 - (HAND_WRAPPER_WIDTH / 2);
        const fromBottom = _isOwnerOnBottomSlot(ownerKey);
        const startY = deckRect.top + (fromBottom ? -120 : -20);
        const endY = fromBottom ? (handRect.top - 105) : (handRect.top - 70);
        const rotation = fromBottom ? 0 : 180;
        const scale = fromBottom ? 0.76 : 0.72;

        _cancelElementAnimations(wrapperEl);
        _ensureHandAnimationLayerMounted(layerEl);
        _setHandWrapperPresentationActive(wrapperEl, false);
        wrapperEl.style.transform = `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})`;

        heldCard = document.createElement('div');
        heldCard.className = `held-draw-card ${fromBottom ? 'face-up' : 'face-down'}`;
        wrapperEl.appendChild(heldCard);
        _setHandWrapperPresentationActive(wrapperEl, true);

        const cleanup = () => {
            if (cleanupStarted) return;
            cleanupStarted = true;
            try {
                if (heldCard && heldCard.parentElement) heldCard.parentElement.removeChild(heldCard);
            } catch (e: any) { /* ignore */ }
            _setHandWrapperPresentationActive(wrapperEl, false);
            if (heldStoneEl) heldStoneEl.style.display = 'none';
            _cancelElementAnimations(wrapperEl);
            _restoreDisplayedHandSkinAfterAnimation(handContext);
            if (timeoutId) {
                _Timer().clearTimeout(timeoutId);
                timeoutId = null;
            }
            _setCardAnimatingState(false);
            try { if (typeof window !== 'undefined') window.__drawHandAnimActive = false; } catch (e: any) { /* ignore */ }
            done();
        };
        timeoutId = _Timer().setTimeout(cleanup, 2200, sc);
        clearResolveFallback = _installAnimationResolveFallback(cleanup, 2600);

        (async () => {
            await _animateCompat(wrapperEl, [
                { transform: `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})` },
                { transform: `translate(${startX}px, ${startY + (fromBottom ? -14 : 14)}px) rotate(${rotation}deg) scale(${scale * 0.96})` }
            ], {
                duration: HAND_DRAW_PICKUP_MS,
                easing: 'ease-out',
                fill: 'forwards'
            }, sc);
            if (cleanupStarted || !_isHandWrapperPresentationActive(wrapperEl)) return;

            await _animateCompat(wrapperEl, [
                { transform: `translate(${startX}px, ${startY + (fromBottom ? -14 : 14)}px) rotate(${rotation}deg) scale(${scale * 0.96})` },
                { transform: `translate(${endX}px, ${endY}px) rotate(${rotation}deg) scale(${scale})` }
            ], {
                duration: HAND_DRAW_MOVE_MS,
                easing: HAND_TRAVEL_EASING,
                fill: 'forwards'
            }, sc);
            if (cleanupStarted || !_isHandWrapperPresentationActive(wrapperEl)) return;

            // Release near hand and retreat.
            heldCard.style.display = 'none';
            const retreatY = fromBottom ? (handRect.bottom + 70) : (handRect.top - 210);
            await _animateCompat(wrapperEl, [
                { transform: `translate(${endX}px, ${endY}px) rotate(${rotation}deg) scale(${scale})` },
                { transform: `translate(${endX}px, ${retreatY}px) rotate(${rotation}deg) scale(${scale})` }
            ], {
                duration: HAND_DRAW_RETREAT_MS,
                easing: HAND_TRAVEL_EASING,
                fill: 'forwards'
            }, sc);
        })().catch(() => {
            // no-op
        }).finally(() => {
            cleanup();
        });
    }));
}

function playDirectHandAddAnimation(payload: any) {
    const data = payload || {};
    return new Promise<void>((resolve) => {
        _finalizeHandAddAnimation(data, { pulseDeck: false });
        resolve();
    });
}

function _canViewerSeeTrapPlacement(playerKey: any) {
    try {
        const root = (typeof window !== 'undefined' && window)
            ? window
            : ((typeof globalThis !== 'undefined' && globalThis) ? globalThis : null);
        if (!root) return true;
        if ((root as any).BOARD_VIEWER_KEY === 'black' || (root as any).BOARD_VIEWER_KEY === 'white') {
            return (root as any).BOARD_VIEWER_KEY === playerKey;
        }
        if ((root as any).LOCAL_PLAYER_KEY === 'black' || (root as any).LOCAL_PLAYER_KEY === 'white') {
            return (root as any).LOCAL_PLAYER_KEY === playerKey;
        }
        if ((root as any).DEBUG_HUMAN_VS_HUMAN === true) return true;
    } catch (e: any) { /* ignore */ }
    return true;
}

function _resolveTrapPlacementBoardElement() {
    try {
        if (typeof boardEl !== 'undefined' && boardEl && typeof boardEl.querySelector === 'function') {
            return boardEl;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
            return document.getElementById('board');
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function playTrapPlacementFlash(row: any, col: any, playerKey: any) {
    // Trap visuals are revealed only by explicit TRAP_REVEAL playback timing.
    void row;
    void col;
    void playerKey;
}

function _isSacrificeSealBurnCardUse(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    if (data.nullifiedBySacrificeWill === true) return true;
    return String(data.cardUseVanishEffect || '').trim().toLowerCase() === 'sacrifice_seal_burn';
}

function _resolveSacrificeAbsorbTargetRect(data: any) {
    const sacrificeWill = data && data.sacrificeWill && typeof data.sacrificeWill === 'object'
        ? data.sacrificeWill
        : null;
    const row = Number(sacrificeWill && sacrificeWill.row);
    const col = Number(sacrificeWill && sacrificeWill.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    const rect = _snapRectToWholePixels(_resolveBoardCellClientRectForAnimationUtils(row, col));
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
    return rect;
}

async function _playSacrificeAbsorbVanish(
    movingCard: any,
    playbackScope: any,
    data: any,
    geometry: any,
    registerBoardEffectSettlement?: (settlement: Promise<any>) => void
) {
    if (!movingCard) return;
    const SACRIFICE_ABSORB_MS = 2600;
    const targetRect = _resolveSacrificeAbsorbTargetRect(data);
    if (!targetRect || !geometry) {
        await _animateCompat(movingCard, [
            { opacity: 1 },
            { opacity: 0, transform: `translate(${geometry && geometry.currentDx || 0}px, ${geometry && geometry.currentDy || 0}px) scale(0.18)` }
        ], {
            duration: 2200,
            easing: 'ease-out',
            fill: 'forwards'
        }, playbackScope);
        return;
    }

    const absorbX = (targetRect.left + targetRect.width / 2 - geometry.cardWidth / 2) - geometry.startX;
    const absorbY = (targetRect.top + targetRect.height / 2 - geometry.cardHeight / 2) - geometry.startY;
    try {
        movingCard.classList.add('sacrifice-card-absorb');
        movingCard.style.transformOrigin = 'center center';
    } catch (e: any) { /* ignore */ }

    const sacrificeWill = data && data.sacrificeWill && typeof data.sacrificeWill === 'object'
        ? data.sacrificeWill
        : null;
    const pulseEvent = {
        type: 'legacy_sacrifice_absorb_pulse',
        row: Number(sacrificeWill && sacrificeWill.row),
        col: Number(sacrificeWill && sacrificeWill.col),
        durationMs: SACRIFICE_ABSORB_MS
    };
    const playBoardEffect = typeof data.playBoardEffect === 'function'
        ? data.playBoardEffect
        : _playLegacyBoardAnimationEventForUtils;
    let cellPulse: Promise<any>;
    try {
        cellPulse = Promise.resolve(playBoardEffect(pulseEvent));
    } catch (error: any) {
        cellPulse = Promise.reject(error);
    }
    if (typeof registerBoardEffectSettlement === 'function') {
        registerBoardEffectSettlement(cellPulse);
    }

    const cardAbsorb = _animateCompat(movingCard, [
        {
            opacity: 1,
            filter: 'none',
            transform: `translate(${geometry.currentDx}px, ${geometry.currentDy}px) scale(1)`,
            boxShadow: movingCard.style.boxShadow || ''
        },
        {
            opacity: 0.72,
            filter: 'brightness(1.18) saturate(1.35)',
            transform: `translate(${Math.round((geometry.currentDx + absorbX) / 2)}px, ${Math.round((geometry.currentDy + absorbY) / 2)}px) scale(0.58)`,
            boxShadow: '0 0 22px rgba(255, 56, 56, 0.76)'
        },
        {
            opacity: 0,
            filter: 'brightness(1.35) saturate(1.7)',
            transform: `translate(${Math.round(absorbX)}px, ${Math.round(absorbY)}px) scale(0.08)`,
            boxShadow: '0 0 30px rgba(255, 35, 35, 0.82)'
        }
    ], {
        duration: SACRIFICE_ABSORB_MS,
        easing: 'cubic-bezier(0.2, 0.72, 0.12, 1)',
        fill: 'forwards'
    }, playbackScope);
    await Promise.all([cardAbsorb, cellPulse]);
}

/**
 * カード使用時のハンド搬送演出
 * Hand carries a used card from hand side to charge UI.
 * @param {{player?:string|number, owner?:string|number, cardId?:string|null, cost?:number|null, name?:string|null}} payload
 * @returns {Promise<void>}
 */
function playCardUseHandAnimation(payload: any) {
    const data = payload || {};
    const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const owner = (data.owner !== undefined && data.owner !== null) ? data.owner : data.player;
    const ownerKey = (owner === 'black' || owner === blackVal || owner === 1) ? 'black' : 'white';
    const fromBottom = _isOwnerOnBottomSlot(ownerKey);

    try {
        if (typeof window !== 'undefined') {
            const now = Date.now();
            const last = Number(window.__lastCardUseAnimAt || 0);
            if (now - last < 80) {
                return Promise.resolve();
            }
            window.__lastCardUseAnimAt = now;
        }
    } catch (e: any) { /* ignore */ }

    const cardUseCardId = _resolveCardFaceArtPreloadCardId(data.cardId, data.visualDescriptor);
    const cardFaceArtPreload = preloadCardFaceArtForAnimation(cardUseCardId, {
        ownerKey,
        priority: 'high'
    });

    return _enqueueHandLayerAnimation(() => {
        const runCardUseAnimation = () => new Promise<void>((resolve, reject) => {
        let clearResolveFallback = function () {};
        let disappearSoundPlayed = false;
        let disappearHookStarted = false;
        let cleanupStarted = false;
        let cleanupPromise: Promise<void> | null = null;
        let hasCleanupPrimaryError = false;
        let cleanupPrimaryError: any = undefined;
        let terminalBoardEffectSettlement: Promise<any> = Promise.resolve();
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            clearResolveFallback();
            resolve();
        };
        const fail = (error: any) => {
            if (settled) return;
            settled = true;
            clearResolveFallback();
            reject(error);
        };
        const playDisappearSoundOnce = () => {
            if (disappearSoundPlayed) return;
            disappearSoundPlayed = true;
            _playEffectByKeySafe(data.disappearSoundKey);
        };
        const runDisappearEffectsOnce = async () => {
            if (disappearHookStarted) return;
            disappearHookStarted = true;
            playDisappearSoundOnce();
            if (typeof data.onDisappear === 'function') {
                await data.onDisappear();
            }
        };
        const setCardAnimating = (locked: any) => {
            _setCardAnimatingState(locked);
        };
        const registerTerminalBoardEffectSettlement = (settlement: Promise<any>) => {
            terminalBoardEffectSettlement = Promise.resolve(settlement);
        };

        if (_isNoAnim()) {
            Promise.resolve(runDisappearEffectsOnce()).then(done, fail);
            return;
        }

        const chargeEl = document.getElementById(fromBottom ? 'charge-black' : 'charge-white');
        const handEl = _resolveHandElementByOwner(ownerKey);
        const { layerEl, handImageEl, heldStoneEl } = _resolveHandLayerElements();
        if (!chargeEl || !handEl || !layerEl) {
            Promise.resolve(runDisappearEffectsOnce()).then(done, fail);
            return;
        }

        const prevHandImageVisibility = handImageEl ? handImageEl.style.visibility : '';
        if (handImageEl) handImageEl.style.visibility = 'hidden';
        const prevHeldStoneDisplay = heldStoneEl ? heldStoneEl.style.display : '';
        if (heldStoneEl) heldStoneEl.style.display = 'none';

        setCardAnimating(true);
        const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
        let movingCard: any = null;
        const sacrificeAbsorb = _isSacrificeSealBurnCardUse(data);
        let timeoutId = _Timer().setTimeout(() => {
            void cleanup();
        }, sacrificeAbsorb ? 5200 : 3200, sc);

        const explicitSourceCardEl = (data.sourceCardEl && typeof data.sourceCardEl.cloneNode === 'function') ? data.sourceCardEl : null;
        // IMPORTANT:
        // Do not auto-pick "last hand card" as animation source.
        // In AUTO mode the hand can update between decision/apply/render, causing visible card mismatch.
        // Prefer payload(cardId/name/cost) unless an explicit source element is supplied.
        const sourceCardEl = explicitSourceCardEl || null;
        const srcRect = _resolveCardUseSourceRect(sourceCardEl, data.sourceCardRect);
        const handRect = srcRect ? null : handEl.getBoundingClientRect();
        const chargeRect = chargeEl.getBoundingClientRect();
        const HOLD_MS = 850;
        const FADE_MS = 420;

        const visualDescriptor = _normalizeCardUseVisualDescriptor(data.visualDescriptor, data.cardId, data.name, data.cost);
        const cardDef = (typeof CardLogic !== 'undefined' && typeof CardLogic.getCardDef === 'function' && visualDescriptor.cardId)
            ? CardLogic.getCardDef(visualDescriptor.cardId)
            : null;
        const cardName = visualDescriptor.name || (cardDef && cardDef.name) || '';
        const cardCost = Number.isFinite(Number(visualDescriptor.cost))
            ? Number(visualDescriptor.cost)
            : ((cardDef && Number.isFinite(Number(cardDef.cost))) ? Number(cardDef.cost) : null);

        _ensureHandAnimationLayerMounted(layerEl);
        movingCard = _buildCardUseMovingElement(sourceCardEl, Object.assign({}, visualDescriptor, {
            cardId: visualDescriptor.cardId || null,
            name: cardName,
            cost: cardCost
        }), ownerKey);
        movingCard.classList.add('visible');
        movingCard.style.position = 'fixed';
        movingCard.style.pointerEvents = 'none';
        movingCard.style.zIndex = '1300';
        movingCard.style.transform = 'translate(0px, 0px)';
        movingCard.style.margin = '0';
        const cardWidth = srcRect ? srcRect.width : 91;
        const cardHeight = srcRect ? srcRect.height : 124;
        const startX = srcRect ? srcRect.left : (handRect.left + handRect.width / 2 - cardWidth / 2);
        const startY = srcRect ? srcRect.top : (handRect.top + handRect.height / 2 - cardHeight / 2);
        const targetX = chargeRect.left + chargeRect.width / 2 - cardWidth / 2;
        const targetY = fromBottom ? (chargeRect.top - cardHeight - 10) : (chargeRect.bottom + 10);
        movingCard.style.left = `${startX}px`;
        movingCard.style.top = `${startY}px`;
        movingCard.style.width = `${cardWidth}px`;
        movingCard.style.height = `${cardHeight}px`;
        layerEl.appendChild(movingCard);

        const dx = targetX - startX;
        const dy = targetY - startY;
        const liftY = fromBottom ? -14 : 14;
        const waitHold = () => new Promise<void>((r) => _Timer().setTimeout(r, HOLD_MS, sc));
        const cleanup = (...primaryErrors: any[]): Promise<void> => {
            if (primaryErrors.length > 0 && !hasCleanupPrimaryError) {
                hasCleanupPrimaryError = true;
                cleanupPrimaryError = primaryErrors[0];
            }
            if (cleanupPromise) return cleanupPromise;
            cleanupStarted = true;
            cleanupPromise = (async () => {
                let hasTerminalBoardEffectError = false;
                let terminalBoardEffectError: any = undefined;
                try {
                    // Board-owned playback must settle before the strict-network
                    // writer can commit its canonical frame. The sacrifice card
                    // animation starts a nested Pixi pulse, so a DOM fallback
                    // timeout may clean the overlay but must never detach that
                    // board phase or start the subsequent destroy early.
                    await terminalBoardEffectSettlement;
                } catch (error: any) {
                    hasTerminalBoardEffectError = true;
                    terminalBoardEffectError = error;
                }
                try {
                    try {
                        if (movingCard && movingCard.parentElement) movingCard.parentElement.removeChild(movingCard);
                    } catch (e: any) { /* ignore */ }
                    if (handImageEl) handImageEl.style.visibility = prevHandImageVisibility;
                    if (heldStoneEl) heldStoneEl.style.display = prevHeldStoneDisplay;
                    if (timeoutId) {
                        _Timer().clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    const cleanupError = hasCleanupPrimaryError
                        ? cleanupPrimaryError
                        : terminalBoardEffectError;
                    if (hasCleanupPrimaryError || hasTerminalBoardEffectError) {
                        fail(cleanupError);
                        return;
                    }
                    await runDisappearEffectsOnce();
                    done();
                } catch (error: any) {
                    fail(error);
                } finally {
                    setCardAnimating(false);
                }
            })();
            return cleanupPromise;
        };
        clearResolveFallback = _installAnimationResolveFallback(() => {
            void cleanup();
        }, sacrificeAbsorb ? 5600 : 3600);

        const animationSequence = (async () => {
            await _animateCompat(movingCard, [
                { transform: 'translate(0px, 0px)' },
                { transform: `translate(0px, ${liftY}px)` }
            ], {
                duration: 140,
                easing: 'ease-out',
                fill: 'forwards'
            }, sc);
            if (cleanupStarted && sacrificeAbsorb) return;

            await _animateCompat(movingCard, [
                { transform: `translate(0px, ${liftY}px)` },
                { transform: `translate(${dx}px, ${dy}px)` }
            ], {
                duration: 320,
                easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)',
                fill: 'forwards'
            }, sc);
            if (cleanupStarted && sacrificeAbsorb) return;

            const bob = fromBottom ? -8 : 8;
            await _animateCompat(movingCard, [
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: `translate(${dx}px, ${dy + bob}px)` },
                { transform: `translate(${dx}px, ${dy}px)` }
            ], {
                duration: 170,
                easing: 'ease-in-out',
                fill: 'forwards'
            }, sc);
            if (cleanupStarted && sacrificeAbsorb) return;

            await waitHold();
            if (cleanupStarted && sacrificeAbsorb) return;

            if (sacrificeAbsorb) {
                await _playSacrificeAbsorbVanish(movingCard, sc, data, {
                    startX,
                    startY,
                    cardWidth,
                    cardHeight,
                    currentDx: dx,
                    currentDy: dy
                }, registerTerminalBoardEffectSettlement);
            } else {
                await _animateCompat(movingCard, [
                    { opacity: 1 },
                    { opacity: 0 }
                ], {
                    duration: FADE_MS,
                    easing: 'ease-out',
                    fill: 'forwards'
                }, sc);
            }
        })();
        void animationSequence.then(
            () => cleanup(),
            (error: any) => cleanup(error)
        );
        });
        if (!_shouldWaitForCardFaceArtPreload(cardFaceArtPreload)) {
            return runCardUseAnimation();
        }
        return _waitForCardFaceArtPreload(cardFaceArtPreload, CARD_FACE_ART_REVEAL_WAIT_MS).then(runCardUseAnimation);
    });
}


/**
 * 躍動石の移動アニメーション
 * Smoothly translate a disc from source cell to target cell.
 * @param {{row:number,col:number}} from
 * @param {{row:number,col:number}} to
 * @returns {Promise<void>}
 */
function animateHyperactiveMove(from: any, to: any, options: any) {
    return _playLegacyBoardAnimationEventForUtils({
        type: 'legacy_hyperactive_move',
        from,
        to,
        options: options || {}
    });
}

// Export for module systems
const AnimationUtils = {
    animateDestroyAt,
    animateFadeOutAt,
    playHandAnimation,
    playClearHandAnimation,
    playDrawCardHandAnimation,
    playDirectHandAddAnimation,
    playCaptureToHandAnimation,
    playTrapPlacementFlash,
    playCardUseHandAnimation,
    animateHyperactiveMove,
    animateStrongWillApply,
    getQueuedHandFadeInState,
    settleOwnerHandFadeIn
};
export = AnimationUtils;

if (typeof window !== 'undefined') {
    window.playClearHandAnimation = playClearHandAnimation;
    window.playDrawCardHandAnimation = playDrawCardHandAnimation;
    window.playDirectHandAddAnimation = playDirectHandAddAnimation;
    window.playCaptureToHandAnimation = playCaptureToHandAnimation;
    window.playTrapPlacementFlash = playTrapPlacementFlash;
    window.playCardUseHandAnimation = playCardUseHandAnimation;
    window.HandAnimationUtilsModule = {
        getQueuedHandFadeInState,
        settleOwnerHandFadeIn
    };
}
