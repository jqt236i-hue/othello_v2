'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

type AssetManifest = {
  files: unknown[];
  [key: string]: unknown;
};

type AssetManifestResult =
  | { status: 'ok'; manifest: AssetManifest }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: string; code?: number | null };

type AssetManifestResponse = {
  ok: boolean;
  status?: unknown;
  json: () => Promise<unknown>;
};

type AssetManifestRoot = {
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<AssetManifestResponse>;
  location?: { protocol?: string; origin?: string };
  UIBootstrap?: AssetManifestBootstrap;
};

type AssetManifestBootstrap = {
  setLoadedAssetManifest?: (
    manifest: AssetManifest,
    options: { root: AssetManifestRoot; dispatch: boolean }
  ) => unknown;
};

function _isDebugAllowed(): boolean {
  try {
    const w = window as any;
    if (w.DEBUG_MODE_ALLOWED === true) return true;
    if (w.DEBUG_MODE_ALLOWED === false) return false;
    const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
    return /[?&]debug=1/.test(qs)
      || /[?&]debug=true/i.test(qs)
      || /[?&]specialDebug=1/.test(qs)
      || /[?&]specialDebug=true/i.test(qs)
      || /[?&]special-debug=1/.test(qs)
      || /[?&]special-debug=true/i.test(qs);
  } catch (e) { return false; }
}

function _requireInitNetworkModuleOrNull(id: string): any {
  if (typeof _require !== 'function') return null;
  try {
    return _require(id);
  } catch (e) {
    /* ignore */
  }
  return null;
}

function _resolvePlaybackStateManager(): any {
  try {
    if (typeof window !== 'undefined' && (window as any).PlaybackStateManager) return (window as any).PlaybackStateManager;
  } catch (e) { /* ignore */ }
  return _requireInitNetworkModuleOrNull('../playback-state-manager.js');
}

function _resolvePlaybackRuntime(): any {
  try {
    if (typeof window !== 'undefined' && (window as any).PlaybackRuntime) return (window as any).PlaybackRuntime;
  } catch (e) { /* ignore */ }
  return _requireInitNetworkModuleOrNull('../playback-runtime.js');
}

function _syncPlaybackWindowFlags(): any {
  try {
    const playbackRuntime = _resolvePlaybackRuntime();
    const playbackState = _resolvePlaybackStateManager();
    if (playbackRuntime && typeof playbackRuntime.syncLegacyWindowFlags === 'function') {
      return playbackRuntime.syncLegacyWindowFlags(playbackState, {
        readCardAnimating: _readCardAnimatingFlag,
        readProcessing: _readProcessingFlag
      });
    }
    if (playbackState && typeof playbackState.syncLegacyWindowFlags === 'function') {
      return playbackState.syncLegacyWindowFlags();
    }
  } catch (e) { /* ignore */ }
  return { isCardAnimating: false, isProcessing: false };
}

function _readCardAnimatingFlag(): boolean {
  try {
    const playbackState = _resolvePlaybackStateManager();
    if (playbackState && typeof playbackState.getCardAnimating === 'function') {
      return playbackState.getCardAnimating() === true;
    }
  } catch (e) { /* ignore */ }
  return (typeof (window as any).isCardAnimating !== 'undefined') ? (window as any).isCardAnimating : false;
}

function _readProcessingFlag(): boolean {
  try {
    const playbackState = _resolvePlaybackStateManager();
    if (playbackState && typeof playbackState.getProcessing === 'function') {
      return playbackState.getProcessing() === true;
    }
  } catch (e) { /* ignore */ }
  return (typeof (window as any).isProcessing !== 'undefined') ? (window as any).isProcessing : false;
}

function _setPlaybackBusyFlags(options?: any): any {
  const config = (options && typeof options === 'object') ? options : { processing: options === true, cardAnimating: options === true };
  try {
    const playbackState = _resolvePlaybackStateManager();
    if (playbackState && typeof playbackState.setBusyState === 'function') {
      playbackState.setBusyState(config);
      return _syncPlaybackWindowFlags();
    }
  } catch (e) { /* ignore */ }
  if (typeof window !== 'undefined') {
    if (Object.prototype.hasOwnProperty.call(config, 'cardAnimating')) (window as any).isCardAnimating = config.cardAnimating === true;
    if (Object.prototype.hasOwnProperty.call(config, 'processing')) (window as any).isProcessing = config.processing === true;
  }
  return _syncPlaybackWindowFlags();
}

