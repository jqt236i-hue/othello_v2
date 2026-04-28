'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function _isDebugAllowed(): boolean {
  try {
    const w = window as any;
    if (w.DEBUG_MODE_ALLOWED === true) return true;
    if (w.DEBUG_MODE_ALLOWED === false) return false;
    const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
    return /[?&]debug=1/.test(qs) || /[?&]debug=true/.test(qs);
  } catch (e) { return false; }
}

function _syncPlaybackWindowFlags(): any {
  try {
    const playbackState = (typeof (window as any).PlaybackStateManager !== 'undefined') ? (window as any).PlaybackStateManager : null;
    if (playbackState && typeof playbackState.syncLegacyWindowFlags === 'function') {
      return playbackState.syncLegacyWindowFlags();
    }
  } catch (e) { /* ignore */ }
  return { isCardAnimating: false, isProcessing: false };
}

function _readCardAnimatingFlag(): boolean {
  try {
    const playbackState = (typeof (window as any).PlaybackStateManager !== 'undefined') ? (window as any).PlaybackStateManager : null;
    if (playbackState && typeof playbackState.getCardAnimating === 'function') {
      return playbackState.getCardAnimating() === true;
    }
  } catch (e) { /* ignore */ }
  return (typeof (window as any).isCardAnimating !== 'undefined') ? (window as any).isCardAnimating : false;
}

function _readProcessingFlag(): boolean {
  try {
    const playbackState = (typeof (window as any).PlaybackStateManager !== 'undefined') ? (window as any).PlaybackStateManager : null;
    if (playbackState && typeof playbackState.getProcessing === 'function') {
      return playbackState.getProcessing() === true;
    }
  } catch (e) { /* ignore */ }
  return (typeof (window as any).isProcessing !== 'undefined') ? (window as any).isProcessing : false;
}

function _setPlaybackBusyFlags(options?: any): any {
  const config = (options && typeof options === 'object') ? options : { processing: options === true, cardAnimating: options === true };
  try {
    const playbackState = (typeof (window as any).PlaybackStateManager !== 'undefined') ? (window as any).PlaybackStateManager : null;
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
    if (typeof fetch === 'function' && typeof (window as any).UIBootstrap !== 'undefined' && typeof (window as any).UIBootstrap.preloadAssets === 'function') {
      try {
        if (typeof location !== 'undefined' && (location.protocol === 'file:' || location.origin === 'null')) return;
      } catch (e) { /* ignore */ }
      try {
        const res = await fetch('assets/asset-manifest.json', { cache: 'no-store' });
        if (res && res.ok) {
          const manifest = await res.json();
          if (typeof (window as any).UIBootstrap.setLoadedAssetManifest === 'function') {
            (window as any).UIBootstrap.setLoadedAssetManifest(manifest, { root: window, dispatch: true });
          }
          const preloadRes = await (window as any).UIBootstrap.preloadAssets(manifest, { timeoutMs: 5000 });
          if (!preloadRes.success) {
            console.warn('[init] asset preloading incomplete', preloadRes.failed);
          }
        }
      } catch (e) { /* ignore */ }
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
      (window as any).__telemetry__ = (window as any).__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
      (window as any).getTelemetrySnapshot = function () { return Object.assign({}, (window as any).__telemetry__); };
      (window as any).resetTelemetry = function () { (window as any).__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; };

      if (typeof (window as any)._watchdogIntervalId === 'undefined' || (window as any)._watchdogIntervalId === null) {
        (window as any)._watchdogIntervalId = setInterval(() => {
          try { if (typeof (window as any).watchdogPing === 'function') (window as any).watchdogPing(); } catch (e) { /* ignore */ }
        }, 250);
      }

      if (typeof (window as any)._uiMirrorIntervalId === 'undefined' || (window as any)._uiMirrorIntervalId === null) {
        (window as any)._uiMirrorIntervalId = setInterval(() => {
          if (typeof window !== 'undefined') {
            (window as any).isCardAnimating = _readCardAnimatingFlag();
            (window as any).isProcessing = _readProcessingFlag();
          }
        }, 100);
      }

      if (typeof (window as any)._playbackWatchdogId === 'undefined' || (window as any)._playbackWatchdogId === null) {
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

const InitNetwork = {
  initNetworkAndDebug
};

export = InitNetwork;
