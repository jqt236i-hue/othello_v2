import type { CardState, GameState, PlayerKey } from '../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

declare const SoundEngine: any;
declare const updateCpuCharacter: (...args: any[]) => any;
declare const SharedUIBootstrap: any;
declare const NetworkMatchClient: any;
declare const waitForPlaybackIdle: (...args: any[]) => any;
declare const hideCpuSpeechBubble: (...args: any[]) => any;
declare const resetRenderStats: (...args: any[]) => any;
declare const clearEffectLivePanel: (...args: any[]) => any;
declare const processCpuTurn: (...args: any[]) => any | undefined;
declare const processAutoBlackTurn: (...args: any[]) => any | undefined;

'use strict';

    let _uiGlobals: any = {};
    let _gameDIInstallResult: any = null;
    let _stoneBaseImagesReadyPromise: any = null;
    let _loadedAssetManifest: any = null;
    const ASSET_MANIFEST_UPDATED_EVENT = 'asset-manifest:updated';
    const STONE_BASE_IMAGE_PATHS = [
        'assets/images/stones/normal_stone-black.png',
        'assets/images/stones/normal_stone-white.png'
    ];
    const IMAGE_ASSET_PATH_PATTERN = /\.(png|jpe?g|webp|svg)(?:[?#].*)?$/i;

    function getDocumentClassList() {
        try {
            if (typeof document !== 'undefined' && document && document.documentElement && document.documentElement.classList) {
                return document.documentElement.classList;
            }
        } catch (e: any) { /* ignore */ }
        return null;
    }

    function classListAddSafe(className: any) {
        const classList = getDocumentClassList();
        if (!classList || typeof classList.add !== 'function') return false;
        try {
            classList.add(className);
            return true;
        } catch (e: any) {
            return false;
        }
    }

    function classListRemoveSafe(className: any) {
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
        } catch (e: any) { /* ignore */ }
        return false;
    }

    function classListContainsSafe(className: any) {
        const classList = getDocumentClassList();
        if (!classList) return false;
        try {
            if (typeof classList.contains === 'function') return !!classList.contains(className);
            if (classList.added) return !!classList.added[className];
        } catch (e: any) { /* ignore */ }
        return false;
    }

    function getDiscOwnerDescriptor(disc: any) {
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

    function syncDiscBaseImageAssignment(disc: any) {
        if (!disc || !disc.style || typeof disc.style.setProperty !== 'function') return;
        const owner = getDiscOwnerDescriptor(disc);
        try { disc.style.setProperty('--stone-image', owner.imageVar); } catch (e: any) { /* ignore */ }
        try { disc.style.setProperty('--disc-base-image', owner.imageVar); } catch (e: any) { /* ignore */ }
        try {
            if (!disc.dataset.renderMode) disc.dataset.renderMode = 'base-only';
            if (!disc.dataset.effect) disc.dataset.effect = 'normal';
        } catch (e: any) { /* ignore */ }
    }

    function syncDiscImageFallbackState(disc: any, options: any = {}) {
        if (!disc || !disc.style || typeof disc.style.setProperty !== 'function') return;
        const owner = getDiscOwnerDescriptor(disc);
        const baseImagesReady = Object.prototype.hasOwnProperty.call(options, 'baseImagesReady')
            ? !!options.baseImagesReady
            : classListContainsSafe('stone-base-images-ready');
        try { disc.dataset.imageState = baseImagesReady ? 'loaded' : 'fallback'; } catch (e: any) { /* ignore */ }
        try {
            disc.style.setProperty('--disc-base-fallback-color', baseImagesReady ? 'transparent' : owner.fallbackColor);
        } catch (e: any) { /* ignore */ }
    }

    function refreshExistingDiscImagePresentation(options: any = {}) {
        if (typeof document === 'undefined' || !document || typeof document.querySelectorAll !== 'function') return;
        const discs = Array.from(document.querySelectorAll('.disc.black, .disc.white')) || [];
        discs.forEach((disc) => {
            try {
                if (options.assignBaseImage) syncDiscBaseImageAssignment(disc);
                syncDiscImageFallbackState(disc, options);
            } catch (e: any) { /* ignore per-disc errors */ }
        });
    }

    function preloadImageList(paths: any, opts: any = {}) {
        const required = Array.isArray(paths) ? paths.filter(Boolean) : [];
        const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 5000;
        if (!required.length) return Promise.resolve({ success: true, loaded: [], failed: [] });
        const loaded: any[] = [];
        const failed: any[] = [];

        return new Promise<any>((resolve) => {
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
                } catch (e: any) {
                    failed.push({ src, reason: String(e) });
                    remaining -= 1;
                    checkDone();
                }
            });
        });
    }

    function isImageAssetPath(path: any) {
        if (!path) return false;
        return IMAGE_ASSET_PATH_PATTERN.test(String(path).trim());
    }

    function preloadSpecialStoneVisuals() {
        const rootScope: any = (typeof globalThis !== 'undefined' && globalThis)
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

        let effectKeys: any[] = [];
        try {
            const supportedEffectKeys = getSupportedEffectKeysFn();
            effectKeys = Array.from(new Set(
                (Array.isArray(supportedEffectKeys) ? supportedEffectKeys : [])
                    .map((key) => String(key || '').trim())
                    .filter((key) => !!key && key !== 'normal')
            ));
        } catch (e: any) {
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
        } catch (e: any) {
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
        _stoneBaseImagesReadyPromise = preloadImageList(STONE_BASE_IMAGE_PATHS, opts).then((res: any) => {
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
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && window.location && typeof window.location.search === 'string') {
                return window.location.search;
            }
        } catch (e: any) { /* ignore */ }
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

    function setDebugLogTarget(target: any, enabled: any) {
        if (!target || typeof target !== 'object') return;
        if (enabled) {
            try {
                target.debugLog = debugLog;
                return;
            } catch (e: any) { /* ignore */ }
        }
        try {
            delete target.debugLog;
        } catch (e: any) {
            try { target.debugLog = undefined; } catch (ignored) { /* ignore */ }
        }
    }

    function syncDebugLogAvailability() {
        const enabled = isDebugSessionEnabled();
        try {
            if (typeof window !== 'undefined' && window) {
                setDebugLogTarget(window, enabled);
            }
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis) {
                setDebugLogTarget(globalThis, enabled);
            }
        } catch (e: any) { /* ignore */ }
        return enabled;
    }

    function debugLog(message: any, level: any, meta: any) {
        if (!isDebugSessionEnabled()) return false;
        const logLevel = String(level || 'debug').trim().toLowerCase() || 'debug';
        const consoleRef: any = (typeof console !== 'undefined' && console) ? console : null;
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

    function addLog(text: any) {
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
                try { logEl.scrollTop = logEl.scrollHeight; } catch (e: any) { if (logEl && logEl.parentElement) logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight; }
                appendedToDom = true;
            }
        } catch (e: any) {
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
        } catch (e: any) {
            // defensive no-op
        }
    }

    function updateStatus() {
        try {
            if (typeof updateCpuCharacter === 'function') {
                updateCpuCharacter();
            }
        } catch (e: any) { /* no-op */ }
    }

    function getTransientUIResetRoot(): any {
        try {
            if (typeof window !== 'undefined' && window) return window;
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis) return globalThis;
        } catch (e: any) { /* ignore */ }
        return null;
    }

    function getTransientUIResetDocument() {
        try {
            if (typeof document !== 'undefined' && document) return document;
        } catch (e: any) { /* ignore */ }
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
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && (globalThis as any).SharedUIBootstrap) {
                return (globalThis as any).SharedUIBootstrap;
            }
        } catch (e: any) { /* ignore */ }
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
            if (typeof globalThis !== 'undefined' && (globalThis as any).PlaybackStateManager) return (globalThis as any).PlaybackStateManager;
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof require === 'function') return require('./playback-state-manager');
        } catch (e: any) { /* ignore */ }
        return null;
    }

    function abortAnimationPlaybackForReset() {
        const root = getTransientUIResetRoot();
        try {
            if (root && root.AnimationEngine && typeof root.AnimationEngine.abortAndSync === 'function') {
                root.AnimationEngine.abortAndSync();
            }
        } catch (e: any) { /* ignore */ }
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
        } catch (e: any) { /* ignore */ }

        if (!clearedViaManager && root) {
            try { root.isCardAnimating = false; } catch (e: any) { /* ignore */ }
            try { root.VisualPlaybackActive = false; } catch (e: any) { /* ignore */ }
            try { root.__playbackActiveSince = null; } catch (e: any) { /* ignore */ }
            try { root.__boardUpdateContext = null; } catch (e: any) { /* ignore */ }
        }

        if (!root) return;
        try { root.__drawHandAnimActive = false; } catch (e: any) { /* ignore */ }
        try { root.__handSequentialRevealState = null; } catch (e: any) { /* ignore */ }
        try { delete root._currentPlaybackScope; } catch (e: any) { try { root._currentPlaybackScope = null; } catch (err: any) { /* ignore */ } }
    }

    function resolvePendingSelectionFlowModule() {
        try {
            if (typeof require === 'function') {
                const selectionFlowModule = require('../game/card-effects/selection-flow');
                if (selectionFlowModule && typeof selectionFlowModule.setSignalBridge === 'function') {
                    return selectionFlowModule;
                }
            }
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).PendingSelectionFlow) {
                const selectionFlow = (window as unknown as Record<string, unknown>).PendingSelectionFlow as { setSignalBridge?: unknown };
                if (typeof selectionFlow.setSignalBridge === 'function') return selectionFlow;
            }
            if (typeof globalThis !== 'undefined' && (globalThis as any).PendingSelectionFlow && typeof (globalThis as any).PendingSelectionFlow.setSignalBridge === 'function') {
                return (globalThis as any).PendingSelectionFlow;
            }
        } catch (e: any) { /* ignore */ }
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
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).PresentationHelper) {
                const presentationHelper = (window as unknown as Record<string, unknown>).PresentationHelper as { emitPresentationEvent?: unknown };
                if (typeof presentationHelper.emitPresentationEvent === 'function') return presentationHelper;
            }
            if (typeof globalThis !== 'undefined' && (globalThis as any).PresentationHelper && typeof (globalThis as any).PresentationHelper.emitPresentationEvent === 'function') {
                return (globalThis as any).PresentationHelper;
            }
        } catch (e: any) { /* ignore */ }
        return null;
    }

    function buildPendingSelectionFlowBridge() {
        return {
            readMatchMode: () => {
                try {
                    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
                        return (globalThis as any).getCurrentMatchMode();
                    }
                    if (typeof globalThis !== 'undefined') return (globalThis as any).MATCH_MODE;
                } catch (e: any) { /* ignore */ }
                return null;
            },
            readHumanVsHumanMode: () => {
                try {
                    return typeof globalThis !== 'undefined' && (globalThis as any).DEBUG_HUMAN_VS_HUMAN === true;
                } catch (e: any) {
                    return false;
                }
            },
            getPlaybackStateManager: () => getPlaybackStateModuleForReset(),
            getGameState: () => {
                try {
                    return typeof globalThis !== 'undefined' ? (globalThis as any).gameState : null;
                } catch (e: any) {
                    return null;
                }
            },
            getCardState: () => {
                try {
                    return typeof globalThis !== 'undefined' ? (globalThis as any).cardState : null;
                } catch (e: any) {
                    return null;
                }
            },
            setGameState: (nextGameState: any) => {
                try {
                    if (typeof globalThis === 'undefined') return false;
                    (globalThis as any).gameState = nextGameState;
                    return true;
                } catch (e: any) {
                    return false;
                }
            },
            setCardState: (nextCardState: any) => {
                try {
                    if (typeof globalThis === 'undefined') return false;
                    (globalThis as any).cardState = nextCardState;
                    return true;
                } catch (e: any) {
                    return false;
                }
            },
            getActionManager: () => {
                try {
                    return typeof globalThis !== 'undefined' ? (globalThis as any).ActionManager : null;
                } catch (e: any) {
                    return null;
                }
            },
            getTurnPipelineUIAdapter: () => {
                try {
                    return typeof globalThis !== 'undefined' ? (globalThis as any).TurnPipelineUIAdapter : null;
                } catch (e: any) {
                    return null;
                }
            },
            getTurnPipeline: () => {
                try {
                    return typeof globalThis !== 'undefined' ? (globalThis as any).TurnPipeline : null;
                } catch (e: any) {
                    return null;
                }
            },
            getPresentationHelper: () => resolvePresentationHelperModule(),
            waitForPlaybackIdle: () => {
                try {
                    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).waitForPlaybackIdle === 'function') {
                        return (globalThis as any).waitForPlaybackIdle();
                    }
                } catch (e: any) { /* ignore */ }
                return undefined;
            },
            scheduleCpuTurn: (ms: any, cb: any) => {
                try {
                    const delay = Number.isFinite(Number(ms)) ? Math.max(0, Math.trunc(Number(ms))) : 0;
                    return setTimeout(cb, delay);
                } catch (e: any) {
                    return undefined;
                }
            },
            processCpuTurn: () => {
                try {
                    const globals = getRegisteredUIGlobals();
                    if (globals && typeof globals.processCpuTurn === 'function') {
                        return globals.processCpuTurn();
                    }
                } catch (e: any) { /* ignore */ }
                return undefined;
            },
            publishSnapshot: (meta: any) => {
                try {
                    if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return undefined;
                    if (typeof (globalThis as any).NetworkMatchClient.publishSnapshot !== 'function') return undefined;
                    if (typeof (globalThis as any).NetworkMatchClient.isActive === 'function' && !(globalThis as any).NetworkMatchClient.isActive()) {
                        return undefined;
                    }
                    return (globalThis as any).NetworkMatchClient.publishSnapshot(meta);
                } catch (e: any) {
                    return undefined;
                }
            },
            isNetworkPublishActive: () => {
                try {
                    if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return false;
                    if (typeof (globalThis as any).NetworkMatchClient.publishSnapshot !== 'function') return false;
                    if (typeof (globalThis as any).NetworkMatchClient.isActive === 'function') {
                        return (globalThis as any).NetworkMatchClient.isActive() === true;
                    }
                    return true;
                } catch (e: any) {
                    return false;
                }
            },
            emitPlaybackEvents: (events: any, meta: any, cardStateValue: any) => {
                if (!Array.isArray(events) || events.length === 0) return false;
                try {
                    const presentationHelper = resolvePresentationHelperModule();
                    if (!presentationHelper || typeof presentationHelper.emitPresentationEvent !== 'function') {
                        return false;
                    }
                    return presentationHelper.emitPresentationEvent(cardStateValue || (typeof globalThis !== 'undefined' ? (globalThis as any).cardState : null), {
                        type: 'PLAYBACK_EVENTS',
                        events,
                        meta: (meta && typeof meta === 'object') ? meta : {}
                    }) === true;
                } catch (e: any) {
                    return false;
                }
            },
            emitStateChanges: () => {
                const signalNames = ['emitCardStateChange', 'emitBoardUpdate', 'emitGameStateChange'];
                let emitted = false;
                for (let index = 0; index < signalNames.length; index += 1) {
                    try {
                        const windowSignal = typeof window !== 'undefined'
                            ? (window as unknown as Record<string, unknown>)[signalNames[index]]
                            : null;
                        const signalFn = typeof windowSignal === 'function'
                            ? windowSignal
                            : (typeof globalThis !== 'undefined' ? (globalThis as any)[signalNames[index]] : null);
                        if (typeof signalFn !== 'function') continue;
                        signalFn();
                        emitted = true;
                    } catch (e: any) { /* ignore */ }
                }
                return emitted;
            },
            emitMessage: (text: any) => {
                if (!text) return false;
                try {
                    const windowLog = typeof window !== 'undefined'
                        ? (window as unknown as Record<string, unknown>).emitLogAdded
                        : null;
                    const emitLogAdded = typeof windowLog === 'function'
                        ? windowLog
                        : (typeof globalThis !== 'undefined' ? (globalThis as any).emitLogAdded : null);
                    if (typeof emitLogAdded !== 'function') {
                        return false;
                    }
                    emitLogAdded(text);
                    return true;
                } catch (e: any) {
                    return false;
                }
            },
            emitBoardUpdate: () => {
                try {
                    const windowBoardUpdate = typeof window !== 'undefined'
                        ? (window as unknown as Record<string, unknown>).emitBoardUpdate
                        : null;
                    const emitBoardUpdate = typeof windowBoardUpdate === 'function'
                        ? windowBoardUpdate
                        : (typeof globalThis !== 'undefined' ? (globalThis as any).emitBoardUpdate : null);
                    if (typeof emitBoardUpdate !== 'function') {
                        return false;
                    }
                    emitBoardUpdate();
                    return true;
                } catch (e: any) {
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
        } catch (e: any) {
            return false;
        }
    }

    function clearTransientTimersForReset() {
        const root = getTransientUIResetRoot();
        try {
            if (root && root.TimerRegistry && typeof root.TimerRegistry.clearAll === 'function') {
                root.TimerRegistry.clearAll();
            }
        } catch (e: any) { /* ignore */ }
    }

    function unlockBoardPlaybackForReset() {
        const doc = getTransientUIResetDocument();
        try {
            const board = doc ? doc.getElementById('board') : null;
            if (board) board.classList.remove('playback-locked');
        } catch (e: any) { /* ignore */ }
    }

    function resetBoardCellTransientState(cell: any) {
        if (!cell || !cell.querySelectorAll) return;
        try {
            const discs = Array.from(cell.querySelectorAll('.disc'));
            discs.forEach((disc: any) => {
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
                } catch (e: any) { /* ignore */ }
            });

            if (!cell.querySelector('.disc')) {
                cell.classList.remove('has-disc');
            } else {
                cell.classList.add('has-disc');
            }
        } catch (e: any) { /* ignore */ }
    }

    function removeElementsBySelectorForReset(doc: any, selector: any) {
        if (!doc || typeof doc.querySelectorAll !== 'function') return;
        try {
            doc.querySelectorAll(selector).forEach((el: any) => {
                try { if (el && el.parentElement) el.parentElement.removeChild(el); } catch (e: any) { /* ignore */ }
            });
        } catch (e: any) { /* ignore */ }
    }

    function clearDetachedBodyDiscsForReset(doc: any) {
        if (!doc || !doc.body) return;
        try {
            const bodyChildren = Array.from(doc.body.children);
            bodyChildren.forEach((el: any) => {
                try {
                    if (!el || !el.classList || !el.classList.contains('disc')) return;
                    const pos = String((el.style && el.style.position) || '').toLowerCase();
                    if (pos === 'fixed' || pos === 'absolute') {
                        if (el.parentElement) el.parentElement.removeChild(el);
                    }
                } catch (e: any) { /* ignore */ }
            });
        } catch (e: any) { /* ignore */ }
    }

    function clearBoardTransientDomForReset() {
        const doc = getTransientUIResetDocument();
        if (!doc) return;

        try {
            const board = doc.getElementById('board');
            if (board) {
                board.querySelectorAll('.cell').forEach((cell: any) => {
                    resetBoardCellTransientState(cell);
                });
            }
        } catch (e: any) { /* ignore */ }

        try {
            const cardFxLayer = doc.getElementById('card-fx-layer');
            if (cardFxLayer) cardFxLayer.innerHTML = '';
        } catch (e: any) { /* ignore */ }

        removeElementsBySelectorForReset(doc, '.hyperactive-move-ghost');
        clearDetachedBodyDiscsForReset(doc);
    }

    function removeElementByIdForReset(doc: any, elementId: any) {
        if (!doc) return;
        try {
            const element = doc.getElementById(elementId);
            if (element && element.parentElement) element.parentElement.removeChild(element);
        } catch (e: any) { /* ignore */ }
    }

    function closeTransientPanelsForReset() {
        const doc = getTransientUIResetDocument();
        const root = getTransientUIResetRoot();
        if (!doc) return;

        removeElementByIdForReset(doc, 'result-overlay');

        try {
            const infoPanel = doc.getElementById('stone-info-panel');
            if (infoPanel) infoPanel.classList.remove('visible');
        } catch (e: any) { /* ignore */ }
        try {
            const infoTagPanel = doc.getElementById('stone-info-tag-panel');
            if (infoTagPanel) infoTagPanel.classList.remove('is-open');
        } catch (e: any) { /* ignore */ }

        removeElementsBySelectorForReset(doc, '.observer-speech-bubble');

        try {
            const hideCpuSpeechBubbleFn = (typeof hideCpuSpeechBubble === 'function')
                ? hideCpuSpeechBubble
                : (root && typeof root.hideCpuSpeechBubble === 'function' ? root.hideCpuSpeechBubble : null);
            if (hideCpuSpeechBubbleFn) hideCpuSpeechBubbleFn();
        } catch (e: any) { /* ignore */ }
    }

    function removeNonPreservedChildren(parent: any, preservedChildren: any) {
        if (!parent || !parent.children) return;
        const preserved = new Set((preservedChildren || []).filter(Boolean));
        Array.from(parent.children).forEach((child: any) => {
            try {
                if (!preserved.has(child) && child.parentElement === parent) {
                    child.parentElement.removeChild(child);
                }
            } catch (e: any) { /* ignore */ }
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
        } catch (e: any) { /* ignore */ }
    }

    function resetRenderStatsForReset() {
        const root = getTransientUIResetRoot();
        try {
            const resetRenderStatsFn = (typeof resetRenderStats === 'function')
                ? resetRenderStats
                : (root && typeof root.resetRenderStats === 'function' ? root.resetRenderStats : null);
            if (resetRenderStatsFn) resetRenderStatsFn();
        } catch (e: any) { /* ignore */ }
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
            try { step(); } catch (e: any) { /* ignore */ }
        });
    }

    // export to global/window for non-module callers
    if (typeof window !== 'undefined') {
        try { window.addLog = addLog; } catch (e: any) { /* Intentionally empty: window assignment guard */ }
        try { window.updateBgmButtons = updateBgmButtons; } catch (e: any) { /* Intentionally empty: window assignment guard */ }
        try { window.updateStatus = updateStatus; } catch (e: any) { /* Intentionally empty: window assignment guard */ }
    }
    syncDebugLogAvailability();

    // DI: Install game-side implementations (timers, UI helpers)
    function _makeTimersImpl() {
        return {
            waitMs: (ms: any) => new Promise((resolve) => {
                try {
                    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') return window.setTimeout(resolve, ms);
                    return setTimeout(resolve, ms);
                } catch (e: any) { setTimeout(resolve, ms); }
            }),
            requestFrame: () => new Promise((resolve) => {
                try {
                    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(resolve);
                    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') return window.requestAnimationFrame(resolve);
                    setTimeout(resolve, 0);
                } catch (e: any) { setTimeout(resolve, 0); }
            })
        };
    }

    function _connect(uiPath: any, gamePath: any, mapFn: any, timersImpl?: any) {
        try {
            const uiMod = require(uiPath);
            const gameMod = require(gamePath);
            if (gameMod && typeof gameMod.setUIImpl === 'function') {
                const impl = mapFn ? mapFn(uiMod, timersImpl) : uiMod;
                gameMod.setUIImpl(impl || {});
            }
        } catch (e: any) { /* ignore missing modules in headless contexts */ }
    }

    function installCoreDI() {
        try {
            classListAddSafe('stone-shadow-enabled');
        } catch (e: any) { /* ignore */ }
        try { ensureStoneBaseImagesReady({ timeoutMs: 5000 }); } catch (e: any) { /* ignore */ }
        try { preloadSpecialStoneVisuals(); } catch (e: any) { /* ignore */ }

        const timersImpl = _makeTimersImpl();

        // Inject into game/timers when available (one-time)
        try {
            const root: any = (typeof globalThis !== 'undefined') ? globalThis : null;
            const alreadyInjected = !!(root && root.__timersInjected);
            if (!alreadyInjected) {
                const gameTimers = require('../game/timers');
                if (gameTimers && typeof gameTimers.setTimerImpl === 'function') {
                    gameTimers.setTimerImpl(timersImpl);
                    if (root) root.__timersInjected = true;
                }
            }
        } catch (e: any) { /* ignore in non-module UI contexts */ }

        return timersImpl;
    }

    function configurePresentationRuntime() {
        try {
            const presentation = require('../game/logic/presentation');
            if (!presentation || typeof presentation.setPresentationRuntime !== 'function') return;
            presentation.setPresentationRuntime({
                getCardState: () => {
                    try {
                        return (typeof globalThis !== 'undefined' && (globalThis as any).cardState)
                            ? (globalThis as any).cardState
                            : null;
                    } catch (e: any) {
                        return null;
                    }
                },
                emitPresentationEvent: (cardStateValue: any, ev: any) => {
                    try {
                        if (typeof globalThis === 'undefined') return false;
                        const boardOps = ((globalThis as any).BoardOps && typeof (globalThis as any).BoardOps.emitPresentationEvent === 'function')
                            ? (globalThis as any).BoardOps
                            : null;
                        if (!boardOps) return false;
                        boardOps.emitPresentationEvent(cardStateValue || null, ev);
                        return true;
                    } catch (e: any) {
                        return false;
                    }
                }
            });
        } catch (e: any) { /* ignore */ }
    }

    function installCardDI() {
        configurePresentationRuntime();
        try {
            const pipelineUIAdapter = require('../game/turn/pipeline_ui_adapter');
            if (pipelineUIAdapter && typeof pipelineUIAdapter.setPipelineUIAdapterRuntime === 'function') {
                pipelineUIAdapter.setPipelineUIAdapterRuntime({
                    getGamePrng: () => {
                        try {
                            return (typeof globalThis !== 'undefined' && typeof (globalThis as any).getGamePrng === 'function')
                                ? (globalThis as any).getGamePrng()
                                : undefined;
                        } catch (e: any) {
                            return undefined;
                        }
                    }
                });
            }
        } catch (e: any) { /* ignore */ }

        // Trap placement flash stays in UI and is invoked from game via DI.
        _connect('./animation-utils', '../game/card-effects/trap', (uiMod: any) => ({
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
        } catch (e: any) { /* ignore */ }

        // Special-effects UI hooks: many modules accept setUIImpl; wire basic helpers
        try {
            const hyperactive = require('../game/special-effects/hyperactive');
            const moveVisuals = require('./move-executor-visuals');
            const playbackEngine = require('./playback-engine');
            const animationConstants = require('../constants/animation-constants');
            const presentation = require('../game/logic/presentation');
            const timers = require('../game/timers');
            if (hyperactive && typeof hyperactive.setUIImpl === 'function') {
                hyperactive.setUIImpl({
                    animateFadeOutAt: moveVisuals && moveVisuals.animateFadeOutAt,
                    animateHyperactiveMove: moveVisuals && moveVisuals.animateHyperactiveMove,
                    animateHyperactiveMoveChain: moveVisuals && moveVisuals.animateHyperactiveMoveChain,
                    setDiscColorAt: moveVisuals && moveVisuals.setDiscColorAt,
                    hasPlaybackEngine: () => !!(playbackEngine && typeof playbackEngine.playPresentationEvents === 'function'),
                    getAnimationTiming: animationConstants && animationConstants.getAnimationTiming,
                    waitMs: timers && timers.waitMs,
                    requestFrame: timers && timers.requestFrame,
                    emitPresentationEvent: presentation && typeof presentation.emitPresentationEvent === 'function'
                        ? (event: any) => presentation.emitPresentationEvent(
                            (typeof globalThis !== 'undefined' ? (globalThis as any).cardState : null),
                            event
                        )
                        : null
                });
            }
        } catch (e: any) { /* ignore */ }
        try {
            const breeding = require('../game/special-effects/breeding');
            const animationUtils = require('./animation-utils');
            const playbackEngine = require('./playback-engine');
            const animationConstants = require('../constants/animation-constants');
            if (breeding && typeof breeding.setUIImpl === 'function') {
                breeding.setUIImpl({
                    animateFadeOutAt: animationUtils && animationUtils.animateFadeOutAt,
                    playPresentationEvents: playbackEngine && playbackEngine.playPresentationEvents,
                    getAnimationTiming: animationConstants && animationConstants.getAnimationTiming
                });
            }
        } catch (e: any) { /* ignore */ }
        try {
            const dragons = require('../game/special-effects/dragons');
            const moveVisuals = require('./move-executor-visuals');
            const playbackEngine = require('./playback-engine');
            const animationConstants = require('../constants/animation-constants');
            const presentation = require('../game/logic/presentation');
            if (dragons && typeof dragons.setUIImpl === 'function') {
                dragons.setUIImpl({
                    setDiscColorAt: moveVisuals && moveVisuals.setDiscColorAt,
                    removeBombOverlayAt: moveVisuals && moveVisuals.removeBombOverlayAt,
                    animateFadeOutAt: moveVisuals && moveVisuals.animateFadeOutAt,
                    playPresentationEvents: playbackEngine && playbackEngine.playPresentationEvents,
                    getAnimationTiming: animationConstants && animationConstants.getAnimationTiming,
                    emitPresentationEvent: presentation && typeof presentation.emitPresentationEvent === 'function'
                        ? (event: any) => presentation.emitPresentationEvent(
                            (typeof globalThis !== 'undefined' ? (globalThis as any).cardState : null),
                            event
                        )
                        : null
                });
            }
        } catch (e: any) { /* ignore */ }
        try {
            const udg = require('../game/special-effects/udg');
            const animationUtils = require('./animation-utils');
            const playbackEngine = require('./playback-engine');
            if (udg && typeof udg.setUIImpl === 'function') {
                udg.setUIImpl({
                    animateFadeOutAt: animationUtils && animationUtils.animateFadeOutAt,
                    playPresentationEvents: playbackEngine && playbackEngine.playPresentationEvents
                });
            }
        } catch (e: any) { /* ignore */ }
        try {
            const bombs = require('../game/special-effects/bombs');
            const animationUtils = require('./animation-utils');
            const animationEngine = require('./animation-engine');
            const playbackEngine = require('./playback-engine');
            if (bombs && typeof bombs.setUIImpl === 'function') {
                bombs.setUIImpl({
                    animateFadeOutAt: animationUtils && animationUtils.animateFadeOutAt,
                    animateDestroyAt: animationUtils && animationUtils.animateDestroyAt,
                    playAnimationEvents: animationEngine && typeof animationEngine.play === 'function'
                        ? (events: any) => animationEngine.play(events)
                        : null,
                    playPresentationEvents: playbackEngine && playbackEngine.playPresentationEvents
                });
            }
        } catch (e: any) { /* ignore */ }
    }

    function installNetworkDI() {
        // Early registration: if the CPU turn handler is available on the game side, register its
        // processCpuTurn/processAutoBlackTurn to UIBootstrap so UI consumers can schedule CPU
        // turns immediately without waiting for other bootstrap steps. This avoids boot-order
        // races where a SCHEDULE_CPU_TURN event would otherwise go unhandled.
        try {
            const cpu = require('../game/cpu-turn-handler');
            if (cpu) {
                const cpuGlobals: any = {};
                if (typeof cpu.processCpuTurn === 'function') cpuGlobals.processCpuTurn = cpu.processCpuTurn;
                if (typeof cpu.processAutoBlackTurn === 'function') cpuGlobals.processAutoBlackTurn = cpu.processAutoBlackTurn;
                if (typeof cpu.setCpuUIImpl === 'function') {
                    cpu.setCpuUIImpl({
                        readMatchMode: () => {
                            try {
                                if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
                                    return (globalThis as any).getCurrentMatchMode();
                                }
                                if (typeof globalThis !== 'undefined') return (globalThis as any).MATCH_MODE;
                            } catch (e: any) { /* ignore */ }
                            return null;
                        },
                        readHumanVsHumanMode: () => {
                            try {
                                return typeof globalThis !== 'undefined' && (globalThis as any).DEBUG_HUMAN_VS_HUMAN === true;
                            } catch (e: any) { /* ignore */ }
                            return false;
                        },
                        getPlaybackStateManager: () => {
                            try {
                                const playbackStateManager = require('./playback-state-manager');
                                if (playbackStateManager) return playbackStateManager;
                            } catch (e: any) { /* ignore */ }
                            try {
                                return (typeof globalThis !== 'undefined' && (globalThis as any).PlaybackStateManager)
                                    ? (globalThis as any).PlaybackStateManager
                                    : null;
                            } catch (e: any) {
                                return null;
                            }
                        }
                    });
                }
                if (Object.keys(cpuGlobals).length) {
                    try { registerUIGlobals(cpuGlobals); } catch (e: any) { /* ignore */ }
                    try { if (typeof globalThis !== 'undefined') { if (cpuGlobals.processCpuTurn) (globalThis as any).processCpuTurn = cpuGlobals.processCpuTurn; if (cpuGlobals.processAutoBlackTurn) (globalThis as any).processAutoBlackTurn = cpuGlobals.processAutoBlackTurn; } } catch (e: any) { /* ignore */ }
                }
            }
        } catch (e: any) { /* ignore */ }

        // Inject UI-cross-boundary modules into game/pass-handler via DI
        try {
            const passHandler = require('../game/pass-handler');
            if (passHandler) {
                try {
                    if (typeof passHandler.setPassHandlerRuntime === 'function') {
                        let cpu: any = null;
                        try { cpu = require('../game/cpu-turn-handler'); } catch (e: any) { /* ignore */ }
                        passHandler.setPassHandlerRuntime({
                            processCpuTurn: cpu && typeof cpu.processCpuTurn === 'function' ? cpu.processCpuTurn : null,
                            readMatchMode: () => {
                                try {
                                    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
                                        return (globalThis as any).getCurrentMatchMode();
                                    }
                                    if (typeof globalThis !== 'undefined') return (globalThis as any).MATCH_MODE;
                                } catch (e: any) { /* ignore */ }
                                return null;
                            },
                            readHumanVsHumanMode: () => {
                                try {
                                    return typeof globalThis !== 'undefined' && (globalThis as any).DEBUG_HUMAN_VS_HUMAN === true;
                                } catch (e: any) { /* ignore */ }
                                return false;
                            },
                            getActionManager: () => {
                                try {
                                    return typeof globalThis !== 'undefined' ? (globalThis as any).ActionManager : null;
                                } catch (e: any) {
                                    return null;
                                }
                            },
                            getNetworkTurnHandoff: () => {
                                try {
                                    return typeof globalThis !== 'undefined' ? (globalThis as any).NetworkTurnHandoff : null;
                                } catch (e: any) {
                                    return null;
                                }
                            }
                        });
                    }
                } catch (e: any) { /* ignore */ }
                try {
                    const playbackStateManager = require('./playback-state-manager');
                    if (playbackStateManager && typeof passHandler.setPlaybackStateManager === 'function') {
                        passHandler.setPlaybackStateManager(playbackStateManager);
                    }
                } catch (e: any) { /* ignore */ }
                try {
                    const networkClient = require('./network-client');
                    if (networkClient && typeof passHandler.setNetworkMatchClient === 'function') {
                        passHandler.setNetworkMatchClient(networkClient);
                    }
                } catch (e: any) { /* ignore */ }
            }
        } catch (e: any) { /* ignore */ }

        try {
            const cpuDecision = require('../game/cpu-decision');
            if (cpuDecision && typeof cpuDecision.setCpuDecisionRuntime === 'function') {
                let cpu: any = null;
                try { cpu = require('../game/cpu-turn-handler'); } catch (e: any) { /* ignore */ }
                cpuDecision.setCpuDecisionRuntime({
                    processCpuTurn: cpu && typeof cpu.processCpuTurn === 'function' ? cpu.processCpuTurn : null,
                    readMatchMode: () => {
                        try {
                            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
                                return (globalThis as any).getCurrentMatchMode();
                            }
                            if (typeof globalThis !== 'undefined') return (globalThis as any).MATCH_MODE;
                        } catch (e: any) { /* ignore */ }
                        return null;
                    },
                    readHumanVsHumanMode: () => {
                        try {
                            return typeof globalThis !== 'undefined' && (globalThis as any).DEBUG_HUMAN_VS_HUMAN === true;
                        } catch (e: any) { /* ignore */ }
                        return false;
                    },
                    readDebugFlag: (name: any) => {
                        try {
                            if (typeof name !== 'string' || typeof globalThis === 'undefined') return false;
                            return (globalThis as any)[name] === true;
                        } catch (e: any) { /* ignore */ }
                        return false;
                    },
                    readQuerySearch: () => {
                        try {
                            return (typeof location !== 'undefined' && location && typeof location.search === 'string')
                                ? location.search
                                : '';
                        } catch (e: any) { /* ignore */ }
                        return '';
                    },
                    readCpuSmartness: () => {
                        const readLevel = (id: string) => {
                            const el = (typeof document !== 'undefined') ? document.getElementById(id) as HTMLSelectElement | null : null;
                            const n = Number(el && el.value);
                            return Number.isFinite(n) ? Math.max(1, Math.min(6, Math.floor(n))) : 1;
                        };
                        return { black: readLevel('smartBlack'), white: readLevel('smartWhite') };
                    },
                    waitForPlaybackIdle: () => {
                        try {
                            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).waitForPlaybackIdle === 'function') {
                                return (globalThis as any).waitForPlaybackIdle();
                            }
                        } catch (e: any) { /* ignore */ }
                        return undefined;
                    },
                    publishSnapshot: (meta: any) => {
                        try {
                            if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return undefined;
                            const client = (globalThis as any).NetworkMatchClient;
                            if (typeof client.publishSnapshot !== 'function') return undefined;
                            if (typeof client.isActive === 'function' && client.isActive() !== true) return undefined;
                            return client.publishSnapshot(meta);
                        } catch (e: any) {
                            return undefined;
                        }
                    },
                    isNetworkPublishActive: () => {
                        try {
                            if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return false;
                            const client = (globalThis as any).NetworkMatchClient;
                            if (typeof client.publishSnapshot !== 'function') return false;
                            if (typeof client.isActive === 'function') return client.isActive() === true;
                            return true;
                        } catch (e: any) {
                            return false;
                        }
                    },
                    playCardUseHandAnimation: (payload: any) => {
                        try {
                            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).playCardUseHandAnimation === 'function') {
                                return (globalThis as any).playCardUseHandAnimation(payload);
                            }
                        } catch (e: any) { /* ignore */ }
                        return undefined;
                    },
                    isVisualPlaybackActive: () => {
                        try {
                            return typeof globalThis !== 'undefined' && (globalThis as any).VisualPlaybackActive === true;
                        } catch (e: any) {
                            return false;
                        }
                    }
                });
            }
        } catch (e: any) { /* ignore */ }

        try {
            const turnPipelinePhases = require('../game/turn/turn_pipeline_phases');
            if (turnPipelinePhases && typeof turnPipelinePhases.setTurnPipelinePhasesRuntime === 'function') {
                turnPipelinePhases.setTurnPipelinePhasesRuntime({
                    readMatchMode: () => {
                        try {
                            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
                                return (globalThis as any).getCurrentMatchMode();
                            }
                            if (typeof globalThis !== 'undefined') return (globalThis as any).MATCH_MODE;
                        } catch (e: any) { /* ignore */ }
                        return null;
                    }
                });
            }
        } catch (e: any) { /* ignore */ }

        // Commentary broker initialization
        try {
            const commentaryBroker = require('./commentary-broker');
            try {
                const cpuCommentaryRuntime = require('../game/ai/cpu-commentary-runtime');
                if (cpuCommentaryRuntime && typeof cpuCommentaryRuntime.setConfig === 'function') {
                    cpuCommentaryRuntime.setConfig({
                        readCpuTalkEnabled: () => {
                            try {
                                return typeof globalThis !== 'undefined' ? (globalThis as any).CPU_TALK_ENABLED : undefined;
                            } catch (e: any) { /* ignore */ }
                            return undefined;
                        },
                        readQuerySearch: () => {
                            try {
                                return (typeof location !== 'undefined' && location && typeof location.search === 'string')
                                    ? location.search
                                    : '';
                            } catch (e: any) { /* ignore */ }
                            return '';
                        }
                    });
                }
            } catch (e: any) { /* ignore */ }
            if (commentaryBroker && typeof commentaryBroker.initBroker === 'function') {
                commentaryBroker.initBroker({
                    root: (typeof globalThis !== 'undefined') ? globalThis : null,
                    addLog,
                    getShowCpuSpeechBubble: () => {
                        try {
                            if (typeof window !== 'undefined' && typeof window.showCpuSpeechBubble === 'function') {
                                return window.showCpuSpeechBubble;
                            }
                        } catch (e: any) { /* ignore */ }
                        return null;
                    }
                });
            }
        } catch (e: any) { /* ignore */ }
    }

    function installUIDI(timersImpl: any) {
        // Move visuals
        _connect('./move-executor-visuals', '../game/move-executor-visuals', (uiMod: any) => ({
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
        _connect('./move-executor-visuals', '../game/move-executor', (uiMod: any, timers: any) => ({
            scheduleCpuTurn: (ms: any, cb: any) => { return timers.waitMs(ms || 0).then(cb); },
            processCpuTurn: (() => {
                try {
                    const cpu = require('../game/cpu-turn-handler');
                    return cpu && typeof cpu.processCpuTurn === 'function' ? cpu.processCpuTurn : null;
                } catch (e: any) {
                    return null;
                }
            })(),
            readMatchMode: () => {
                try {
                    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
                        return (globalThis as any).getCurrentMatchMode();
                    }
                    if (typeof globalThis !== 'undefined') return (globalThis as any).MATCH_MODE;
                } catch (e: any) { /* ignore */ }
                return null;
            },
            readHumanVsHumanMode: () => {
                try {
                    return typeof globalThis !== 'undefined' && (globalThis as any).DEBUG_HUMAN_VS_HUMAN === true;
                } catch (e: any) { /* ignore */ }
                return false;
            },
            getPlaybackStateManager: () => getPlaybackStateModuleForReset(),
            getTurnPipelineUIAdapter: () => {
                try {
                    return typeof globalThis !== 'undefined' ? (globalThis as any).TurnPipelineUIAdapter : null;
                } catch (e: any) {
                    return null;
                }
            },
            getTurnPipeline: () => {
                try {
                    return typeof globalThis !== 'undefined' ? (globalThis as any).TurnPipeline : null;
                } catch (e: any) {
                    return null;
                }
            },
            getNetworkTurnHandoff: () => {
                try {
                    return typeof globalThis !== 'undefined' ? (globalThis as any).NetworkTurnHandoff : null;
                } catch (e: any) {
                    return null;
                }
            },
            getLocalPlayerKey: () => {
                try {
                    if (typeof globalThis === 'undefined') return null;
                    return (globalThis as any).LOCAL_PLAYER_KEY
                        || (globalThis as any).__LOCAL_PLAYER_KEY
                        || (globalThis as any).BOARD_VIEWER_KEY
                        || null;
                } catch (e: any) {
                    return null;
                }
            },
            getActionManager: () => {
                try {
                    return typeof globalThis !== 'undefined' ? (globalThis as any).ActionManager : null;
                } catch (e: any) {
                    return null;
                }
            },
            emitBoardUpdate: () => {
                try {
                    const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitBoardUpdate : null;
                    if (typeof fn !== 'function') return false;
                    return fn() === true;
                } catch (e: any) {
                    return false;
                }
            },
            emitCardStateChange: () => {
                try {
                    const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitCardStateChange : null;
                    if (typeof fn !== 'function') return false;
                    return fn() === true;
                } catch (e: any) {
                    return false;
                }
            },
            now: () => Date.now(),
            // Let game/move-executor await the UI playback lifecycle (AnimationEngine / visual writer)
            waitForPlayback: uiMod.waitForPlaybackIdle,
            publishSnapshot: (meta: any) => {
                try {
                    if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return undefined;
                    const client = (globalThis as any).NetworkMatchClient;
                    if (typeof client.publishSnapshot !== 'function') return undefined;
                    if (typeof client.isActive === 'function' && client.isActive() !== true) return undefined;
                    return client.publishSnapshot(meta);
                } catch (e: any) {
                    return undefined;
                }
            },
            isNetworkPublishActive: () => {
                try {
                    if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return false;
                    const client = (globalThis as any).NetworkMatchClient;
                    if (typeof client.publishSnapshot !== 'function') return false;
                    if (typeof client.isActive === 'function') return client.isActive() === true;
                    return true;
                } catch (e: any) {
                    return false;
                }
            },
            emitPresentationEvent: (ev: any) => {
                try {
                    if (typeof globalThis === 'undefined') return false;
                    const cardStateRef = ((globalThis as any).cardState && typeof (globalThis as any).cardState === 'object')
                        ? (globalThis as any).cardState
                        : null;
                    const boardOps = ((globalThis as any).BoardOps && typeof (globalThis as any).BoardOps.emitPresentationEvent === 'function')
                        ? (globalThis as any).BoardOps
                        : null;
                    if (!cardStateRef || !boardOps) return false;
                    boardOps.emitPresentationEvent(cardStateRef, ev);
                    return true;
                } catch (e: any) {
                    return false;
                }
            }
        }), timersImpl);

        // Visual effects map
        _connect('./visual-effects-map', '../game/visual-effects-map', (uiMod: any) => ({
            applyStoneVisualEffect: uiMod.applyStoneVisualEffect,
            removeStoneVisualEffect: uiMod.removeStoneVisualEffect,
            getSupportedEffectKeys: uiMod.getSupportedEffectKeys,
            __setSpecialStoneScaleImpl__: uiMod.__setSpecialStoneScaleImpl__ || function(scale: any) { if (typeof window !== 'undefined' && window.setSpecialStoneScale) window.setSpecialStoneScale(scale); }
        }), timersImpl);

        // Turn manager helpers (readCpuSmartness / scheduleCpuTurn / isDocumentHidden / pulseDeckUI)
        try {
            const tm = require('../game/turn-manager');
            if (tm && typeof tm.setUIImpl === 'function') {
                tm.setUIImpl({
                    readCpuSmartness: () => {
                        const readLevel = (id: string) => {
                            const el = (typeof document !== 'undefined') ? document.getElementById(id) as HTMLSelectElement | null : null;
                            const n = Number(el && el.value);
                            return Number.isFinite(n) ? Math.max(1, Math.min(6, Math.floor(n))) : 1;
                        };
                        return { black: readLevel('smartBlack'), white: readLevel('smartWhite') };
                    },
                    readMatchMode: () => {
                        try {
                            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
                                return (globalThis as any).getCurrentMatchMode();
                            }
                            if (typeof globalThis !== 'undefined') return (globalThis as any).MATCH_MODE;
                        } catch (e: any) { /* ignore */ }
                        return null;
                    },
                    readHumanVsHumanMode: () => {
                        try {
                            return typeof globalThis !== 'undefined' && (globalThis as any).DEBUG_HUMAN_VS_HUMAN === true;
                        } catch (e: any) { /* ignore */ }
                        return false;
                    },
                    isDocumentHidden: () => (typeof document !== 'undefined' && document.hidden) || false,
                    pulseDeckUI: () => {},
                    scheduleCpuTurn: (ms: any, cb: any) => { timersImpl.waitMs(ms || 0).then(cb); },
                    resetTransientUIState: () => { runResetTransientUIStateCleanup(); },
                    clearLogUI: () => {
                        try {
                            const el = (typeof document !== 'undefined') ? document.getElementById('log') : null;
                            if (el) el.innerHTML = '';
                        } catch (e: any) { /* ignore */ }
                        try {
                            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).clearEffectLivePanel === 'function') {
                                (globalThis as any).clearEffectLivePanel();
                                return;
                            }
                        } catch (e: any) { /* ignore */ }
                        try {
                            const effectEl = (typeof document !== 'undefined') ? document.getElementById('effect-live-lines') : null;
                            if (effectEl) effectEl.innerHTML = '';
                        } catch (e: any) { /* ignore */ }
                    }
                });
            }
        } catch (e: any) { /* ignore */ }
    }

    function installGameDI() {
        if (_gameDIInstallResult) return _gameDIInstallResult;

        const timersImpl = installCoreDI();
        installCardDI();
        installNetworkDI();
        installUIDI(timersImpl);

        function preloadAssets(manifest: any, opts: any = {}) {
            opts = Object.assign({ timeoutMs: 5000 }, opts || {});
            const required = (manifest && manifest.files) ? manifest.files.map((f: any) => f.path).filter(isImageAssetPath) : [];
            if (!required.length) return Promise.resolve({ success: true, loaded: [], failed: [] });
            const stoneBaseReadyPromise = ensureStoneBaseImagesReady({ timeoutMs: opts.timeoutMs });

            return preloadImageList(required, opts).then((res: any) => {
                return Promise.resolve(stoneBaseReadyPromise).catch(() => ({ success: false, loaded: [], failed: [] })).then(() => {
                    if (res && res.success) {
                        try {
                            classListAddSafe('stone-images-loaded');
                            classListAddSafe('stone-shadow-enabled');
                            refreshExistingDiscImagePresentation({ assignBaseImage: true });
                        } catch (e: any) { /* ignore */ }
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
    function registerUIGlobals(obj: any) {
        _uiGlobals = Object.assign(_uiGlobals, obj || {});
        // For backward compatibility, mirror to window where appropriate
        try {
            if (typeof window !== 'undefined') {
                for (const k of Object.keys(obj || {})) {
                    try { window[k] = obj[k]; } catch (e: any) { /* ignore */ }
                }
            }
        } catch (e: any) { /* ignore */ }
        syncDebugLogAvailability();
        return _uiGlobals;
    }
    function getRegisteredUIGlobals() {
        return Object.assign({}, _uiGlobals);
    }
    function isGameDIInstalled() {
        return !!_gameDIInstallResult;
    }

    function isAssetManifestShape(manifest: any) {
        return !!(manifest && typeof manifest === 'object' && Array.isArray(manifest.files));
    }

    function resolveAssetManifestEventTarget(preferredRoot: any) {
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

    function createAssetManifestUpdatedEvent(target: any, manifest: any) {
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
        try { event.detail = manifest; } catch (e: any) { /* ignore */ }
        return event;
    }

    function setLoadedAssetManifest(manifest: any, options: any = {}) {
        _loadedAssetManifest = isAssetManifestShape(manifest) ? manifest : null;
        if (options.dispatch === false) return _loadedAssetManifest;

        const target = resolveAssetManifestEventTarget(options.root);
        if (!target) return _loadedAssetManifest;

        const event = createAssetManifestUpdatedEvent(target, _loadedAssetManifest);
        if (!event) return _loadedAssetManifest;
        try { target.dispatchEvent(event); } catch (e: any) { /* ignore */ }
        return _loadedAssetManifest;
    }

    function getLoadedAssetManifest() {
        return _loadedAssetManifest;
    }

    async function refreshLoadedAssetManifest(opts: any = {}) {
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
            } catch (e: any) { /* ignore */ }

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
        } catch (e: any) {
            return { status: 'error', reason: String(e) };
        }
    }

    function preloadAssets(manifest: any, opts: any) {
        try {
            const impl = installGameDI();
            return impl.preloadAssets(manifest, opts);
        } catch (e: any) {
            return Promise.resolve({ success: false, loaded: [], failed: [{ reason: String(e) }] });
        }
    }

    async function applyAssetManifest(manifest: any, policy: any = { mode: 'compat' }, opts: any = {}) {
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
            try { if (typeof console !== 'undefined' && console.warn) console.warn('[ASSET_MANIFEST] preload incomplete, using fallback', res.failed); } catch (e: any) { /* Intentionally empty: console guard */ }
            return { status: 'fallback', details: res };
        } catch (e: any) {
            return { status: 'error', details: String(e) };
        }
    }

    // Handler to be called with the server-sent GameInit payload
    // payload may include assetManifest and other init fields
    async function handleGameInit(payload: any, opts: any = { assetPolicy: { mode: 'compat' } }) {
        if (!payload) return { status: 'no_payload' };
        if (payload.assetManifest) {
            const res = await applyAssetManifest(payload.assetManifest, opts.assetPolicy || { mode: 'compat' }, opts);
            try { if (typeof window !== 'undefined') window.__assetManifestStatus = res; } catch (e: any) { /* Intentionally empty: window assignment guard */ }
            return { status: 'asset_manifest_handled', result: res };
        }
        return { status: 'no_asset_manifest' };
    }

    const UIBootstrap = {
        addLog: (typeof addLog === 'function') ? addLog : function () { return false; },
        debugLog: (typeof debugLog === 'function') ? debugLog : function () { return false; },
        updateBgmButtons,
        updateStatus,
        installGameDI,
        isGameDIInstalled,
        registerUIGlobals,
        getRegisteredUIGlobals,
        preloadAssets,
        preloadSpecialStoneVisuals,
        applyAssetManifest,
        handleGameInit,
        ensureStoneBaseImagesReady,
        setLoadedAssetManifest,
        getLoadedAssetManifest,
        refreshLoadedAssetManifest,
        ASSET_MANIFEST_UPDATED_EVENT
    };
    try {
        if (typeof window !== 'undefined') {
            (window as unknown as { UIBootstrap?: typeof UIBootstrap }).UIBootstrap = UIBootstrap;
        }
    } catch (e: any) { /* ignore */ }
export = UIBootstrap;

