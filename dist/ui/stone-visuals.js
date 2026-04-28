'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
let AnimationShared = (typeof _require === 'function') ? _require('./animation-helpers') : (typeof window !== 'undefined' ? window.AnimationHelpers : null);
let BoardRendererDiscHelpers = (typeof _require === 'function') ? _require('./board-renderer') : (typeof window !== 'undefined' ? window : null);
let VisualEffectsHelpers = (typeof _require === 'function')
    ? (function () { try {
        return _require('./visual-effects-map');
    }
    catch (e) {
        return null;
    } })()
    : (typeof window !== 'undefined' ? window : null);
let _isNoAnim = (AnimationShared && AnimationShared.isNoAnim) ? AnimationShared.isNoAnim : function () { return false; };
let _Timer = (AnimationShared && AnimationShared.getTimer) ? AnimationShared.getTimer : function () {
    if (typeof TimerRegistry !== 'undefined')
        return TimerRegistry;
    return {
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        clearAll: () => { },
        pendingCount: () => 0,
        newScope: () => null,
        clearScope: () => { }
    };
};
try {
    if (typeof window !== 'undefined' && _isNoAnim() && typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.classList.add('no-anim');
    }
}
catch (e) { }
function _getDiscRenderHelperForStoneVisuals(name) {
    if (BoardRendererDiscHelpers && typeof BoardRendererDiscHelpers[name] === 'function')
        return BoardRendererDiscHelpers[name];
    if (typeof window !== 'undefined' && typeof window[name] === 'function')
        return window[name];
    return null;
}
function _getVisualEffectsHelperForStoneVisuals(name) {
    if (VisualEffectsHelpers && typeof VisualEffectsHelpers[name] === 'function')
        return VisualEffectsHelpers[name];
    if (typeof window !== 'undefined' && typeof window[name] === 'function')
        return window[name];
    return null;
}
function applyStoneVisualState(disc, options = {}) {
    const debugVisual = (typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true);
    if (debugVisual)
        console.log('[VISUAL_DEBUG] applyStoneVisualState invoked', options && options.effectKey);
    const { effectKey, owner, newColor = null, fadeWholeStone = false } = options;
    if (!disc || !disc.parentElement)
        return;
    if (newColor === 1 || newColor === -1) {
        disc.classList.remove('black', 'white');
        disc.classList.add(newColor === 1 ? 'black' : 'white');
    }
    if (effectKey && typeof applyStoneVisualEffect === 'function') {
        try {
            if (debugVisual)
                console.log('[VISUAL_DEBUG] crossfade attempting applyStoneVisualEffect', effectKey);
        }
        catch (e) { }
        try {
            applyStoneVisualEffect(disc, effectKey, { owner });
        }
        catch (e) {
            console.warn('[VISUAL_DEBUG] applyStoneVisualEffect threw', e);
        }
        try {
            if (debugVisual)
                console.log('[VISUAL_DEBUG] crossfade after apply classes:', disc && disc.className);
        }
        catch (e) { }
    }
    try {
        const overlay = disc.parentElement.querySelector('.stone-fade-overlay');
        if (overlay)
            overlay.remove();
    }
    catch (e) { }
    disc.classList.remove('stone-hidden', 'stone-hidden-all', 'stone-instant');
    try {
        disc.style.opacity = '';
    }
    catch (e) { }
    return;
}
function _removeStoneFadeOverlay(disc) {
    if (!disc || !disc.parentElement)
        return;
    try {
        const overlay = disc.parentElement.querySelector('.stone-fade-overlay');
        if (overlay)
            overlay.remove();
    }
    catch (e) { /* ignore */ }
}
function _waitForStoneVisualFrame() {
    return new Promise((resolve) => {
        try {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => resolve());
                return;
            }
        }
        catch (e) { /* ignore */ }
        const timer = _Timer();
        timer.setTimeout(resolve, 0);
    });
}
async function animateStoneVisualTransition(disc, options = {}) {
    const debugVisual = (typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true);
    if (debugVisual)
        console.log('[VISUAL_DEBUG] animateStoneVisualTransition invoked', options && options.effectKey);
    if (!disc || !disc.parentElement)
        return;
    const durationMs = Number.isFinite(Number(options.durationMs))
        ? Math.max(0, Math.trunc(Number(options.durationMs)))
        : 600;
    if (_isNoAnim() || durationMs <= 0) {
        applyStoneVisualState(disc, options);
        return;
    }
    const container = disc.parentElement;
    _removeStoneFadeOverlay(disc);
    let overlay = null;
    let priorContainerPosition = '';
    let changedContainerPosition = false;
    try {
        overlay = disc.cloneNode(true);
        overlay.classList.add('stone-fade-overlay');
        overlay.setAttribute('aria-hidden', 'true');
        try {
            overlay.removeAttribute('id');
        }
        catch (e) { /* ignore */ }
        const computedPosition = (typeof window !== 'undefined' && window.getComputedStyle)
            ? window.getComputedStyle(container).position
            : '';
        if (computedPosition === 'static') {
            priorContainerPosition = container.style.position || '';
            container.style.position = 'relative';
            changedContainerPosition = true;
        }
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.pointerEvents = 'none';
        overlay.style.opacity = '1';
        overlay.style.transition = `opacity ${durationMs}ms ease`;
        overlay.style.zIndex = '2';
        container.appendChild(overlay);
    }
    catch (e) {
        overlay = null;
    }
    const priorTransition = disc.style.transition || '';
    const priorOpacity = disc.style.opacity || '';
    try {
        disc.style.transition = `opacity ${durationMs}ms ease`;
        disc.style.opacity = '0';
        applyStoneVisualState(disc, options);
        await _waitForStoneVisualFrame();
        disc.style.opacity = '1';
        if (overlay)
            overlay.style.opacity = '0';
        await new Promise((resolve) => {
            const timer = _Timer();
            timer.setTimeout(resolve, durationMs);
        });
    }
    finally {
        try {
            disc.style.transition = priorTransition;
        }
        catch (e) { /* ignore */ }
        try {
            disc.style.opacity = priorOpacity;
        }
        catch (e) { /* ignore */ }
        if (overlay && overlay.parentElement) {
            try {
                overlay.parentElement.removeChild(overlay);
            }
            catch (e) { /* ignore */ }
        }
        if (changedContainerPosition) {
            try {
                container.style.position = priorContainerPosition;
            }
            catch (e) { /* ignore */ }
        }
    }
}
async function crossfadeStoneVisual(disc, options = {}) {
    return animateStoneVisualTransition(disc, options);
}
if (typeof window !== 'undefined') {
    window.crossfadeStoneVisual = crossfadeStoneVisual;
    window.applyStoneVisualState = applyStoneVisualState;
}
const TIME_BOMB_TURNS = (typeof CardLogic !== 'undefined' && Number.isFinite(CardLogic.TIME_BOMB_TURNS))
    ? CardLogic.TIME_BOMB_TURNS
    : 3;
