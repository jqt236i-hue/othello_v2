'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require) as NodeRequire;

let _registerUIGlobals_debug: any = null;
let _getUIBootstrapGlobals_debug: any = null;
try {
    const uiBootstrap = _require('../bootstrap');
    if (uiBootstrap) {
        if (typeof uiBootstrap.registerUIGlobals === 'function') _registerUIGlobals_debug = uiBootstrap.registerUIGlobals;
        if (typeof uiBootstrap.getRegisteredUIGlobals === 'function') _getUIBootstrapGlobals_debug = uiBootstrap.getRegisteredUIGlobals;
    }
} catch (e) { /* ignore */ }

function _isDebugAllowed(): boolean {
    try {
        const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {})) as any;
        if (seed.DEBUG_UNLIMITED_USAGE === true) return true;
        if (seed.DEBUG_MODE_ALLOWED === true) return true;
        if (seed.DEBUG_MODE_ALLOWED === false) return false;
        const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
        return (/[?&]debug=1/.test(qs) || /[?&]debug=true/.test(qs));
    } catch (e) {
        return false;
    }
}

function _setDebugModeAllowed(debugAllowed: boolean): void {
    const normalized = !!debugAllowed;
    try {
        if (_registerUIGlobals_debug) {
            _registerUIGlobals_debug({ DEBUG_MODE_ALLOWED: normalized });
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined') {
            (window as any).DEBUG_MODE_ALLOWED = normalized;
        }
    } catch (e) { /* ignore */ }
}

const DEBUG_HAND_SCROLL_LONG_PRESS_MS = 300;
const DEBUG_HAND_SCROLL_MOVE_THRESHOLD_PX = 10;
const DEBUG_HAND_SCROLL_DRAG_START_PX = 18;
const DEBUG_HAND_SCROLL_SUPPRESS_CLICK_MS = 280;
const DEBUG_HAND_FLING_FRICTION = 0.92;
const DEBUG_HAND_FLING_STOP_VELOCITY = 0.65;
const DEBUG_HAND_WHEEL_SCALE = 0.9;

let _debugControlRefs: any = {
    debugModeBtn: null,
    humanVsHumanBtn: null,
    visualTestBtn: null
};

let _networkDebugModeAccessState: any = {
    networkMode: false,
    roomDebugEnabled: false
};

function _isDebugLayoutEnabled(): boolean {
    try {
        const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {})) as any;
        return seed.DEBUG_UNLIMITED_USAGE === true;
    } catch (e) {
        return false;
    }
}

function _getCurrentMatchModeForDebug(): string {
    try {
        const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {})) as any;
        if (seed && typeof seed.getCurrentMatchMode === 'function') {
            const mode = seed.getCurrentMatchMode();
            if (mode) return String(mode).toLowerCase();
        }
        if (seed && seed.MATCH_MODE) return String(seed.MATCH_MODE).toLowerCase();
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && typeof (window as any).getCurrentMatchMode === 'function') {
            const mode = (window as any).getCurrentMatchMode();
            if (mode) return String(mode).toLowerCase();
        }
        if (typeof window !== 'undefined' && (window as any).MATCH_MODE) {
            return String((window as any).MATCH_MODE).toLowerCase();
        }
    } catch (e) { /* ignore */ }
    return 'cpu';
}

function _getCardStateForDebug(): any {
    try {
        if (typeof (cardState as any) !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && (window as any).cardState && typeof (window as any).cardState === 'object') return (window as any).cardState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).cardState && typeof (globalThis as any).cardState === 'object') return (globalThis as any).cardState;
    } catch (e) { /* ignore */ }
    return null;
}

function _hasMutatedDebugSessionState(): boolean {
    const state = _getCardStateForDebug();
    if (!state) return false;
    return state.debugHandFilled === true || state.debugNoDraw === true;
}

function _clearMutatedDebugSessionStateFlags(): boolean {
    const state = _getCardStateForDebug();
    if (!state || typeof state !== 'object') return false;
    let changed = false;
    if (state.debugHandFilled === true) {
        state.debugHandFilled = false;
        changed = true;
    }
    if (state.debugNoDraw === true) {
        state.debugNoDraw = false;
        changed = true;
    }
    return changed;
}

