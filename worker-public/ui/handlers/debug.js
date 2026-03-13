/**
 * @file debug.js
 * @description Debug mode and visual test handlers
 */

// Attempt to use UIBootstrap.registerUIGlobals / getRegisteredUIGlobals when available for centralized global registration
let _registerUIGlobals_debug = null;
let _getUIBootstrapGlobals_debug = null;
try {
    const uiBootstrap = require('../bootstrap');
    if (uiBootstrap) {
        if (typeof uiBootstrap.registerUIGlobals === 'function') _registerUIGlobals_debug = uiBootstrap.registerUIGlobals;
        if (typeof uiBootstrap.getRegisteredUIGlobals === 'function') _getUIBootstrapGlobals_debug = uiBootstrap.getRegisteredUIGlobals;
    }
} catch (e) { /* ignore */ }

function _isDebugAllowed() {
    try {
        const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {}));
        if (seed.DEBUG_UNLIMITED_USAGE === true) return true;
        if (seed.DEBUG_MODE_ALLOWED === true) return true;
        if (seed.DEBUG_MODE_ALLOWED === false) return false;
        const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
        return /[?&]debug=1/.test(qs) || /[?&]debug=true/.test(qs);
    } catch (e) {
        return false;
    }
}

function _setDebugModeAllowed(debugAllowed) {
    const normalized = !!debugAllowed;
    try {
        if (_registerUIGlobals_debug) {
            _registerUIGlobals_debug({ DEBUG_MODE_ALLOWED: normalized });
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined') {
            window.DEBUG_MODE_ALLOWED = normalized;
        }
    } catch (e) { /* ignore */ }
}

const DEBUG_HAND_SCROLL_LONG_PRESS_MS = 120;
const DEBUG_HAND_SCROLL_MOVE_THRESHOLD_PX = 10;
const DEBUG_HAND_SCROLL_SUPPRESS_CLICK_MS = 280;
const DEBUG_HAND_FLING_FRICTION = 0.92;
const DEBUG_HAND_FLING_STOP_VELOCITY = 0.65;
const DEBUG_HAND_WHEEL_SCALE = 0.9;

function _isDebugLayoutEnabled() {
    try {
        const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {}));
        return seed.DEBUG_UNLIMITED_USAGE === true;
    } catch (e) {
        return false;
    }
}

