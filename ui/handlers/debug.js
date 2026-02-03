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
    // Ensure game-layer debug flags are synced on init
    const seed = (_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug() || {}) : (typeof window !== 'undefined' ? window : {}));
    _syncDebugFlags(seed.DEBUG_UNLIMITED_USAGE === true, seed.DEBUG_HUMAN_VS_HUMAN === true);

    // Debug Mode
    if (debugModeBtn) {
        const isDebug = seed.DEBUG_UNLIMITED_USAGE === true;
        debugModeBtn.textContent = isDebug ? 'DEBUG: ON' : 'DEBUG: OFF';
        debugModeBtn.style.color = isDebug ? '#6bff6b' : '#ff6b6b';
        debugModeBtn.addEventListener('click', () => {
            const updatedDebug = !(_getUIBootstrapGlobals_debug ? (_getUIBootstrapGlobals_debug().DEBUG_UNLIMITED_USAGE === true) : (typeof window !== 'undefined' && window.DEBUG_UNLIMITED_USAGE === true));
            debugModeBtn.textContent = updatedDebug ? 'DEBUG: ON' : 'DEBUG: OFF';
            debugModeBtn.style.color = updatedDebug ? '#6bff6b' : '#ff6b6b';

            // Show/hide debug buttons
            if (visualTestBtn) visualTestBtn.style.display = updatedDebug ? 'block' : 'none';
            if (humanVsHumanBtn) humanVsHumanBtn.style.display = updatedDebug ? 'block' : 'none';

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
        _registerUIGlobals_debug({ setupDebugControls });
    } else if (typeof window !== 'undefined') {
        window.setupDebugControls = setupDebugControls;
    }
} catch (e) { /* ignore */ }