function _resolveResetGameForDebug(): any {
    try {
        const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {})) as any;
        if (seed && typeof seed.resetGame === 'function') return seed.resetGame;
    } catch (e) { /* ignore */ }
    try {
        if (typeof (resetGame as any) === 'function') return resetGame;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && typeof (window as any).resetGame === 'function') return (window as any).resetGame;
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).resetGame === 'function') return (globalThis as any).resetGame;
    } catch (e) { /* ignore */ }
    return null;
}

function _applyDebugLayoutState(debugEnabled: boolean): void {
    if (typeof document === 'undefined') return;
    const normalized = !!debugEnabled;
    try {
        if (document.documentElement && document.documentElement.classList) {
            document.documentElement.classList.toggle('debug-layout', normalized);
        }
        if (document.body && document.body.classList) {
            document.body.classList.toggle('debug-layout', normalized);
        }
        if (!normalized) {
            ['hand-black', 'hand-white'].forEach((id) => {
                const containerEl = document.getElementById(id);
                const state = _getDebugHandScrollState(containerEl);
                _cancelDebugHandFling(state);
                _finishDebugHandScroll(containerEl, state, null);
                if (state) state.suppressClickUntil = 0;
                _applyDebugHandTrackTransform(containerEl, 0);
            });
        }
    } catch (e) { /* ignore */ }
}

function _createDebugHandScrollState(): any {
    return {
        activePointerId: null,
        startX: 0,
        startY: 0,
        startOffsetX: 0,
        currentOffsetX: 0,
        dragReady: false,
        dragging: false,
        pressTimerId: null,
        suppressClickUntil: 0,
        lastMoveX: 0,
        lastMoveTs: 0,
        velocityX: 0,
        flingRafId: null
    };
}

function _getDebugHandScrollState(containerEl: any): any {
    if (!containerEl) return null;
    if (!containerEl.__debugHandScrollState) {
        containerEl.__debugHandScrollState = _createDebugHandScrollState();
    }
    return containerEl.__debugHandScrollState;
}

function _clearDebugHandScrollTimer(state: any): void {
    if (!state || state.pressTimerId == null) return;
    try { clearTimeout(state.pressTimerId); } catch (e) { /* ignore */ }
    state.pressTimerId = null;
}

function _cancelDebugHandFling(state: any): void {
    if (!state || state.flingRafId == null || typeof window === 'undefined' || typeof window.cancelAnimationFrame !== 'function') return;
    try { window.cancelAnimationFrame(state.flingRafId); } catch (e) { /* ignore */ }
    state.flingRafId = null;
}

function _getDebugHandTrackEl(containerEl: any): any {
    if (!containerEl || typeof containerEl.querySelector !== 'function') return null;
    return containerEl.querySelector('.hand-track');
}

function _findDebugHandClickableCardAtPoint(containerEl: any, clientX: number, clientY: number): any {
    if (!containerEl || typeof document === 'undefined') return null;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

    if (typeof document.elementsFromPoint === 'function') {
        const stack = document.elementsFromPoint(clientX, clientY);
        for (const entry of stack) {
            if (!entry || !containerEl.contains(entry as Node) || typeof (entry as any).closest !== 'function') continue;
            const cardEl = (entry as any).closest('.card-item.clickable');
            if (cardEl && containerEl.contains(cardEl)) {
                return cardEl;
            }
        }
    }

    const cards = typeof containerEl.querySelectorAll === 'function'
        ? Array.from(containerEl.querySelectorAll('.card-item.clickable'))
        : [];
    for (const cardEl of cards) {
        const rect = typeof (cardEl as any).getBoundingClientRect === 'function'
            ? (cardEl as any).getBoundingClientRect()
            : null;
        if (!rect) continue;
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            return cardEl;
        }
    }

    return null;
}

function _getDebugHandOffsetLimit(containerEl: any): number {
    const trackEl = _getDebugHandTrackEl(containerEl);
    if (!containerEl || !trackEl) return 0;
    const containerWidth = Number(containerEl.clientWidth) || 0;
    const trackWidth = Math.max(Number(trackEl.scrollWidth) || 0, Number(trackEl.getBoundingClientRect().width) || 0);
    if (!containerWidth || !trackWidth || trackWidth <= containerWidth) return 0;
    return trackWidth - containerWidth;
}