function setDiscColorAt(row, col, color) {
    const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
    const cell = root.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc)
        return;
    disc.classList.remove('black', 'white');
    disc.classList.add(color === (typeof BLACK !== 'undefined' ? BLACK : 1) ? 'black' : 'white');
    const setDiscStoneImage = _getDiscRenderHelperForStoneVisuals('setDiscStoneImage');
    if (setDiscStoneImage) {
        setDiscStoneImage(disc, color);
    }
}
function removeBombOverlayAt(row, col) {
    const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
    const cell = root.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc)
        return;
    disc.classList.remove('bomb', 'bomb-black', 'bomb-white');
    const timer = disc.querySelector('.bomb-timer');
    if (timer)
        timer.remove();
    const icon = disc.querySelector('.bomb-icon');
    if (icon)
        icon.remove();
}
function clearAllStoneVisualEffectsAt(row, col) {
    const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
    const cell = root.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc)
        return;
    const clearStoneVisualEffectState = _getVisualEffectsHelperForStoneVisuals('clearStoneVisualEffectState');
    if (clearStoneVisualEffectState) {
        clearStoneVisualEffectState(disc);
        return;
    }
    disc.classList.remove('special-stone', 'ud-black', 'ud-white', 'breeding-black', 'breeding-white');
    delete disc.dataset.ud;
    delete disc.dataset.breeding;
    try {
        if (typeof STONE_VISUAL_EFFECTS !== 'undefined' && STONE_VISUAL_EFFECTS) {
            for (const k of Object.keys(STONE_VISUAL_EFFECTS)) {
                const eff = STONE_VISUAL_EFFECTS[k];
                if (eff && eff.cssClass)
                    disc.classList.remove(eff.cssClass);
            }
        }
    }
    catch (e) {
        // visuals only
    }
    disc.style.removeProperty('--special-stone-image');
    disc.style.removeProperty('--disc-overlay-image');
    disc.style.removeProperty('--disc-overlay-scale');
    disc.style.removeProperty('--dragon-image-path');
    disc.style.removeProperty('--breeding-image-path');
    const setDiscStoneImage = _getDiscRenderHelperForStoneVisuals('setDiscStoneImage');
    if (setDiscStoneImage) {
        setDiscStoneImage(disc, disc.classList.contains('white') ? WHITE : BLACK);
    }
}
function syncDiscVisualToCurrentState(row, col) {
    const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
    const cell = root.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!disc)
        return;
    const markerKinds = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
    const isBombCategoryMarker = (marker) => {
        if (!marker || typeof marker !== 'object')
            return false;
        if (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
            return MarkersAdapter.isBombCategoryMarker(marker);
        }
        const data = (marker.data && typeof marker.data === 'object') ? marker.data : null;
        const category = String(data && data.category ? data.category : '').trim().toLowerCase();
        const type = String(data && data.type ? data.type : '').trim().toUpperCase();
        return marker.kind === 'bomb' || category === 'bomb' || type === 'TIME_BOMB';
    };
    let bomb = null;
    if (cardState && Array.isArray(cardState.markers)) {
        bomb = (typeof MarkersAdapter !== 'undefined'
            && MarkersAdapter
            && typeof MarkersAdapter.findBombMarkerAt === 'function')
            ? MarkersAdapter.findBombMarkerAt(cardState, row, col)
            : (cardState.markers.find((m) => isBombCategoryMarker(m) && m.row === row && m.col === col) || null);
        if (bomb && bomb.data) {
            bomb = { row, col, remainingTurns: bomb.data.remainingTurns, owner: bomb.owner };
        }
    }
    if (!bomb) {
        removeBombOverlayAt(row, col);
    }
    else {
        const bombOwner = (bomb.owner === 'black' || bomb.owner === BLACK || bomb.owner === 1) ? BLACK : WHITE;
        disc.classList.add('bomb', 'special-stone', bombOwner === BLACK ? 'bomb-black' : 'bomb-white');
        if (!disc.querySelector('.bomb-timer')) {
            const timeLabel = document.createElement('div');
            timeLabel.className = 'bomb-timer';
            timeLabel.textContent = bomb.remainingTurns;
            disc.appendChild(timeLabel);
        }
        else {
            try {
                disc.querySelector('.bomb-timer').textContent = bomb.remainingTurns;
            }
            catch (e) { /* ignore */ }
        }
    }
    clearAllStoneVisualEffectsAt(row, col);
    if (bomb) {
        const bombOwner = (bomb.owner === 'black' || bomb.owner === BLACK || bomb.owner === 1) ? BLACK : WHITE;
        if (typeof applyStoneVisualEffect === 'function') {
            applyStoneVisualEffect(disc, 'timeBombStone', { owner: bombOwner });
        }
        disc.classList.add('bomb', 'special-stone', bombOwner === BLACK ? 'bomb-black' : 'bomb-white');
    }
    let special = null;
    if (cardState && Array.isArray(cardState.markers)) {
        const s = cardState.markers.find((m) => (m.kind === markerKinds.SPECIAL_STONE
            && !isBombCategoryMarker(m)
            && m.row === row
            && m.col === col)) || null;
        if (s && s.data) {
            special = { row, col, type: s.data.type, owner: s.owner, remainingOwnerTurns: s.data.remainingOwnerTurns, regenRemaining: s.data.regenRemaining };
        }
    }
    if (!special)
        return;
    const ownerVal = (special.owner === 'black') ? BLACK : (special.owner === 'white') ? WHITE : (Number.isFinite(special.owner) ? special.owner : null);
    const effectKey = (typeof getEffectKeyForSpecialType === 'function') ? getEffectKeyForSpecialType(special.type) : null;
    if (effectKey && typeof applyStoneVisualEffect === 'function') {
        if (special.type === 'REGEN' && (special.regenRemaining || 0) <= 0)
            return;
        applyStoneVisualEffect(disc, effectKey, { owner: ownerVal });
    }
}
function applyPendingSpecialstoneVisual(move, pendingType) {
    if (!pendingType)
        return;
    const root = (typeof boardEl !== 'undefined' && boardEl) ? boardEl : document;
    const placedCell = root.querySelector(`.cell[data-row="${move.row}"][data-col="${move.col}"]`);
    const disc = placedCell ? placedCell.querySelector('.disc') : null;
    if (!disc)
        return;
    if (pendingType === 'TIME_BOMB') {
        const ownerClass = move.player === BLACK ? 'bomb-black' : 'bomb-white';
        disc.classList.add('bomb', 'special-stone', ownerClass);
        if (!disc.querySelector('.bomb-timer')) {
            const timeLabel = document.createElement('div');
            timeLabel.className = 'bomb-timer';
            timeLabel.textContent = TIME_BOMB_TURNS;
            disc.appendChild(timeLabel);
        }
    }
    const effectKey = (typeof getEffectKeyForPendingType === 'function') ? getEffectKeyForPendingType(pendingType) : null;
    if (effectKey && typeof applyStoneVisualEffect === 'function')
        applyStoneVisualEffect(disc, effectKey, { owner: move.player });
}
let _chargeDeltaTimers = Object.create(null);
let _chargeDeltaClearTimers = Object.create(null);
let _chargeDeltaSeq = Object.create(null);
function _getChargeDeltaSignKey(deltaOrSign) {
    if (deltaOrSign === 'increase' || deltaOrSign === 'decrease')
        return deltaOrSign;
    return Number(deltaOrSign) > 0 ? 'increase' : 'decrease';
}
function _getChargeDeltaSurfaceKey(key, deltaOrSign) {
    return `${key}-${_getChargeDeltaSignKey(deltaOrSign)}`;
}
function _getChargeDeltaElementId(key, deltaOrSign) {
    return `charge-delta-${key}-${_getChargeDeltaSignKey(deltaOrSign)}`;
}
function _resolveChargeDeltaEl(key, delta) {
    if (typeof document === 'undefined')
        return null;
    return document.getElementById(_getChargeDeltaElementId(key, delta));
}
function _resolveChargeDeltaCssPx(el, propertyName, fallback) {
    try {
        if (typeof window !== 'undefined' && window.getComputedStyle && el) {
            const raw = window.getComputedStyle(el).getPropertyValue(propertyName);
            const parsed = parseFloat(raw);
            if (Number.isFinite(parsed))
                return parsed;
        }
    }
    catch (e) { /* ignore */ }
    return fallback;
}
function _resolveChargeDeltaSideGapPx(el) {
    return _resolveChargeDeltaCssPx(el, '--layout-size-charge-delta-side-gap', _resolveChargeDeltaCssPx(el, '--layout-size-charge-delta-anchor-gap', 8));
}
function _resolveChargeDeltaViewportHeight() {
    try {
        if (typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0) {
            return window.innerHeight;
        }
        if (document.documentElement && Number.isFinite(document.documentElement.clientHeight) && document.documentElement.clientHeight > 0) {
            return document.documentElement.clientHeight;
        }
    }
    catch (e) { /* ignore */ }
    return 1080;
}
function _resolveChargeDeltaViewportWidth() {
    try {
        if (typeof window !== 'undefined' && Number.isFinite(window.innerWidth) && window.innerWidth > 0) {
            return window.innerWidth;
        }
        if (document.documentElement && Number.isFinite(document.documentElement.clientWidth) && document.documentElement.clientWidth > 0) {
            return document.documentElement.clientWidth;
        }
    }
    catch (e) { /* ignore */ }
    return 1920;
}
function _isMirroredChargeDeltaSlot(key) {
    return key === 'white';
}
function _positionChargeDeltaEl(key, delta, el) {
    if (typeof document === 'undefined' || !el)
        return;
    const chargeId = (key === 'black') ? 'charge-black' : 'charge-white';
    const chargeEl = document.getElementById(chargeId);
    if (!chargeEl || typeof chargeEl.getBoundingClientRect !== 'function')
        return;
    const chargeRect = chargeEl.getBoundingClientRect();
    if (!Number.isFinite(chargeRect.left) || !Number.isFinite(chargeRect.top))
        return;
    const deltaRect = (typeof el.getBoundingClientRect === 'function') ? el.getBoundingClientRect() : null;
    const deltaWidth = (deltaRect && Number.isFinite(deltaRect.width) && deltaRect.width > 0)
        ? deltaRect.width
        : (el.offsetWidth || 0);
    const deltaHeight = (deltaRect && Number.isFinite(deltaRect.height) && deltaRect.height > 0)
        ? deltaRect.height
        : (el.offsetHeight || 0);
    const chargeWidth = Number.isFinite(chargeRect.width) ? chargeRect.width : 0;
    const chargeHeight = Number.isFinite(chargeRect.height) ? chargeRect.height : 0;
    const chargeRight = Number.isFinite(chargeRect.right) ? chargeRect.right : (chargeRect.left + chargeWidth);
    const gap = _resolveChargeDeltaSideGapPx(el);
    const viewportWidth = _resolveChargeDeltaViewportWidth();
    const viewportHeight = _resolveChargeDeltaViewportHeight();
    const isPositive = Number(delta) > 0;
    const showOnLeft = _isMirroredChargeDeltaSlot(key) ? !isPositive : isPositive;
    const anchorLeft = showOnLeft
        ? (chargeRect.left - deltaWidth - gap)
        : (chargeRight + gap);
    const anchorTop = chargeRect.top + ((chargeHeight - deltaHeight) / 2);
    const maxLeft = Math.max(8, viewportWidth - deltaWidth - 8);
    const maxTop = Math.max(8, viewportHeight - deltaHeight - 8);
    const clampedLeft = Math.min(maxLeft, Math.max(8, anchorLeft));
    const clampedTop = Math.min(maxTop, Math.max(8, anchorTop));
    el.style.left = `${Math.round(clampedLeft)}px`;
    el.style.top = `${Math.round(clampedTop)}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
}
function _setChargeDeltaText(el, delta) {
    if (!el)
        return;
    const sign = delta > 0 ? '+' : '';
    el.textContent = sign + delta;
}
function _applyChargeDeltaVariant(el, delta) {
    if (!el)
        return;
    el.classList.remove('is-increase', 'is-decrease');
    el.classList.add(delta > 0 ? 'is-increase' : 'is-decrease');
}
function _restartChargeDeltaAnimation(el) {
    if (!el)
        return;
    el.classList.remove('is-visible', 'is-fadeout', 'is-restart');
    el.classList.add('is-restart');
    void el.offsetWidth;
}
function _scheduleChargeDeltaLifecycle(surfaceKey, key, delta, el, seq, timer) {
    const startShow = function () {
        if ((_chargeDeltaSeq[surfaceKey] || 0) !== seq)
            return;
        _positionChargeDeltaEl(key, delta, el);
        el.classList.remove('is-restart');
        el.classList.remove('is-fadeout');
        el.classList.add('is-visible');
        _chargeDeltaTimers[surfaceKey] = timer.setTimeout(function () {
            if ((_chargeDeltaSeq[surfaceKey] || 0) !== seq)
                return;
            el.classList.remove('is-visible');
            el.classList.add('is-fadeout');
            _chargeDeltaClearTimers[surfaceKey] = timer.setTimeout(function () {
                if ((_chargeDeltaSeq[surfaceKey] || 0) !== seq)
                    return;
                el.textContent = '';
                el.classList.remove('is-fadeout');
            }, 500);
        }, 4000);
    };
    startShow();
}
function _showChargeDeltaNow(key, delta) {
    if (typeof document === 'undefined')
        return;
    if (!Number.isFinite(delta) || delta === 0)
        return;
    const surfaceKey = _getChargeDeltaSurfaceKey(key, delta);
    const el = _resolveChargeDeltaEl(key, delta);
    if (!el)
        return;
    _setChargeDeltaText(el, delta);
    _positionChargeDeltaEl(key, delta, el);
    _applyChargeDeltaVariant(el, delta);
    const timer = _Timer();
    if (_chargeDeltaTimers[surfaceKey])
        timer.clearTimeout(_chargeDeltaTimers[surfaceKey]);
    if (_chargeDeltaClearTimers[surfaceKey])
        timer.clearTimeout(_chargeDeltaClearTimers[surfaceKey]);
    const seq = (_chargeDeltaSeq[surfaceKey] || 0) + 1;
    _chargeDeltaSeq[surfaceKey] = seq;
    _restartChargeDeltaAnimation(el);
    _scheduleChargeDeltaLifecycle(surfaceKey, key, delta, el, seq, timer);
}
function showChargeDelta(playerKey, delta) {
    if (!Number.isFinite(delta) || delta === 0)
        return;
    if (typeof document === 'undefined')
        return;
    const key = (playerKey === 'white' || playerKey === WHITE || playerKey === -1) ? 'white' : 'black';
    _showChargeDeltaNow(key, Number(delta));
}
if (typeof window !== 'undefined') {
    try {
        window.StoneVisuals = window.StoneVisuals || {};
        Object.assign(window.StoneVisuals, { applyStoneVisualState, animateStoneVisualTransition, crossfadeStoneVisual, setDiscColorAt, removeBombOverlayAt, clearAllStoneVisualEffectsAt, syncDiscVisualToCurrentState, applyPendingSpecialstoneVisual, showChargeDelta });
    }
    catch (e) { }
}
const StoneVisualsModule = {
    applyStoneVisualState,
    animateStoneVisualTransition,
    crossfadeStoneVisual,
    setDiscColorAt,
    removeBombOverlayAt,
    clearAllStoneVisualEffectsAt,
    syncDiscVisualToCurrentState,
    applyPendingSpecialstoneVisual,
    showChargeDelta
};
module.exports = StoneVisualsModule;
//# sourceMappingURL=stone-visuals.js.map