function _applyDebugLayoutState(debugEnabled) {
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

function _createDebugHandScrollState() {
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

function _getDebugHandScrollState(containerEl) {
    if (!containerEl) return null;
    if (!containerEl.__debugHandScrollState) {
        containerEl.__debugHandScrollState = _createDebugHandScrollState();
    }
    return containerEl.__debugHandScrollState;
}

function _clearDebugHandScrollTimer(state) {
    if (!state || state.pressTimerId == null) return;
    try { clearTimeout(state.pressTimerId); } catch (e) { /* ignore */ }
    state.pressTimerId = null;
}

function _cancelDebugHandFling(state) {
    if (!state || state.flingRafId == null || typeof window === 'undefined' || typeof window.cancelAnimationFrame !== 'function') return;
    try { window.cancelAnimationFrame(state.flingRafId); } catch (e) { /* ignore */ }
    state.flingRafId = null;
}

function _getDebugHandTrackEl(containerEl) {
    if (!containerEl || typeof containerEl.querySelector !== 'function') return null;
    return containerEl.querySelector('.hand-track');
}

function _getDebugHandOffsetLimit(containerEl) {
    const trackEl = _getDebugHandTrackEl(containerEl);
    if (!containerEl || !trackEl) return 0;
    const containerWidth = Number(containerEl.clientWidth) || 0;
    const trackWidth = Math.max(Number(trackEl.scrollWidth) || 0, Number(trackEl.getBoundingClientRect().width) || 0);
    if (!containerWidth || !trackWidth || trackWidth <= containerWidth) return 0;
    return (trackWidth - containerWidth) / 2;
}

function _clampDebugHandOffset(containerEl, nextOffsetX) {
    const limit = _getDebugHandOffsetLimit(containerEl);
    if (!Number.isFinite(limit) || limit <= 0) return 0;
    return Math.max(-limit, Math.min(limit, Number(nextOffsetX) || 0));
}

function _applyDebugHandTrackTransform(containerEl, offsetX) {
    if (!containerEl) return;
    const trackEl = _getDebugHandTrackEl(containerEl);
    if (!trackEl || !trackEl.style) return;
    const nextOffsetX = _clampDebugHandOffset(containerEl, offsetX);
    const safeOffset = Number.isFinite(nextOffsetX) ? nextOffsetX : 0;
    trackEl.style.transform = `translate3d(${safeOffset}px, 0, 0)`;
    const state = _getDebugHandScrollState(containerEl);
    if (state) state.currentOffsetX = safeOffset;
}

function _startDebugHandFling(containerEl, state, initialVelocityX) {
    if (!containerEl || !state || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;
    _cancelDebugHandFling(state);
    let velocityX = Number(initialVelocityX) || 0;
    const step = () => {
        velocityX *= DEBUG_HAND_FLING_FRICTION;
        const nextOffset = _clampDebugHandOffset(containerEl, state.currentOffsetX + velocityX);
        const hitBound = Math.abs(nextOffset - (state.currentOffsetX + velocityX)) > 0.5;
        _applyDebugHandTrackTransform(containerEl, nextOffset);
        if (hitBound) velocityX *= 0.52;
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

function _applyDebugHandWheelDelta(containerEl, state, rawDelta) {
    if (!containerEl || !state) return;
    const delta = Number(rawDelta) || 0;
    if (!delta) return;
    _cancelDebugHandFling(state);
    const nextOffset = _clampDebugHandOffset(containerEl, state.currentOffsetX - (delta * DEBUG_HAND_WHEEL_SCALE));
    _applyDebugHandTrackTransform(containerEl, nextOffset);
}

function _finishDebugHandScroll(containerEl, state, event) {
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

function _installDebugHandScroll(containerEl) {
    if (!containerEl || containerEl.dataset.debugHandScrollBound === '1') return;
    containerEl.dataset.debugHandScrollBound = '1';
    const state = _getDebugHandScrollState(containerEl);
    if (!state) return;

    containerEl.addEventListener('pointerdown', (event) => {
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

    containerEl.addEventListener('pointermove', (event) => {
        if (!_isDebugLayoutEnabled()) return;
        if (state.activePointerId == null) return;
        if (typeof event.pointerId === 'number' && event.pointerId !== state.activePointerId) return;
        const clientX = Number(event.clientX) || 0;
        const clientY = Number(event.clientY) || 0;
        const deltaX = clientX - state.startX;
        const deltaY = clientY - state.startY;
        if (!state.dragReady) {
            if (Math.abs(deltaY) > DEBUG_HAND_SCROLL_MOVE_THRESHOLD_PX && Math.abs(deltaY) > Math.abs(deltaX)) {
                _clearDebugHandScrollTimer(state);
            }
            return;
        }
        if (!state.dragging && Math.abs(deltaX) < DEBUG_HAND_SCROLL_MOVE_THRESHOLD_PX) {
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

    const finishHandler = (event) => {
        if (state.activePointerId == null) return;
        if (event && typeof event.pointerId === 'number' && event.pointerId !== state.activePointerId) return;
        _finishDebugHandScroll(containerEl, state, event);
    };
    containerEl.addEventListener('pointerup', finishHandler);
    containerEl.addEventListener('pointercancel', finishHandler);
    containerEl.addEventListener('lostpointercapture', finishHandler);

    containerEl.addEventListener('click', (event) => {
        if (!_isDebugLayoutEnabled()) return;
        if (state.suppressClickUntil <= Date.now()) return;
        state.suppressClickUntil = 0;
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        if (event && typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }, true);

    containerEl.addEventListener('wheel', (event) => {
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

function _ensureDebugHandScrollBindings() {
    if (typeof document === 'undefined') return;
    _installDebugHandScroll(document.getElementById('hand-black'));
    _installDebugHandScroll(document.getElementById('hand-white'));
    _applyDebugHandTrackTransform(document.getElementById('hand-black'), (_getDebugHandScrollState(document.getElementById('hand-black')) || {}).currentOffsetX || 0);
    _applyDebugHandTrackTransform(document.getElementById('hand-white'), (_getDebugHandScrollState(document.getElementById('hand-white')) || {}).currentOffsetX || 0);
}

function _applyDebugButtonState(debugModeBtn, debugEnabled) {
    if (!debugModeBtn) return;
    debugModeBtn.textContent = debugEnabled ? 'DEBUG: ON' : 'DEBUG: OFF';
    if (debugModeBtn.style) {
        debugModeBtn.style.color = debugEnabled ? '#6bff6b' : '#ff6b6b';
    }

    const ariaPressed = debugEnabled ? 'true' : 'false';
    if (typeof debugModeBtn.setAttribute === 'function') {
        debugModeBtn.setAttribute('aria-pressed', ariaPressed);
        return;
    }

    debugModeBtn.ariaPressed = ariaPressed;
    if (typeof debugModeBtn.getAttribute !== 'function') {
        debugModeBtn.getAttribute = (name) => {
            if (name === 'aria-pressed') return debugModeBtn.ariaPressed;
            return null;
        };
    }
}

function _applyDebugSubButtonVisibility(humanVsHumanBtn, visualTestBtn, debugEnabled) {
    const display = debugEnabled ? 'block' : 'none';
    if (visualTestBtn) visualTestBtn.style.display = display;
    if (humanVsHumanBtn) humanVsHumanBtn.style.display = display;
}

function _syncDebugFlags(debugEnabled, humanVsHuman) {
    try {
        const payload = {
            DEBUG_UNLIMITED_USAGE: !!debugEnabled,
            DEBUG_HUMAN_VS_HUMAN: !!humanVsHuman
        };

        // For UI impl bridges, preserve existing objects and only set debug flags
        try {
            const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {}));
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
            // Also update legacy window flags to preserve compatibility with modules that still read window.*
            try {
                if (typeof window !== 'undefined') {
                    window.DEBUG_UNLIMITED_USAGE = !!debugEnabled;
                    window.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;

                    window.__uiImpl_turn_manager = window.__uiImpl_turn_manager || {};
                    window.__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;
                    window.__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = !!debugEnabled;

                    window.__uiImpl_move_executor = window.__uiImpl_move_executor || {};
                    window.__uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;

                    window.__uiImpl = window.__uiImpl || {};
                    window.__uiImpl.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;
                    window.__uiImpl.DEBUG_UNLIMITED_USAGE = !!debugEnabled;
                }
            } catch (e) { /* ignore */ }
            return;
        }

        // Fallback: legacy behavior (direct window writes)
        if (typeof window !== 'undefined') {
            // Global flags (legacy consumers)
            window.DEBUG_UNLIMITED_USAGE = !!debugEnabled;
            window.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;

            // UI impl bridges (game layer reads these, not window flags)
            window.__uiImpl_turn_manager = window.__uiImpl_turn_manager || {};
            window.__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;
            window.__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = !!debugEnabled;

            window.__uiImpl_move_executor = window.__uiImpl_move_executor || {};
            window.__uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;

            window.__uiImpl = window.__uiImpl || {};
            window.__uiImpl.DEBUG_HUMAN_VS_HUMAN = !!humanVsHuman;
            window.__uiImpl.DEBUG_UNLIMITED_USAGE = !!debugEnabled;
        }
    } catch (e) { /* ignore */ }
}

function setupDebugControls(debugModeBtn, humanVsHumanBtn, visualTestBtn) {
    const debugAllowed = _isDebugAllowed();
    if (!debugAllowed) {
        if (humanVsHumanBtn) humanVsHumanBtn.style.display = 'none';
        if (visualTestBtn) visualTestBtn.style.display = 'none';
    }
    _ensureDebugHandScrollBindings();
    // Ensure game-layer debug flags are synced on init
    const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {}));
    _applyDebugLayoutState(seed.DEBUG_UNLIMITED_USAGE === true);
    _syncDebugFlags(seed.DEBUG_UNLIMITED_USAGE === true, seed.DEBUG_HUMAN_VS_HUMAN === true);

    // Debug Mode
    if (debugModeBtn) {
        debugModeBtn.style.display = 'block';
        const isDebug = seed.DEBUG_UNLIMITED_USAGE === true;
        _applyDebugButtonState(debugModeBtn, isDebug);
        _applyDebugSubButtonVisibility(humanVsHumanBtn, visualTestBtn, isDebug);
        debugModeBtn.addEventListener('click', () => {
            const updatedDebug = !(_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug().DEBUG_UNLIMITED_USAGE === true) : (typeof window !== 'undefined' && window.DEBUG_UNLIMITED_USAGE === true));
            if (updatedDebug) _setDebugModeAllowed(true);
            _applyDebugButtonState(debugModeBtn, updatedDebug);
            _applyDebugLayoutState(updatedDebug);

            // Show/hide debug buttons
            _applyDebugSubButtonVisibility(humanVsHumanBtn, visualTestBtn, updatedDebug);

            if (updatedDebug) {
                addLog('🐛 デバッグモード: ON （制限なしでカード使用可能）');
                // Enable human vs human mode by default
                _syncDebugFlags(true, true);
                // Disable AUTO while DEBUG is ON to avoid interference
                try {
                    const g = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {}));
                    if (typeof g.disableAutoMode === 'function') {
                        g.disableAutoMode();
                        const autoBtn = document.getElementById('autoToggleBtn');
                        if (autoBtn) autoBtn.textContent = 'AUTO: OFF';
                    }
                } catch (e) { /* ignore */ }

                const g2 = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {}));
                if (typeof g2.ensureDebugActionsLoaded === 'function') {
                    g2.ensureDebugActionsLoaded(() => {
                        fillDebugHand();
                    });
                } else {
                    fillDebugHand();
                }
                if (humanVsHumanBtn) {
                    humanVsHumanBtn.textContent = '人間vs人間: ON';
                    humanVsHumanBtn.style.color = '#90ee90';
                }
                addLog('🎮 人間vs人間モード: ON （黒白両方操作可能、手札は黒のみ使用）');
            } else {
                addLog('デバッグモード: OFF');
                // Disable human vs human mode when debug is turned off
                _syncDebugFlags(false, false);
                if (humanVsHumanBtn) {
                    humanVsHumanBtn.textContent = '人間vs人間: OFF';
                    humanVsHumanBtn.style.color = '#ffb366';
                }
            }
            if (typeof renderCardUI === 'function') renderCardUI();
        });
    }

    // Human vs Human Mode (debug subfeature)
    if (humanVsHumanBtn) {
        const seed2 = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {}));
        humanVsHumanBtn.textContent = seed2.DEBUG_HUMAN_VS_HUMAN ? '人間vs人間: ON' : '人間vs人間: OFF';
        humanVsHumanBtn.style.color = seed2.DEBUG_HUMAN_VS_HUMAN ? '#90ee90' : '#ffb366';
        humanVsHumanBtn.addEventListener('click', () => {
            const curr = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug().DEBUG_HUMAN_VS_HUMAN === true) : (typeof window !== 'undefined' && window.DEBUG_HUMAN_VS_HUMAN === true));
            const updatedHuman = !curr;
            const currDebug = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug().DEBUG_UNLIMITED_USAGE === true) : (typeof window !== 'undefined' && window.DEBUG_UNLIMITED_USAGE === true));
            _syncDebugFlags(currDebug, updatedHuman);
            humanVsHumanBtn.textContent = updatedHuman ? '人間vs人間: ON' : '人間vs人間: OFF';
            humanVsHumanBtn.style.color = updatedHuman ? '#90ee90' : '#ffb366';

            if (updatedHuman) {
                addLog('🎮 人間vs人間モード: ON （黒白両方操作可能、手札は黒のみ使用）');
            } else {
                addLog('人間vs人間モード: OFF');
            }
        });
    }

    // Visual Test Button
    if (visualTestBtn) {
        visualTestBtn.addEventListener('click', () => {
            const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {}));
            if (!(seed && seed.DEBUG_UNLIMITED_USAGE)) return;
            const run = (dbg) => {
                if (!dbg || typeof dbg.applyVisualTestBoard !== 'function') {
                    console.warn('[debug] DebugActions.applyVisualTestBoard not available');
                    return;
                }
                dbg.applyVisualTestBoard(gameState, cardState);
                if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
                else if (typeof renderBoard === 'function') renderBoard();
                addLog('石ビジュアルテスト表示 (黒:左列 / 白:右列)');
            };
            let dbg = (typeof DebugActions !== 'undefined') ? DebugActions : null;
            if (!dbg && typeof require === 'function') {
                try { dbg = require('../../game/debug/debug-actions'); } catch (e) { dbg = null; }
            }
            if (dbg) return run(dbg);
            if (seed && typeof seed.ensureDebugActionsLoaded === 'function') {
                return seed.ensureDebugActionsLoaded(run);
            }
            run(null);
        });
    }
}

// Register setupDebugControls with UIBootstrap for canonical access, fall back to attaching to window for legacy consumers
try {
    if (_registerUIGlobals_debug) {
        _registerUIGlobals_debug({ setupDebugControls, refreshDebugHandLayout: _ensureDebugHandScrollBindings });
    } else if (typeof window !== 'undefined') {
        window.setupDebugControls = setupDebugControls;
        window.refreshDebugHandLayout = _ensureDebugHandScrollBindings;
    }
} catch (e) { /* ignore */ }