function _clampDebugHandOffset(containerEl: any, nextOffsetX: number): number {
    const limit = _getDebugHandOffsetLimit(containerEl);
    if (!Number.isFinite(limit) || limit <= 0) return 0;
    const safeOffset = Number(nextOffsetX) || 0;
    if (safeOffset >= 0) return 0;
    if (safeOffset <= -limit) return -limit;
    return safeOffset;
}

function _applyDebugHandTrackTransform(containerEl: any, offsetX: number): void {
    if (!containerEl) return;
    const trackEl = _getDebugHandTrackEl(containerEl);
    if (!trackEl || !trackEl.style) return;
    const nextOffsetX = _clampDebugHandOffset(containerEl, offsetX);
    const safeOffset = Number.isFinite(nextOffsetX) ? nextOffsetX : 0;
    trackEl.style.transform = `translate3d(${safeOffset}px, 0, 0)`;
    const state = _getDebugHandScrollState(containerEl);
    if (state) state.currentOffsetX = safeOffset;
}

function _startDebugHandFling(containerEl: any, state: any, initialVelocityX: number): void {
    if (!containerEl || !state || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;
    _cancelDebugHandFling(state);
    let velocityX = Number(initialVelocityX) || 0;
    const step = () => {
        velocityX *= DEBUG_HAND_FLING_FRICTION;
        const nextOffset = _clampDebugHandOffset(containerEl, state.currentOffsetX + velocityX);
        const hitBound = Math.abs(nextOffset - (state.currentOffsetX + velocityX)) > 0.5;
        _applyDebugHandTrackTransform(containerEl, nextOffset);
        if (hitBound) {
            state.velocityX = 0;
            state.flingRafId = null;
            return;
        }
        if (Math.abs(velocityX) < DEBUG_HAND_FLING_STOP_VELOCITY) {
            state.velocityX = 0;
            state.flingRafId = null;
            return;
        }
        state.velocityX = velocityX;
        state.flingRafId = window.requestAnimationFrame(step);
    };
    state.flingRafId = window.requestAnimationFrame(step);
}

function _applyDebugHandWheelDelta(containerEl: any, state: any, rawDelta: number): void {
    if (!containerEl || !state) return;
    const delta = Number(rawDelta) || 0;
    if (!delta) return;
    _cancelDebugHandFling(state);
    const nextOffset = _clampDebugHandOffset(containerEl, state.currentOffsetX - (delta * DEBUG_HAND_WHEEL_SCALE));
    _applyDebugHandTrackTransform(containerEl, nextOffset);
}

function _finishDebugHandScroll(containerEl: any, state: any, event: any): void {
    if (!containerEl || !state) return;
    _clearDebugHandScrollTimer(state);
    const shouldFling = !!state.dragging;
    if (state.dragging) {
        state.suppressClickUntil = Date.now() + DEBUG_HAND_SCROLL_SUPPRESS_CLICK_MS;
    }
    state.activePointerId = null;
    state.dragReady = false;
    state.dragging = false;
    if (containerEl.classList) {
        containerEl.classList.remove('debug-hand-fling-ready');
        containerEl.classList.remove('debug-hand-fling-dragging');
    }
    if (shouldFling) {
        _startDebugHandFling(containerEl, state, state.velocityX);
    }
}

function _installDebugHandScroll(containerEl: any): void {
    if (!containerEl || containerEl.dataset.debugHandScrollBound === '1') return;
    containerEl.dataset.debugHandScrollBound = '1';
    const state = _getDebugHandScrollState(containerEl);
    if (!state) return;

    containerEl.addEventListener('pointerdown', (event: any) => {
        if (!_isDebugLayoutEnabled()) return;
        if (event && event.pointerType === 'mouse' && event.button !== 0) return;
        const targetCard = event && event.target && typeof event.target.closest === 'function'
            ? event.target.closest('.card-item')
            : null;
        if (!targetCard) return;
        if (event && typeof event.clientX !== 'number') return;
        _finishDebugHandScroll(containerEl, state, event);
        _cancelDebugHandFling(state);
        _applyDebugHandTrackTransform(containerEl, state.currentOffsetX);
        state.activePointerId = typeof event.pointerId === 'number' ? event.pointerId : 1;
        try {
            if (typeof containerEl.setPointerCapture === 'function') {
                containerEl.setPointerCapture(state.activePointerId);
            }
        } catch (_e) { /* ignore – JSDOM / old browsers */ }
        state.startX = Number(event.clientX) || 0;
        state.startY = Number(event.clientY) || 0;
        state.startOffsetX = Number(state.currentOffsetX) || 0;
        state.dragReady = false;
        state.dragging = false;
        state.lastMoveX = state.startX;
        state.lastMoveTs = Date.now();
        state.velocityX = 0;
        _clearDebugHandScrollTimer(state);
        state.pressTimerId = setTimeout(() => {
            state.pressTimerId = null;
            if (!_isDebugLayoutEnabled() || state.activePointerId == null) return;
            state.dragReady = true;
            if (containerEl.classList) {
                containerEl.classList.add('debug-hand-fling-ready');
            }
        }, DEBUG_HAND_SCROLL_LONG_PRESS_MS);
    }, { passive: true });

    containerEl.addEventListener('pointermove', (event: any) => {
        if (!_isDebugLayoutEnabled()) return;
        if (state.activePointerId == null) return;
        if (typeof event.pointerId === 'number' && event.pointerId !== state.activePointerId) return;
        if (typeof event.buttons === 'number' && event.buttons === 0) {
            _finishDebugHandScroll(containerEl, state, event);
            return;
        }
        const clientX = Number(event.clientX) || 0;
        const clientY = Number(event.clientY) || 0;
        const deltaX = clientX - state.startX;
        const deltaY = clientY - state.startY;
        if (!state.dragReady) {
            if (Math.abs(deltaY) > DEBUG_HAND_SCROLL_MOVE_THRESHOLD_PX && Math.abs(deltaY) > Math.abs(deltaX)) {
                _clearDebugHandScrollTimer(state);
                return;
            }
            if (Math.abs(deltaX) >= DEBUG_HAND_SCROLL_MOVE_THRESHOLD_PX && Math.abs(deltaX) >= Math.abs(deltaY)) {
                _clearDebugHandScrollTimer(state);
                state.dragReady = true;
                if (containerEl.classList) {
                    containerEl.classList.add('debug-hand-fling-ready');
                }
            } else {
                return;
            }
        }
        if (!state.dragging && Math.abs(deltaX) < DEBUG_HAND_SCROLL_DRAG_START_PX) {
            return;
        }
        if (!state.dragging) {
            state.dragging = true;
            if (containerEl.classList) {
                containerEl.classList.add('debug-hand-fling-dragging');
            }
        }
        const now = Date.now();
        const nextOffsetX = _clampDebugHandOffset(containerEl, state.startOffsetX + deltaX);
        _applyDebugHandTrackTransform(containerEl, nextOffsetX);
        const dt = Math.max(1, now - state.lastMoveTs);
        state.velocityX = ((clientX - state.lastMoveX) / dt) * 16;
        state.lastMoveX = clientX;
        state.lastMoveTs = now;
        state.suppressClickUntil = Date.now() + DEBUG_HAND_SCROLL_SUPPRESS_CLICK_MS;
        if (event && event.cancelable) event.preventDefault();
    }, { passive: false });

    const finishHandler = (event: any) => {
        if (state.activePointerId == null) return;
        if (event && typeof event.pointerId === 'number' && event.pointerId !== state.activePointerId) return;
        _finishDebugHandScroll(containerEl, state, event);
    };
    containerEl.addEventListener('pointerup', finishHandler);
    containerEl.addEventListener('pointercancel', finishHandler);
    containerEl.addEventListener('lostpointercapture', finishHandler);

    containerEl.addEventListener('click', (event: any) => {
        if (!_isDebugLayoutEnabled()) return;
        if (state.suppressClickUntil > Date.now()) {
            state.suppressClickUntil = 0;
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
            if (event && typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
            return;
        }

        const directCardEl = event && event.target && typeof event.target.closest === 'function'
            ? event.target.closest('.card-item.clickable')
            : null;
        if (directCardEl && containerEl.contains(directCardEl)) return;

        const fallbackCardEl = _findDebugHandClickableCardAtPoint(
            containerEl,
            Number(event && event.clientX),
            Number(event && event.clientY)
        );
        if (!fallbackCardEl || !fallbackCardEl.dataset) return;

        const cardId = fallbackCardEl.dataset.cardId || null;
        const ownerKey = fallbackCardEl.dataset.ownerKey || containerEl.dataset.ownerKey || null;
        if (!cardId || typeof window === 'undefined' || typeof (window as any).onCardClick !== 'function') return;

        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        if (event && typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        (window as any).onCardClick(cardId, ownerKey);
    }, true);

    containerEl.addEventListener('wheel', (event: any) => {
        if (!_isDebugLayoutEnabled()) return;
        const primaryDelta = Math.abs(Number(event.deltaX) || 0) > Math.abs(Number(event.deltaY) || 0)
            ? Number(event.deltaX) || 0
            : Number(event.deltaY) || 0;
        if (!primaryDelta) return;
        _applyDebugHandWheelDelta(containerEl, state, primaryDelta);
        state.suppressClickUntil = Date.now() + 80;
        if (event && event.cancelable) event.preventDefault();
    }, { passive: false });
}

function _ensureDebugHandScrollBindings(): void {
    if (typeof document === 'undefined') return;
    _installDebugHandScroll(document.getElementById('hand-black'));
    _installDebugHandScroll(document.getElementById('hand-white'));
    _applyDebugHandTrackTransform(document.getElementById('hand-black'), (_getDebugHandScrollState(document.getElementById('hand-black')) || {}).currentOffsetX || 0);
    _applyDebugHandTrackTransform(document.getElementById('hand-white'), (_getDebugHandScrollState(document.getElementById('hand-white')) || {}).currentOffsetX || 0);
}

function _applyDebugButtonState(debugModeBtn: any, debugEnabled: boolean): void {
    if (!debugModeBtn) return;
    debugModeBtn.textContent = debugEnabled ? 'DEBUG: ON' : 'DEBUG: OFF';
    if (debugModeBtn.style) {
        debugModeBtn.style.color = debugEnabled ? '#6bff6b' : '#d7ccc8';
    }
    if (debugModeBtn.dataset) {
        debugModeBtn.dataset.active = debugEnabled ? 'true' : 'false';
    }

    const ariaPressed = debugEnabled ? 'true' : 'false';
    if (typeof debugModeBtn.setAttribute === 'function') {
        debugModeBtn.setAttribute('aria-pressed', ariaPressed);
        return;
    }

    debugModeBtn.ariaPressed = ariaPressed;
    if (typeof debugModeBtn.getAttribute !== 'function') {
        debugModeBtn.getAttribute = (name: string) => {
            if (name === 'aria-pressed') return debugModeBtn.ariaPressed;
            return null;
        };
    }
}

function _applyDebugSubButtonVisibility(humanVsHumanBtn: any, visualTestBtn: any, debugEnabled: boolean): void {
    const display = debugEnabled ? 'block' : 'none';
    if (visualTestBtn) visualTestBtn.style.display = display;
    if (humanVsHumanBtn) humanVsHumanBtn.style.display = display;
}

function _syncDebugFlags(debugEnabled: boolean, humanVsHuman: boolean): void {
    try {
        const payload: any = {
            DEBUG_UNLIMITED_USAGE: !!debugEnabled,
            DEBUG_HUMAN_VS_HUMAN: !!humanVsHuman
        };

        try {
            const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {})) as any;
            payload.__uiImpl_turn_manager = Object.assign({}, seed.__uiImpl_turn_manager || {}, {
                DEBUG_HUMAN_VS_HUMAN: !!humanVsHuman,
                DEBUG_UNLIMITED_USAGE: !!debugEnabled
            });
            payload.__uiImpl_move_executor = Object.assign({}, seed.__uiImpl_move_executor || {}, {
                DEBUG_HUMAN_VS_HUMAN: !!humanVsHuman
            });
            payload.__uiImpl = Object.assign({}, seed.__uiImpl || {}, {
                DEBUG_HUMAN_VS_HUMAN: !!humanVsHuman,
                DEBUG_UNLIMITED_USAGE: !!debugEnabled
            });
        } catch (e) { /* ignore */ }

        if (_registerUIGlobals_debug) {
            _registerUIGlobals_debug(payload);
            try {
                if (typeof window !== 'undefined') {
                    (window as any).DEBUG_UNLIMITED_USAGE = !!debugEnabled;
                    (window as any).DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;

                    (window as any).__uiImpl_turn_manager = (window as any).__uiImpl_turn_manager || {};
                    (window as any).__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;
                    (window as any).__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = !!debugEnabled;

                    (window as any).__uiImpl_move_executor = (window as any).__uiImpl_move_executor || {};
                    (window as any).__uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;

                    (window as any).__uiImpl = (window as any).__uiImpl || {};
                    (window as any).__uiImpl.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;
                    (window as any).__uiImpl.DEBUG_UNLIMITED_USAGE = !!debugEnabled;
                }
            } catch (e) { /* ignore */ }
            return;
        }

        if (typeof window !== 'undefined') {
            (window as any).DEBUG_UNLIMITED_USAGE = !!debugEnabled;
            (window as any).DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;

            (window as any).__uiImpl_turn_manager = (window as any).__uiImpl_turn_manager || {};
            (window as any).__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;
            (window as any).__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = !!debugEnabled;

            (window as any).__uiImpl_move_executor = (window as any).__uiImpl_move_executor || {};
            (window as any).__uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;

            (window as any).__uiImpl = (window as any).__uiImpl || {};
            (window as any).__uiImpl.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;
            (window as any).__uiImpl.DEBUG_UNLIMITED_USAGE = !!debugEnabled;
        }
    } catch (e) { /* ignore */ }
}

function _applyNetworkDebugModeAccessState(): void {
    const refs = _debugControlRefs || {};
    const debugModeBtn = refs.debugModeBtn;
    const humanVsHumanBtn = refs.humanVsHumanBtn;
    const visualTestBtn = refs.visualTestBtn;
    if (!debugModeBtn) return;

    const networkMode = _networkDebugModeAccessState.networkMode === true;
    const roomDebugEnabled = _networkDebugModeAccessState.roomDebugEnabled === true;
    if (networkMode && !roomDebugEnabled) {
        _syncDebugFlags(false, false);
        _applyDebugLayoutState(false);
        _applyDebugButtonState(debugModeBtn, false);
        _applyDebugSubButtonVisibility(humanVsHumanBtn, visualTestBtn, false);
        debugModeBtn.style.display = 'none';
        return;
    }

    debugModeBtn.style.display = 'block';
    const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {})) as any;
    const isDebug = seed.DEBUG_UNLIMITED_USAGE === true;
    _applyDebugButtonState(debugModeBtn, isDebug);
    _applyDebugSubButtonVisibility(humanVsHumanBtn, visualTestBtn, isDebug);
}

