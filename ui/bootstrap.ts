// @ts-nocheck
import type { CardState, GameState, PlayerKey } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

'use strict';

    let _uiGlobals = {};
    let _gameDIInstallResult = null;
    let _stoneBaseImagesReadyPromise = null;
    let _loadedAssetManifest = null;
    const ASSET_MANIFEST_UPDATED_EVENT = 'asset-manifest:updated';
    const STONE_BASE_IMAGE_PATHS = [
        'assets/images/stones/normal_stone-black.png',
        'assets/images/stones/normal_stone-white.png'
    ];

    function getDocumentClassList() {
        try {
            if (typeof document !== 'undefined' && document && document.documentElement && document.documentElement.classList) {
                return document.documentElement.classList;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function classListAddSafe(className) {
        const classList = getDocumentClassList();
        if (!classList || typeof classList.add !== 'function') return false;
        try {
            classList.add(className);
            return true;
        } catch (e) {
            return false;
        }
    }

    function classListRemoveSafe(className) {
        const classList = getDocumentClassList();
        if (!classList) return false;
        try {
            if (typeof classList.remove === 'function') {
                classList.remove(className);
                return true;
            }
            if (classList.added && Object.prototype.hasOwnProperty.call(classList.added, className)) {
                delete classList.added[className];
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function classListContainsSafe(className) {
        const classList = getDocumentClassList();
        if (!classList) return false;
        try {
            if (typeof classList.contains === 'function') return !!classList.contains(className);
            if (classList.added) return !!classList.added[className];
        } catch (e) { /* ignore */ }
        return false;
    }

    function getDiscOwnerDescriptor(disc) {
        const isWhite = !!(disc && disc.classList && typeof disc.classList.contains === 'function' && disc.classList.contains('white'));
        return isWhite
            ? {
                imageVar: 'var(--normal-stone-white-image)',
                fallbackColor: '#ffffff'
            }
            : {
                imageVar: 'var(--normal-stone-black-image)',
                fallbackColor: '#050505'
            };
    }

    function syncDiscBaseImageAssignment(disc) {
        if (!disc || !disc.style || typeof disc.style.setProperty !== 'function') return;
        const owner = getDiscOwnerDescriptor(disc);
        try { disc.style.setProperty('--stone-image', owner.imageVar); } catch (e) { /* ignore */ }
        try { disc.style.setProperty('--disc-base-image', owner.imageVar); } catch (e) { /* ignore */ }
        try {
            if (!disc.dataset.renderMode) disc.dataset.renderMode = 'base-only';
            if (!disc.dataset.effect) disc.dataset.effect = 'normal';
        } catch (e) { /* ignore */ }
    }

    function syncDiscImageFallbackState(disc, options = {}) {
        if (!disc || !disc.style || typeof disc.style.setProperty !== 'function') return;
        const owner = getDiscOwnerDescriptor(disc);
        const baseImagesReady = Object.prototype.hasOwnProperty.call(options, 'baseImagesReady')
            ? !!options.baseImagesReady
            : classListContainsSafe('stone-base-images-ready');
        try { disc.dataset.imageState = baseImagesReady ? 'loaded' : 'fallback'; } catch (e) { /* ignore */ }
        try {
            disc.style.setProperty('--disc-base-fallback-color', baseImagesReady ? 'transparent' : owner.fallbackColor);
        } catch (e) { /* ignore */ }
    }

    function refreshExistingDiscImagePresentation(options = {}) {
        if (typeof document === 'undefined' || !document || typeof document.querySelectorAll !== 'function') return;
        const discs = Array.from(document.querySelectorAll('.disc.black, .disc.white')) || [];
        discs.forEach((disc) => {
            try {
                if (options.assignBaseImage) syncDiscBaseImageAssignment(disc);
                syncDiscImageFallbackState(disc, options);
            } catch (e) { /* ignore per-disc errors */ }
        });
    }

    function preloadImageList(paths, opts = {}) {
        const required = Array.isArray(paths) ? paths.filter(Boolean) : [];
        const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 5000;
        if (!required.length) return Promise.resolve({ success: true, loaded: [], failed: [] });
        const loaded = [];
        const failed = [];

        return new Promise((resolve) => {
            let remaining = required.length;
            const checkDone = () => {
                if (remaining <= 0) {
                    resolve({ success: failed.length === 0, loaded, failed });
                }
            };

            required.forEach((src) => {
                try {
                    const img = new Image();
                    let timedOut = false;
                    const to = setTimeout(() => {
                        timedOut = true;
                        failed.push({ src, reason: 'timeout' });
                        remaining -= 1;
                        checkDone();
                    }, timeoutMs);
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
            });
        });
    }

    function preloadSpecialStoneVisuals() {
        const rootScope = (typeof globalThis !== 'undefined' && globalThis)
            ? globalThis
            : ((typeof window !== 'undefined' && window) ? window : null);
        if (!rootScope) {
            return { attempted: false, reason: 'no_root', effectKeys: [], started: [], skipped: [] };
        }

        const preloadFn = (typeof rootScope.preloadStoneVisualEffectKeys === 'function')
            ? rootScope.preloadStoneVisualEffectKeys
            : null;
        const getSupportedEffectKeysFn = (typeof rootScope.getSupportedEffectKeys === 'function')
            ? rootScope.getSupportedEffectKeys
            : null;
        if (!preloadFn || !getSupportedEffectKeysFn) {
            return { attempted: false, reason: 'api_unavailable', effectKeys: [], started: [], skipped: [] };
        }

        let effectKeys = [];
        try {
            const supportedEffectKeys = getSupportedEffectKeysFn();
            effectKeys = Array.from(new Set(
                (Array.isArray(supportedEffectKeys) ? supportedEffectKeys : [])
                    .map((key) => String(key || '').trim())
                    .filter((key) => !!key && key !== 'normal')
            ));
        } catch (e) {
            return { attempted: false, reason: 'effect_keys_failed', error: String(e), effectKeys: [], started: [], skipped: [] };
        }
        if (!effectKeys.length) {
            return { attempted: false, reason: 'no_effect_keys', effectKeys: [], started: [], skipped: [] };
        }

        try {
            const result = preloadFn(effectKeys) || {};
            return {
                attempted: true,
                effectKeys,
                started: Array.isArray(result.started) ? result.started : [],
                skipped: Array.isArray(result.skipped) ? result.skipped : []
            };
        } catch (e) {
            return {
                attempted: false,
                reason: 'preload_failed',
                error: String(e),
                effectKeys,
                started: [],
                skipped: []
            };
        }
    }

    function ensureStoneBaseImagesReady(opts = {}) {
        if (classListContainsSafe('stone-base-images-ready')) {
            return Promise.resolve({ success: true, loaded: STONE_BASE_IMAGE_PATHS.slice(), failed: [] });
        }
        if (_stoneBaseImagesReadyPromise) return _stoneBaseImagesReadyPromise;
        _stoneBaseImagesReadyPromise = preloadImageList(STONE_BASE_IMAGE_PATHS, opts).then((res) => {
            if (res && res.success) {
                classListAddSafe('stone-base-images-ready');
                refreshExistingDiscImagePresentation({ assignBaseImage: true, baseImagesReady: true });
                return res;
            }
            classListRemoveSafe('stone-base-images-ready');
            refreshExistingDiscImagePresentation({ baseImagesReady: false });
            _stoneBaseImagesReadyPromise = null;
            return res;
        }).catch((e) => {
            classListRemoveSafe('stone-base-images-ready');
            refreshExistingDiscImagePresentation({ baseImagesReady: false });
            _stoneBaseImagesReadyPromise = null;
            return { success: false, loaded: [], failed: [{ reason: String(e) }] };
        });
        return _stoneBaseImagesReadyPromise;
    }

    function readDebugQueryString() {
        try {
            if (typeof location !== 'undefined' && location && typeof location.search === 'string') {
                return location.search;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && window.location && typeof window.location.search === 'string') {
                return window.location.search;
            }
        } catch (e) { /* ignore */ }
        return '';
    }

    function isDebugSessionEnabled() {
        const seed = (_uiGlobals && typeof _uiGlobals === 'object') ? _uiGlobals : {};
        if (seed.DEBUG_UNLIMITED_USAGE === true) return true;
        if (seed.DEBUG_MODE_ALLOWED === true) return true;
        if (seed.DEBUG_MODE_ALLOWED === false) return false;
        const query = readDebugQueryString();
        return /[?&]debug=1(?:&|$)/.test(query) || /[?&]debug=true(?:&|$)/i.test(query);
    }

    function setDebugLogTarget(target, enabled) {
        if (!target || typeof target !== 'object') return;
        if (enabled) {
            try {
                target.debugLog = debugLog;
                return;
            } catch (e) { /* ignore */ }
        }
        try {
            delete target.debugLog;
        } catch (e) {
            try { target.debugLog = undefined; } catch (ignored) { /* ignore */ }
        }
    }

    function syncDebugLogAvailability() {
        const enabled = isDebugSessionEnabled();
        try {
            if (typeof window !== 'undefined' && window) {
                setDebugLogTarget(window, enabled);
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis) {
                setDebugLogTarget(globalThis, enabled);
            }
        } catch (e) { /* ignore */ }
        return enabled;
    }

    function debugLog(message, level, meta) {
        if (!isDebugSessionEnabled()) return false;
        const logLevel = String(level || 'debug').trim().toLowerCase() || 'debug';
        const consoleRef = (typeof console !== 'undefined' && console) ? console : null;
        const writer = consoleRef && typeof consoleRef[logLevel] === 'function'
            ? consoleRef[logLevel].bind(consoleRef)
            : (consoleRef && typeof consoleRef.log === 'function' ? consoleRef.log.bind(consoleRef) : null);
        if (!writer) return false;
        if (arguments.length >= 3) {
            writer(`[debug:${logLevel}]`, message, meta);
        } else {
            writer(`[debug:${logLevel}]`, message);
        }
        return true;
    }

    function addLog(text) {
        const resolvedText = (text && typeof text === 'object' && typeof text.text === 'string')
            ? String(text.text)
            : String(text);
        let appendedToDom = false;
        try {
            const logEl = (typeof document !== 'undefined') ? document.getElementById('log') : null;
            if (logEl) {
                const entry = document.createElement('div');
                entry.className = 'logEntry';
                entry.textContent = resolvedText;
                logEl.appendChild(entry);
                try { logEl.scrollTop = logEl.scrollHeight; } catch (e) { if (logEl && logEl.parentElement) logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight; }
                appendedToDom = true;
            }
        } catch (e) {
            // ignore DOM errors
        }
        if ((!appendedToDom || isDebugSessionEnabled()) && typeof console !== 'undefined' && console.log) {
            console.log('[log]', resolvedText);
        }
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

    function resolveSharedUIBootstrapHelpers() {
        try {
            if (typeof require === 'function') {
                const sharedBootstrap = require('../shared/ui-bootstrap-shared');
                if (sharedBootstrap && typeof sharedBootstrap === 'object') {
                    return sharedBootstrap;
                }
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.SharedUIBootstrap) {
                return globalThis.SharedUIBootstrap;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function getPlaybackStateModuleForReset() {
        const sharedBootstrap = resolveSharedUIBootstrapHelpers();
        if (sharedBootstrap && typeof sharedBootstrap.resolvePlaybackStateManager === 'function') {
            const resolved = sharedBootstrap.resolvePlaybackStateManager(getTransientUIResetRoot());
            if (resolved) return resolved;
        }
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
            if (playbackState && typeof playbackState.abortPlayback === 'function') {
                playbackState.abortPlayback();
                clearedViaManager = true;
            } else if (playbackState && typeof playbackState.clearPlaybackLock === 'function') {
                playbackState.clearPlaybackLock();
                clearedViaManager = true;
            }
        } catch (e) { /* ignore */ }

        if (!clearedViaManager && root) {
            try { root.isCardAnimating = false; } catch (e) { /* ignore */ }
            try { root.VisualPlaybackActive = false; } catch (e) { /* ignore */ }
            try { root.__playbackActiveSince = null; } catch (e) { /* ignore */ }
            try { root.__boardUpdateContext = null; } catch (e) { /* ignore */ }
        }

        if (!root) return;
        try { root.__drawHandAnimActive = false; } catch (e) { /* ignore */ }
        try { root.__handSequentialRevealState = null; } catch (e) { /* ignore */ }
        try { delete root._currentPlaybackScope; } catch (e) { try { root._currentPlaybackScope = null; } catch (err) { /* ignore */ } }
    }

    function resolvePendingSelectionFlowModule() {
        try {
            if (typeof require === 'function') {
                const selectionFlowModule = require('../game/card-effects/selection-flow');
                if (selectionFlowModule && typeof selectionFlowModule.setSignalBridge === 'function') {
                    return selectionFlowModule;
                }
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow && typeof globalThis.PendingSelectionFlow.setSignalBridge === 'function') {
                return globalThis.PendingSelectionFlow;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolvePresentationHelperModule() {
        try {
            if (typeof require === 'function') {
                const presentationHelperModule = require('../game/logic/presentation');
                if (presentationHelperModule && typeof presentationHelperModule.emitPresentationEvent === 'function') {
                    return presentationHelperModule;
                }
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.PresentationHelper && typeof globalThis.PresentationHelper.emitPresentationEvent === 'function') {
                return globalThis.PresentationHelper;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function buildPendingSelectionFlowBridge() {
        return {
            getPlaybackStateManager: () => getPlaybackStateModuleForReset(),
            waitForPlaybackIdle: () => {
                try {
                    if (typeof globalThis !== 'undefined' && typeof globalThis.waitForPlaybackIdle === 'function') {
                        return globalThis.waitForPlaybackIdle();
                    }
                } catch (e) { /* ignore */ }
                return undefined;
            },
            publishSnapshot: (meta) => {
                try {
                    if (typeof globalThis === 'undefined' || !globalThis.NetworkMatchClient) return undefined;
                    if (typeof globalThis.NetworkMatchClient.publishSnapshot !== 'function') return undefined;
                    if (typeof globalThis.NetworkMatchClient.isActive === 'function' && !globalThis.NetworkMatchClient.isActive()) {
                        return undefined;
                    }
                    return globalThis.NetworkMatchClient.publishSnapshot(meta);
                } catch (e) {
                    return undefined;
                }
            },
            isNetworkPublishActive: () => {
                try {
                    if (typeof globalThis === 'undefined' || !globalThis.NetworkMatchClient) return false;
                    if (typeof globalThis.NetworkMatchClient.publishSnapshot !== 'function') return false;
                    if (typeof globalThis.NetworkMatchClient.isActive === 'function') {
                        return globalThis.NetworkMatchClient.isActive() === true;
                    }
                    return true;
                } catch (e) {
                    return false;
                }
            },
            emitPlaybackEvents: (events, meta, cardStateValue) => {
                if (!Array.isArray(events) || events.length === 0) return false;
                try {
                    const presentationHelper = resolvePresentationHelperModule();
                    if (!presentationHelper || typeof presentationHelper.emitPresentationEvent !== 'function') {
                        return false;
                    }
                    return presentationHelper.emitPresentationEvent(cardStateValue || (typeof globalThis !== 'undefined' ? globalThis.cardState : null), {
                        type: 'PLAYBACK_EVENTS',
                        events,
                        meta: (meta && typeof meta === 'object') ? meta : {}
                    }) === true;
                } catch (e) {
                    return false;
                }
            },
            emitStateChanges: () => {
                const signalNames = ['emitCardStateChange', 'emitBoardUpdate', 'emitGameStateChange'];
                let emitted = false;
                for (let index = 0; index < signalNames.length; index += 1) {
                    try {
                        if (typeof globalThis === 'undefined') continue;
                        const signalFn = globalThis[signalNames[index]];
                        if (typeof signalFn !== 'function') continue;
                        signalFn();
                        emitted = true;
                    } catch (e) { /* ignore */ }
                }
                return emitted;
            },
            emitMessage: (text) => {
                if (!text) return false;
                try {
                    if (typeof globalThis === 'undefined' || typeof globalThis.emitLogAdded !== 'function') {
                        return false;
                    }
                    globalThis.emitLogAdded(text);
                    return true;
                } catch (e) {
                    return false;
                }
            },
            emitBoardUpdate: () => {
                try {
                    if (typeof globalThis === 'undefined' || typeof globalThis.emitBoardUpdate !== 'function') {
                        return false;
                    }
                    globalThis.emitBoardUpdate();
                    return true;
                } catch (e) {
                    return false;
                }
            }
        };
    }

    function configurePendingSelectionFlowBridge() {
        try {
            const selectionFlow = resolvePendingSelectionFlowModule();
            if (!selectionFlow || typeof selectionFlow.setSignalBridge !== 'function') return false;
            selectionFlow.setSignalBridge(buildPendingSelectionFlowBridge());
            return true;
        } catch (e) {
            return false;
        }
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
        try {
            const hideHeroSpeechBubbleFn = (typeof hideHeroSpeechBubble === 'function')
                ? hideHeroSpeechBubble
                : (root && typeof root.hideHeroSpeechBubble === 'function' ? root.hideHeroSpeechBubble : null);
            if (hideHeroSpeechBubbleFn) hideHeroSpeechBubbleFn();
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
            const handImageEl = doc.getElementById('handImage');
            const heldStoneEl = doc.getElementById('heldStone');

            if (handLayerEl) {
                handLayerEl.style.display = 'none';
                removeNonPreservedChildren(handLayerEl, [handWrapperEl]);
            }
            if (handWrapperEl) {
                handWrapperEl.style.transform = '';
                handWrapperEl.style.display = 'none';
                removeNonPreservedChildren(handWrapperEl, [handImageEl, heldStoneEl]);
            }
            if (handImageEl) handImageEl.style.visibility = '';
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
    syncDebugLogAvailability();

    // DI: Install game-side implementations (timers, UI helpers)
    function _makeTimersImpl() {
        return {
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
    }

    function _connect(uiPath, gamePath, mapFn, timersImpl) {
        try {
            const uiMod = require(uiPath);
            const gameMod = require(gamePath);
            if (gameMod && typeof gameMod.setUIImpl === 'function') {
                const impl = mapFn ? mapFn(uiMod, timersImpl) : uiMod;
                gameMod.setUIImpl(impl || {});
            }
        } catch (e) { /* ignore missing modules in headless contexts */ }
    }

    function installCoreDI() {
        try {
            classListAddSafe('stone-shadow-enabled');
        } catch (e) { /* ignore */ }
        try { ensureStoneBaseImagesReady({ timeoutMs: 5000 }); } catch (e) { /* ignore */ }
        try { preloadSpecialStoneVisuals(); } catch (e) { /* ignore */ }

        const timersImpl = _makeTimersImpl();

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

        return timersImpl;
    }

    function installCardDI() {
        // Trap placement flash stays in UI and is invoked from game via DI.
        _connect('./animation-utils', '../game/card-effects/trap', (uiMod) => ({
            playTrapPlacementFlash: uiMod.playTrapPlacementFlash
        }));

        configurePendingSelectionFlowBridge();

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
    }

    function installNetworkDI() {
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

        // Commentary broker initialization
        try {
            const commentaryBroker = require('./commentary-broker');
            if (commentaryBroker && typeof commentaryBroker.initBroker === 'function') {
                commentaryBroker.initBroker({
                    root: (typeof globalThis !== 'undefined') ? globalThis : null,
                    addLog,
                    getShowHeroSpeechBubble: () => {
                        try {
                            if (typeof window !== 'undefined' && typeof window.showHeroSpeechBubble === 'function') {
                                return window.showHeroSpeechBubble;
                            }
                        } catch (e) { /* ignore */ }
                        return null;
                    },
                    getShowCpuSpeechBubble: () => {
                        try {
                            if (typeof window !== 'undefined' && typeof window.showCpuSpeechBubble === 'function') {
                                return window.showCpuSpeechBubble;
                            }
                        } catch (e) { /* ignore */ }
                        return null;
                    }
                });
            }
        } catch (e) { /* ignore */ }
    }

    function installUIDI(timersImpl) {
        // Move visuals
        _connect('./move-executor-visuals', '../game/move-executor-visuals', (uiMod) => ({
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
            animateFadeOutAt: uiMod.animateFadeOutAt,
            animateDestroyAt: uiMod.animateDestroyAt,
            animateHyperactiveMove: uiMod.animateHyperactiveMove,
            animateHyperactiveMoveChain: uiMod.animateHyperactiveMoveChain,
            hasPlaybackEngine: uiMod.hasPlaybackEngine,
            applyPendingSpecialstoneVisual: uiMod.applyPendingSpecialstoneVisual,
            runMoveVisualSequence: uiMod.runMoveVisualSequence
        }), timersImpl);

        // Provide scheduling helper to game/move-executor so CPU turns are delayed to allow visuals to complete
        _connect('./move-executor-visuals', '../game/move-executor', (uiMod, timers) => ({
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
        }), timersImpl);

        // Visual effects map
        _connect('./visual-effects-map', '../game/visual-effects-map', (uiMod) => ({
            applyStoneVisualEffect: uiMod.applyStoneVisualEffect,
            removeStoneVisualEffect: uiMod.removeStoneVisualEffect,
            getSupportedEffectKeys: uiMod.getSupportedEffectKeys,
            __setSpecialStoneScaleImpl__: uiMod.__setSpecialStoneScaleImpl__ || function(scale) { if (typeof window !== 'undefined' && window.setSpecialStoneScale) window.setSpecialStoneScale(scale); }
        }), timersImpl);

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
    }

    function installGameDI() {
        if (_gameDIInstallResult) return _gameDIInstallResult;

        const timersImpl = installCoreDI();
        installCardDI();
        installNetworkDI();
        installUIDI(timersImpl);

        function preloadAssets(manifest, opts = {}) {
            opts = Object.assign({ timeoutMs: 5000 }, opts || {});
            const required = (manifest && manifest.files) ? manifest.files.map(f => f.path) : [];
            if (!required.length) return Promise.resolve({ success: true, loaded: [], failed: [] });
            const stoneBaseReadyPromise = ensureStoneBaseImagesReady({ timeoutMs: opts.timeoutMs });

            return preloadImageList(required, opts).then((res) => {
                return Promise.resolve(stoneBaseReadyPromise).catch(() => ({ success: false, loaded: [], failed: [] })).then(() => {
                    if (res && res.success) {
                        try {
                            classListAddSafe('stone-images-loaded');
                            classListAddSafe('stone-shadow-enabled');
                            refreshExistingDiscImagePresentation({ assignBaseImage: true });
                        } catch (e) { /* ignore */ }
                        return { success: true, loaded: res.loaded || [], failed: res.failed || [] };
                    }
                    return { success: false, loaded: res && res.loaded ? res.loaded : [], failed: res && res.failed ? res.failed : [] };
                });
            });
        }

        _gameDIInstallResult = { timersImpl, registerUIGlobals, preloadAssets, preloadSpecialStoneVisuals };
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
        syncDebugLogAvailability();
        return _uiGlobals;
    }
    function getRegisteredUIGlobals() {
        return Object.assign({}, _uiGlobals);
    }
    function isGameDIInstalled() {
        return !!_gameDIInstallResult;
    }

    function isAssetManifestShape(manifest) {
        return !!(manifest && typeof manifest === 'object' && Array.isArray(manifest.files));
    }

    function resolveAssetManifestEventTarget(preferredRoot) {
        const candidates = [
            preferredRoot,
            (typeof window !== 'undefined' ? window : null),
            (typeof globalThis !== 'undefined' ? globalThis : null)
        ];
        for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            if (!candidate || typeof candidate.dispatchEvent !== 'function') continue;
            return candidate;
        }
        return null;
    }

    function createAssetManifestUpdatedEvent(target, manifest) {
        const CustomEventCtor = (target && typeof target.CustomEvent === 'function')
            ? target.CustomEvent
            : (typeof CustomEvent === 'function' ? CustomEvent : null);
        if (CustomEventCtor) {
            return new CustomEventCtor(ASSET_MANIFEST_UPDATED_EVENT, {
                detail: manifest
            });
        }
        const EventCtor = (target && typeof target.Event === 'function')
            ? target.Event
            : (typeof Event === 'function' ? Event : null);
        if (!EventCtor) return null;
        const event = new EventCtor(ASSET_MANIFEST_UPDATED_EVENT);
        try { event.detail = manifest; } catch (e) { /* ignore */ }
        return event;
    }

    function setLoadedAssetManifest(manifest, options = {}) {
        _loadedAssetManifest = isAssetManifestShape(manifest) ? manifest : null;
        if (options.dispatch === false) return _loadedAssetManifest;

        const target = resolveAssetManifestEventTarget(options.root);
        if (!target) return _loadedAssetManifest;

        const event = createAssetManifestUpdatedEvent(target, _loadedAssetManifest);
        if (!event) return _loadedAssetManifest;
        try { target.dispatchEvent(event); } catch (e) { /* ignore */ }
        return _loadedAssetManifest;
    }

    function getLoadedAssetManifest() {
        return _loadedAssetManifest;
    }

    async function refreshLoadedAssetManifest(opts = {}) {
        try {
            const fetchFn = (opts.root && typeof opts.root.fetch === 'function')
                ? opts.root.fetch.bind(opts.root)
                : (typeof fetch === 'function' ? fetch : null);
            if (typeof fetchFn !== 'function') {
                return { status: 'unavailable', reason: 'fetch-unavailable' };
            }
            try {
                const locationRef = (opts.root && opts.root.location)
                    || (typeof location !== 'undefined' ? location : null);
                if (locationRef && (locationRef.protocol === 'file:' || locationRef.origin === 'null')) {
                    return { status: 'skipped', reason: 'file-origin' };
                }
            } catch (e) { /* ignore */ }

            const manifestUrl = String(opts.manifestUrl || 'assets/asset-manifest.json').trim() || 'assets/asset-manifest.json';
            const response = await fetchFn(manifestUrl, { cache: 'no-store' });
            if (!response || response.ok !== true) {
                return {
                    status: 'error',
                    reason: 'fetch-failed',
                    code: response && Number.isFinite(Number(response.status)) ? Number(response.status) : null
                };
            }
            const manifest = await response.json();
            if (!isAssetManifestShape(manifest)) {
                return { status: 'error', reason: 'invalid-manifest' };
            }
            setLoadedAssetManifest(manifest, {
                root: opts.root,
                dispatch: opts.dispatch !== false
            });
            return { status: 'ok', manifest };
        } catch (e) {
            return { status: 'error', reason: String(e) };
        }
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
        setLoadedAssetManifest(manifest, { root: opts.root, dispatch: true });
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

    const UIBootstrap = { addLog, debugLog, updateBgmButtons, updateStatus, installGameDI, isGameDIInstalled, registerUIGlobals, getRegisteredUIGlobals, preloadAssets, preloadSpecialStoneVisuals, applyAssetManifest, handleGameInit, ensureStoneBaseImagesReady, setLoadedAssetManifest, getLoadedAssetManifest, refreshLoadedAssetManifest, ASSET_MANIFEST_UPDATED_EVENT };
export = UIBootstrap;