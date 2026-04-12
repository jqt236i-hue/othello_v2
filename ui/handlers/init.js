/**
 * @file init.js
 * @description UI event handler initialization
 */

/**
 * UI初期化
 * Initialize all UI event listeners and elements
 */
const InitBootstrapShared = (() => {
    if (typeof require === 'function') {
        try { return require('../../shared/ui-bootstrap-shared'); } catch (e) { /* ignore */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SharedUIBootstrap) return globalThis.SharedUIBootstrap;
    } catch (e) { /* ignore */ }
    return null;
})();

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

function setUiInitializedFlag(value) {
    try {
        const ready = value === true;
        if (typeof globalThis !== 'undefined') globalThis.__uiInitialized = ready;
        if (typeof window !== 'undefined') window.__uiInitialized = ready;
    } catch (e) { /* ignore */ }
}

function _getPlaybackStateRuntime() {
    if (InitBootstrapShared && typeof InitBootstrapShared.resolvePlaybackStateManager === 'function') {
        const resolved = InitBootstrapShared.resolvePlaybackStateManager();
        if (resolved) return resolved;
    }
    if (typeof PlaybackStateManager !== 'undefined' && PlaybackStateManager) return PlaybackStateManager;
    if (typeof require === 'function') {
        try { return require('../playback-state-manager'); } catch (e) { /* ignore */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.PlaybackStateManager) return globalThis.PlaybackStateManager;
    } catch (e) { /* ignore */ }
    return null;
}

function _getPlaybackRuntimeModule() {
    if (InitBootstrapShared && typeof InitBootstrapShared.resolvePlaybackRuntime === 'function') {
        const resolved = InitBootstrapShared.resolvePlaybackRuntime();
        if (resolved) return resolved;
    }
    if (typeof PlaybackRuntime !== 'undefined' && PlaybackRuntime) return PlaybackRuntime;
    if (typeof require === 'function') {
        try { return require('../playback-runtime'); } catch (e) { /* ignore */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.PlaybackRuntime) return globalThis.PlaybackRuntime;
    } catch (e) { /* ignore */ }
    return null;
}

function _getUiBootstrapModule() {
    if (InitBootstrapShared && typeof InitBootstrapShared.resolveUIBootstrap === 'function') {
        return InitBootstrapShared.resolveUIBootstrap();
    }
    return (typeof UIBootstrap !== 'undefined' && UIBootstrap && typeof UIBootstrap.installGameDI === 'function')
        ? UIBootstrap
        : null;
}

function _readCardAnimatingFlag() {
    const playbackState = _getPlaybackStateRuntime();
    if (playbackState && typeof playbackState.getCardAnimating === 'function') {
        return playbackState.getCardAnimating() === true;
    }
    return (typeof isCardAnimating !== 'undefined') ? isCardAnimating : false;
}

function _readProcessingFlag() {
    const playbackState = _getPlaybackStateRuntime();
    if (playbackState && typeof playbackState.getProcessing === 'function') {
        return playbackState.getProcessing() === true;
    }
    return (typeof isProcessing !== 'undefined') ? isProcessing : false;
}

function _syncPlaybackWindowFlags() {
    const playbackState = _getPlaybackStateRuntime();
    const playbackRuntime = _getPlaybackRuntimeModule();
    if (playbackRuntime && typeof playbackRuntime.syncLegacyWindowFlags === 'function') {
        return playbackRuntime.syncLegacyWindowFlags(playbackState, {
            readCardAnimating: _readCardAnimatingFlag,
            readProcessing: _readProcessingFlag
        });
    }
    if (playbackState && typeof playbackState.syncLegacyWindowFlags === 'function') {
        return playbackState.syncLegacyWindowFlags({
            readCardAnimating: _readCardAnimatingFlag,
            readProcessing: _readProcessingFlag
        });
    }
    if (typeof window !== 'undefined') {
        window.isCardAnimating = _readCardAnimatingFlag();
        window.isProcessing = _readProcessingFlag();
    }
    return {
        isCardAnimating: _readCardAnimatingFlag() === true,
        isProcessing: _readProcessingFlag() === true
    };
}

