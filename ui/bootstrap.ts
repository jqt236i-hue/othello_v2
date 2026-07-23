import type { CardState, GameState, PlayerKey } from '../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let OwnerHelpersModule: any = null;
try {
    if (typeof _require === 'function') {
        OwnerHelpersModule = _require('../utils/owner-helpers');
    }
} catch (e: any) { /* ignore */ }
if (!OwnerHelpersModule) {
    try {
        if (typeof window !== 'undefined' && window && (window as any).OwnerHelpers) {
            OwnerHelpersModule = (window as any).OwnerHelpers;
        }
    } catch (e: any) { /* ignore */ }
}

let CpuProfileSelectionModule: any = null;
try {
    if (typeof _require === 'function') {
        CpuProfileSelectionModule = _require('./cpu-profile-selection');
    }
} catch (e: any) { /* ignore */ }

let BootstrapRuntimeResolvers: any = null;
try {
    if (typeof _require === 'function') {
        BootstrapRuntimeResolvers = _require('./bootstrap/runtime-resolvers');
    }
} catch (e: any) { /* ignore */ }

let BootstrapCpuRuntimeWiring: any = null;
try {
    if (typeof _require === 'function') {
        BootstrapCpuRuntimeWiring = _require('./bootstrap/cpu-runtime-wiring');
    }
} catch (e: any) { /* ignore */ }

let BootstrapPassRuntimeWiring: any = null;
try {
    if (typeof _require === 'function') {
        BootstrapPassRuntimeWiring = _require('./bootstrap/pass-runtime-wiring');
    }
} catch (e: any) { /* ignore */ }

let BootstrapAssetManifestRuntime: any = null;
try {
    if (typeof _require === 'function') {
        BootstrapAssetManifestRuntime = _require('./bootstrap/asset-manifest-runtime');
    }
} catch (e: any) { /* ignore */ }

let PixiRuntimeContract: any = null;
try {
    if (typeof _require === 'function') {
        PixiRuntimeContract = _require('./pixi/runtime-contract');
    }
} catch (e: any) { /* ignore */ }

function readCpuSmartnessValueFromSelect(id: string): number | string {
    try {
        if (CpuProfileSelectionModule && typeof CpuProfileSelectionModule.readCpuSmartnessValueFromSelectId === 'function') {
            return CpuProfileSelectionModule.readCpuSmartnessValueFromSelectId(id);
        }
    } catch (e: any) { /* ignore */ }
    const el = (typeof document !== 'undefined') ? document.getElementById(id) as HTMLSelectElement | null : null;
    const raw = String(el && el.value || '').trim();
    if (!raw) return 1;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(1, Math.min(9, Math.floor(n))) : raw;
}