function setNetworkDebugModeAccess(options: any): void {
    const opts = (options && typeof options === 'object') ? options : {};
    _networkDebugModeAccessState.networkMode = opts.networkMode === true;
    _networkDebugModeAccessState.roomDebugEnabled = opts.roomDebugEnabled === true;
    _applyNetworkDebugModeAccessState();
}

function setDebugModeEnabled(debugEnabled: boolean): boolean {
    const refs = _debugControlRefs || {};
    const debugModeBtn = refs.debugModeBtn;
    const humanVsHumanBtn = refs.humanVsHumanBtn;
    const visualTestBtn = refs.visualTestBtn;
    const nextDebugEnabled = debugEnabled === true;
    const currentGlobals = (_getUIBootstrapGlobals_debug
        ? (_getUIBootstrapGlobals_debug() || {})
        : (typeof window !== 'undefined' ? window : {})) as any;
    const wasDebugEnabled = currentGlobals.DEBUG_UNLIMITED_USAGE === true;
    const hadMutatedDebugState = !nextDebugEnabled && wasDebugEnabled && _hasMutatedDebugSessionState();
    let requestedLocalReset = false;

    if (nextDebugEnabled && _networkDebugModeAccessState.networkMode === true && _networkDebugModeAccessState.roomDebugEnabled !== true) {
        return false;
    }

    if (nextDebugEnabled) _setDebugModeAllowed(true);
    _applyDebugButtonState(debugModeBtn, nextDebugEnabled);
    _applyDebugLayoutState(nextDebugEnabled);
    _applyDebugSubButtonVisibility(humanVsHumanBtn, visualTestBtn, nextDebugEnabled);

    if (nextDebugEnabled) {
        if (!wasDebugEnabled) {
            (addLog as any)('🐛 デバッグモード: ON （制限なしでカード使用可能）');
        }
        _syncDebugFlags(true, true);
        try {
            const g = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {})) as any;
            if (typeof g.disableAutoMode === 'function') {
                g.disableAutoMode();
                const autoBtn = document.getElementById('autoToggleBtn');
                if (autoBtn) autoBtn.textContent = 'AUTO: OFF';
            }
        } catch (e) { /* ignore */ }

        if (!wasDebugEnabled) {
            const g2 = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {})) as any;
            if (typeof g2.ensureDebugActionsLoaded === 'function') {
                g2.ensureDebugActionsLoaded(() => {
                    (fillDebugHand as any)();
                });
            } else {
                (fillDebugHand as any)();
            }
        }
        if (humanVsHumanBtn) {
            humanVsHumanBtn.textContent = '人間vs人間: ON';
            humanVsHumanBtn.style.color = '#90ee90';
        }
        if (!wasDebugEnabled) {
            (addLog as any)('🎮 人間vs人間モード: ON （黒白両方操作可能、手札は黒のみ使用）');
        }
    } else {
        (addLog as any)('デバッグモード: OFF');
        _syncDebugFlags(false, false);
        _clearMutatedDebugSessionStateFlags();
        if (hadMutatedDebugState && _getCurrentMatchModeForDebug() !== 'network') {
            const resetGameFn = _resolveResetGameForDebug();
            if (typeof resetGameFn === 'function') {
                requestedLocalReset = true;
                (addLog as any)('デバッグ由来の手札状態を解除するため対局をリセット');
                try {
                    resetGameFn();
                } catch (e) {
                    requestedLocalReset = false;
                    console.warn('[debug] resetGame after disabling debug mode failed:', (e as any) && (e as any).message ? (e as any).message : e);
                }
            }
        }
        if (humanVsHumanBtn) {
            humanVsHumanBtn.textContent = '人間vs人間: OFF';
            humanVsHumanBtn.style.color = '#ffb366';
        }
    }
    if (!requestedLocalReset && typeof (renderCardUI as any) === 'function') (renderCardUI as any)();
    return true;
}

