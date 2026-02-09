/**
 * @file init.js
 * @description UI event handler initialization
 */

/**
 * UI初期化
 * Initialize all UI event listeners and elements
 */
function _isDebugAllowed() {
    try {
        if (typeof window !== 'undefined') {
            if (window.DEBUG_MODE_ALLOWED === true) return true;
            if (window.DEBUG_MODE_ALLOWED === false) return false;
        }
        const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
        return /[?&]debug=1/.test(qs) || /[?&]debug=true/.test(qs);
    } catch (e) {
        return false;
    }
}

function initializeUI() {
    const resetBtn = document.getElementById('resetBtn');
    const muteBtn = document.getElementById('muteBtn');
    const seTypeSelect = document.getElementById('seTypeSelect');
    const seVolSlider = document.getElementById('seVolSlider');
    const bgmPlayBtn = document.getElementById('bgmPlayBtn');
    const bgmPauseBtn = document.getElementById('bgmPauseBtn');
    const bgmTrackSelect = document.getElementById('bgmTrackSelect');
    const bgmVolSlider = document.getElementById('bgmVolSlider');
    const autoToggleBtn = document.getElementById('autoToggleBtn');
    const smartBlack = document.getElementById('smartBlack');
    const smartWhite = document.getElementById('smartWhite');
    const debugModeBtn = document.getElementById('debugModeBtn');
    const humanVsHumanBtn = document.getElementById('humanVsHumanBtn');
    const visualTestBtn = document.getElementById('visualTestBtn');
    const debugAllowed = _isDebugAllowed();

    // Reset
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (typeof resetGame === 'function') {
                try { resetGame(); } catch (e) { console.error('[init] resetGame threw', e && e.message); }
            } else {
                console.warn('[init] resetGame not available; skipping reset');
            }
            try { if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.init === 'function') SoundEngine.init(); } catch (e) { /* ignore */ }
        });
    }

    // Debug / Visual test controls
    if (debugAllowed && typeof setupDebugControls === 'function') {
        setupDebugControls(debugModeBtn, humanVsHumanBtn, visualTestBtn);
    } else {
        if (debugModeBtn) debugModeBtn.style.display = 'none';
        if (humanVsHumanBtn) humanVsHumanBtn.style.display = 'none';
        if (visualTestBtn) visualTestBtn.style.display = 'none';
    }



    // Auto Toggle (simple)
    if (typeof setupAutoToggle === 'function') {
        setupAutoToggle(autoToggleBtn, smartBlack, smartWhite);
    }

    // Smart Level Selects
    if (typeof setupSmartSelects === 'function') {
        setupSmartSelects(smartBlack, smartWhite);
    }

    // SE Controls
    if (typeof setupSoundControls === 'function') {
        setupSoundControls(muteBtn, seTypeSelect, seVolSlider);
    }

    // BGM Controls
    if (typeof setupBgmControls === 'function') {
        setupBgmControls(bgmPlayBtn, bgmPauseBtn, bgmTrackSelect, bgmVolSlider);
    }

    // Initialize card UI handlers
    const useBtn = document.getElementById('use-card-btn');
    const passBtn = document.getElementById('pass-btn');
    const sellBtn = document.getElementById('sell-card-btn');
    if (useBtn) {
        useBtn.addEventListener('click', useSelectedCard);
    }
    if (sellBtn && typeof confirmSellCardSelection === 'function') {
        sellBtn.addEventListener('click', confirmSellCardSelection);
    }
    if (passBtn && typeof passCurrentTurn === 'function') {
        passBtn.addEventListener('click', passCurrentTurn);
    }

    // Load CPU policy based on CPU level
    if (typeof loadCpuPolicy === 'function') {
        loadCpuPolicy();
    }
    // Load local policy-table model for browser CPU (safe fallback on failure)
    if (typeof initPolicyTableModel === 'function') {
        initPolicyTableModel();
    }

    // Load LvMax Deep CFR models
    if (typeof initLvMaxModels === 'function') {
        initLvMaxModels();
    }

    // Initialize the game (guarded: resetGame may not be present in minimal test harness)
    try {
        if (typeof resetGame === 'function') resetGame();
    } catch (e) { console.error('[init] resetGame threw', e && e.message); }

    // Attempt to preload asset manifest (optional; source of truth for assets in network play)
    try {
        if (typeof fetch === 'function' && typeof UIBootstrap !== 'undefined' && typeof UIBootstrap.preloadAssets === 'function') {
            // When opened via file://, `fetch('assets/asset-manifest.json')` is blocked by browser CORS (origin "null").
            // Avoid triggering noisy console errors; assets will still be loaded lazily via <img>/<audio> when referenced.
            try {
                if (typeof location !== 'undefined' && (location.protocol === 'file:' || location.origin === 'null')) {
                    return;
                }
            } catch (e) { /* ignore */ }
            (async () => {
                try {
                    const res = await fetch('assets/asset-manifest.json', { cache: 'no-store' });
                    if (res && res.ok) {
                        const manifest = await res.json();
                        const preloadRes = await UIBootstrap.preloadAssets(manifest, { timeoutMs: 5000 });
                        if (!preloadRes.success) {
                            console.warn('[init] asset preloading incomplete, falling back to CSS-only visuals', preloadRes.failed);
                        }
                    }
                } catch (e) { /* ignore fetch errors in environments without files */ }
            })();
        }
    } catch (e) { /* ignore */ }

    // NOTE: Do NOT inject or write to `window.cardState` from UI init here to preserve the
    // single-writer invariant. Reset/bootstrapping is handled in `resetGame()` when needed.

    // One-time UI helpers (moved from ui.js to avoid double initialization)
    try {
        if (typeof initWorkVisualsHelpers === 'function') initWorkVisualsHelpers();
        if (typeof initWorkVisualDiagnosticsAuto === 'function') initWorkVisualDiagnosticsAuto();
    } catch (e) { /* defensive */ }


    // Mirror internal animation flags to window for telemetry and Playwright checks
    if (typeof window !== 'undefined') {
        // Respect query param or pre-set global flag
        try {
            const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
            if (qs.indexOf('?noanim=1') !== -1 || qs.indexOf('&noanim=1') !== -1) window.DISABLE_ANIMATIONS = true;
        } catch (e) { /* ignore */ }

        // Expose TimerRegistry if available
        if (typeof TimerRegistry !== 'undefined') window.TimerRegistry = TimerRegistry;
        // Inject real timer impl for game-side timers (auto loop, etc.) — once
        if (typeof GameTimers !== 'undefined' && typeof GameTimers.setTimerImpl === 'function') {
            if (!window.__timersInjected) {
                GameTimers.setTimerImpl({
                    waitMs: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                    requestFrame: () => new Promise(resolve => requestAnimationFrame(resolve))
                });
                window.__timersInjected = true;
            }
        }

        // Initialize monitoring flags
        window.isCardAnimating = typeof isCardAnimating !== 'undefined' ? isCardAnimating : false;
        window.isProcessing = typeof isProcessing !== 'undefined' ? isProcessing : false;

        // If no-anim mode is enabled, ensure flags are not stuck true
        if (window.DISABLE_ANIMATIONS === true) {
            window.isCardAnimating = false;
            isCardAnimating = false;
            isProcessing = false;
        }

        if (debugAllowed) {
            // Telemetry: minimal counters for watchdog and single-writer events
            window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
            window.getTelemetrySnapshot = function () { return Object.assign({}, window.__telemetry__); };
            window.resetTelemetry = function () { window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; };

            // Mirror internal animation flags to window for telemetry and checks
            window._uiMirrorIntervalId = setInterval(() => {
                if (typeof window !== 'undefined') {
                    window.isCardAnimating = typeof isCardAnimating !== 'undefined' ? isCardAnimating : false;
                    window.isProcessing = typeof isProcessing !== 'undefined' ? isProcessing : false;
                }
            }, 100);

            // Watchdog ping for stuck flags (game/turn-manager.js provides watchdogPing)
            if (typeof window._watchdogIntervalId === 'undefined' || window._watchdogIntervalId === null) {
                window._watchdogIntervalId = setInterval(() => {
                    try {
                        if (typeof watchdogPing === 'function') watchdogPing();
                    } catch (e) { /* ignore */ }
                }, 250);
            }

            // UI-side playback watchdog: abort visuals if playback gets stuck too long
            if (typeof window._playbackWatchdogId === 'undefined' || window._playbackWatchdogId === null) {
                window._playbackWatchdogId = setInterval(() => {
                    try {
                        if (window.VisualPlaybackActive === true) {
                            window.__playbackActiveSince = window.__playbackActiveSince || Date.now();
                            const elapsed = Date.now() - window.__playbackActiveSince;
                            if (elapsed > 15000) {
                                if (window.AnimationEngine && typeof window.AnimationEngine.abortAndSync === 'function') {
                                    window.AnimationEngine.abortAndSync();
                                }
                                window.VisualPlaybackActive = false;
                                const board = document.getElementById('board');
                                if (board) board.classList.remove('playback-locked');
                                window.__playbackActiveSince = null;
                            }
                        } else {
                            window.__playbackActiveSince = null;
                        }
                    } catch (e) { /* ignore */ }
                }, 500);
            }
        }
    }
}

// Auto-initialize UI when DOM is ready
document.addEventListener('DOMContentLoaded', initializeUI);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeUI,
        setupSmartSelects: (typeof setupSmartSelects !== 'undefined') ? setupSmartSelects : function () {},
        setupSoundControls: (typeof setupSoundControls !== 'undefined') ? setupSoundControls : function () {},
        setupBgmControls: (typeof setupBgmControls !== 'undefined') ? setupBgmControls : function () {},
        loadCpuPolicy: (typeof loadCpuPolicy !== 'undefined') ? loadCpuPolicy : function () {}
    };
} 

if (typeof window !== 'undefined') {
    window.initializeUI = initializeUI;
}
