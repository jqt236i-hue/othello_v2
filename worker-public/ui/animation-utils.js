/**
 * @file animation-utils.js
 * @description アニメーションユーティリティ
 * 石の配置・破壊・フェードアウトアニメーションを担当
 */
// Shared animation helpers (normalized) - resolved lazily via AnimationResolver
let __anim_res_utils = null;
try { __anim_res_utils = (typeof require === 'function') ? require('./animation-resolver') : (typeof globalThis !== 'undefined' ? globalThis.AnimationResolver : null); } catch (e) { __anim_res_utils = (typeof globalThis !== 'undefined' ? globalThis.AnimationResolver : null); }
function _getAnimationShared() { return (__anim_res_utils && typeof __anim_res_utils.getAnimationShared === 'function') ? __anim_res_utils.getAnimationShared() : null; }
function _isNoAnim() { const fn = (__anim_res_utils && typeof __anim_res_utils.isNoAnim === 'function') ? __anim_res_utils.isNoAnim() : function () { return false; }; return fn(); }
function _Timer() { return (__anim_res_utils && typeof __anim_res_utils.getTimer === 'function') ? __anim_res_utils.getTimer() : (function () {
    if (typeof TimerRegistry !== 'undefined') return TimerRegistry;
    return {
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        clearAll: () => {},
        pendingCount: () => 0,
        newScope: () => null,
        clearScope: () => {}
    };
})(); }
let __playback_state_utils = null;
try { __playback_state_utils = (typeof require === 'function') ? require('./playback-state-manager') : (typeof globalThis !== 'undefined' ? globalThis.PlaybackStateManager : null); } catch (e) { __playback_state_utils = (typeof globalThis !== 'undefined' ? globalThis.PlaybackStateManager : null); }
let __hand_skin_utils = null;
function _setCardAnimatingState(locked) {
    if (__playback_state_utils && typeof __playback_state_utils.setCardAnimating === 'function') {
        __playback_state_utils.setCardAnimating(locked);
        return;
    }
    if (typeof isCardAnimating !== 'undefined') isCardAnimating = !!locked;
    if (typeof window !== 'undefined') window.isCardAnimating = !!locked;
}

function _setProcessingState(locked) {
    if (__playback_state_utils && typeof __playback_state_utils.setProcessing === 'function') {
        __playback_state_utils.setProcessing(locked);
        return;
    }
    if (typeof isProcessing !== 'undefined') isProcessing = !!locked;
    if (typeof window !== 'undefined') window.isProcessing = !!locked;
}

function _requestCardUiSyncForAnimationUtils(reason) {
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
    } catch (e) { /* ignore */ }
    return false;
}

function _normalizeHandOwnerKey(value) {
    if (value === 'white' || value === -1 || value === '-1') return 'white';
    return 'black';
}

function _resolveHandElementByOwner(playerKey) {
    if (typeof document === 'undefined') return null;
    const ownerKey = _normalizeHandOwnerKey(playerKey);
    const handBlackEl = document.getElementById('hand-black');
    const handWhiteEl = document.getElementById('hand-white');
    const handElements = [handBlackEl, handWhiteEl].filter(Boolean);

    for (const handEl of handElements) {
        const slotOwnerKey = handEl && handEl.dataset && handEl.dataset.ownerKey
            ? _normalizeHandOwnerKey(handEl.dataset.ownerKey)
            : null;
        if (slotOwnerKey === ownerKey) return handEl;
    }

    return document.getElementById(ownerKey === 'white' ? 'hand-white' : 'hand-black');
}

function _resolveDeckElementByOwner(playerKey) {
    if (typeof document === 'undefined') return null;
    const ownerKey = _normalizeHandOwnerKey(playerKey);
    const deckBlackEl = document.getElementById('deck-black');
    const deckWhiteEl = document.getElementById('deck-white');
    const deckElements = [deckBlackEl, deckWhiteEl].filter(Boolean);

    for (const deckEl of deckElements) {
        const slotOwnerKey = deckEl && deckEl.dataset && deckEl.dataset.ownerKey
            ? _normalizeHandOwnerKey(deckEl.dataset.ownerKey)
            : null;
        if (slotOwnerKey === ownerKey) return deckEl;
    }

    return document.getElementById(ownerKey === 'white' ? 'deck-white' : 'deck-black');
}

function _isOwnerOnBottomSlot(playerKey) {
    const ownerKey = _normalizeHandOwnerKey(playerKey);
    if (typeof document === 'undefined') return ownerKey === 'black';

    const bottomEl = document.getElementById('hand-black');
    const topEl = document.getElementById('hand-white');
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

function _resolveHandImageElement() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('handImage');
}

function _getHandSkinUiModule() {
    if (__hand_skin_utils && typeof __hand_skin_utils === 'object') return __hand_skin_utils;
    try {
        if (typeof require === 'function') {
            __hand_skin_utils = require('./handlers/hand-skin');
        }
    } catch (e) { /* ignore */ }
    if (!__hand_skin_utils) {
        try {
            if (typeof window !== 'undefined' && window && window.HandSkinUiModule) {
                __hand_skin_utils = window.HandSkinUiModule;
            }
        } catch (e) { /* ignore */ }
    }
    if (!__hand_skin_utils) {
        try {
            if (typeof globalThis !== 'undefined' && globalThis && globalThis.HandSkinUiModule) {
                __hand_skin_utils = globalThis.HandSkinUiModule;
            }
        } catch (e) { /* ignore */ }
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
    } catch (e) { /* ignore */ }
    return null;
}