function setupDebugControls(debugModeBtn: any, humanVsHumanBtn: any, visualTestBtn: any): void {
    _debugControlRefs = {
        debugModeBtn: debugModeBtn || null,
        humanVsHumanBtn: humanVsHumanBtn || null,
        visualTestBtn: visualTestBtn || null
    };

    const debugAllowed = _isDebugAllowed();
    if (!debugAllowed) {
        if (humanVsHumanBtn) humanVsHumanBtn.style.display = 'none';
        if (visualTestBtn) visualTestBtn.style.display = 'none';
    }
    _ensureDebugHandScrollBindings();
    const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {})) as any;
    _applyDebugLayoutState(seed.DEBUG_UNLIMITED_USAGE === true);
    _syncDebugFlags(seed.DEBUG_UNLIMITED_USAGE === true, seed.DEBUG_HUMAN_VS_HUMAN === true);

    if (debugModeBtn) {
        debugModeBtn.style.display = 'block';
        const isDebug = seed.DEBUG_UNLIMITED_USAGE === true;
        _applyDebugButtonState(debugModeBtn, isDebug);
        _applyDebugSubButtonVisibility(humanVsHumanBtn, visualTestBtn, isDebug);
        debugModeBtn.addEventListener('click', () => {
            const updatedDebug = !(_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug().DEBUG_UNLIMITED_USAGE === true) : (typeof window !== 'undefined' && (window as any).DEBUG_UNLIMITED_USAGE === true));
            setDebugModeEnabled(updatedDebug);
        });
    }

    if (humanVsHumanBtn) {
        const seed2 = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {})) as any;
        humanVsHumanBtn.textContent = seed2.DEBUG_HUMAN_VS_HUMAN ? '人間vs人間: ON' : '人間vs人間: OFF';
        humanVsHumanBtn.style.color = seed2.DEBUG_HUMAN_VS_HUMAN ? '#90ee90' : '#ffb366';
        humanVsHumanBtn.addEventListener('click', () => {
            const curr = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug().DEBUG_HUMAN_VS_HUMAN === true) : (typeof window !== 'undefined' && (window as any).DEBUG_HUMAN_VS_HUMAN === true));
            const updatedHuman = !curr;
            const currDebug = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug().DEBUG_UNLIMITED_USAGE === true) : (typeof window !== 'undefined' && (window as any).DEBUG_UNLIMITED_USAGE === true));
            _syncDebugFlags(currDebug, updatedHuman);
            humanVsHumanBtn.textContent = updatedHuman ? '人間vs人間: ON' : '人間vs人間: OFF';
            humanVsHumanBtn.style.color = updatedHuman ? '#90ee90' : '#ffb366';

            if (updatedHuman) {
                (addLog as any)('🎮 人間vs人間モード: ON （黒白両方操作可能、手札は黒のみ使用）');
            } else {
                (addLog as any)('人間vs人間モード: OFF');
            }
        });
    }

    if (visualTestBtn) {
        visualTestBtn.addEventListener('click', () => {
            const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {})) as any;
            if (!(seed && seed.DEBUG_UNLIMITED_USAGE)) return;
            const run = (dbg: any) => {
                if (!dbg || typeof dbg.applyVisualTestBoard !== 'function') {
                    console.warn('[debug] DebugActions.applyVisualTestBoard not available');
                    return;
                }
                dbg.applyVisualTestBoard((gameState as any), (cardState as any));
                if (typeof (BoardUpdateDispatch as any) !== 'undefined' && BoardUpdateDispatch && typeof (BoardUpdateDispatch as any).requestBoardUpdate === 'function') {
                    (BoardUpdateDispatch as any).requestBoardUpdate();
                } else if (typeof (emitBoardUpdate as any) === 'function') (emitBoardUpdate as any)();
                else if (typeof (renderBoard as any) === 'function') (renderBoard as any)();
                (addLog as any)('石ビジュアルテスト表示 (黒:左列 / 白:右列)');
            };
            let dbg = (typeof (DebugActions as any) !== 'undefined') ? (DebugActions as any) : null;
            if (!dbg && typeof _require === 'function') {
                try { dbg = _require('../../game/debug/debug-actions'); } catch (e) { dbg = null; }
            }
            if (dbg) return run(dbg);
            if (seed && typeof seed.ensureDebugActionsLoaded === 'function') {
                return seed.ensureDebugActionsLoaded(run);
            }
            run(null);
        });
    }

    _applyNetworkDebugModeAccessState();
}

try {
    if (_registerUIGlobals_debug) {
        _registerUIGlobals_debug({
            setupDebugControls,
            refreshDebugHandLayout: _ensureDebugHandScrollBindings,
            setNetworkDebugModeAccess,
            setDebugModeEnabled
        });
    } else if (typeof window !== 'undefined') {
        (window as any).setupDebugControls = setupDebugControls;
        (window as any).refreshDebugHandLayout = _ensureDebugHandScrollBindings;
        (window as any).setNetworkDebugModeAccess = setNetworkDebugModeAccess;
        (window as any).setDebugModeEnabled = setDebugModeEnabled;
    }
} catch (e) { /* ignore */ }

const DebugModule = {
    setupDebugControls,
    setNetworkDebugModeAccess,
    setDebugModeEnabled
};

export = DebugModule;
