(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.UIBootstrap = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    let _uiGlobals = {};
    let _gameDIInstallResult = null;

    function parseCpuCommentaryLog(text) {
        const raw = String(text || '').trim();
        const match = raw.match(/^(黒|白)CPU:\s*(.+)$/);
        if (!match) return null;
        const playerKey = match[1] === '白' ? 'white' : 'black';
        const line = String(match[2] || '').trim();
        if (!line) return null;
        return { playerKey, line };
    }

    function maybeShowCpuSpeechFromLog(text) {
        try {
            if (typeof window === 'undefined') return;
            const parsed = parseCpuCommentaryLog(text);
            if (!parsed) return;
            if (typeof window.showCpuSpeechBubble === 'function') {
                window.showCpuSpeechBubble(parsed.line, { playerKey: parsed.playerKey });
            }
        } catch (e) {
            // ignore speech UI failures to keep log path stable
        }
    }

    function addLog(text) {
        try {
            const logEl = (typeof document !== 'undefined') ? document.getElementById('log') : null;
            if (logEl) {
                const entry = document.createElement('div');
                entry.className = 'logEntry';
                entry.textContent = String(text);
                logEl.appendChild(entry);
                try { logEl.scrollTop = logEl.scrollHeight; } catch (e) { if (logEl && logEl.parentElement) logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight; }
                maybeShowCpuSpeechFromLog(text);
                return;
            }
        } catch (e) {
            // ignore DOM errors
        }
        maybeShowCpuSpeechFromLog(text);
        if (typeof console !== 'undefined' && console.log) console.log('[log]', String(text));
    }

    function updateBgmButtons() {
        try {
            const bgmPlayBtn = (typeof document !== 'undefined') ? document.getElementById('bgmPlayBtn') : null;
            const bgmPauseBtn = (typeof document !== 'undefined') ? document.getElementById('bgmPauseBtn') : null;
            if (typeof SoundEngine !== 'undefined' && SoundEngine.allowBgmPlay && !SoundEngine.bgm?.paused) {
                if (bgmPlayBtn) bgmPlayBtn.classList.add('btn-active');
                if (bgmPauseBtn) bgmPauseBtn.classList.remove('btn-active');
            } else {
                if (bgmPlayBtn) bgmPlayBtn.classList.remove('btn-active');
                if (bgmPauseBtn) bgmPauseBtn.classList.add('btn-active');
            }
        } catch (e) {
            // defensive no-op
        }
    }

    function updateStatus() {
        try {
            if (typeof updateCpuCharacter === 'function') {
                updateCpuCharacter();
            }
        } catch (e) { /* no-op */ }
    }

    function getTransientUIResetRoot() {
        try {
            if (typeof window !== 'undefined' && window) return window;
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
        } catch (e) { /* ignore */ }
        return null;
    }

    function getTransientUIResetDocument() {
        try {
            if (typeof document !== 'undefined' && document) return document;
        } catch (e) { /* ignore */ }
        const root = getTransientUIResetRoot();
        return root && root.document ? root.document : null;
    }

    function getPlaybackStateModuleForReset() {
        const root = getTransientUIResetRoot();
        if (root && root.PlaybackStateManager) return root.PlaybackStateManager;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.PlaybackStateManager) return globalThis.PlaybackStateManager;
        } catch (e) { /* ignore */ }
        try {
            if (typeof require === 'function') return require('./playback-state-manager');
        } catch (e) { /* ignore */ }
        return null;
    }

    function abortAnimationPlaybackForReset() {
        const root = getTransientUIResetRoot();
        try {
            if (root && root.AnimationEngine && typeof root.AnimationEngine.abortAndSync === 'function') {
                root.AnimationEngine.abortAndSync();
            }
        } catch (e) { /* ignore */ }
    }

    function clearPlaybackStateForReset() {
        const root = getTransientUIResetRoot();
        const playbackState = getPlaybackStateModuleForReset();
        let clearedViaManager = false;

        try {
            if (playbackState && typeof playbackState.clearPlaybackLock === 'function') {
                playbackState.clearPlaybackLock();
                clearedViaManager = true;
            }
        } catch (e) { /* ignore */ }

        if (!clearedViaManager && root) {
            try { root.isCardAnimating = false; } catch (e) { /* ignore */ }
            try { root.VisualPlaybackActive = false; } catch (e) { /* ignore */ }
            try { root.__playbackActiveSince = null; } catch (e) { /* ignore */ }
            try { root.__boardUpdateContext = null; } catch (e) { /* ignore */ }
            try { root.__suppressNextDiffFlip = false; } catch (e) { /* ignore */ }
        }

        if (!root) return;
        try { root.__drawHandAnimActive = false; } catch (e) { /* ignore */ }
        try { root.__handSequentialRevealState = null; } catch (e) { /* ignore */ }
        try { delete root._currentPlaybackScope; } catch (e) { try { root._currentPlaybackScope = null; } catch (err) { /* ignore */ } }
    }

    function clearTransientTimersForReset() {
        const root = getTransientUIResetRoot();
        try {
            if (root && root.TimerRegistry && typeof root.TimerRegistry.clearAll === 'function') {
                root.TimerRegistry.clearAll();
            }
        } catch (e) { /* ignore */ }
    }

    function unlockBoardPlaybackForReset() {
        const doc = getTransientUIResetDocument();
        try {
            const board = doc ? doc.getElementById('board') : null;
            if (board) board.classList.remove('playback-locked');
        } catch (e) { /* ignore */ }
    }

    function resetBoardCellTransientState(cell) {
        if (!cell || !cell.querySelectorAll) return;
        try {
            const discs = Array.from(cell.querySelectorAll('.disc'));
            discs.forEach((disc) => {
                try {
                    if (!disc || !disc.classList) return;
                    const shouldRemoveDisc =
                        disc.classList.contains('destroy-fade') ||
                        disc.classList.contains('shatter');
                    if (shouldRemoveDisc) {
                        if (disc.parentElement) disc.parentElement.removeChild(disc);
                        return;
                    }
                    disc.classList.remove('stone-hidden', 'stone-hidden-all', 'stone-instant');
                    disc.style.visibility = 'visible';
                    disc.style.opacity = '';
                } catch (e) { /* ignore */ }
            });

            if (!cell.querySelector('.disc')) {
                cell.classList.remove('has-disc');
            } else {
                cell.classList.add('has-disc');
            }
        } catch (e) { /* ignore */ }
    }

    function removeElementsBySelectorForReset(doc, selector) {
        if (!doc || typeof doc.querySelectorAll !== 'function') return;
        try {
            doc.querySelectorAll(selector).forEach((el) => {
                try { if (el && el.parentElement) el.parentElement.removeChild(el); } catch (e) { /* ignore */ }
            });
        } catch (e) { /* ignore */ }
    }

    function clearDetachedBodyDiscsForReset(doc) {
        if (!doc || !doc.body) return;
        try {
            const bodyChildren = Array.from(doc.body.children);
            bodyChildren.forEach((el) => {
                try {
                    if (!el || !el.classList || !el.classList.contains('disc')) return;
                    const pos = String((el.style && el.style.position) || '').toLowerCase();
                    if (pos === 'fixed' || pos === 'absolute') {
                        if (el.parentElement) el.parentElement.removeChild(el);
                    }
                } catch (e) { /* ignore */ }
            });
        } catch (e) { /* ignore */ }
    }

    function clearBoardTransientDomForReset() {
        const doc = getTransientUIResetDocument();
        if (!doc) return;

        try {
            const board = doc.getElementById('board');
            if (board) {
                board.querySelectorAll('.cell').forEach((cell) => {
                    resetBoardCellTransientState(cell);
                });
            }
        } catch (e) { /* ignore */ }

        try {
            const cardFxLayer = doc.getElementById('card-fx-layer');
            if (cardFxLayer) cardFxLayer.innerHTML = '';
        } catch (e) { /* ignore */ }

        removeElementsBySelectorForReset(doc, '.hyperactive-move-ghost');
        clearDetachedBodyDiscsForReset(doc);
    }

    function removeElementByIdForReset(doc, elementId) {
        if (!doc) return;
        try {
            const element = doc.getElementById(elementId);
            if (element && element.parentElement) element.parentElement.removeChild(element);
        } catch (e) { /* ignore */ }
    }

    function closeTransientPanelsForReset() {
        const doc = getTransientUIResetDocument();
        const root = getTransientUIResetRoot();
        if (!doc) return;

        removeElementByIdForReset(doc, 'result-overlay');

        try {
            const infoPanel = doc.getElementById('stone-info-panel');
            if (infoPanel) infoPanel.classList.remove('visible');
        } catch (e) { /* ignore */ }
        try {
            const infoTagPanel = doc.getElementById('stone-info-tag-panel');
            if (infoTagPanel) infoTagPanel.classList.remove('is-open');
        } catch (e) { /* ignore */ }

        removeElementsBySelectorForReset(doc, '.observer-speech-bubble');

        try {
            const hideCpuSpeechBubbleFn = (typeof hideCpuSpeechBubble === 'function')
                ? hideCpuSpeechBubble
                : (root && typeof root.hideCpuSpeechBubble === 'function' ? root.hideCpuSpeechBubble : null);
            if (hideCpuSpeechBubbleFn) hideCpuSpeechBubbleFn();
        } catch (e) { /* ignore */ }
    }

    function removeNonPreservedChildren(parent, preservedChildren) {
        if (!parent || !parent.children) return;
        const preserved = new Set((preservedChildren || []).filter(Boolean));
        Array.from(parent.children).forEach((child) => {
            try {
                if (!preserved.has(child) && child.parentElement === parent) {
                    child.parentElement.removeChild(child);
                }
            } catch (e) { /* ignore */ }
        });
    }

    function resetHandAnimationUiForReset() {
        const doc = getTransientUIResetDocument();
        if (!doc) return;

        try {
            const handLayerEl = doc.getElementById('handLayer');
            const handWrapperEl = doc.getElementById('handWrapper');
            const handSvgEl = doc.getElementById('handSvg');
            const heldStoneEl = doc.getElementById('heldStone');

            if (handLayerEl) {
                handLayerEl.style.display = 'none';
                removeNonPreservedChildren(handLayerEl, [handWrapperEl]);
            }
            if (handWrapperEl) {
                handWrapperEl.style.transform = '';
                handWrapperEl.style.display = 'none';
                removeNonPreservedChildren(handWrapperEl, [handSvgEl, heldStoneEl]);
            }
            if (handSvgEl) handSvgEl.style.visibility = '';
            if (heldStoneEl) {
                heldStoneEl.innerHTML = '';
                heldStoneEl.style.display = 'none';
            }
        } catch (e) { /* ignore */ }
    }

    function resetRenderStatsForReset() {
        const root = getTransientUIResetRoot();
        try {
            const resetRenderStatsFn = (typeof resetRenderStats === 'function')
                ? resetRenderStats
                : (root && typeof root.resetRenderStats === 'function' ? root.resetRenderStats : null);
            if (resetRenderStatsFn) resetRenderStatsFn();
        } catch (e) { /* ignore */ }
    }

    function runResetTransientUIStateCleanup() {
        // Keep abort first so any final sync can consume pending diff context before we clear playback state.
        [
            abortAnimationPlaybackForReset,
            clearPlaybackStateForReset,
            clearTransientTimersForReset,
            unlockBoardPlaybackForReset,
            clearBoardTransientDomForReset,
            closeTransientPanelsForReset,
            resetHandAnimationUiForReset,
            resetRenderStatsForReset
        ].forEach((step) => {
            try { step(); } catch (e) { /* ignore */ }
        });
    }

    // export to global/window for non-module callers
    if (typeof window !== 'undefined') {
        try { window.addLog = addLog; } catch (e) {}
        try { window.updateBgmButtons = updateBgmButtons; } catch (e) {}
        try { window.updateStatus = updateStatus; } catch (e) {}
    }

    // DI: Install game-side implementations (timers, UI helpers)
    function installGameDI() {
        if (_gameDIInstallResult) return _gameDIInstallResult;
        try {
            if (typeof document !== 'undefined' && document.documentElement && document.documentElement.classList) {
                document.documentElement.classList.add('stone-shadow-enabled');
            }
        } catch (e) { /* ignore */ }

        // Ensure BoardOps is available globally for presentation/event wiring
        try {
            if (typeof globalThis !== 'undefined' && !globalThis.BoardOps) {
                const boardOps = require('../game/logic/board_ops');
                if (boardOps) globalThis.BoardOps = boardOps;
            }
        } catch (e) { /* ignore in non-module UI contexts */ }

        // Timers implementation using browser timing APIs
        const timersImpl = {
            waitMs: (ms) => new Promise((resolve) => {
                try {
                    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') return window.setTimeout(resolve, ms);
                    return setTimeout(resolve, ms);
                } catch (e) { setTimeout(resolve, ms); }
            }),
            requestFrame: () => new Promise((resolve) => {
                try {
                    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(resolve);
                    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') return window.requestAnimationFrame(resolve);
                    setTimeout(resolve, 0);
                } catch (e) { setTimeout(resolve, 0); }
            })
        };

        // Inject into game/timers when available (one-time)
        try {
            const root = (typeof globalThis !== 'undefined') ? globalThis : null;
            const alreadyInjected = !!(root && root.__timersInjected);
            if (!alreadyInjected) {
                const gameTimers = require('../game/timers');
                if (gameTimers && typeof gameTimers.setTimerImpl === 'function') {
                    gameTimers.setTimerImpl(timersImpl);
                    if (root) root.__timersInjected = true;
                }
            }
        } catch (e) { /* ignore in non-module UI contexts */ }

        // Helper to connect UI modules to their game counterparts
        const connect = (uiPath, gamePath, mapFn) => {
            try {
                const uiMod = require(uiPath);
                const gameMod = require(gamePath);
                if (gameMod && typeof gameMod.setUIImpl === 'function') {
                    const impl = mapFn ? mapFn(uiMod, timersImpl) : uiMod;
                    gameMod.setUIImpl(impl || {});
                }
            } catch (e) { /* ignore missing modules in headless contexts */ }
        };

        // Move visuals
        connect('./move-executor-visuals', '../game/move-executor-visuals', (uiMod) => ({
            applyFlipAnimations: uiMod.applyFlipAnimations,
            setDiscColorAt: uiMod.setDiscColorAt,
            removeBombOverlayAt: uiMod.removeBombOverlayAt,
            clearAllStoneVisualEffectsAt: uiMod.clearAllStoneVisualEffectsAt,
            syncDiscVisualToCurrentState: uiMod.syncDiscVisualToCurrentState,
            getFlipAnimMs: uiMod.getFlipAnimMs,
            getPhaseGapMs: uiMod.getPhaseGapMs,
            getTurnTransitionGapMs: uiMod.getTurnTransitionGapMs,
            animateFlipsWithDeferredColor: uiMod.animateFlipsWithDeferredColor,
            animateRegenBack: uiMod.animateRegenBack,
            applyPendingSpecialstoneVisual: uiMod.applyPendingSpecialstoneVisual,
            runMoveVisualSequence: uiMod.runMoveVisualSequence
        }));

        // Provide scheduling helper to game/move-executor so CPU turns are delayed to allow visuals to complete
        connect('./move-executor-visuals', '../game/move-executor', (uiMod, timers) => ({
            scheduleCpuTurn: (ms, cb) => { return timers.waitMs(ms || 0).then(cb); },
            now: () => Date.now(),
            // Let game/move-executor await the UI playback lifecycle (AnimationEngine / visual writer)
            waitForPlayback: uiMod.waitForPlaybackIdle,
            emitPresentationEvent: (ev) => {
                try {
                    if (typeof globalThis === 'undefined') return false;
                    const cardStateRef = (globalThis.cardState && typeof globalThis.cardState === 'object')
                        ? globalThis.cardState
                        : null;
                    const boardOps = (globalThis.BoardOps && typeof globalThis.BoardOps.emitPresentationEvent === 'function')
                        ? globalThis.BoardOps
                        : null;
                    if (!cardStateRef || !boardOps) return false;
                    boardOps.emitPresentationEvent(cardStateRef, ev);
                    return true;
                } catch (e) {
                    return false;
                }
            }
        }));

        // Visual effects map
        connect('./visual-effects-map', '../game/visual-effects-map', (uiMod) => ({
            applyStoneVisualEffect: uiMod.applyStoneVisualEffect,
            removeStoneVisualEffect: uiMod.removeStoneVisualEffect,
            getSupportedEffectKeys: uiMod.getSupportedEffectKeys,
            __setSpecialStoneScaleImpl__: uiMod.__setSpecialStoneScaleImpl__ || function(scale) { if (typeof window !== 'undefined' && window.setSpecialStoneScale) window.setSpecialStoneScale(scale); }
        }));

        // Trap placement flash stays in UI and is invoked from game via DI.
        connect('./animation-utils', '../game/card-effects/trap', (uiMod) => ({
            playTrapPlacementFlash: uiMod.playTrapPlacementFlash
        }));

        // Turn manager helpers (readCpuSmartness / scheduleCpuTurn / isDocumentHidden / pulseDeckUI)
        try {
            const tm = require('../game/turn-manager');
            if (tm && typeof tm.setUIImpl === 'function') {
                tm.setUIImpl({
                    readCpuSmartness: () => ({ black: 1, white: 1 }),
                    isDocumentHidden: () => (typeof document !== 'undefined' && document.hidden) || false,
                    pulseDeckUI: () => {},
                    scheduleCpuTurn: (ms, cb) => { timersImpl.waitMs(ms || 0).then(cb); },
                    resetTransientUIState: () => { runResetTransientUIStateCleanup(); },
                    clearLogUI: () => {
                        try {
                            const el = (typeof document !== 'undefined') ? document.getElementById('log') : null;
                            if (el) el.innerHTML = '';
                        } catch (e) { /* ignore */ }
                        try {
                            if (typeof globalThis !== 'undefined' && typeof globalThis.clearEffectLivePanel === 'function') {
                                globalThis.clearEffectLivePanel();
                                return;
                            }
                        } catch (e) { /* ignore */ }
                        try {
                            const effectEl = (typeof document !== 'undefined') ? document.getElementById('effect-live-lines') : null;
                            if (effectEl) effectEl.innerHTML = '';
                        } catch (e) { /* ignore */ }
                    }
                });
            }
        } catch (e) { /* ignore */ }

        // Early registration: if the CPU turn handler is available on the game side, register its
        // processCpuTurn/processAutoBlackTurn to UIBootstrap so UI consumers can schedule CPU
        // turns immediately without waiting for other bootstrap steps. This avoids boot-order
        // races where a SCHEDULE_CPU_TURN event would otherwise go unhandled.
        try {
            const cpu = require('../game/cpu-turn-handler');
            if (cpu) {
                const cpuGlobals = {};
                if (typeof cpu.processCpuTurn === 'function') cpuGlobals.processCpuTurn = cpu.processCpuTurn;
                if (typeof cpu.processAutoBlackTurn === 'function') cpuGlobals.processAutoBlackTurn = cpu.processAutoBlackTurn;
                if (Object.keys(cpuGlobals).length) {
                    try { registerUIGlobals(cpuGlobals); } catch (e) { /* ignore */ }
                    try { if (typeof globalThis !== 'undefined') { if (cpuGlobals.processCpuTurn) globalThis.processCpuTurn = cpuGlobals.processCpuTurn; if (cpuGlobals.processAutoBlackTurn) globalThis.processAutoBlackTurn = cpuGlobals.processAutoBlackTurn; } } catch (e) { /* ignore */ }
                }
            }
        } catch (e) { /* ignore */ }

        // Action log storage adapter (UI-only localStorage access)
        try {
            const am = require('../game/schema/action_manager');
            const storage = require('./storage/action-log');
            if (am && typeof am.setStorageAdapter === 'function' && storage) {
                am.setStorageAdapter(storage);
            }
        } catch (e) { /* ignore */ }

        // Special-effects UI hooks: many modules accept setUIImpl; wire basic helpers
        const specialModules = ['../game/special-effects/breeding', '../game/special-effects/dragons', '../game/special-effects/hyperactive'];
        for (const p of specialModules) {
            try {
                const m = require(p);
                if (m && typeof m.setUIImpl === 'function') {
                    m.setUIImpl({ /* currently no-op placeholders; UI modules provide visuals */ });
                }
            } catch (e) { /* ignore */ }
        }

        function preloadAssets(manifest, opts = {}) {
            opts = Object.assign({ timeoutMs: 5000 }, opts || {});
            const required = (manifest && manifest.files) ? manifest.files.map(f => f.path) : [];
            if (!required.length) return Promise.resolve({ success: true, loaded: [], failed: [] });
            const loaded = [];
            const failed = [];

            return new Promise((resolve) => {
                let remaining = required.length;
                const checkDone = () => {
                    if (remaining <= 0) {
                        if (failed.length === 0) {
                            try {
                                if (typeof document !== 'undefined' && document.documentElement && document.documentElement.classList) {
                                    document.documentElement.classList.add('stone-images-loaded');
                                    document.documentElement.classList.add('stone-shadow-enabled');
                                    // After declaring images as loaded, ensure existing discs have per-disc overlay var set
                                    try {
                                        const discs = Array.from(document.querySelectorAll('.disc.black, .disc.white')) || [];
                                        for (const d of discs) {
                                            try {
                                                if (typeof window !== 'undefined' && typeof window.setDiscStoneImage === 'function') {
                                                    // Attempt to use canonical helper
                                                    window.setDiscStoneImage(d, d.classList && d.classList.contains('black') ? BLACK : WHITE);
                                                } else {
                                                    // Best-effort fallback
                                                    const val = (d.classList && d.classList.contains('black')) ? 'var(--normal-stone-black-image)' : 'var(--normal-stone-white-image)';
                                                    try { d.style.setProperty('--stone-image', val); } catch (e) { }
                                                }
                                            } catch (e) { /* ignore per-disc errors */ }
                                        }
                                    } catch (e) { /* ignore */ }
                                }
                            } catch (e) {}
                            resolve({ success: true, loaded, failed });
                        } else {
                            resolve({ success: false, loaded, failed });
                        }
                    }
                };

                for (const src of required) {
                    try {
                        const img = new Image();
                        let timedOut = false;
                        const to = setTimeout(() => {
                            timedOut = true;
                            failed.push({ src, reason: 'timeout' });
                            remaining -= 1;
                            checkDone();
                        }, opts.timeoutMs);
                        img.onload = () => {
                            if (timedOut) return;
                            clearTimeout(to);
                            loaded.push(src);
                            remaining -= 1;
                            checkDone();
                        };
                        img.onerror = () => {
                            if (timedOut) return;
                            clearTimeout(to);
                            failed.push({ src, reason: 'error' });
                            remaining -= 1;
                            checkDone();
                        };
                        img.src = src;
                    } catch (e) {
                        failed.push({ src, reason: String(e) });
                        remaining -= 1;
                        checkDone();
                    }
                }
            });
        }

        /**
         * Apply an asset manifest received from server as part of game init.
         * policy = { mode: 'compat'|'strict' } - compat allows fallback, strict rejects on failure
         * Returns an object: { status: 'ok'|'fallback'|'error', details }
         */
        _gameDIInstallResult = { timersImpl, registerUIGlobals, preloadAssets };
        return _gameDIInstallResult;
    }

    // Register UI globals so game modules can access canonical UI implementations.
    function registerUIGlobals(obj) {
        _uiGlobals = Object.assign(_uiGlobals, obj || {});
        // For backward compatibility, mirror to window where appropriate
        try {
            if (typeof window !== 'undefined') {
                for (const k of Object.keys(obj || {})) {
                    try { window[k] = obj[k]; } catch (e) { /* ignore */ }
                }
            }
        } catch (e) { /* ignore */ }
        return _uiGlobals;
    }
    function getRegisteredUIGlobals() {
        return Object.assign({}, _uiGlobals);
    }
    function isGameDIInstalled() {
        return !!_gameDIInstallResult;
    }

    function preloadAssets(manifest, opts) {
        try {
            const impl = installGameDI();
            return impl.preloadAssets(manifest, opts);
        } catch (e) {
            return Promise.resolve({ success: false, loaded: [], failed: [{ reason: String(e) }] });
        }
    }

    async function applyAssetManifest(manifest, policy = { mode: 'compat' }, opts = {}) {
        if (!manifest || !manifest.files) return { status: 'error', details: 'invalid manifest' };
        try {
            const res = await preloadAssets(manifest, opts || {});
            if (res.success) {
                return { status: 'ok', details: res };
            }
            // failed to preload some assets
            if (policy && policy.mode === 'strict') {
                return { status: 'error', details: res };
            }
            // compat mode: log and continue with fallback
            try { if (typeof console !== 'undefined' && console.warn) console.warn('[ASSET_MANIFEST] preload incomplete, using fallback', res.failed); } catch (e) {}
            return { status: 'fallback', details: res };
        } catch (e) {
            return { status: 'error', details: String(e) };
        }
    }

    // Handler to be called with the server-sent GameInit payload
    // payload may include assetManifest and other init fields
    async function handleGameInit(payload, opts = { assetPolicy: { mode: 'compat' } }) {
        if (!payload) return { status: 'no_payload' };
        if (payload.assetManifest) {
            const res = await applyAssetManifest(payload.assetManifest, opts.assetPolicy || { mode: 'compat' }, opts);
            try { if (typeof window !== 'undefined') window.__assetManifestStatus = res; } catch (e) {}
            return { status: 'asset_manifest_handled', result: res };
        }
        return { status: 'no_asset_manifest' };
    }

    if (typeof module !== 'undefined' && module.exports) {
        return { addLog, updateBgmButtons, updateStatus, installGameDI, isGameDIInstalled, registerUIGlobals, getRegisteredUIGlobals, preloadAssets, applyAssetManifest, handleGameInit };
    }

    return { addLog, updateBgmButtons, updateStatus, installGameDI, isGameDIInstalled, registerUIGlobals, getRegisteredUIGlobals, preloadAssets, applyAssetManifest, handleGameInit };
}));