function _getSyncDisplayedHandSkin() {
    const handSkinUi = _getHandSkinUiModule();
    if (handSkinUi && typeof handSkinUi.syncDisplayedHandSkin === 'function') {
        return handSkinUi.syncDisplayedHandSkin;
    }
    try {
        if (typeof window !== 'undefined' && window && typeof window.syncDisplayedHandSkin === 'function') {
            return window.syncDisplayedHandSkin;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function _resolveHandAnimationContext(ownerKey, visualOptions) {
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
        } catch (e) { /* ignore */ }
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

function _applyResolvedHandAnimationContext(handContext) {
    const imageEl = _resolveHandImageElement();
    if (!imageEl || !handContext || !handContext.renderedImagePath) return handContext;
    imageEl.setAttribute('src', handContext.renderedImagePath);
    if (handContext.renderedSkinId) {
        imageEl.setAttribute('data-hand-skin-id', handContext.renderedSkinId);
    }
    if (handContext.selectedSkinId) {
        imageEl.setAttribute('data-hand-selected-skin-id', handContext.selectedSkinId);
    }
    return handContext;
}

function _syncDisplayedHandSkinForAnimation(ownerKey, visualOptions) {
    try {
        const handContext = _resolveHandAnimationContext(ownerKey, visualOptions);
        return _applyResolvedHandAnimationContext(handContext);
    } catch (e) { /* ignore */ }
    return _resolveHandAnimationContext(ownerKey, visualOptions);
}

function _restoreDisplayedHandSkinAfterAnimation() {
    try {
        const syncDisplayedHandSkin = _getSyncDisplayedHandSkin();
        if (typeof syncDisplayedHandSkin !== 'function') return;
        const rootRef = (typeof window !== 'undefined' && window)
            ? window
            : ((typeof globalThis !== 'undefined' && globalThis) ? globalThis : null);
        syncDisplayedHandSkin(rootRef, null, _resolveHandImageElement());
    } catch (e) { /* ignore */ }
}

function _resolveHandLayerElements() {
    return {
        layerEl: (typeof handLayer !== 'undefined' && handLayer) ? handLayer : document.getElementById('handLayer'),
        wrapperEl: (typeof handWrapper !== 'undefined' && handWrapper) ? handWrapper : document.getElementById('handWrapper'),
        handImageEl: _resolveHandImageElement(),
        heldStoneEl: (typeof heldStone !== 'undefined' && heldStone) ? heldStone : document.getElementById('heldStone')
    };
}

function _resolveHandSelectorByOwner(playerKey) {
    const handEl = _resolveHandElementByOwner(playerKey);
    if (handEl && handEl.id) {
        return `#${handEl.id}`;
    }
    const ownerKey = _normalizeHandOwnerKey(playerKey);
    return ownerKey === 'white' ? '#hand-white' : '#hand-black';
}

function _playEffectByKeySafe(soundKey) {
    const key = String(soundKey || '').trim();
    if (!key) return;
    try {
        if (typeof SoundEngine !== 'undefined' && SoundEngine && typeof SoundEngine.playEffectByKey === 'function') {
            if (typeof SoundEngine.init === 'function') SoundEngine.init();
            SoundEngine.playEffectByKey(key);
        }
    } catch (e) { /* ignore */ }
}

function _resolveCardStateForHandAnimations() {
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object') return window.cardState;
    } catch (e) { /* ignore */ }
    return null;
}

function _normalizeCardSourceRect(rectLike) {
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

function _snapRectToWholePixels(rectLike) {
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

function _resolveCardUseSourceRect(sourceCardEl, sourceCardRect) {
    let liveRect = null;
    if (sourceCardEl && typeof sourceCardEl.getBoundingClientRect === 'function') {
        try {
            liveRect = _normalizeCardSourceRect(sourceCardEl.getBoundingClientRect());
        } catch (e) { /* ignore */ }
    }
    if (liveRect && liveRect.width > 0 && liveRect.height > 0) return liveRect;
    const snapshotRect = _normalizeCardSourceRect(sourceCardRect);
    if (snapshotRect) return snapshotRect;
    return liveRect;
}

function _resolveCreateCardFaceElement() {
    try {
        if (typeof createCardFaceElement === 'function') return createCardFaceElement;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window && typeof window.createCardFaceElement === 'function') {
            return window.createCardFaceElement;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis.createCardFaceElement === 'function') {
            return globalThis.createCardFaceElement;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function _resolveApplyCardSpecialArtToFace() {
    try {
        if (typeof applyCardSpecialArtToFace === 'function') return applyCardSpecialArtToFace;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window && typeof window.applyCardSpecialArtToFace === 'function') {
            return window.applyCardSpecialArtToFace;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis.applyCardSpecialArtToFace === 'function') {
            return globalThis.applyCardSpecialArtToFace;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function _getFallbackCardCostTier(cost) {
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

function _normalizeCardUseDisplayTypeLabel(label) {
    const normalized = String(label || '').trim();
    return normalized || '';
}

function _resolveCardUseDisplayTypeLabel(descriptor, cardId) {
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
    } catch (e) { /* ignore */ }

    try {
        if (typeof window !== 'undefined' && window.CardCatalog && Array.isArray(window.CardCatalog.cards) && cardId) {
            const catalogCard = window.CardCatalog.cards.find((entry) => entry && entry.id === cardId);
            const catalogLabel = _normalizeCardUseDisplayTypeLabel(catalogCard && (catalogCard.display_type_ja || catalogCard.displayTypeJa));
            if (catalogLabel) return catalogLabel;
        }
    } catch (e) { /* ignore */ }

    return '';
}

function _normalizeCardUseVisualDescriptor(descriptor, fallbackCardId, fallbackCardName, fallbackCardCost) {
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

function _buildFallbackCardUseElement(cardId, cardName, cardCost, descriptor, ownerKey) {
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
        } catch (e) { /* ignore */ }
    }

    const cardEl = document.createElement('div');
    cardEl.className = 'card-item visible';
    if (resolvedCardId) {
        try { cardEl.dataset.cardId = String(resolvedCardId); } catch (e) { /* ignore */ }
    }
    if (resolvedCostTier) {
        const tierClass = `cost-tier-${resolvedCostTier}`;
        cardEl.classList.add(tierClass);
    }
    const _typeKeyMap = { '採掘':'mining', '守護':'guard', '戦闘':'battle', '執行':'judgment', '禁忌':'taboo', '殲滅':'annihilation', '繁栄':'prosperity', '特殊':'special' };
    const resolvedTypeKey = _typeKeyMap[resolvedTypeLabel] || '';
    if (resolvedTypeKey) {
        try { cardEl.dataset.cardType = resolvedTypeKey; } catch (e) { /* ignore */ }
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
        } catch (e) { /* ignore */ }
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
    if (resolvedTypeLabel) {
        const badgeRow = document.createElement('div');
        badgeRow.className = 'card-badge-row';
        const typeBadge = document.createElement('div');
        typeBadge.className = 'card-type-badge';
        var _typeIconMap = { '採掘':'\u26CF\uFE0E', '守護':'\u26E8\uFE0E', '戦闘':'\u2694\uFE0E', '執行':'\u2696\uFE0E', '禁忌':'\u26A0\uFE0E', '殲滅':'\u2620\uFE0E', '繁栄':'\u2728', '特殊':'\u2726' };
        var _typeIcon = _typeIconMap[resolvedTypeLabel] || '';
        typeBadge.textContent = _typeIcon ? (_typeIcon + ' ' + resolvedTypeLabel) : resolvedTypeLabel;
        badgeRow.appendChild(typeBadge);
        cardEl.appendChild(badgeRow);
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
    } catch (e) {
        return null;
    }
}

function _setHandRevealState(nextState) {
    try {
        if (typeof window === 'undefined') return;
        window.__handSequentialRevealState = nextState || null;
    } catch (e) { /* ignore */ }
}

function _setHandRevealCount(playerKey, visibleCount, reason) {
    const ownerKey = _normalizeHandOwnerKey(playerKey);
    const safeCount = Math.max(0, Math.trunc(Number(visibleCount) || 0));
    _setHandRevealState({ playerKey: ownerKey, visibleCount: safeCount, reason: reason || null });
}

const THROW_CHAIN_HAND_FADE_DURATION = '1s';

function _clearHandFadeInState(token) {
    try {
        if (typeof window === 'undefined') return;
        const activeState = (window.__handFadeInState && typeof window.__handFadeInState === 'object')
            ? window.__handFadeInState
            : null;
        const activeHint = (window.__handFadeInHint && typeof window.__handFadeInHint === 'object')
            ? window.__handFadeInHint
            : null;
        if (!token || (activeState && activeState.token === token)) {
            window.__handFadeInState = null;
        }
        if (!token || (activeHint && activeHint.token === token)) {
            window.__handFadeInHint = null;
        }
    } catch (e) { /* ignore */ }
}

function _applyQueuedHandFadeIn(fadeState, payload) {
    if (!fadeState || !fadeState.token) return;
    try {
        if (typeof window !== 'undefined') {
            const activeState = (window.__handFadeInState && typeof window.__handFadeInState === 'object')
                ? window.__handFadeInState
                : null;
            if (!activeState || activeState.token !== fadeState.token) return;
        }

        const handSelector = _resolveHandSelectorByOwner(fadeState.playerKey);
        const latestCard = document.querySelector(`${handSelector} .card-item:last-child`);
        if (latestCard) {
            latestCard.classList.remove('card-fade-prep');
            if (payload && payload.reason === 'generated_throw_chain') {
                latestCard.style.setProperty('--card-fade-in-duration', THROW_CHAIN_HAND_FADE_DURATION);
            } else {
                latestCard.style.removeProperty('--card-fade-in-duration');
            }
            latestCard.classList.add('card-fade-in');
        }
    } catch (e) { /* ignore */ }
    _clearHandFadeInState(fadeState.token);
}

function _scheduleQueuedHandFadeIn(fadeState, payload) {
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
    } catch (e) { /* ignore */ }
    run();
}

function _installAnimationResolveFallback(done, timeoutMs) {
    if (typeof done !== 'function') return function () {};
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return function () {};

    let fallbackId = null;
    try {
        fallbackId = setTimeout(() => {
            fallbackId = null;
            done();
        }, timeoutMs);
    } catch (e) {
        fallbackId = null;
    }

    return function clearFallback() {
        if (fallbackId === null) return;
        try { clearTimeout(fallbackId); } catch (e) { /* ignore */ }
        fallbackId = null;
    };
}

function _getHandLayerAnimationRoot() {
    if (typeof window !== 'undefined' && window) return window;
    try {
        if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
    } catch (e) { /* ignore */ }
    return null;
}

function _getHandLayerAnimationQueueTail(rootRef) {
    if (!rootRef) return Promise.resolve();
    const tail = rootRef.__handLayerAnimationQueueTail;
    return (tail && typeof tail.then === 'function')
        ? tail.catch(() => {})
        : Promise.resolve();
}

function _setHandLayerAnimationQueueTail(rootRef, nextTail) {
    if (!rootRef) return;
    try {
        rootRef.__handLayerAnimationQueueTail = nextTail || null;
    } catch (e) { /* ignore */ }
}

function _enqueueHandLayerAnimation(task) {
    const runTask = (typeof task === 'function') ? task : function () { return Promise.resolve(); };
    const rootRef = _getHandLayerAnimationRoot();
    if (!rootRef) {
        return Promise.resolve().then(runTask);
    }

    const previousTail = _getHandLayerAnimationQueueTail(rootRef);
    let releaseQueue = function () {};
    const gate = new Promise((resolve) => {
        releaseQueue = resolve;
    });
    const nextTail = previousTail.then(() => gate);
    _setHandLayerAnimationQueueTail(rootRef, nextTail);

    const clearTailIfCurrent = () => {
        try {
            if (rootRef.__handLayerAnimationQueueTail === nextTail) {
                rootRef.__handLayerAnimationQueueTail = null;
            }
        } catch (e) { /* ignore */ }
    };

    return previousTail.then(() => {
        return Promise.resolve(runTask()).finally(() => {
            releaseQueue();
            void nextTail.finally(clearTailIfCurrent);
        });
    });
}

function _animateCompat(el, keyframes, options, scope) {
    return new Promise((resolve) => {
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
                    try { anim.addEventListener('finish', finish, { once: true }); } catch (e) { /* ignore */ }
                    try {
                        if (anim.finished && typeof anim.finished.then === 'function') {
                            anim.finished.then(finish).catch(finish);
                        }
                    } catch (e) { /* ignore */ }
                    _Timer().setTimeout(finish, duration + 140, scope);
                    return;
                }
            }
        } catch (e) { /* fallback below */ }

        // Fallback path: transition-based minimal animation
        const frames = Array.isArray(keyframes) ? keyframes : [];
        const first = frames.length ? frames[0] : {};
        const last = frames.length ? frames[frames.length - 1] : first;
        const easing = (options && options.easing) ? options.easing : 'linear';
        const supportsStyle = !!(el && el.style);
        const prevTransition = supportsStyle ? (el.style.transition || '') : '';

        if (supportsStyle) {
            if (first && Object.prototype.hasOwnProperty.call(first, 'transform')) el.style.transform = first.transform;
            if (first && Object.prototype.hasOwnProperty.call(first, 'opacity')) el.style.opacity = first.opacity;
            try { void el.offsetHeight; } catch (e) { /* ignore */ }

            const transitionParts = [];
            if ((first && Object.prototype.hasOwnProperty.call(first, 'transform')) || (last && Object.prototype.hasOwnProperty.call(last, 'transform'))) {
                transitionParts.push(`transform ${duration}ms ${easing}`);
            }
            if ((first && Object.prototype.hasOwnProperty.call(first, 'opacity')) || (last && Object.prototype.hasOwnProperty.call(last, 'opacity'))) {
                transitionParts.push(`opacity ${duration}ms ${easing}`);
            }
            if (transitionParts.length) {
                el.style.transition = transitionParts.join(', ');
            }

            const applyLast = () => {
                try {
                    if (last && Object.prototype.hasOwnProperty.call(last, 'transform')) el.style.transform = last.transform;
                    if (last && Object.prototype.hasOwnProperty.call(last, 'opacity')) el.style.opacity = last.opacity;
                } catch (e) { /* ignore */ }
            };
            try {
                if (typeof requestAnimationFrame === 'function') requestAnimationFrame(applyLast);
                else _Timer().setTimeout(applyLast, 16, scope);
            } catch (e) {
                applyLast();
            }
        }

        _Timer().setTimeout(() => {
            try { if (supportsStyle) el.style.transition = prevTransition; } catch (e) { /* ignore */ }
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
function animateDestroyAt(row, col, options) {
    // Unified destroy path: use the same fade-out logic as DESTROY playback.
    return animateFadeOutAt(row, col, options);
}

/**
 * フェードアウトアニメーション（破壊用）
 * Animate fade-out at a single board cell (returns a Promise)
 * @param {number} row - 行
 * @param {number} col - 列
 * @returns {Promise<void>}
 */
function animateFadeOutAt(row, col, options) {
    const opts = options || {};
    return new Promise(resolve => {
        const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
        const cell = root.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (!cell) return resolve();
        let disc = cell.querySelector('.disc');
        let createdGhost = false;
        if (!disc && opts.createGhost) {
            disc = document.createElement('div');
            const color = opts.color;
            disc.className = 'disc ' + (color === BLACK ? 'black' : 'white');
            // Ensure it doesn't interfere with clicks
            disc.style.pointerEvents = 'none';
            cell.appendChild(disc);
            createdGhost = true;

            // Optional: apply special stone visual to match expected look before fading out
            if (opts.effectKey && typeof applyStoneVisualEffect === 'function') {
                applyStoneVisualEffect(disc, opts.effectKey, { owner: color });
            }
        }
        if (!disc) return resolve();

        // If already animating, resolve immediately
        if (disc.classList.contains('destroy-fade')) return resolve();

        const noAnim = _isNoAnim();
        if (noAnim) {
            if (createdGhost && disc.parentElement) {
                disc.parentElement.removeChild(disc);
            }
            return resolve();
        }

        // Ensure fade-out isn't overridden by other animation classes (e.g. leftover 'flip')
        disc.classList.remove('flip', 'shatter', 'breeding-spawn');
        void disc.offsetWidth;

        let resolved = false;
        let timerId = null;
        const safeResolve = () => {
            if (resolved) return;
            resolved = true;
            disc.removeEventListener('animationend', onEnd);
            if (timerId !== null) {
                try { _Timer().clearTimeout(timerId); } catch (e) {}
                timerId = null;
            }
            if (createdGhost && disc.parentElement) {
                disc.parentElement.removeChild(disc);
            }
            resolve();
        };

        // Safety timeout (DESTROY_FADE_MS + 200ms)
        const fadeMs = (typeof SharedConstants !== 'undefined' && SharedConstants.DESTROY_FADE_MS) ? SharedConstants.DESTROY_FADE_MS : ((typeof window !== 'undefined' && window.DESTROY_FADE_MS) ? window.DESTROY_FADE_MS : 500);
        const startTs = Date.now();

        const onEnd = (ev) => {
            // Guard: if animationend fires immediately (duration 0), wait for the expected fade window.
            try {
                const elapsed = Date.now() - startTs;
                if (elapsed < fadeMs) return;
            } catch (e) { /* ignore */ }
            safeResolve();
        };
            const useAnimationEnd = !opts.createGhost; // Keep this line for clarity
        if (useAnimationEnd) disc.addEventListener('animationend', onEnd);
        disc.classList.add('destroy-fade');

        timerId = _Timer().setTimeout(safeResolve, fadeMs + 200);
    });
}

/**
 * 強い意志付与のフェードイン
 * @param {number} row
 * @param {number} col
 * @returns {Promise<void>}
 */
function animateStrongWillApply(row, col) {
    return new Promise(resolve => {
        const cell = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (!cell) return resolve();
        const disc = cell.querySelector('.disc');
        if (!disc) return resolve();

        // If no animations mode, resolve immediately
        if (_isNoAnim()) {
            resolve();
            return;
        }

        // Restart animation if needed
        disc.classList.remove('strong-will-apply');
        void disc.offsetWidth;
        disc.classList.add('strong-will-apply');

        let resolved = false;
        const safeResolve = () => {
            if (resolved) {
                return;
            }
            resolved = true;
            disc.removeEventListener('animationend', onEnd);
            disc.classList.remove('strong-will-apply');
            resolve();
        };
        const onEnd = (ev) => {
            safeResolve();
        };
        disc.addEventListener('animationend', onEnd);
        // Safety timeout
        const timerId = _Timer().setTimeout(safeResolve, 600);
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
function playHandAnimation(player, row, col, onComplete, visualOptions) {
    return _enqueueHandLayerAnimation(() => new Promise((resolveQueue) => {
        const syncCardAnimating = (locked) => {
            _setCardAnimatingState(locked);
        };
        const refreshCardUi = () => {
            _requestCardUiSyncForAnimationUtils('animation-utils:play-hand-animation');
        };
        const unlockProcessing = () => {
            _setProcessingState(false);
        };
        const releaseQueue = () => {
            try { resolveQueue(); } catch (e) { /* ignore */ }
        };
        const completeImmediately = () => {
            unlockProcessing();
            syncCardAnimating(false);
            refreshCardUi();
            try { if (typeof onComplete === 'function') onComplete(); } catch (e) { /* ignore */ }
            releaseQueue();
        };

        _setProcessingState(true);

        const boardRoot = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document.getElementById('board');
        const targetCell = boardRoot ? boardRoot.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`) : null;
        if (!targetCell) {
            completeImmediately();
            return;
        }

        // No-Animation: short-circuit to immediate completion without toggling isCardAnimating
        if (_isNoAnim()) {
            completeImmediately();
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
        const cellRect = targetCell.getBoundingClientRect();

        const handContext = _syncDisplayedHandSkinForAnimation(player, visualOptions);
        const playerKey = handContext && handContext.ownerKey
            ? handContext.ownerKey
            : _normalizeHandOwnerKey(player);
        // Setup Hand
        layerEl.style.display = 'block';
        wrapperEl.style.display = 'block';
        heldStoneEl.style.display = 'block';
        heldStoneEl.className = 'held-stone ' + (player === BLACK ? 'black' : 'white');

        // Calculate Position
        const cellCenterX = cellRect.left + (cellRect.width / 2);
        const cellCenterY = cellRect.top + (cellRect.height / 2);
        const wrapW = HAND_WRAPPER_WIDTH;

        const fromBottom = _isOwnerOnBottomSlot(playerKey);
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

        // Set initial state
        wrapperEl.style.transform = `translate(${dropX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})`;
        let completed = false;
        const completeMove = () => {
            if (completed) return;
            completed = true;
            try { if (typeof onComplete === 'function') onComplete(); } catch (e) { /* ignore */ }
        };
        const cleanup = () => {
            layerEl.style.display = 'none';
            wrapperEl.style.display = 'none';
            heldStoneEl.style.display = 'none';
            _restoreDisplayedHandSkinAfterAnimation();
            if (handAnimationTimeout) {
                _Timer().clearTimeout(handAnimationTimeout);
                handAnimationTimeout = null;
            }
            syncCardAnimating(false);
            unlockProcessing();
            refreshCardUi();
            releaseQueue();
        };

        (async () => {
            // 1. Approach
            await _animateCompat(wrapperEl, [
                { transform: `translate(${dropX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})` },
                { transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})` }
            ], {
                duration: 400,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
                fill: 'forwards'
            }, sc);

            // 2. Place (Bobbing effect)
            const bobOffset = (player === BLACK) ? 10 : -10;
            const placeAnim = _animateCompat(wrapperEl, [
                { transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})` },
                { transform: `translate(${dropX}px, ${dropY + bobOffset}px) rotate(${rotation}deg) scale(${scale * 0.95})` },
                { transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})` }
            ], {
                duration: 150,
                easing: 'ease-in-out'
            }, sc);

            // Reflect placement immediately when the hand starts the place motion.
            heldStoneEl.style.display = 'none';
            try {
                if (typeof SoundEngine !== 'undefined' && SoundEngine) {
                    SoundEngine.init();
                    SoundEngine.playStoneClack();
                }
            } catch (e) { /* ignore */ }
            completeMove();
            await placeAnim;

            // 3. Retreat
            await _animateCompat(wrapperEl, [
                { transform: `translate(${dropX}px, ${dropY}px) rotate(${rotation}deg) scale(${scale})` },
                { transform: `translate(${dropX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})` }
            ], {
                duration: 300,
                easing: 'ease-in',
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
function playClearHandAnimation(payload) {
    const data = payload || {};
    const blackVal = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const ownerKey = (data.player === 'white' || data.player === -1 || data.player === '-1') ? 'white'
        : (data.player === 'black' || data.player === blackVal || data.player === 1) ? 'black'
            : 'black';
    const clearReason = data.reason || null;

    return new Promise((resolve) => {
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

        const cards = Array.from(handEl.querySelectorAll('.card-item'));
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
            return new Promise((resolveOne) => {
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
                    } catch (e) { /* ignore */ }
                    try {
                        if (cardEl && cardEl.parentElement) cardEl.parentElement.removeChild(cardEl);
                    } catch (e) { /* ignore */ }
                    resolveOne();
                }, index * staggerMs, scope);
            });
        });

        Promise.all(animations).then(() => done()).catch(() => done());
    });
}

function _finalizeHandAddAnimation(payload, options) {
    const data = payload || {};
    const opts = options || {};
    const toPlayerKey = _normalizeHandOwnerKey(data.player);
    const fadeState = {
        playerKey: toPlayerKey,
        count: Number.isFinite(data.count) ? data.count : 1,
        token: `hand-fade-${Date.now()}-${Math.random().toString(36).slice(2)}`
    };

    let revealState = _getHandRevealState();
    if (revealState && revealState.playerKey === toPlayerKey && Number.isFinite(revealState.visibleCount)) {
        const drawCount = Number.isFinite(data.count) ? Math.max(1, Math.trunc(data.count)) : 1;
        _setHandRevealCount(toPlayerKey, Number(revealState.visibleCount) + drawCount, revealState.reason || null);
    }

    try {
        if (typeof window !== 'undefined') {
            window.__handFadeInState = fadeState;
            window.__handFadeInHint = fadeState;
        }
    } catch (e) { /* ignore */ }

    try {
        _requestCardUiSyncForAnimationUtils('animation-utils:finalize-hand-add');
        _scheduleQueuedHandFadeIn(fadeState, data);
    } catch (e) {
        _clearHandFadeInState(fadeState.token);
    }

    revealState = _getHandRevealState();
    if (revealState && revealState.playerKey === toPlayerKey && Number.isFinite(revealState.visibleCount)) {
        const resolvedCardState = _resolveCardStateForHandAnimations();
        const hand = (resolvedCardState && resolvedCardState.hands && Array.isArray(resolvedCardState.hands[toPlayerKey]))
            ? resolvedCardState.hands[toPlayerKey]
            : null;
        const handLen = hand ? hand.length : null;
        if (Number.isFinite(handLen) && Number(revealState.visibleCount) >= handLen) {
            _setHandRevealState(null);
        }
    }

    if (opts.pulseDeck === false) return;

    try {
        if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.pulseDeckUI === 'function') {
            __uiImpl.pulseDeckUI();
        }
    } catch (e) { /* ignore */ }
}

function _getCaptureReservedHandSlotState() {
    try {
        if (typeof window !== 'undefined' && window.__captureReservedHandSlotState && typeof window.__captureReservedHandSlotState === 'object') {
            return window.__captureReservedHandSlotState;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function _clearCaptureReservedHandSlotState(expectedToken) {
    try {
        if (typeof window === 'undefined') return;
        if (!window.__captureReservedHandSlotState) return;
        if (expectedToken && window.__captureReservedHandSlotState.token && window.__captureReservedHandSlotState.token !== expectedToken) {
            return;
        }
        window.__captureReservedHandSlotState = null;
    } catch (e) { /* ignore */ }
}

function _finalizeCaptureToHandAnimation(payload) {
    const data = payload || {};
    _clearCaptureReservedHandSlotState(data.reservedToken || null);
    _requestCardUiSyncForAnimationUtils('animation-utils:finalize-capture-hand');
}

function _resolveCaptureTargetCardElement(playerKey, handIndex) {
    const handEl = _resolveHandElementByOwner(playerKey);
    if (!handEl || !Number.isInteger(handIndex)) return null;
    return handEl.querySelector(`.card-item[data-owner-key="${playerKey}"][data-hand-index="${handIndex}"]`)
        || handEl.querySelector(`.card-item[data-hand-index="${handIndex}"]`);
}

function playCaptureToHandAnimation(payload) {
    const data = payload || {};
    const toPlayerKey = _normalizeHandOwnerKey(data.player);
    const reservedState = _getCaptureReservedHandSlotState();
    const reservedToken = reservedState && reservedState.playerKey === toPlayerKey
        ? (reservedState.token || null)
        : null;

    return _enqueueHandLayerAnimation(() => new Promise((resolve) => {
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
        const sourceCell = boardRoot && Number.isInteger(sourceRow) && Number.isInteger(sourceCol)
            ? boardRoot.querySelector(`.cell[data-row="${sourceRow}"][data-col="${sourceCol}"]`)
            : null;
        if (!layerEl || !targetCardEl || !sourceCell) {
            done();
            return;
        }

        const targetRect = _snapRectToWholePixels(targetCardEl.getBoundingClientRect());
        const sourceDisc = sourceCell.querySelector('.disc');
        const sourceRect = sourceDisc
            ? _snapRectToWholePixels(sourceDisc.getBoundingClientRect())
            : _snapRectToWholePixels(sourceCell.getBoundingClientRect());
        if (!sourceRect || !targetRect) {
            done();
            return;
        }

        _setCardAnimatingState(true);
        layerEl.style.display = 'block';

        const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
        let cleanupStarted = false;
        let movingStone = null;
        let revealCard = null;
        let timeoutId = _Timer().setTimeout(() => {
            void cleanup();
        }, 2600, sc);

        const cleanup = async () => {
            if (cleanupStarted) return;
            cleanupStarted = true;
            try {
                if (movingStone && movingStone.parentElement) movingStone.parentElement.removeChild(movingStone);
            } catch (e) { /* ignore */ }
            try {
                if (revealCard && revealCard.parentElement) revealCard.parentElement.removeChild(revealCard);
            } catch (e) { /* ignore */ }
            if (timeoutId) {
                _Timer().clearTimeout(timeoutId);
                timeoutId = null;
            }
            layerEl.style.display = 'none';
            _setCardAnimatingState(false);
            done();
        };

        movingStone = sourceDisc ? sourceDisc.cloneNode(true) : document.createElement('div');
        if (!sourceDisc) {
            const sourceOwnerKey = _normalizeHandOwnerKey(data.sourceOwner);
            movingStone.className = `disc ${sourceOwnerKey === 'white' ? 'white' : 'black'}`;
            if (data.sourceSpecialType && typeof applyStoneVisualEffect === 'function') {
                try {
                    applyStoneVisualEffect(movingStone, data.sourceSpecialType, { owner: sourceOwnerKey });
                } catch (e) { /* ignore */ }
            }
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
function playDrawCardHandAnimation(payload) {
    const data = payload || {};
    const toPlayerKey = _normalizeHandOwnerKey(data.player);

    try {
        if (typeof window !== 'undefined') {
            if (window.__drawHandAnimActive) {
                _finalizeHandAddAnimation(data, { pulseDeck: true });
                return Promise.resolve();
            }
            const now = Date.now();
            const last = Number(window.__lastDrawAnimAt || 0);
            if (now - last < 80) {
                _finalizeHandAddAnimation(data, { pulseDeck: true });
                return Promise.resolve();
            }
            window.__lastDrawAnimAt = now;
        }
    } catch (e) { /* ignore */ }

    return _enqueueHandLayerAnimation(() => new Promise(resolve => {
        let clearResolveFallback = function () {};
        const done = () => {
            clearResolveFallback();
            try {
                if (typeof window !== 'undefined') window.__drawHandAnimActive = false;
            } catch (e) { /* ignore */ }

            _finalizeHandAddAnimation(data, { pulseDeck: true });

            resolve();
        };

        try {
            if (typeof window !== 'undefined') {
                window.__drawHandAnimActive = true;
            }
        } catch (e) { /* ignore */ }

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
            done();
            return;
        }

        // Draw animation should never show placement stone visual.
        if (heldStoneEl) heldStoneEl.style.display = 'none';

        // Keep lock local to this animation only.
        _setCardAnimatingState(true);
        const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
        let heldCard = null;
        let cleanupStarted = false;
        let timeoutId = null;

        const deckRect = deckEl.getBoundingClientRect();
        const handRect = handEl.getBoundingClientRect();

        const startX = deckRect.left + deckRect.width / 2 - (HAND_WRAPPER_WIDTH / 2);
        const endX = handRect.left + handRect.width / 2 - (HAND_WRAPPER_WIDTH / 2);
        const fromBottom = _isOwnerOnBottomSlot(ownerKey);
        const startY = deckRect.top + (fromBottom ? -120 : -20);
        const endY = fromBottom ? (handRect.top - 105) : (handRect.top - 70);
        const rotation = fromBottom ? 0 : 180;
        const scale = fromBottom ? 0.76 : 0.72;

        layerEl.style.display = 'block';
        wrapperEl.style.display = 'block';
        wrapperEl.style.transform = `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})`;

        heldCard = document.createElement('div');
        heldCard.className = `held-draw-card ${fromBottom ? 'face-up' : 'face-down'}`;
        wrapperEl.appendChild(heldCard);

        const cleanup = () => {
            if (cleanupStarted) return;
            cleanupStarted = true;
            try {
                if (heldCard && heldCard.parentElement) heldCard.parentElement.removeChild(heldCard);
            } catch (e) { /* ignore */ }
            layerEl.style.display = 'none';
            wrapperEl.style.display = 'none';
            if (heldStoneEl) heldStoneEl.style.display = 'none';
            _restoreDisplayedHandSkinAfterAnimation();
            if (timeoutId) {
                _Timer().clearTimeout(timeoutId);
                timeoutId = null;
            }
            _setCardAnimatingState(false);
            try { if (typeof window !== 'undefined') window.__drawHandAnimActive = false; } catch (e) { /* ignore */ }
            done();
        };
        timeoutId = _Timer().setTimeout(cleanup, 2200, sc);
        clearResolveFallback = _installAnimationResolveFallback(cleanup, 2600);

        (async () => {
            await _animateCompat(wrapperEl, [
                { transform: `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(${scale})` },
                { transform: `translate(${startX}px, ${startY + (fromBottom ? -14 : 14)}px) rotate(${rotation}deg) scale(${scale * 0.96})` }
            ], {
                duration: 140,
                easing: 'ease-out',
                fill: 'forwards'
            }, sc);

            await _animateCompat(wrapperEl, [
                { transform: `translate(${startX}px, ${startY + (fromBottom ? -14 : 14)}px) rotate(${rotation}deg) scale(${scale * 0.96})` },
                { transform: `translate(${endX}px, ${endY}px) rotate(${rotation}deg) scale(${scale})` }
            ], {
                duration: 360,
                easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)',
                fill: 'forwards'
            }, sc);

            // Release near hand and retreat.
            heldCard.style.display = 'none';
            const retreatY = fromBottom ? (handRect.bottom + 70) : (handRect.top - 210);
            await _animateCompat(wrapperEl, [
                { transform: `translate(${endX}px, ${endY}px) rotate(${rotation}deg) scale(${scale})` },
                { transform: `translate(${endX}px, ${retreatY}px) rotate(${rotation}deg) scale(${scale})` }
            ], {
                duration: 220,
                easing: 'ease-in',
                fill: 'forwards'
            }, sc);
        })().catch(() => {
            // no-op
        }).finally(() => {
            cleanup();
        });
    }));
}

function playDirectHandAddAnimation(payload) {
    const data = payload || {};
    return new Promise((resolve) => {
        _finalizeHandAddAnimation(data, { pulseDeck: false });
        resolve();
    });
}

function _canViewerSeeTrapPlacement(playerKey) {
    try {
        const root = (typeof window !== 'undefined' && window)
            ? window
            : ((typeof globalThis !== 'undefined' && globalThis) ? globalThis : null);
        if (!root) return true;
        if (root.BOARD_VIEWER_KEY === 'black' || root.BOARD_VIEWER_KEY === 'white') {
            return root.BOARD_VIEWER_KEY === playerKey;
        }
        if (root.LOCAL_PLAYER_KEY === 'black' || root.LOCAL_PLAYER_KEY === 'white') {
            return root.LOCAL_PLAYER_KEY === playerKey;
        }
        if (root.DEBUG_HUMAN_VS_HUMAN === true) return true;
    } catch (e) { /* ignore */ }
    return true;
}

function _resolveTrapPlacementBoardElement() {
    try {
        if (typeof boardEl !== 'undefined' && boardEl && typeof boardEl.querySelector === 'function') {
            return boardEl;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
            return document.getElementById('board');
        }
    } catch (e) { /* ignore */ }
    return null;
}

function playTrapPlacementFlash(row, col, playerKey) {
    // Trap visuals are revealed only by explicit TRAP_REVEAL playback timing.
    void row;
    void col;
    void playerKey;
}

/**
 * カード使用時のハンド搬送演出
 * Hand carries a used card from hand side to charge UI.
 * @param {{player?:string|number, owner?:string|number, cardId?:string|null, cost?:number|null, name?:string|null}} payload
 * @returns {Promise<void>}
 */
function playCardUseHandAnimation(payload) {
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
    } catch (e) { /* ignore */ }

    return _enqueueHandLayerAnimation(() => new Promise((resolve, reject) => {
        let clearResolveFallback = function () {};
        let disappearSoundPlayed = false;
        let disappearHookStarted = false;
        let cleanupStarted = false;
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            clearResolveFallback();
            resolve();
        };
        const fail = (error) => {
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
        const setCardAnimating = (locked) => {
            _setCardAnimatingState(locked);
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
        let movingCard = null;
        let timeoutId = _Timer().setTimeout(() => {
            void cleanup();
        }, 3200, sc);

        const handRect = handEl.getBoundingClientRect();
        const chargeRect = chargeEl.getBoundingClientRect();
        const explicitSourceCardEl = (data.sourceCardEl && typeof data.sourceCardEl.cloneNode === 'function') ? data.sourceCardEl : null;
        // IMPORTANT:
        // Do not auto-pick "last hand card" as animation source.
        // In AUTO mode the hand can update between decision/apply/render, causing visible card mismatch.
        // Prefer payload(cardId/name/cost) unless an explicit source element is supplied.
        const sourceCardEl = explicitSourceCardEl || null;
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

        layerEl.style.display = 'block';
        movingCard = sourceCardEl
            ? sourceCardEl.cloneNode(true)
            : _buildFallbackCardUseElement(
                visualDescriptor.cardId || null,
                cardName,
                cardCost,
                visualDescriptor,
                ownerKey
            );
        if (!sourceCardEl) {
            movingCard.classList.add('visible');
        }
        movingCard.style.position = 'fixed';
        movingCard.style.pointerEvents = 'none';
        movingCard.style.zIndex = '1300';
        movingCard.style.transform = 'translate(0px, 0px)';
        movingCard.style.margin = '0';
        const srcRect = _resolveCardUseSourceRect(sourceCardEl, data.sourceCardRect);
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
        const waitHold = () => new Promise((r) => _Timer().setTimeout(r, HOLD_MS, sc));
        const cleanup = async () => {
            if (cleanupStarted) return;
            cleanupStarted = true;
            try {
                if (movingCard && movingCard.parentElement) movingCard.parentElement.removeChild(movingCard);
            } catch (e) { /* ignore */ }
            if (handImageEl) handImageEl.style.visibility = prevHandImageVisibility;
            if (heldStoneEl) heldStoneEl.style.display = prevHeldStoneDisplay;
            layerEl.style.display = 'none';
            if (timeoutId) {
                _Timer().clearTimeout(timeoutId);
                timeoutId = null;
            }
            try {
                await runDisappearEffectsOnce();
                setCardAnimating(false);
                done();
            } catch (error) {
                setCardAnimating(false);
                fail(error);
            }
        };
        clearResolveFallback = _installAnimationResolveFallback(() => {
            void cleanup();
        }, 3600);

        (async () => {
            await _animateCompat(movingCard, [
                { transform: 'translate(0px, 0px)' },
                { transform: `translate(0px, ${liftY}px)` }
            ], {
                duration: 140,
                easing: 'ease-out',
                fill: 'forwards'
            }, sc);

            await _animateCompat(movingCard, [
                { transform: `translate(0px, ${liftY}px)` },
                { transform: `translate(${dx}px, ${dy}px)` }
            ], {
                duration: 320,
                easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)',
                fill: 'forwards'
            }, sc);

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

            await waitHold();

            await _animateCompat(movingCard, [
                { opacity: 1 },
                { opacity: 0 }
            ], {
                duration: FADE_MS,
                easing: 'ease-out',
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
 * 多動石の移動アニメーション
 * Smoothly translate a disc from source cell to target cell.
 * @param {{row:number,col:number}} from
 * @param {{row:number,col:number}} to
 * @returns {Promise<void>}
 */
function animateHyperactiveMove(from, to, options) {
    const opts = options || {};
    return new Promise(resolve => {
        const fromCell = boardEl.querySelector(`.cell[data-row="${from.row}"][data-col="${from.col}"]`);
        const toCell = boardEl.querySelector(`.cell[data-row="${to.row}"][data-col="${to.col}"]`);
        if (!fromCell || !toCell) return resolve();

        let fromDisc = fromCell.querySelector('.disc');
        let sourceCell = fromCell;
        // Fallback order:
        // 1) carryDisc passed by caller (for chained moves when board is already at final snapshot),
        // 2) destination disc (single-step post-state fallback).
        if (!fromDisc && opts.carryDisc && opts.carryDisc.parentElement) {
            fromDisc = opts.carryDisc;
            sourceCell = opts.carryDisc.parentElement;
        }
        if (!fromDisc) {
            const toDisc = toCell.querySelector('.disc');
            if (!toDisc) return resolve();
            fromDisc = toDisc;
            sourceCell = toCell;
        }
        // Move visuals must not inherit destroy/disappear state.
        fromDisc.classList.remove('destroy-fade', 'shatter');

        const fxLayer = document.getElementById('card-fx-layer') || boardEl;
        const fxRect = _snapRectToWholePixels(fxLayer.getBoundingClientRect());
        const fromRect = _snapRectToWholePixels(fromCell.getBoundingClientRect());
        const toRect = _snapRectToWholePixels(toCell.getBoundingClientRect());
        const sourceCellRect = sourceCell && typeof sourceCell.getBoundingClientRect === 'function'
            ? _snapRectToWholePixels(sourceCell.getBoundingClientRect())
            : fromRect;
        const liveDiscRect = fromDisc && typeof fromDisc.getBoundingClientRect === 'function'
            ? _snapRectToWholePixels(fromDisc.getBoundingClientRect())
            : null;
        if (!fxRect || !fromRect || !toRect) return resolve();

        let discWidth = liveDiscRect && liveDiscRect.width > 0 ? liveDiscRect.width : 0;
        let discHeight = liveDiscRect && liveDiscRect.height > 0 ? liveDiscRect.height : 0;
        let discInsetX = (
            liveDiscRect &&
            sourceCellRect &&
            Number.isFinite(liveDiscRect.left) &&
            Number.isFinite(sourceCellRect.left)
        ) ? (liveDiscRect.left - sourceCellRect.left) : NaN;
        let discInsetY = (
            liveDiscRect &&
            sourceCellRect &&
            Number.isFinite(liveDiscRect.top) &&
            Number.isFinite(sourceCellRect.top)
        ) ? (liveDiscRect.top - sourceCellRect.top) : NaN;

        if (!(discWidth > 0) || !(discHeight > 0) || !Number.isFinite(discInsetX) || !Number.isFinite(discInsetY)) {
            try {
                if (typeof window !== 'undefined' && boardEl && typeof window.getComputedStyle === 'function') {
                    const boardStyle = window.getComputedStyle(boardEl);
                    const cssDiscSize = Number.parseFloat(boardStyle.getPropertyValue('--board-disc-size-px') || '');
                    const cssDiscInset = Number.parseFloat(boardStyle.getPropertyValue('--board-disc-inset-px') || '');
                    if (!(discWidth > 0) && Number.isFinite(cssDiscSize) && cssDiscSize > 0) discWidth = cssDiscSize;
                    if (!(discHeight > 0) && Number.isFinite(cssDiscSize) && cssDiscSize > 0) discHeight = cssDiscSize;
                    if (!Number.isFinite(discInsetX) && Number.isFinite(cssDiscInset) && cssDiscInset >= 0) discInsetX = cssDiscInset;
                    if (!Number.isFinite(discInsetY) && Number.isFinite(cssDiscInset) && cssDiscInset >= 0) discInsetY = cssDiscInset;
                }
            } catch (e) { /* ignore */ }
        }

        if (!(discWidth > 0)) discWidth = fromRect.width * 0.82;
        if (!(discHeight > 0)) discHeight = fromRect.height * 0.82;
        if (!Number.isFinite(discInsetX)) discInsetX = Math.max(0, (fromRect.width - discWidth) / 2);
        if (!Number.isFinite(discInsetY)) discInsetY = Math.max(0, (fromRect.height - discHeight) / 2);

        // Match the currently rendered disc box so moving stones keep the same sharp size.
        const startX = Math.round((fromRect.left - fxRect.left) + discInsetX);
        const startY = Math.round((fromRect.top - fxRect.top) + discInsetY);
        const endX = Math.round((toRect.left - fxRect.left) + discInsetX);
        const endY = Math.round((toRect.top - fxRect.top) + discInsetY);
        const ghostWidth = Math.max(1, Math.round(discWidth));
        const ghostHeight = Math.max(1, Math.round(discHeight));
        const baseMoveMs = (typeof window !== 'undefined' && window.AnimationConstants && Number.isFinite(window.AnimationConstants.MOVE_MS))
            ? window.AnimationConstants.MOVE_MS
            : 400;
        const durationMs = Math.max(1, Math.round(baseMoveMs));

// No-Animation: perform immediate move
    if (typeof _isNoAnim === 'function' && _isNoAnim()) {
        try {
            if (fromDisc.parentElement === fromCell) {
                fromCell.removeChild(fromDisc);
            }
            toCell.appendChild(fromDisc);
        } catch (e) { /* ignore */ }
        return resolve();
    }

    const ghost = fromDisc.cloneNode(true);
        ghost.classList.remove('destroy-fade', 'shatter');
        ghost.classList.add('hyperactive-move-ghost');
        ghost.style.position = 'absolute';
        ghost.style.left = `${startX}px`;
        ghost.style.top = `${startY}px`;
        ghost.style.width = `${ghostWidth}px`;
        ghost.style.height = `${ghostHeight}px`;
        ghost.style.pointerEvents = 'none';
        ghost.style.transform = 'none';
        ghost.style.transition = 'none';

        // Hide source disc; board re-render after the animation will remove it
        fromDisc.style.visibility = 'hidden';
        fxLayer.appendChild(ghost);

        let finished = false;
        let timeoutId = null;
        let transitionKickoffId = null;
        const handleTransitionEnd = (event) => {
            if (!event || event.target !== ghost) return;
            const propertyName = String(event.propertyName || '');
            if (propertyName && propertyName !== 'left' && propertyName !== 'top') return;
            finish();
        };
        const finish = () => {
            if (finished) return;
            finished = true;
            if (timeoutId !== null) {
                _Timer().clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (transitionKickoffId !== null && typeof cancelAnimationFrame === 'function') {
                try { cancelAnimationFrame(transitionKickoffId); } catch (e) { /* ignore */ }
                transitionKickoffId = null;
            }
            try { ghost.removeEventListener('transitionend', handleTransitionEnd); } catch (e) { /* ignore */ }
            if (ghost.parentElement) ghost.parentElement.removeChild(ghost);
            // Materialize the moved disc immediately so multiple hyperactive moves
            // don't look like teleporting/reappearing after a batch re-render.
            // (Final board state is still synced by emitBoardUpdate().)
            try {
                // Remove any existing disc in target (should be empty, but guard against stale DOM)
                const existing = toCell.querySelector('.disc');
                if (existing && existing !== fromDisc) {
                    existing.remove();
                }
                fromDisc.style.visibility = '';
                if (sourceCell === fromCell && fromDisc.parentElement === fromCell) {
                    fromCell.removeChild(fromDisc);
                }
                toCell.appendChild(fromDisc);
            } catch (e) {
                // ignore DOM move errors; board will re-render after this animation anyway
            }
            resolve();
        };

        ghost.addEventListener('transitionend', handleTransitionEnd);
        const startTransition = () => {
            if (finished) return;
            ghost.style.transition =
                `left ${durationMs}ms cubic-bezier(0.2, 0.85, 0.3, 1), top ${durationMs}ms cubic-bezier(0.2, 0.85, 0.3, 1)`;
            ghost.style.left = `${endX}px`;
            ghost.style.top = `${endY}px`;
        };
        const sc = (typeof window !== 'undefined' && window._currentPlaybackScope) ? window._currentPlaybackScope : null;
        try {
            if (typeof requestAnimationFrame === 'function') {
                transitionKickoffId = requestAnimationFrame(startTransition);
            } else if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                transitionKickoffId = window.requestAnimationFrame(startTransition);
            } else {
                _Timer().setTimeout(startTransition, 0, sc);
            }
        } catch (e) {
            _Timer().setTimeout(startTransition, 0, sc);
        }
        timeoutId = _Timer().setTimeout(finish, durationMs + 220, sc);
    });
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
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
        animateStrongWillApply
    };
}

if (typeof window !== 'undefined') {
    window.playClearHandAnimation = playClearHandAnimation;
    window.playDrawCardHandAnimation = playDrawCardHandAnimation;
    window.playDirectHandAddAnimation = playDirectHandAddAnimation;
    window.playCaptureToHandAnimation = playCaptureToHandAnimation;
    window.playTrapPlacementFlash = playTrapPlacementFlash;
    window.playCardUseHandAnimation = playCardUseHandAnimation;
}