function createInjectedTimerService(timersImpl: any) {
    const hasUsableWaitMs = !!(timersImpl && typeof timersImpl.waitMs === 'function');

    return {
        setTimeout(callback: any, delay: any) {
            const handle: any = { cancelled: false };
            handle.unref = () => handle;
            if (!hasUsableWaitMs) return handle;
            Promise.resolve(timersImpl.waitMs(delay)).then(() => {
                if (handle.cancelled) return;
                try { callback(); } catch (e: any) { /* ignore */ }
            });
            return handle;
        },
        clearTimeout(handle: any) {
            if (handle && typeof handle === 'object') handle.cancelled = true;
        },
        setInterval(callback: any, delay: any) {
            const handle: any = { cancelled: false };
            handle.unref = () => handle;
            if (!hasUsableWaitMs) return handle;
            const tick = () => {
                if (handle.cancelled) return;
                try { callback(); } catch (e: any) { /* ignore */ }
                if (handle.cancelled) return;
                Promise.resolve(timersImpl.waitMs(delay)).then(tick);
            };
            Promise.resolve(timersImpl.waitMs(delay)).then(tick);
            return handle;
        },
        clearInterval(handle: any) {
            if (handle && typeof handle === 'object') handle.cancelled = true;
        }
    };
}

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
    let cpuCandidateScoringRuntime: {
        scoreCandidatesInWorker?: Function;
        searchCardQuiescenceInWorker?: Function;
    } = {};

    function configureCpuCandidateScoring(runtime: any): boolean {
        const scorer = runtime && typeof runtime.scoreCandidatesInWorker === 'function'
            ? runtime.scoreCandidatesInWorker
            : null;
        const quiescenceSearcher = runtime && typeof runtime.searchCardQuiescenceInWorker === 'function'
            ? runtime.searchCardQuiescenceInWorker
            : null;
        cpuCandidateScoringRuntime = {
            ...(scorer ? { scoreCandidatesInWorker: scorer } : {}),
            ...(quiescenceSearcher ? { searchCardQuiescenceInWorker: quiescenceSearcher } : {})
        };
        return !!scorer || !!quiescenceSearcher;
    }

    function configurePixiRuntime(runtime: any, options?: any): boolean {
        if (!PixiRuntimeContract || typeof PixiRuntimeContract.configurePixiRuntime !== 'function') return false;
        return PixiRuntimeContract.configurePixiRuntime(runtime, options);
    }

    function markPixiRuntimeUnavailable(reason: any, options?: any): boolean {
        if (!PixiRuntimeContract || typeof PixiRuntimeContract.markPixiRuntimeUnavailable !== 'function') return false;
        return PixiRuntimeContract.markPixiRuntimeUnavailable(reason, options);
    }

    function getPixiRuntimeCapability(): any {
        if (!PixiRuntimeContract || typeof PixiRuntimeContract.getPixiRuntimeCapability !== 'function') {
            return Object.freeze({ lane: 'unknown', injected: false, version: null, unavailableReason: 'runtime-contract-unavailable' });
        }
        return PixiRuntimeContract.getPixiRuntimeCapability();
    }
    let _gameDIInstallResult: any = null;
    let _stoneBaseImagesReadyPromise: any = null;
    const ASSET_MANIFEST_UPDATED_EVENT = 'asset-manifest:updated';
    const STONE_BASE_IMAGE_PATHS = [
        'assets/images/stone-skin/default/black.png',
        'assets/images/stone-skin/default/white.png'
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
            classListAddSafe('stone-images-loaded');
            classListAddSafe('stone-shadow-enabled');
            return Promise.resolve({ success: true, loaded: STONE_BASE_IMAGE_PATHS.slice(), failed: [] });
        }
        if (_stoneBaseImagesReadyPromise) return _stoneBaseImagesReadyPromise;
        _stoneBaseImagesReadyPromise = preloadImageList(STONE_BASE_IMAGE_PATHS, opts).then((res: any) => {
            if (res && res.success) {
                classListAddSafe('stone-base-images-ready');
                // The shared stone skeleton only needs the two normal stone
                // images. Keep the legacy class as a compatibility signal;
                // feature images are now loaded by their owning surfaces.
                classListAddSafe('stone-images-loaded');
                classListAddSafe('stone-shadow-enabled');
                refreshExistingDiscImagePresentation({ assignBaseImage: true, baseImagesReady: true });
                return res;
            }
            classListRemoveSafe('stone-base-images-ready');
            classListRemoveSafe('stone-images-loaded');
            refreshExistingDiscImagePresentation({ baseImagesReady: false });
            _stoneBaseImagesReadyPromise = null;
            return res;
        }).catch((e) => {
            classListRemoveSafe('stone-base-images-ready');
            classListRemoveSafe('stone-images-loaded');
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
        if (seed.NETWORK_LOCAL_DEBUG_MODE === true) return true;
        if (seed.DEBUG_MODE_ALLOWED === true) return true;
        if (seed.DEBUG_MODE_ALLOWED === false) return false;
        const query = readDebugQueryString();
        return /[?&]debug=1(?:&|$)/.test(query)
            || /[?&]debug=true(?:&|$)/i.test(query)
            || /[?&]specialDebug=1(?:&|$)/.test(query)
            || /[?&]specialDebug=true(?:&|$)/i.test(query)
            || /[?&]special-debug=1(?:&|$)/.test(query)
            || /[?&]special-debug=true(?:&|$)/i.test(query);
    }

    function createBootstrapRuntimeResolvers() {
        if (BootstrapRuntimeResolvers && typeof BootstrapRuntimeResolvers.createRuntimeResolvers === 'function') {
            return BootstrapRuntimeResolvers.createRuntimeResolvers({
                getRegisteredUIGlobals,
                readDebugQueryString,
                isDebugSessionEnabled,
                debugLog
            });
        }
        function resolveRuntimeFunction(name: string) {
            try {
                if (typeof name !== 'string') return null;
                const registered = getRegisteredUIGlobals();
                const registeredCandidate = registered && (registered as any)[name];
                if (typeof registeredCandidate === 'function') return registeredCandidate;
                if (typeof globalThis === 'undefined') return null;
                const candidate = (globalThis as any)[name];
                return typeof candidate === 'function' ? candidate : null;
            } catch (e: any) {
                return null;
            }
        }
        function resolveRuntimeValue(name: string) {
            try {
                if (typeof name !== 'string' || typeof globalThis === 'undefined') return undefined;
                return Object.prototype.hasOwnProperty.call(globalThis, name)
                    ? (globalThis as any)[name]
                    : undefined;
            } catch (e: any) {
                return undefined;
            }
        }
        function readMatchMode() {
            try {
                if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
                    return (globalThis as any).getCurrentMatchMode();
                }
                if (typeof globalThis !== 'undefined') return (globalThis as any).MATCH_MODE;
            } catch (e: any) { /* ignore */ }
            return null;
        }
        function readHumanVsHumanMode() {
            try {
                return typeof globalThis !== 'undefined' && (globalThis as any).DEBUG_HUMAN_VS_HUMAN === true;
            } catch (e: any) { /* ignore */ }
            return false;
        }
        function readExplicitCpuTurnDelayMs() {
            try {
                if (!isDebugSessionEnabled() || typeof globalThis === 'undefined') return null;
                const rawValue = (globalThis as any).CPU_TURN_DELAY_MS;
                if (rawValue === null || typeof rawValue === 'undefined') return null;
                const value = Number(rawValue);
                return Number.isFinite(value) ? value : null;
            } catch (e: any) { /* ignore */ }
            return null;
        }
        return {
            resolveRuntimeFunction,
            resolveRuntimeValue,
            readMatchMode,
            readHumanVsHumanMode,
            readExplicitCpuTurnDelayMs,
            readQuerySearch: readDebugQueryString,
            isDebugLogAvailable: isDebugSessionEnabled,
            debugLog
        };
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
        const debugEnabled = isDebugSessionEnabled();
        let appendedToDom = false;
        try {
            const logEl = (typeof document !== 'undefined') ? document.getElementById('log') : null;
            if (logEl) {
                const entry = document.createElement('div');
                entry.className = 'logEntry';
                entry.textContent = resolvedText;
                logEl.appendChild(entry);
                const logOpen = !!(logEl.classList && logEl.classList.contains('is-log-open'));
                try { logEl.classList.remove('is-visible'); } catch (e: any) { /* ignore classList errors */ }
                try { logEl.setAttribute('aria-hidden', logOpen ? 'false' : 'true'); } catch (e: any) { /* ignore aria errors */ }
                try { logEl.scrollTop = logEl.scrollHeight; } catch (e: any) { if (logEl && logEl.parentElement) logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight; }
                appendedToDom = true;
            }
        } catch (e: any) {
            // ignore DOM errors
        }
        if (debugEnabled && typeof console !== 'undefined' && console.log) {
            console.log('[log]', resolvedText);
        }
        try {
            const recorder = (typeof window !== 'undefined' && window)
                ? (window as any).recordBattleStatusEvent
                : null;
            if (typeof recorder === 'function') recorder(resolvedText);
        } catch (e: any) { /* ignore battle status update errors */ }
    }

    function updateBgmButtons() {
        try {
            const bgmPlayBtn = (typeof document !== 'undefined') ? document.getElementById('bgmPlayBtn') : null;
            const bgmPauseBtn = (typeof document !== 'undefined') ? document.getElementById('bgmPauseBtn') : null;
            const quickBgmToggleBtn = (typeof document !== 'undefined') ? document.getElementById('quickBgmToggleBtn') : null;
            const bgmEnabled = typeof SoundEngine !== 'undefined' && SoundEngine.allowBgmPlay !== false;
            if (quickBgmToggleBtn) {
                quickBgmToggleBtn.textContent = bgmEnabled ? 'BGM: ON' : 'BGM: OFF';
                quickBgmToggleBtn.setAttribute('aria-pressed', bgmEnabled ? 'true' : 'false');
                quickBgmToggleBtn.classList.toggle('btn-active', bgmEnabled);
                quickBgmToggleBtn.setAttribute('title', bgmEnabled ? 'BGMをオフ' : 'BGMをオン');
            }
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

    function isNetworkMatchClientSpectator(client: any): boolean {
        try {
            return !!(client && typeof client.isSpectator === 'function' && client.isSpectator() === true);
        } catch (e: any) {
            return false;
        }
    }

    function buildPendingSelectionFlowBridge() {
        const runtimeResolvers = createBootstrapRuntimeResolvers();
        return {
            readMatchMode: runtimeResolvers.readMatchMode,
            readHumanVsHumanMode: runtimeResolvers.readHumanVsHumanMode,
            resolveRuntimeValue: runtimeResolvers.resolveRuntimeValue,
            getPlaybackStateManager: () => getPlaybackStateModuleForReset(),
            acquireSelectionSettlementLock: (meta: any) => {
                try {
                    const playbackState = getPlaybackStateModuleForReset();
                    if (playbackState && typeof playbackState.acquireSelectionSettlementLock === 'function') {
                        return playbackState.acquireSelectionSettlementLock(meta);
                    }
                } catch (e: any) { /* ignore */ }
                return null;
            },
            releaseSelectionSettlementLock: (token: any) => {
                try {
                    const playbackState = getPlaybackStateModuleForReset();
                    if (playbackState && typeof playbackState.releaseSelectionSettlementLock === 'function') {
                        playbackState.releaseSelectionSettlementLock(token);
                        return true;
                    }
                } catch (e: any) { /* ignore */ }
                return false;
            },
            setSelectionProcessing: (next: boolean) => {
                try {
                    const normalized = next === true;
                    const playbackState = getPlaybackStateModuleForReset();
                    if (playbackState && typeof playbackState.setBusyState === 'function') {
                        playbackState.setBusyState({ processing: normalized });
                        return true;
                    }
                    if (playbackState && typeof playbackState.setProcessing === 'function') {
                        playbackState.setProcessing(normalized);
                        return true;
                    }
                } catch (e: any) { /* ignore */ }
                return false;
            },
            setSelectionCardAnimating: (next: boolean) => {
                try {
                    const normalized = next === true;
                    const playbackState = getPlaybackStateModuleForReset();
                    if (playbackState && typeof playbackState.setBusyState === 'function') {
                        playbackState.setBusyState({ cardAnimating: normalized });
                        return true;
                    }
                    if (playbackState && typeof playbackState.setCardAnimating === 'function') {
                        playbackState.setCardAnimating(normalized);
                        return true;
                    }
                } catch (e: any) { /* ignore */ }
                return false;
            },
            setSelectionBusy: (next: boolean) => {
                try {
                    const normalized = next === true;
                    const playbackState = getPlaybackStateModuleForReset();
                    if (playbackState && typeof playbackState.setBusyState === 'function') {
                        playbackState.setBusyState({
                            processing: normalized,
                            cardAnimating: normalized
                        });
                        return true;
                    }
                } catch (e: any) { /* ignore */ }
                return false;
            },
            readSelectionBusyState: (payload: any) => {
                const settlementLocked = payload && payload.settlementLocked === true;
                const localState = payload && payload.localSelectionBusyState && typeof payload.localSelectionBusyState === 'object'
                    ? payload.localSelectionBusyState
                    : {};
                let processing = localState.processing === true;
                let cardAnimating = localState.cardAnimating === true;
                try {
                    const playbackState = getPlaybackStateModuleForReset();
                    if (playbackState && typeof playbackState.getProcessing === 'function') {
                        processing = playbackState.getProcessing() === true;
                    }
                    if (playbackState && typeof playbackState.getCardAnimating === 'function') {
                        cardAnimating = playbackState.getCardAnimating() === true;
                    }
                } catch (e: any) { /* ignore */ }
                return {
                    processing: settlementLocked || processing,
                    cardAnimating: settlementLocked || cardAnimating
                };
            },
            shouldAllowSelectionEntryDuringPlayback: (payload: any) => {
                try {
                    const playbackState = getPlaybackStateModuleForReset();
                    if (playbackState && typeof playbackState.shouldAllowSelectionEntryDuringPlayback === 'function') {
                        return playbackState.shouldAllowSelectionEntryDuringPlayback(payload || {}) === true;
                    }
                } catch (e: any) { /* ignore */ }
                return false;
            },
            clearSelectionEntryPlaybackContext: () => {
                try {
                    const playbackState = getPlaybackStateModuleForReset();
                    if (playbackState && typeof playbackState.clearSelectionEntryPlaybackContext === 'function') {
                        playbackState.clearSelectionEntryPlaybackContext();
                        return true;
                    }
                } catch (e: any) { /* ignore */ }
                return false;
            },
            armSelectionBoardUpdateContext: (context: any) => {
                try {
                    const playbackState = getPlaybackStateModuleForReset();
                    if (playbackState && typeof playbackState.armBoardUpdateContext === 'function') {
                        playbackState.armBoardUpdateContext(context);
                        return true;
                    }
                } catch (e: any) { /* ignore */ }
                return false;
            },
            armBoardUpdateDuringPlayback: (context: any) => {
                try {
                    const runtime = typeof _require === 'function'
                        ? _require('./board-update-sync-runtime')
                        : null;
                    if (runtime && typeof runtime.armBoardUpdateSyncContext === 'function') {
                        runtime.armBoardUpdateSyncContext(Object.assign({}, context));
                        return true;
                    }
                } catch (e: any) { /* ignore */ }
                try {
                    const runtime = typeof globalThis !== 'undefined'
                        ? (globalThis as any).BoardUpdateSyncRuntime
                        : null;
                    if (runtime && typeof runtime.armBoardUpdateSyncContext === 'function') {
                        runtime.armBoardUpdateSyncContext(Object.assign({}, context));
                        return true;
                    }
                } catch (e: any) { /* ignore */ }
                return false;
            },
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
            processCpuTurn: (...args: any[]) => {
                try {
                    const globals = getRegisteredUIGlobals();
                    if (globals && typeof globals.processCpuTurn === 'function') {
                        return globals.processCpuTurn(...args);
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
                    if (isNetworkMatchClientSpectator((globalThis as any).NetworkMatchClient)) return undefined;
                    return (globalThis as any).NetworkMatchClient.publishSnapshot(meta);
                } catch (e: any) {
                    return undefined;
                }
            },
            isNetworkPublishActive: () => {
                try {
                    if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return false;
                    if (typeof (globalThis as any).NetworkMatchClient.publishSnapshot !== 'function') return false;
                    if (isNetworkMatchClientSpectator((globalThis as any).NetworkMatchClient)) return false;
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

    function clearLegalMoveHintsForTurnManager() {
        const doc = getTransientUIResetDocument();
        if (!doc) return false;
        let cleared = false;
        try {
            ['board', 'board-expansion-layer'].forEach((id) => {
                const root = doc.getElementById(id);
                if (!root || typeof root.querySelectorAll !== 'function') return;
                root.querySelectorAll('.legal, .legal-free, .keyboard-legal-cursor, .random-spawn-preview').forEach((el: any) => {
                    try {
                        if (!el || !el.classList) return;
                        el.classList.remove('legal', 'legal-free', 'keyboard-legal-cursor', 'random-spawn-preview');
                        cleared = true;
                    } catch (e: any) { /* ignore */ }
                });
            });
        } catch (e: any) { /* ignore */ }
        return cleared;
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

    function resolveResultOverlayModuleForReset(root: any) {
        try {
            if (typeof _require === 'function') {
                const resultOverlayModule = _require('./result-overlay');
                if (resultOverlayModule && typeof resultOverlayModule === 'object') {
                    return resultOverlayModule;
                }
            }
        } catch (e: any) { /* ignore */ }
        try {
            if (root && root.ResultOverlayModule && typeof root.ResultOverlayModule === 'object') {
                return root.ResultOverlayModule;
            }
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && (globalThis as any).ResultOverlayModule) {
                const resultOverlayModule = (globalThis as any).ResultOverlayModule;
                if (resultOverlayModule && typeof resultOverlayModule === 'object') {
                    return resultOverlayModule;
                }
            }
        } catch (e: any) { /* ignore */ }
        return null;
    }

    function resetResultPresentationModuleStateForReset(root: any) {
        try {
            const resultOverlayModule = resolveResultOverlayModuleForReset(root);
            if (resultOverlayModule && typeof resultOverlayModule.resetResultPresentationState === 'function') {
                resultOverlayModule.resetResultPresentationState(null);
                return true;
            }
        } catch (e: any) { /* ignore */ }
        return false;
    }

    function clearResultPresentationDomForReset(doc: any) {
        removeElementByIdForReset(doc, 'result-overlay');
        removeElementByIdForReset(doc, 'result-reopen-button');
        try {
            doc.querySelectorAll('.has-result-reopen-button').forEach((el: any) => {
                try { if (el && el.classList) el.classList.remove('has-result-reopen-button'); } catch (e: any) { /* ignore */ }
            });
        } catch (e: any) { /* ignore */ }
    }

    function resetResultPresentationForTransientUIReset(doc: any, root: any) {
        resetResultPresentationModuleStateForReset(root);
        clearResultPresentationDomForReset(doc);
    }

    function closeTransientPanelsForReset() {
        const doc = getTransientUIResetDocument();
        const root = getTransientUIResetRoot();
        if (!doc) return;

        resetResultPresentationForTransientUIReset(doc, root);

        try {
            const infoPanel = doc.getElementById('stone-info-panel');
            if (infoPanel) infoPanel.setAttribute('aria-hidden', 'false');
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
                handLayerEl.style.display = 'block';
                removeNonPreservedChildren(handLayerEl, [handWrapperEl]);
            }
            if (handWrapperEl) {
                try {
                    if (typeof handWrapperEl.getAnimations === 'function') {
                        handWrapperEl.getAnimations().forEach((animation: any) => {
                            try { animation.cancel(); } catch (e: any) { /* ignore */ }
                        });
                    }
                } catch (e: any) { /* ignore */ }
                handWrapperEl.style.transform = '';
                handWrapperEl.style.display = 'block';
                handWrapperEl.style.opacity = '0';
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

    function resetBoardVisualRenderSessionForReset() {
        try {
            const renderer = _require('./board-renderer');
            if (renderer && typeof renderer.resetBoardVisualRenderSession === 'function') {
                renderer.resetBoardVisualRenderSession();
            }
        } catch (e: any) { /* ignore */ }
    }

    function runResetTransientUIStateCleanup() {
        // Keep abort first so any final sync can consume pending diff context before we clear playback state.
        [
            abortAnimationPlaybackForReset,
            clearPlaybackStateForReset,
            resetBoardVisualRenderSessionForReset,
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

        const timersImpl = _makeTimersImpl();

        try {
            const gameCoreLogic = require('../game/game-core-logic');
            if (gameCoreLogic && typeof gameCoreLogic.setUIImpl === 'function') {
                gameCoreLogic.setUIImpl({
                    isDebugLogAvailable: () => isDebugSessionEnabled(),
                    debugLog
                });
            }
        } catch (e: any) { /* ignore in non-module UI contexts */ }

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

        try {
            const placement = require('../game/card-effects/placement');
            if (placement && typeof placement.setUIImpl === 'function') {
                placement.setUIImpl({
                    emitLogAdded: (message: any) => {
                        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).emitLogAdded === 'function') {
                            (globalThis as any).emitLogAdded(message);
                        }
                    },
                    isDebugLogAvailable: () => isDebugSessionEnabled(),
                    debugLog,
                    getCardState: () => {
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any).cardState || null : null; } catch (e: any) { return null; }
                    }
                });
            }
        } catch (e: any) { /* ignore */ }

        try {
            const destroy = require('../game/card-effects/destroy');
            if (destroy && typeof destroy.setUIImpl === 'function') {
                destroy.setUIImpl({
                    emitLogAdded: (message: any) => {
                        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).emitLogAdded === 'function') {
                            (globalThis as any).emitLogAdded(message);
                        }
                    },
                    getLogMessages: () => {
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any).LOG_MESSAGES || null : null; } catch (e: any) { return null; }
                    },
                    posToNotation: (row: number, col: number) => {
                        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).posToNotation === 'function') {
                            return (globalThis as any).posToNotation(row, col);
                        }
                        return `${row},${col}`;
                    },
                    getCardLogic: () => {
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any).CardLogic || null : null; } catch (e: any) { return null; }
                    },
                    getCardState: () => {
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any).cardState || null : null; } catch (e: any) { return null; }
                    },
                    getGameState: () => {
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any).gameState || null : null; } catch (e: any) { return null; }
                    }
                });
            }
        } catch (e: any) { /* ignore */ }

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

    function installNetworkDI(timerService: any) {
        const runtimeResolvers = createBootstrapRuntimeResolvers();
        // Early CPU registration stays before pass wiring so pass runtime can resolve processCpuTurn.
        try {
            if (BootstrapCpuRuntimeWiring && typeof BootstrapCpuRuntimeWiring.installCpuRuntimeWiring === 'function') {
                const result = BootstrapCpuRuntimeWiring.installCpuRuntimeWiring({
                    requireModule: (id: string) => require(id),
                    timerService,
                    runtimeResolvers,
                    readCpuSmartnessValueFromSelect,
                    getPlaybackStateModuleForReset,
                    registerUIGlobals,
                    scoreCandidatesInWorker: typeof cpuCandidateScoringRuntime.scoreCandidatesInWorker === 'function'
                        ? (...args: any[]) => {
                            const scorer = cpuCandidateScoringRuntime.scoreCandidatesInWorker;
                            if (typeof scorer !== 'function') {
                                throw new Error('Dedicated CPU candidate scorer is unavailable');
                            }
                            return scorer(...args);
                        }
                        : undefined,
                    searchCardQuiescenceInWorker: typeof cpuCandidateScoringRuntime.searchCardQuiescenceInWorker === 'function'
                        ? (...args: any[]) => {
                            const searcher = cpuCandidateScoringRuntime.searchCardQuiescenceInWorker;
                            if (typeof searcher !== 'function') {
                                throw new Error('Dedicated CPU card-quiescence searcher is unavailable');
                            }
                            return searcher(...args);
                        }
                        : undefined,
                    isCpuCandidateScoringAvailable: () => (
                        typeof cpuCandidateScoringRuntime.scoreCandidatesInWorker === 'function'
                    ),
                    isCpuCardQuiescenceAvailable: () => (
                        typeof cpuCandidateScoringRuntime.searchCardQuiescenceInWorker === 'function'
                    )
                });
                const cpuGlobals = result && result.registeredGlobals ? result.registeredGlobals : {};
                if (Object.keys(cpuGlobals).length) {
                    try { registerUIGlobals(cpuGlobals); } catch (e: any) { /* ignore */ }
                    try {
                        if (typeof globalThis !== 'undefined') {
                            if (cpuGlobals.processCpuTurn) (globalThis as any).processCpuTurn = cpuGlobals.processCpuTurn;
                            if (cpuGlobals.processAutoBlackTurn) (globalThis as any).processAutoBlackTurn = cpuGlobals.processAutoBlackTurn;
                        }
                    } catch (e: any) { /* ignore */ }
                }
            }
        } catch (e: any) { /* ignore */ }

        // Inject UI-cross-boundary modules into game/pass-handler via DI.
        try {
            if (BootstrapPassRuntimeWiring && typeof BootstrapPassRuntimeWiring.installPassRuntimeWiring === 'function') {
                const result = BootstrapPassRuntimeWiring.installPassRuntimeWiring({
                    requireModule: (id: string) => require(id),
                    timerService,
                    runtimeResolvers,
                    getPlaybackStateModuleForReset,
                    registerUIGlobals
                });
                const passGlobals = result && result.registeredGlobals ? result.registeredGlobals : {};
                if (Object.keys(passGlobals).length) {
                    try { registerUIGlobals(passGlobals); } catch (e: any) { /* ignore */ }
                    try {
                        if (typeof globalThis !== 'undefined') {
                            if (passGlobals.processPassTurn) (globalThis as any).processPassTurn = passGlobals.processPassTurn;
                            if (passGlobals.ensureCurrentPlayerCanActOrPass) (globalThis as any).ensureCurrentPlayerCanActOrPass = passGlobals.ensureCurrentPlayerCanActOrPass;
                        }
                    } catch (e: any) { /* ignore */ }
                }
            }
        } catch (e: any) { /* ignore */ }

        try {
            const cpuDecision = require('../game/cpu-decision');
            if (cpuDecision) {
                if (typeof cpuDecision.setCpuTimerService === 'function') {
                    cpuDecision.setCpuTimerService(timerService || null);
                }
            }
            if (cpuDecision && typeof cpuDecision.setCpuDecisionRuntime === 'function') {
                let cpu: any = null;
                try { cpu = require('../game/cpu-turn-handler'); } catch (e: any) { /* ignore */ }
                cpuDecision.setCpuDecisionRuntime({
                    processCpuTurn: cpu && typeof cpu.processCpuTurn === 'function' ? cpu.processCpuTurn : null,
                    readMatchMode: runtimeResolvers.readMatchMode,
                    readHumanVsHumanMode: runtimeResolvers.readHumanVsHumanMode,
                    readDebugFlag: (name: any) => {
                        try {
                            if (typeof name !== 'string' || typeof globalThis === 'undefined') return false;
                            return (globalThis as any)[name] === true;
                        } catch (e: any) { /* ignore */ }
                        return false;
                    },
                    isDebugLogAvailable: runtimeResolvers.isDebugLogAvailable,
                    readQuerySearch: runtimeResolvers.readQuerySearch,
                    readCpuSmartness: () => {
                        return {
                            black: readCpuSmartnessValueFromSelect('smartBlack'),
                            white: readCpuSmartnessValueFromSelect('smartWhite')
                        };
                    },
                    getCpuLv6SharedProfile: () => {
                        try {
                            return typeof globalThis !== 'undefined' ? (globalThis as any).CPU_LV6_SHARED_PROFILE : null;
                        } catch (e: any) { /* ignore */ }
                        return null;
                    },
                    readCpuLv6OnnxRuntimeGuard: () => {
                        try {
                            return typeof globalThis !== 'undefined' ? (globalThis as any).CPU_LV6_ONNX_RUNTIME_GUARD : null;
                        } catch (e: any) { /* ignore */ }
                        return null;
                    },
                    readCpuLv6PendingSelectionBudgetMs: () => {
                        try {
                            return typeof globalThis !== 'undefined' ? (globalThis as any).CPU_LV6_PENDING_SELECTION_ONNX_MAX_MS : undefined;
                        } catch (e: any) { /* ignore */ }
                        return undefined;
                    },
                    emitCardStateChange: () => {
                        try {
                            const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitCardStateChange : null;
                            if (typeof fn === 'function') return fn();
                        } catch (e: any) { /* ignore */ }
                        return undefined;
                    },
                    emitBoardUpdate: () => {
                        try {
                            const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitBoardUpdate : null;
                            if (typeof fn === 'function') return fn();
                        } catch (e: any) { /* ignore */ }
                        return undefined;
                    },
                    emitGameStateChange: () => {
                        try {
                            const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitGameStateChange : null;
                            if (typeof fn === 'function') return fn();
                        } catch (e: any) { /* ignore */ }
                        return undefined;
                    },
                    emitLogAdded: (message: any, kind?: any) => {
                        try {
                            const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitLogAdded : null;
                            if (typeof fn === 'function') return fn(message, kind);
                        } catch (e: any) { /* ignore */ }
                        return undefined;
                    },
                    emitEffectLog: (message: any) => {
                        try {
                            const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitEffectLog : null;
                            if (typeof fn === 'function') return fn(message);
                        } catch (e: any) { /* ignore */ }
                        return undefined;
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
                            if (isNetworkMatchClientSpectator(client)) return undefined;
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
                            if (isNetworkMatchClientSpectator(client)) return false;
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
            const controllerEvents = require('../game/controller-events');
            if (controllerEvents && typeof controllerEvents.setControllerEventsRuntime === 'function') {
                controllerEvents.setControllerEventsRuntime({
                    getGameEvents: () => {
                        try {
                            return typeof globalThis !== 'undefined' ? (globalThis as any).GameEvents : null;
                        } catch (e: any) {
                            return null;
                        }
                    }
                });
            }
        } catch (e: any) { /* ignore */ }

        try {
            const turnPipelinePhases = require('../game/turn/turn_pipeline_phases');
            if (turnPipelinePhases && typeof turnPipelinePhases.setTurnPipelinePhasesRuntime === 'function') {
                turnPipelinePhases.setTurnPipelinePhasesRuntime({
                    isDebugLogAvailable: runtimeResolvers.isDebugLogAvailable,
                    debugLog: runtimeResolvers.debugLog,
                    readMatchMode: runtimeResolvers.readMatchMode
                });
            }
        } catch (e: any) { /* ignore */ }

        try {
            const hyperactiveCards = require('../game/logic/cards/hyperactive');
            if (hyperactiveCards && typeof hyperactiveCards.setHyperactiveRuntime === 'function') {
                hyperactiveCards.setHyperactiveRuntime({
                    isDebugLogAvailable: () => isDebugSessionEnabled(),
                    debugLog,
                    readRuntimeModule: (key: string) => {
                        try {
                            if (typeof globalThis !== 'undefined') return (globalThis as any)[key];
                        } catch (e: any) { /* ignore */ }
                        return undefined;
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
                        readQuerySearch: runtimeResolvers.readQuerySearch
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

    function installUIDI(timersImpl: any, timerService: any) {
        const runtimeResolvers = createBootstrapRuntimeResolvers();
        const initGameModule = (() => {
            try { return require('./bootstrap/init-game'); } catch (e: any) { return null; }
        })();
        if (initGameModule && typeof initGameModule.installMoveExecutorRuntime === 'function') {
            initGameModule.installMoveExecutorRuntime({
                requireModule: (id: string) => require(id),
                connectUIRuntime: _connect,
                timersImpl,
                timerService,
                runtimeResolvers,
                getPlaybackStateModuleForReset,
                isNetworkMatchClientSpectator,
                isDebugSessionEnabled
            });
        }

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
            if (tm && typeof tm.setTurnManagerTimerService === 'function') {
                tm.setTurnManagerTimerService(timerService || null);
            }
            if (tm && typeof tm.setUIImpl === 'function') {
                tm.setUIImpl({
                    getRuntimeRoot: () => {
                        try { return typeof globalThis !== 'undefined' ? globalThis : null; } catch (e: any) { return null; }
                    },
                    getGamePrng: () => {
                        try {
                            return (typeof globalThis !== 'undefined' && typeof (globalThis as any).getGamePrng === 'function')
                                ? (globalThis as any).getGamePrng()
                                : undefined;
                        } catch (e: any) {
                            return undefined;
                        }
                    },
                    isDebugLogAvailable: () => isDebugSessionEnabled(),
                    readRuntimeValue: (key: string) => {
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any)[key] : undefined; } catch (e: any) { return undefined; }
                    },
                    writeRuntimeValue: (key: string, value: any) => {
                        try { if (typeof globalThis !== 'undefined') (globalThis as any)[key] = value; } catch (e: any) { /* ignore */ }
                    },
                    clearLegalMoveHints: clearLegalMoveHintsForTurnManager,
                    readProcessing: () => {
                        try {
                            const playbackState = getPlaybackStateModuleForReset();
                            if (playbackState && typeof playbackState.getProcessing === 'function') {
                                return playbackState.getProcessing() === true;
                            }
                        } catch (e: any) { /* ignore */ }
                        try { return typeof globalThis !== 'undefined' && (globalThis as any).isProcessing === true; } catch (e: any) { return false; }
                    },
                    readCardAnimating: () => {
                        try {
                            const playbackState = getPlaybackStateModuleForReset();
                            if (playbackState && typeof playbackState.getCardAnimating === 'function') {
                                return playbackState.getCardAnimating() === true;
                            }
                        } catch (e: any) { /* ignore */ }
                        try { return typeof globalThis !== 'undefined' && (globalThis as any).isCardAnimating === true; } catch (e: any) { return false; }
                    },
                    readPlaybackActive: () => {
                        try {
                            const playbackState = getPlaybackStateModuleForReset();
                            if (playbackState && typeof playbackState.getPlaybackActive === 'function') {
                                return playbackState.getPlaybackActive() === true;
                            }
                        } catch (e: any) { /* ignore */ }
                        try { return typeof globalThis !== 'undefined' && (globalThis as any).VisualPlaybackActive === true; } catch (e: any) { return false; }
                    },
                    setBusyState: (config: any) => {
                        const next = (config && typeof config === 'object') ? config : {};
                        try {
                            const playbackState = getPlaybackStateModuleForReset();
                            if (playbackState && typeof playbackState.setBusyState === 'function') {
                                playbackState.setBusyState(next);
                            } else if (playbackState) {
                                if (Object.prototype.hasOwnProperty.call(next, 'processing') && typeof playbackState.setProcessing === 'function') {
                                    playbackState.setProcessing(next.processing === true);
                                }
                                if (Object.prototype.hasOwnProperty.call(next, 'cardAnimating') && typeof playbackState.setCardAnimating === 'function') {
                                    playbackState.setCardAnimating(next.cardAnimating === true);
                                }
                                if (Object.prototype.hasOwnProperty.call(next, 'playbackActive') && typeof playbackState.setPlaybackActive === 'function') {
                                    playbackState.setPlaybackActive(next.playbackActive === true);
                                }
                            }
                            if (playbackState && next.playbackActive === false && typeof playbackState.setPlaybackStartedAt === 'function') {
                                playbackState.setPlaybackStartedAt(null);
                            }
                        } catch (e: any) { /* ignore */ }
                        try {
                            if (typeof globalThis !== 'undefined') {
                                if (Object.prototype.hasOwnProperty.call(next, 'processing')) (globalThis as any).isProcessing = next.processing === true;
                                if (Object.prototype.hasOwnProperty.call(next, 'cardAnimating')) (globalThis as any).isCardAnimating = next.cardAnimating === true;
                                if (Object.prototype.hasOwnProperty.call(next, 'playbackActive')) {
                                    (globalThis as any).VisualPlaybackActive = next.playbackActive === true;
                                    if (next.playbackActive === true && !Number.isFinite(Number((globalThis as any).__playbackActiveSince))) {
                                        (globalThis as any).__playbackActiveSince = Date.now();
                                    } else if (next.playbackActive === false) {
                                        (globalThis as any).__playbackActiveSince = null;
                                    }
                                }
                            }
                        } catch (e: any) { /* ignore */ }
                    },
                    clearPlaybackLock: () => {
                        try {
                            const playbackState = getPlaybackStateModuleForReset();
                            if (playbackState && typeof playbackState.abortPlayback === 'function') {
                                playbackState.abortPlayback();
                                return true;
                            }
                            if (playbackState && typeof playbackState.clearPlaybackLock === 'function') {
                                playbackState.clearPlaybackLock();
                                return true;
                            }
                        } catch (e: any) { /* ignore */ }
                        return false;
                    },
                    readPlaybackStartedAt: () => {
                        try {
                            const playbackState = getPlaybackStateModuleForReset();
                            if (playbackState && typeof playbackState.getPlaybackStartedAt === 'function') {
                                return playbackState.getPlaybackStartedAt();
                            }
                        } catch (e: any) { /* ignore */ }
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any).__playbackActiveSince : null; } catch (e: any) { return null; }
                    },
                    readPlaybackRunning: () => {
                        try {
                            const root = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
                            const engine = root && root.AnimationEngine;
                            if (engine && typeof engine.isPlaying === 'boolean') return engine.isPlaying === true;
                        } catch (e: any) { /* ignore */ }
                        return null;
                    },
                    shouldAllowSelectionEntryDuringPlayback: (payload: any) => {
                        try {
                            const playbackState = getPlaybackStateModuleForReset();
                            if (playbackState && typeof playbackState.shouldAllowSelectionEntryDuringPlayback === 'function') {
                                return playbackState.shouldAllowSelectionEntryDuringPlayback(payload || {}) === true;
                            }
                        } catch (e: any) { /* ignore */ }
                        return false;
                    },
                    emitPresentationEvent: (ev: any) => {
                        try {
                            const presentationHelper = resolvePresentationHelperModule();
                            if (!presentationHelper || typeof presentationHelper.emitPresentationEvent !== 'function') return false;
                            const cardStateRef = typeof globalThis !== 'undefined' ? (globalThis as any).cardState : null;
                            return presentationHelper.emitPresentationEvent(cardStateRef, ev) === true;
                        } catch (e: any) {
                            return false;
                        }
                    },
                    playTurnStartSpecialEffects: async (player: any, events: any[]) => {
                        const startEvents = Array.isArray(events) ? events : [];
                        const run = async (moduleId: string, fnName: string, args: any[]) => {
                            try {
                                const mod = require(moduleId);
                                const fn = mod && mod[fnName];
                                if (typeof fn === 'function') await fn(...args);
                            } catch (e: any) { /* ignore */ }
                        };
                        await run('../game/special-effects/bombs', 'processBombs', [startEvents]);
                        await run('../game/special-effects/udg', 'processUltimateDestroyGodsAtTurnStart', [player, null, startEvents]);
                        await run('../game/special-effects/dragons', 'processUltimateReverseDragonsAtTurnStart', [player, startEvents]);
                        await run('../game/special-effects/breeding', 'processBreedingEffectsAtTurnStart', [player, startEvents]);
                        await run('../game/special-effects/hyperactive', 'processHyperactiveMovesAtTurnStart', [player, null, startEvents]);
                    },
                    dispatchPendingSelection: (payload: any) => {
                        const handlerNames: Record<string, string> = {
                            destroy: 'handleDestroySelection',
                            reverse_will: 'handleReverseWillSelection',
                            strong_wind: 'handleStrongWindSelection',
                            buoyancy: 'handleBuoyancySelection',
                            super_buoyancy: 'handleSuperBuoyancySelection',
                            gravity: 'handleGravitySelection',
                            super_gravity: 'handleSuperGravitySelection',
                            super_attraction: 'handleSuperAttractionSelection',
                            teleport: 'handleTeleportSelection',
                            cell_teleport: 'handleTeleportSelection',
                            tempt: 'handleTemptSelection',
                            capture: 'handleCaptureSelection',
                            trap: 'handleTrapSelection',
                            guard: 'handleGuardSelection',
                            living_will: 'handleLivingWillSelection',
                            extend_life: 'handleExtendLifeSelection',
                            corrosion: 'handleCorrosionSelection',
                            clone: 'handleCloneSelection',
                            blockade: 'handleBlockadeSelection',
                            poison: 'handlePoisonSelection',
                            board_expansion: 'handleBoardExpansionSelection',
                            board_shrink: 'handleBoardShrinkSelection',
                            freeze: 'handleFreezeSelection',
                            seed: 'handleSeedSelection',
                            position_swap: 'handlePositionSwapSelection',
                            meteor: 'handleMeteorSelection',
                            causal_replay: 'handleCausalReplaySelection',
                            time_bomb: 'handleTimeBombSelection',
                            swap_with_enemy: 'handleSwapSelection'
                        };
                        const key = String(payload && payload.dispatchKey || '');
                        const handlerName = handlerNames[key];
                        if (!handlerName) return false;
                        const roots = [
                            (typeof window !== 'undefined' ? window : null),
                            (typeof globalThis !== 'undefined' ? globalThis : null)
                        ];
                        for (let index = 0; index < roots.length; index += 1) {
                            const root = roots[index] as unknown as Record<string, any> | null;
                            const handler = root ? root[handlerName] : null;
                            if (typeof handler !== 'function') continue;
                            handler(payload.row, payload.col, payload.playerKey, payload.directionKey);
                            return true;
                        }
                        const moduleHandlers: Record<string, { moduleId: string; exportName: string }> = {
                            destroy: {
                                moduleId: '../game/card-effects/destroy',
                                exportName: 'handleDestroySelection'
                            }
                        };
                        const moduleHandler = moduleHandlers[key];
                        if (moduleHandler) {
                            try {
                                const mod = require(moduleHandler.moduleId);
                                const handler = mod ? mod[moduleHandler.exportName] : null;
                                if (typeof handler === 'function') {
                                    handler(payload.row, payload.col, payload.playerKey);
                                    return true;
                                }
                            } catch (e: any) { /* ignore */ }
                        }
                        return false;
                    },
                    readCpuSmartness: () => {
                        return {
                            black: readCpuSmartnessValueFromSelect('smartBlack'),
                            white: readCpuSmartnessValueFromSelect('smartWhite')
                        };
                    },
                    readMatchMode: runtimeResolvers.readMatchMode,
                    readHumanVsHumanMode: runtimeResolvers.readHumanVsHumanMode,
                    updateCpuCharacter: () => {
                        try {
                            const fn = typeof globalThis !== 'undefined' ? (globalThis as any).updateCpuCharacter : null;
                            if (typeof fn !== 'function') return false;
                            fn();
                            return true;
                        } catch (e: any) {
                            return false;
                        }
                    },
                    showResult: () => {
                        try {
                            const fn = typeof globalThis !== 'undefined' ? (globalThis as any).showResult : null;
                            if (typeof fn !== 'function') return false;
                            fn();
                            return true;
                        } catch (e: any) {
                            return false;
                        }
                    },
                    readNetworkSeatKey: () => {
                        try {
                            if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return null;
                            const client = (globalThis as any).NetworkMatchClient;
                            if (typeof client.getSeatKey !== 'function') return null;
                            return client.getSeatKey();
                        } catch (e: any) { /* ignore */ }
                        return null;
                    },
                    isNetworkSpectator: () => {
                        try {
                            if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return false;
                            return isNetworkMatchClientSpectator((globalThis as any).NetworkMatchClient);
                        } catch (e: any) { /* ignore */ }
                        return false;
                    },
                    emitStatus: (message: any, isError?: any) => {
                        try {
                            const root = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
                            const writer = root && root.writeNetworkStatus;
                            if (typeof writer !== 'function') return false;
                            writer(String(message || ''), isError === true);
                            return true;
                        } catch (e: any) { /* ignore */ }
                        return false;
                    },
                    publishNetworkSnapshot: (meta: any) => {
                        try {
                            if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return undefined;
                            const client = (globalThis as any).NetworkMatchClient;
                            if (typeof client.publishSnapshot !== 'function') return undefined;
                            if (typeof client.isActive === 'function' && !client.isActive()) return undefined;
                            if (isNetworkMatchClientSpectator(client)) return undefined;
                            return client.publishSnapshot(meta);
                        } catch (e: any) { /* ignore */ }
                        return undefined;
                    },
                    isNetworkPublishActive: () => {
                        try {
                            if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return false;
                            const client = (globalThis as any).NetworkMatchClient;
                            if (typeof client.publishSnapshot !== 'function') return false;
                            if (isNetworkMatchClientSpectator(client)) return false;
                            if (typeof client.isActive === 'function') return client.isActive() === true;
                            return true;
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
                            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).clearBattleStatusPanel === 'function') {
                                (globalThis as any).clearBattleStatusPanel();
                                return;
                            }
                        } catch (e: any) { /* ignore */ }
                        try {
                            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).clearEffectLivePanel === 'function') {
                                (globalThis as any).clearEffectLivePanel();
                                return;
                            }
                        } catch (e: any) { /* ignore */ }
                        try {
                            const effectEl = (typeof document !== 'undefined') ? document.getElementById('effect-live-panel') : null;
                            if (effectEl && effectEl.getAttribute('data-battle-status-panel') === '1') {
                                const latestEl = effectEl.querySelector('.battle-status-latest');
                                if (latestEl) latestEl.textContent = '直近 -';
                            }
                        } catch (e: any) { /* ignore */ }
                    },
                    applyDebugTestScenarioAfterReset: (payload: any) => {
                        try {
                            if (!isDebugSessionEnabled()) return { applied: false, reason: 'debug_disabled' };
                            const root = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
                            if (root && typeof root.getCurrentMatchMode === 'function' && root.getCurrentMatchMode() === 'network') {
                                return { applied: false, reason: 'network_mode' };
                            }
                            const scenarios = require('./debug-test-scenarios');
                            if (!scenarios || typeof scenarios.readDebugTestScenarioFromLocation !== 'function' || typeof scenarios.applyDebugTestScenarioAfterReset !== 'function') {
                                return { applied: false, reason: 'scenario_module_unavailable' };
                            }
                            const scenarioId = scenarios.readDebugTestScenarioFromLocation(root);
                            if (!scenarioId) return { applied: false, reason: 'no_scenario' };
                            return scenarios.applyDebugTestScenarioAfterReset({
                                ...(payload && typeof payload === 'object' ? payload : {}),
                                scenarioId
                            });
                        } catch (e: any) {
                            return { applied: false, reason: 'scenario_error', error: e && e.message ? e.message : String(e) };
                        }
                    }
                });
            }
        } catch (e: any) { /* ignore */ }
    }

    function installGameDI() {
        if (_gameDIInstallResult) return _gameDIInstallResult;

        const timersImpl = installCoreDI();
        const timerService = createInjectedTimerService(timersImpl);
        installCardDI();
        installNetworkDI(timerService);
        installUIDI(timersImpl, timerService);
        try {
            const sharedBootstrap = resolveSharedUIBootstrapHelpers();
            const sharedGlobals = sharedBootstrap && typeof sharedBootstrap.getRegisteredUIGlobals === 'function'
                ? sharedBootstrap.getRegisteredUIGlobals()
                : null;
            if (sharedGlobals && typeof sharedGlobals === 'object') {
                registerUIGlobals(sharedGlobals);
            }
        } catch (e: any) { /* ignore */ }

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

    function getBoardVisualController() {
        try {
            const renderer = _require('./board-renderer');
            return renderer && typeof renderer.getBoardVisualController === 'function'
                ? renderer.getBoardVisualController()
                : null;
        } catch (e: any) {
            return null;
        }
    }

    function ensureOwnerHelpersGlobal() {
        if (!OwnerHelpersModule) return null;
        try {
            registerUIGlobals({ OwnerHelpers: OwnerHelpersModule });
        } catch (e: any) { /* ignore */ }
        return OwnerHelpersModule;
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

    function dispatchAssetManifestUpdated(manifest: any, options: any = {}) {
        const target = resolveAssetManifestEventTarget(options.root);
        if (!target) return false;

        const event = createAssetManifestUpdatedEvent(target, manifest);
        if (!event) return false;
        try { target.dispatchEvent(event); } catch (e: any) { /* ignore */ }
        return true;
    }

    function preloadAssets(manifest: any, opts: any) {
        try {
            const impl = installGameDI();
            return impl.preloadAssets(manifest, opts);
        } catch (e: any) {
            return Promise.resolve({ success: false, loaded: [], failed: [{ reason: String(e) }] });
        }
    }

    const assetManifestRuntime = BootstrapAssetManifestRuntime && typeof BootstrapAssetManifestRuntime.createAssetManifestRuntime === 'function'
        ? BootstrapAssetManifestRuntime.createAssetManifestRuntime({
            preloadAssets,
            isAssetManifestShape,
            dispatchAssetManifestUpdated
        })
        : null;

    const setLoadedAssetManifest = assetManifestRuntime.setLoadedAssetManifest;
    const getLoadedAssetManifest = assetManifestRuntime.getLoadedAssetManifest;
    const refreshLoadedAssetManifest = assetManifestRuntime.refreshLoadedAssetManifest;
    const applyAssetManifest = assetManifestRuntime.applyAssetManifest;
    const handleGameInit = assetManifestRuntime.handleGameInit;

    const UIBootstrap = {
        addLog: (typeof addLog === 'function') ? addLog : function () { return false; },
        debugLog: (typeof debugLog === 'function') ? debugLog : function () { return false; },
        updateBgmButtons,
        updateStatus,
        installGameDI,
        isGameDIInstalled,
        registerUIGlobals,
        getRegisteredUIGlobals,
        getBoardVisualController,
        configureCpuCandidateScoring,
        configurePixiRuntime,
        markPixiRuntimeUnavailable,
        getPixiRuntimeCapability,
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

    let uiBootstrapRuntimeInitialized = false;
    function initializeUIBootstrapRuntime(runtimeRoot?: any): boolean {
        if (uiBootstrapRuntimeInitialized) return false;
        ensureOwnerHelpersGlobal();
        const target = runtimeRoot || (typeof window !== 'undefined' ? window : null);
        try {
            if (target) {
                (target as { UIBootstrap?: typeof UIBootstrap }).UIBootstrap = UIBootstrap;
                if (String((target as any).__CARD_REVERSI_BROWSER_LANE__ || '').toLowerCase() === 'classic') {
                    if ((target as any).PIXI) {
                        configurePixiRuntime((target as any).PIXI, { root: target, lane: 'classic' });
                    } else {
                        markPixiRuntimeUnavailable('classic-global-missing', { root: target, lane: 'classic' });
                    }
                }
            }
        } catch (e: any) { /* ignore */ }
        uiBootstrapRuntimeInitialized = true;
        return true;
    }
    Object.defineProperty(UIBootstrap, 'initializeUIBootstrapRuntime', {
        configurable: false,
        enumerable: false,
        value: initializeUIBootstrapRuntime
    });
export = UIBootstrap;