async function initNetworkAndDebug(): Promise<void> {
  const debugAllowed = _isDebugAllowed();

  try {
    const rootRef: AssetManifestRoot | null = typeof window !== 'undefined' ? window : null;
    const uiBootstrap = rootRef?.UIBootstrap ?? null;
    const manifestResult = await loadAssetManifestForBoot(rootRef, uiBootstrap);
    if (manifestResult.status === 'error') {
      const log = debugAllowed ? console.warn : console.info;
      log('[init] asset manifest unavailable', manifestResult.reason);
    }
  } catch (e) { /* ignore */ }

  if (typeof window !== 'undefined') {
    try {
      const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
      if (qs.indexOf('?noanim=1') !== -1 || qs.indexOf('&noanim=1') !== -1) (window as any).DISABLE_ANIMATIONS = true;
    } catch (e) { /* ignore */ }

    if (typeof (window as any).TimerRegistry !== 'undefined') (window as any).TimerRegistry = (window as any).TimerRegistry;
    if (typeof (window as any).GameTimers !== 'undefined' && typeof (window as any).GameTimers.setTimerImpl === 'function' && !(window as any).__timersInjected) {
      (window as any).GameTimers.setTimerImpl({
        waitMs: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
        requestFrame: () => new Promise(resolve => requestAnimationFrame(resolve))
      });
      (window as any).__timersInjected = true;
    }

    _syncPlaybackWindowFlags();

    if ((window as any).DISABLE_ANIMATIONS === true) {
      _setPlaybackBusyFlags({ cardAnimating: false, processing: false });
    }

    if (debugAllowed) {
      const playbackState = _resolvePlaybackStateManager();
      const playbackRuntime = _resolvePlaybackRuntime();
      if (playbackRuntime && typeof playbackRuntime.syncLegacyWindowFlags === 'function') {
        playbackRuntime.syncLegacyWindowFlags(playbackState, {
          readCardAnimating: _readCardAnimatingFlag,
          readProcessing: _readProcessingFlag
        });
      }
      if (playbackRuntime && typeof playbackRuntime.ensureDebugRuntime === 'function') {
        playbackRuntime.ensureDebugRuntime(playbackState, {
          readCardAnimating: _readCardAnimatingFlag,
          readProcessing: _readProcessingFlag,
          abortPlayback: () => {
            try {
              if ((window as any).AnimationEngine && typeof (window as any).AnimationEngine.abortAndSync === 'function') {
                (window as any).AnimationEngine.abortAndSync();
              }
            } catch (e) { /* ignore */ }
          },
          getBoardElement: () => document.getElementById('board')
        });
      }
      (window as any).__telemetry__ = (window as any).__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
      (window as any).getTelemetrySnapshot = function () { return Object.assign({}, (window as any).__telemetry__); };
      (window as any).resetTelemetry = function () { (window as any).__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; };

      if (typeof (window as any)._watchdogIntervalId === 'undefined' || (window as any)._watchdogIntervalId === null) {
        (window as any)._watchdogIntervalId = setInterval(() => {
          try { if (typeof (window as any).watchdogPing === 'function') (window as any).watchdogPing(); } catch (e) { /* ignore */ }
        }, 250);
      }

      const usingPlaybackRuntime = playbackRuntime && typeof playbackRuntime.ensureDebugRuntime === 'function';

      if (!usingPlaybackRuntime && (typeof (window as any)._uiMirrorIntervalId === 'undefined' || (window as any)._uiMirrorIntervalId === null)) {
        (window as any)._uiMirrorIntervalId = setInterval(() => {
          if (typeof window !== 'undefined') {
            (window as any).isCardAnimating = _readCardAnimatingFlag();
            (window as any).isProcessing = _readProcessingFlag();
          }
        }, 100);
      }

      if (!usingPlaybackRuntime && (typeof (window as any)._playbackWatchdogId === 'undefined' || (window as any)._playbackWatchdogId === null)) {
        (window as any)._playbackWatchdogId = setInterval(() => {
          try {
            if ((window as any).VisualPlaybackActive === true) {
              (window as any).__playbackActiveSince = (window as any).__playbackActiveSince || Date.now();
              const elapsed = Date.now() - (window as any).__playbackActiveSince;
              if (elapsed > 15000) {
                if ((window as any).AnimationEngine && typeof (window as any).AnimationEngine.abortAndSync === 'function') {
                  (window as any).AnimationEngine.abortAndSync();
                }
                (window as any).VisualPlaybackActive = false;
                const board = document.getElementById('board');
                if (board) board.classList.remove('playback-locked');
                (window as any).__playbackActiveSince = null;
              }
            } else {
              (window as any).__playbackActiveSince = null;
            }
          } catch (e) { /* ignore */ }
        }, 500);
      }
    }
  }
}

/**
 * Load and publish the asset manifest without eagerly downloading every asset.
 *
 * The manifest is an integrity/catalog source for feature-level preloaders. A
 * full-image preload here made cold boot fetch every background, card, and
 * special-stone image before the player had opened the corresponding feature.
 */
function isAssetManifest(value: unknown): value is AssetManifest {
  return !!value && typeof value === 'object' && Array.isArray((value as AssetManifest).files);
}

async function loadAssetManifestForBoot(
  rootRef: AssetManifestRoot | null,
  uiBootstrap: AssetManifestBootstrap | null
): Promise<AssetManifestResult> {
  if (!rootRef || typeof rootRef !== 'object') return { status: 'skipped', reason: 'root-unavailable' };
  const fetchFn = typeof rootRef.fetch === 'function'
    ? rootRef.fetch.bind(rootRef)
    : (typeof fetch === 'function' ? fetch : null);
  if (typeof fetchFn !== 'function') return { status: 'skipped', reason: 'fetch-unavailable' };
  try {
    const locationRef = rootRef.location || (typeof location !== 'undefined' ? location : null);
    if (locationRef && (locationRef.protocol === 'file:' || locationRef.origin === 'null')) {
      return { status: 'skipped', reason: 'file-origin' };
    }
  } catch (e) { /* ignore */ }

  try {
    const response = await fetchFn('assets/asset-manifest.json', { cache: 'no-cache' });
    if (!response || response.ok !== true) {
      return {
        status: 'error',
        reason: 'fetch-failed',
        code: response && Number.isFinite(Number(response.status)) ? Number(response.status) : null
      };
    }
    const manifest = await response.json();
    if (!isAssetManifest(manifest)) {
      return { status: 'error', reason: 'invalid-manifest' };
    }
    if (uiBootstrap && typeof uiBootstrap.setLoadedAssetManifest === 'function') {
      uiBootstrap.setLoadedAssetManifest(manifest, { root: rootRef, dispatch: true });
    }
    return { status: 'ok', manifest };
  } catch (e) {
    return { status: 'error', reason: String(e) };
  }
}

const InitNetwork = {
  initNetworkAndDebug,
  loadAssetManifestForBoot
};

export = InitNetwork;
