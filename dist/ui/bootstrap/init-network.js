'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function _isDebugAllowed() {
    try {
        const w = window;
        if (w.DEBUG_MODE_ALLOWED === true)
            return true;
        if (w.DEBUG_MODE_ALLOWED === false)
            return false;
        const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
        return /[?&]debug=1/.test(qs) || /[?&]debug=true/.test(qs);
    }
    catch (e) {
        return false;
    }
}
function _syncPlaybackWindowFlags() {
    try {
        const playbackState = (typeof window.PlaybackStateManager !== 'undefined') ? window.PlaybackStateManager : null;
        if (playbackState && typeof playbackState.syncLegacyWindowFlags === 'function') {
            return playbackState.syncLegacyWindowFlags();
        }
    }
    catch (e) { /* ignore */ }
    return { isCardAnimating: false, isProcessing: false };
}
function _readCardAnimatingFlag() {
    try {
        const playbackState = (typeof window.PlaybackStateManager !== 'undefined') ? window.PlaybackStateManager : null;
        if (playbackState && typeof playbackState.getCardAnimating === 'function') {
            return playbackState.getCardAnimating() === true;
        }
    }
    catch (e) { /* ignore */ }
    return (typeof window.isCardAnimating !== 'undefined') ? window.isCardAnimating : false;
}
function _readProcessingFlag() {
    try {
        const playbackState = (typeof window.PlaybackStateManager !== 'undefined') ? window.PlaybackStateManager : null;
        if (playbackState && typeof playbackState.getProcessing === 'function') {
            return playbackState.getProcessing() === true;
        }
    }
    catch (e) { /* ignore */ }
    return (typeof window.isProcessing !== 'undefined') ? window.isProcessing : false;
}
function _setPlaybackBusyFlags(options) {
    const config = (options && typeof options === 'object') ? options : { processing: options === true, cardAnimating: options === true };
    try {
        const playbackState = (typeof window.PlaybackStateManager !== 'undefined') ? window.PlaybackStateManager : null;
        if (playbackState && typeof playbackState.setBusyState === 'function') {
            playbackState.setBusyState(config);
            return _syncPlaybackWindowFlags();
        }
    }
    catch (e) { /* ignore */ }
    if (typeof window !== 'undefined') {
        if (Object.prototype.hasOwnProperty.call(config, 'cardAnimating'))
            window.isCardAnimating = config.cardAnimating === true;
        if (Object.prototype.hasOwnProperty.call(config, 'processing'))
            window.isProcessing = config.processing === true;
    }
    return _syncPlaybackWindowFlags();
}
async function initNetworkAndDebug() {
    const debugAllowed = _isDebugAllowed();
    try {
        if (typeof fetch === 'function' && typeof window.UIBootstrap !== 'undefined' && typeof window.UIBootstrap.preloadAssets === 'function') {
            try {
                if (typeof location !== 'undefined' && (location.protocol === 'file:' || location.origin === 'null'))
                    return;
            }
            catch (e) { /* ignore */ }
            try {
                const res = await fetch('assets/asset-manifest.json', { cache: 'no-store' });
                if (res && res.ok) {
                    const manifest = await res.json();
                    if (typeof window.UIBootstrap.setLoadedAssetManifest === 'function') {
                        window.UIBootstrap.setLoadedAssetManifest(manifest, { root: window, dispatch: true });
                    }
                    const preloadRes = await window.UIBootstrap.preloadAssets(manifest, { timeoutMs: 5000 });
                    if (!preloadRes.success) {
                        console.warn('[init] asset preloading incomplete', preloadRes.failed);
                    }
                }
            }
            catch (e) { /* ignore */ }
        }
    }
    catch (e) { /* ignore */ }
    if (typeof window !== 'undefined') {
        try {
            const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
            if (qs.indexOf('?noanim=1') !== -1 || qs.indexOf('&noanim=1') !== -1)
                window.DISABLE_ANIMATIONS = true;
        }
        catch (e) { /* ignore */ }
        if (typeof window.TimerRegistry !== 'undefined')
            window.TimerRegistry = window.TimerRegistry;
        if (typeof window.GameTimers !== 'undefined' && typeof window.GameTimers.setTimerImpl === 'function' && !window.__timersInjected) {
            window.GameTimers.setTimerImpl({
                waitMs: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                requestFrame: () => new Promise(resolve => requestAnimationFrame(resolve))
            });
            window.__timersInjected = true;
        }
        _syncPlaybackWindowFlags();
        if (window.DISABLE_ANIMATIONS === true) {
            _setPlaybackBusyFlags({ cardAnimating: false, processing: false });
        }
        if (debugAllowed) {
            window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
            window.getTelemetrySnapshot = function () { return Object.assign({}, window.__telemetry__); };
            window.resetTelemetry = function () { window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; };
            if (typeof window._watchdogIntervalId === 'undefined' || window._watchdogIntervalId === null) {
                window._watchdogIntervalId = setInterval(() => {
                    try {
                        if (typeof window.watchdogPing === 'function')
                            window.watchdogPing();
                    }
                    catch (e) { /* ignore */ }
                }, 250);
            }
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
                                if (board)
                                    board.classList.remove('playback-locked');
                                window.__playbackActiveSince = null;
                            }
                        }
                        else {
                            window.__playbackActiveSince = null;
                        }
                    }
                    catch (e) { /* ignore */ }
                }, 500);
            }
        }
    }
}
const InitNetwork = {
    initNetworkAndDebug
};
module.exports = InitNetwork;
//# sourceMappingURL=init-network.js.map