function _setPlaybackBusyFlags(options) {
    const config = (options && typeof options === 'object')
        ? options
        : {
            processing: options === true,
            cardAnimating: options === true
        };
    const playbackState = _getPlaybackStateRuntime();
    if (playbackState && typeof playbackState.setBusyState === 'function') {
        playbackState.setBusyState(config);
        return _syncPlaybackWindowFlags();
    }

    if (typeof window !== 'undefined') {
        if (Object.prototype.hasOwnProperty.call(config, 'cardAnimating')) {
            window.isCardAnimating = config.cardAnimating === true;
        }
        if (Object.prototype.hasOwnProperty.call(config, 'processing')) {
            window.isProcessing = config.processing === true;
        }
    }
    try {
        if (Object.prototype.hasOwnProperty.call(config, 'cardAnimating') && typeof isCardAnimating !== 'undefined') {
            isCardAnimating = config.cardAnimating === true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (Object.prototype.hasOwnProperty.call(config, 'processing') && typeof isProcessing !== 'undefined') {
            isProcessing = config.processing === true;
        }
    } catch (e) { /* ignore */ }
    return _syncPlaybackWindowFlags();
}

function _installPlaybackDebugRuntime() {
    const playbackState = _getPlaybackStateRuntime();
    const playbackRuntime = _getPlaybackRuntimeModule();
    if (playbackRuntime && typeof playbackRuntime.ensureDebugRuntime === 'function') {
        return playbackRuntime.ensureDebugRuntime(playbackState, {
            readCardAnimating: _readCardAnimatingFlag,
            readProcessing: _readProcessingFlag,
            abortPlayback: () => {
                try {
                    if (window.AnimationEngine && typeof window.AnimationEngine.abortAndSync === 'function') {
                        window.AnimationEngine.abortAndSync();
                    }
                } catch (e) { /* ignore */ }
            },
            getBoardElement: () => {
                try {
                    return document.getElementById('board');
                } catch (e) {
                    return null;
                }
            }
        });
    }
    if (!playbackState || typeof playbackState.ensureDebugRuntime !== 'function') return null;
    return playbackState.ensureDebugRuntime({
        readCardAnimating: _readCardAnimatingFlag,
        readProcessing: _readProcessingFlag,
        abortPlayback: () => {
            try {
                if (window.AnimationEngine && typeof window.AnimationEngine.abortAndSync === 'function') {
                    window.AnimationEngine.abortAndSync();
                }
            } catch (e) { /* ignore */ }
        },
        getBoardElement: () => {
            try {
                return document.getElementById('board');
            } catch (e) {
                return null;
            }
        }
    });
}

async function initializeUI() {
    setUiInitializedFlag(false);
    try {
        const uiBootstrap = _getUiBootstrapModule();
        if (uiBootstrap && typeof uiBootstrap.installGameDI === 'function') {
            uiBootstrap.installGameDI();
        }
    } catch (e) {
        console.warn('[init] UIBootstrap.installGameDI failed', e);
    }

    const resetBtn = document.getElementById('resetBtn');
    const muteBtn = document.getElementById('muteBtn');
    const seTypeSelect = document.getElementById('seTypeSelect');
    const seVolSlider = document.getElementById('seVolSlider');
    const bgmPlayBtn = document.getElementById('bgmPlayBtn');
    const bgmPauseBtn = document.getElementById('bgmPauseBtn');
    const bgmTrackSelect = document.getElementById('bgmTrackSelect');
    const bgmVolSlider = document.getElementById('bgmVolSlider');
    const storyBtn = document.getElementById('storyBtn');
    const storyMenuOverlay = document.getElementById('storyMenuOverlay');
    const tutorialOverlay = document.getElementById('tutorialOverlay');
    const rulesHelpBtn = document.getElementById('rulesHelpBtn');
    const rulesHelpPanel = document.getElementById('rules-help-panel');
    const gachaOpenBtn = document.getElementById('gachaOpenBtn');
    const gachaOverlay = document.getElementById('gachaOverlay');
    const gachaModal = document.getElementById('gachaModal');
    const gachaCloseBtn = document.getElementById('gachaCloseBtn');
    const gachaBalanceValue = document.getElementById('gachaBalanceValue');
    const gachaDetailToggleBtn = document.getElementById('gachaDetailToggleBtn');
    const gachaDetailsPanel = document.getElementById('gachaDetailsPanel');
    const gachaSinglePullBtn = document.getElementById('gachaSinglePullBtn');
    const gachaTenPullBtn = document.getElementById('gachaTenPullBtn');
    const gachaStatusText = document.getElementById('gachaStatusText');
    const gachaResults = document.getElementById('gachaResults');
    const handSkinBtn = document.getElementById('handSkinBtn');
    const handSkinPanel = document.getElementById('handSkinPanel');
    const handSkinCloseBtn = document.getElementById('handSkinCloseBtn');
    const handSkinOptions = document.getElementById('handSkinOptions');
    const handImage = document.getElementById('handImage');
    const autoToggleBtn = document.getElementById('autoToggleBtn');
    const smartBlack = document.getElementById('smartBlack');
    const smartWhite = document.getElementById('smartWhite');
    const debugModeBtn = document.getElementById('debugModeBtn');
    const humanVsHumanBtn = document.getElementById('humanVsHumanBtn');
    const visualTestBtn = document.getElementById('visualTestBtn');
    const modeCpuBtn = document.getElementById('modeCpuBtn');
    const modeNetworkBtn = document.getElementById('modeNetworkBtn');
    const controlPanel = document.getElementById('control-panel');
    const deckBuilderOpenBtn = document.getElementById('deckBuilderOpenBtn');
    const deckBuilderControlSummary = document.getElementById('deckBuilderControlSummary');
    const deckBuilderOverlay = document.getElementById('deckBuilderOverlay');
    const deckBuilderCloseBtn = document.getElementById('deckBuilderCloseBtn');
    const deckBuilderHeaderSummary = document.getElementById('deckBuilderHeaderSummary');
    const deckBuilderBody = document.getElementById('deckBuilderBody');
    const boardSizeOpenBtn = document.getElementById('boardSizeOpenBtn');
    const boardSizeControlSummary = document.getElementById('boardSizeControlSummary');
    const boardSizeEditor = document.getElementById('boardSizeEditor');
    const boardSizeRowsInput = document.getElementById('boardSizeRowsInput');
    const boardSizeColsInput = document.getElementById('boardSizeColsInput');
    const boardSizeCloseBtn = document.getElementById('boardSizeCloseBtn');
    const boardSizeEditorNote = document.getElementById('boardSizeEditorNote');
    const networkPanel = document.getElementById('networkPanel');
    const networkAdvancedSettings = document.getElementById('networkAdvancedSettings');
    const networkServerInput = document.getElementById('networkServerInput');
    const networkPlayerNameInput = document.getElementById('networkPlayerNameInput');
    const networkRoomIdInput = document.getElementById('networkRoomIdInput');
    const networkBoardSizeRowsInput = document.getElementById('networkBoardSizeRowsInput');
    const networkBoardSizeColsInput = document.getElementById('networkBoardSizeColsInput');
    const networkBoardSizeSummary = document.getElementById('networkBoardSizeSummary');
    const networkBoardSizeNote = document.getElementById('networkBoardSizeNote');
    const networkEnableDebugCheckbox = document.getElementById('networkEnableDebugCheckbox');
    const networkCopyRoomBtn = document.getElementById('networkCopyRoomBtn');
    const networkCreateBtn = document.getElementById('networkCreateBtn');
    const networkJoinBtn = document.getElementById('networkJoinBtn');
    const networkLeaveBtn = document.getElementById('networkLeaveBtn');
    const networkStatusText = document.getElementById('networkStatusText');
    const networkDeckInfo = document.getElementById('networkDeckInfo');
    const networkTimerStatus = document.getElementById('networkTimerStatus');
    const networkOverlay = document.getElementById('networkOverlay');
    const networkCloseBtn = document.getElementById('networkCloseBtn');
    const leaderboardOpenBtn = document.getElementById('leaderboardOpenBtn');
    const leaderboardOverlay = document.getElementById('leaderboardOverlay');
    const leaderboardPanel = document.getElementById('leaderboardModal');
    const leaderboardCloseBtn = document.getElementById('leaderboardCloseBtn');
    const leaderboardNameInput = document.getElementById('leaderboardNameInput');
    const leaderboardReloadBtn = document.getElementById('leaderboardReloadBtn');
    const leaderboardStatusText = document.getElementById('leaderboardStatusText');
    const leaderboardList = document.getElementById('leaderboardList');
    const networkChatPanel = document.getElementById('networkChatPanel');
    const networkChatToggle = document.getElementById('networkChatToggle');
    const networkChatMessages = document.getElementById('networkChatMessages');
    const networkChatInput = document.getElementById('networkChatInput');
    const networkChatSendBtn = document.getElementById('networkChatSendBtn');
    const sidePanel = document.getElementById('side-panel');
    const sidePanelToggleBtn = document.getElementById('sidePanelToggleBtn');
    const debugAllowed = _isDebugAllowed();

    try {
        if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.primeEffectSounds === 'function') {
            SoundEngine.primeEffectSounds();
        }
    } catch (e) { /* ignore */ }

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
    if (typeof setupDebugControls === 'function') {
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

    if (typeof setupMatchModeControls === 'function') {
        setupMatchModeControls({
            modeCpuBtn,
            modeNetworkBtn,
            controlPanel,
            networkPanel,
            networkAdvancedSettings,
            networkRoomInput: networkRoomIdInput,
            networkServerInput,
            networkPlayerNameInput,
            networkBoardSizeRowsInput,
            networkBoardSizeColsInput,
            networkBoardSizeSummary,
            networkBoardSizeNote,
            networkEnableDebugCheckbox,
            networkCopyRoomBtn,
            networkCreateBtn,
            networkJoinBtn,
            networkLeaveBtn,
            networkStatus: networkStatusText,
            networkDeckInfo,
            networkTimerStatus,
            networkOverlay,
            networkCloseBtn,
            leaderboardOpenBtn,
            leaderboardOverlay,
            leaderboardPanel,
            leaderboardCloseBtn,
            leaderboardNameInput,
            leaderboardReloadBtn,
            leaderboardStatus: leaderboardStatusText,
            leaderboardList,
            networkChatPanel,
            networkChatToggle,
            networkChatMessages,
            networkChatInput,
            networkChatSendBtn,
            autoToggleBtn
        });
    }

    if (typeof setupDeckBuilderControls === 'function') {
        setupDeckBuilderControls({
            openBtn: deckBuilderOpenBtn,
            controlSummary: deckBuilderControlSummary,
            overlay: deckBuilderOverlay,
            closeBtn: deckBuilderCloseBtn,
            headerSummary: deckBuilderHeaderSummary,
            body: deckBuilderBody,
            boardSizeOpenBtn,
            boardSizeControlSummary,
            boardSizeEditor,
            boardSizeRowsInput,
            boardSizeColsInput,
            boardSizeCloseBtn,
            boardSizeEditorNote
        });
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

    if (typeof setupRulesHelp === 'function') {
        setupRulesHelp(rulesHelpBtn, rulesHelpPanel);
    }

    if (typeof setupGachaControls === 'function') {
        setupGachaControls({
            root: window
        });
    }

    if (typeof setupHandSkinControls === 'function') {
        setupHandSkinControls({
            button: handSkinBtn,
            panel: handSkinPanel,
            closeBtn: handSkinCloseBtn,
            optionsEl: handSkinOptions,
            handImage,
            root: window
        });
    }

    if (typeof setupStoryControls === 'function') {
        setupStoryControls(storyBtn, storyMenuOverlay, tutorialOverlay);
    }

    if (typeof setupStoryBattleUi === 'function') {
        setupStoryBattleUi({
            root: window,
            soundRefs: {
                muteBtn,
                seVolSlider,
                bgmVolSlider,
                bgmTrackSelect
            }
        });
    }

    if (sidePanel && sidePanelToggleBtn) {
        const applySidePanelCollapsedState = (collapsed) => {
            const isCollapsed = collapsed === true;
            sidePanel.classList.toggle('side-panel-collapsed', isCollapsed);
            sidePanelToggleBtn.textContent = isCollapsed ? '＋' : '−';
            sidePanelToggleBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
            const label = isCollapsed ? '操作パネルを開く' : '操作パネルを閉じる';
            sidePanelToggleBtn.setAttribute('aria-label', label);
            sidePanelToggleBtn.title = label;
        };

        const root = document.documentElement;
        const rootProfile = root ? String(root.getAttribute('data-layout-profile') || '').trim() : '';
        const isPhonePortraitProfile = !!(root && root.classList.contains('layout-profile-phone-portrait'))
            || rootProfile === 'layout-profile-phone-portrait';
        applySidePanelCollapsedState(isPhonePortraitProfile);

        if (sidePanelToggleBtn.dataset.sidePanelToggleBound !== '1') {
            sidePanelToggleBtn.addEventListener('click', () => {
                const nextCollapsed = !sidePanel.classList.contains('side-panel-collapsed');
                applySidePanelCollapsedState(nextCollapsed);
            });
            sidePanelToggleBtn.dataset.sidePanelToggleBound = '1';
        }
    }

    // Initialize card UI handlers
    const destroyBtn = document.getElementById('destroy-card-btn');
    const useBtn = document.getElementById('use-card-btn');
    const detailBtn = document.getElementById('toggle-card-detail-btn');
    const passBtn = document.getElementById('pass-btn');
    if (destroyBtn && typeof destroySelectedHandCard === 'function') {
        destroyBtn.addEventListener('click', () => {
            destroySelectedHandCard();
        });
    }
    if (useBtn) {
        useBtn.addEventListener('click', () => {
            if (typeof useSelectedCard === 'function') useSelectedCard();
        });
    }
    if (detailBtn && typeof toggleCardDetailExpanded === 'function') {
        detailBtn.addEventListener('click', toggleCardDetailExpanded);
    }
    if (passBtn && typeof passCurrentTurn === 'function') {
        passBtn.addEventListener('click', passCurrentTurn);
    }

    // Load CPU policy based on CPU level
    if (
        typeof loadCpuPolicy === 'function' &&
        typeof CpuPolicy !== 'undefined' &&
        CpuPolicy &&
        typeof CpuPolicy.loadPolicyForLevel === 'function'
    ) {
        loadCpuPolicy();
    }
    // Load local ONNX model for browser CPU (safe fallback on failure)
    if (typeof initPolicyOnnxModel === 'function') {
        await initPolicyOnnxModel();
    }
    // Load local policy-table model for browser CPU (safe fallback on failure)
    if (typeof initPolicyTableModel === 'function') {
        await initPolicyTableModel();
    }

    // Load LvMax Deep CFR models
    if (typeof initLvMaxModels === 'function' && typeof loadLvMaxModels === 'function') {
        initLvMaxModels();
    }

    // Initialize the game (guarded: resetGame may not be present in minimal test harness)
    try {
        if (typeof resetGame === 'function') resetGame();
    } catch (e) { console.error('[init] resetGame threw', e && e.message); }
    setUiInitializedFlag(true);

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
                        if (typeof UIBootstrap.setLoadedAssetManifest === 'function') {
                            UIBootstrap.setLoadedAssetManifest(manifest, { root: window, dispatch: true });
                        }
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
        _syncPlaybackWindowFlags();

        // If no-anim mode is enabled, ensure flags are not stuck true
        if (window.DISABLE_ANIMATIONS === true) {
            _setPlaybackBusyFlags({
                cardAnimating: false,
                processing: false
            });
        }

        if (debugAllowed) {
            // Telemetry: minimal counters for watchdog and single-writer events
            window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
            window.getTelemetrySnapshot = function () { return Object.assign({}, window.__telemetry__); };
            window.resetTelemetry = function () { window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; };

            const playbackRuntime = _installPlaybackDebugRuntime();

            // Watchdog ping for stuck flags (game/turn-manager.js provides watchdogPing)
            if (typeof window._watchdogIntervalId === 'undefined' || window._watchdogIntervalId === null) {
                window._watchdogIntervalId = setInterval(() => {
                    try {
                        if (typeof watchdogPing === 'function') watchdogPing();
                    } catch (e) { /* ignore */ }
                }, 250);
            }

            if (!playbackRuntime) {
                // Legacy fallback when the playback manager is unavailable.
                if (typeof window._uiMirrorIntervalId === 'undefined' || window._uiMirrorIntervalId === null) {
                    window._uiMirrorIntervalId = setInterval(() => {
                        if (typeof window !== 'undefined') {
                            window.isCardAnimating = _readCardAnimatingFlag();
                            window.isProcessing = _readProcessingFlag();
                        }
                    }, 100);
                }

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
}

// Auto-initialize UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Promise.resolve(initializeUI()).catch((err) => {
        console.error('[init] initializeUI failed', err && err.message ? err.message : err);
    });
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeUI,
        setupSmartSelects: (typeof setupSmartSelects !== 'undefined') ? setupSmartSelects : function () {},
        setupSoundControls: (typeof setupSoundControls !== 'undefined') ? setupSoundControls : function () {},
        setupBgmControls: (typeof setupBgmControls !== 'undefined') ? setupBgmControls : function () {},
        loadCpuPolicy: (typeof loadCpuPolicy !== 'undefined') ? loadCpuPolicy : function () {},
        setUiInitializedFlag
    };
} 

if (typeof window !== 'undefined') {
    window.initializeUI = initializeUI;
}
