'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function getRoot(root) {
    const base = root || (typeof globalThis !== 'undefined' ? globalThis : {});
    if (base && base.window && typeof base.window === 'object')
        return base.window;
    try {
        if (typeof window !== 'undefined' && window)
            return window;
    }
    catch (e) { /* ignore */ }
    return base;
}
function getPlaybackState(playbackState) {
    if (playbackState && typeof playbackState === 'object')
        return playbackState;
    const target = getRoot();
    try {
        if (target && target.PlaybackStateManager && typeof target.PlaybackStateManager === 'object') {
            return target.PlaybackStateManager;
        }
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis && globalThis.PlaybackStateManager) {
            return globalThis.PlaybackStateManager;
        }
    }
    catch (e) { /* ignore */ }
    return null;
}
function syncLegacyWindowFlags(playbackState, options) {
    const manager = getPlaybackState(playbackState);
    const config = (options && typeof options === 'object') ? options : {};
    const nextState = {};
    if (typeof config.readCardAnimating === 'function') {
        nextState.cardAnimating = config.readCardAnimating() === true;
    }
    else if (Object.prototype.hasOwnProperty.call(config, 'cardAnimating')) {
        nextState.cardAnimating = config.cardAnimating === true;
    }
    if (typeof config.readProcessing === 'function') {
        nextState.processing = config.readProcessing() === true;
    }
    else if (Object.prototype.hasOwnProperty.call(config, 'processing')) {
        nextState.processing = config.processing === true;
    }
    if (manager && typeof manager.setBusyState === 'function') {
        if (Object.keys(nextState).length > 0) {
            manager.setBusyState(nextState);
        }
        return {
            isCardAnimating: manager.getCardAnimating && manager.getCardAnimating() === true,
            isProcessing: manager.getProcessing && manager.getProcessing() === true,
            playbackActive: manager.getPlaybackActive && manager.getPlaybackActive() === true
        };
    }
    return {
        isCardAnimating: nextState.cardAnimating === true,
        isProcessing: nextState.processing === true,
        playbackActive: false
    };
}
function ensureDebugRuntime(playbackState, options) {
    const manager = getPlaybackState(playbackState);
    const target = getRoot();
    const config = (options && typeof options === 'object') ? options : {};
    const readCardAnimating = (typeof config.readCardAnimating === 'function')
        ? config.readCardAnimating
        : function () { return target.isCardAnimating === true; };
    const readProcessing = (typeof config.readProcessing === 'function')
        ? config.readProcessing
        : function () { return target.isProcessing === true; };
    const requestAbortPlayback = (typeof config.abortPlayback === 'function')
        ? config.abortPlayback
        : function () {
            try {
                if (target.AnimationEngine && typeof target.AnimationEngine.abortAndSync === 'function') {
                    target.AnimationEngine.abortAndSync();
                }
            }
            catch (e) { /* ignore */ }
        };
    const getBoardElement = (typeof config.getBoardElement === 'function')
        ? config.getBoardElement
        : function () {
            try {
                if (target.document && typeof target.document.getElementById === 'function') {
                    return target.document.getElementById('board');
                }
            }
            catch (e) { /* ignore */ }
            return null;
        };
    const mirrorIntervalMs = Number.isFinite(Number(config.mirrorIntervalMs))
        ? Math.max(16, Math.trunc(Number(config.mirrorIntervalMs)))
        : 100;
    const watchdogIntervalMs = Number.isFinite(Number(config.watchdogIntervalMs))
        ? Math.max(50, Math.trunc(Number(config.watchdogIntervalMs)))
        : 500;
    const watchdogTimeoutMs = Number.isFinite(Number(config.watchdogTimeoutMs))
        ? Math.max(1000, Math.trunc(Number(config.watchdogTimeoutMs)))
        : 15000;
    const setIntervalImpl = (typeof setInterval === 'function')
        ? setInterval
        : ((typeof target.setInterval === 'function') ? target.setInterval.bind(target) : null);
    const clearIntervalImpl = (typeof clearInterval === 'function')
        ? clearInterval
        : ((typeof target.clearInterval === 'function') ? target.clearInterval.bind(target) : null);
    syncLegacyWindowFlags(manager, {
        readCardAnimating,
        readProcessing
    });
    if (setIntervalImpl && (typeof target._uiMirrorIntervalId === 'undefined' || target._uiMirrorIntervalId === null)) {
        target._uiMirrorIntervalId = setIntervalImpl(function () {
            try {
                syncLegacyWindowFlags(manager, {
                    readCardAnimating,
                    readProcessing
                });
            }
            catch (e) { /* ignore */ }
        }, mirrorIntervalMs);
    }
    if (manager && setIntervalImpl && (typeof target._playbackWatchdogId === 'undefined' || target._playbackWatchdogId === null)) {
        target._playbackWatchdogId = setIntervalImpl(function () {
            try {
                if (manager.getPlaybackActive && manager.getPlaybackActive() === true) {
                    const startedAt = manager.getPlaybackStartedAt && manager.getPlaybackStartedAt();
                    if ((startedAt === null || typeof startedAt === 'undefined') && typeof manager.setPlaybackStartedAt === 'function') {
                        manager.setPlaybackStartedAt(Date.now());
                    }
                    const activeSince = manager.getPlaybackStartedAt && manager.getPlaybackStartedAt();
                    if (Number.isFinite(activeSince) && (Date.now() - activeSince) > watchdogTimeoutMs) {
                        requestAbortPlayback();
                        if (manager.getPlaybackActive && manager.getPlaybackActive() === true && typeof manager.abortPlayback === 'function') {
                            manager.abortPlayback({ boardElement: getBoardElement() });
                        }
                    }
                }
                else if (typeof manager.setPlaybackStartedAt === 'function') {
                    manager.setPlaybackStartedAt(null);
                }
            }
            catch (e) { /* ignore */ }
        }, watchdogIntervalMs);
    }
    return {
        mirrorIntervalId: target._uiMirrorIntervalId || null,
        playbackWatchdogId: target._playbackWatchdogId || null,
        clear: function () {
            if (target._uiMirrorIntervalId !== null && typeof target._uiMirrorIntervalId !== 'undefined') {
                clearIntervalImpl(target._uiMirrorIntervalId);
                target._uiMirrorIntervalId = null;
            }
            if (target._playbackWatchdogId !== null && typeof target._playbackWatchdogId !== 'undefined') {
                clearIntervalImpl(target._playbackWatchdogId);
                target._playbackWatchdogId = null;
            }
        }
    };
}
function clearDebugRuntime(playbackState) {
    const manager = getPlaybackState(playbackState);
    const target = getRoot();
    const clearIntervalImpl = (typeof clearInterval === 'function')
        ? clearInterval
        : ((typeof target.clearInterval === 'function') ? target.clearInterval.bind(target) : null);
    if (target._uiMirrorIntervalId !== null && typeof target._uiMirrorIntervalId !== 'undefined') {
        if (clearIntervalImpl)
            clearIntervalImpl(target._uiMirrorIntervalId);
        target._uiMirrorIntervalId = null;
    }
    if (target._playbackWatchdogId !== null && typeof target._playbackWatchdogId !== 'undefined') {
        if (clearIntervalImpl)
            clearIntervalImpl(target._playbackWatchdogId);
        target._playbackWatchdogId = null;
    }
    if (manager && typeof manager.setPlaybackStartedAt === 'function' && manager.getPlaybackActive && manager.getPlaybackActive() !== true) {
        manager.setPlaybackStartedAt(null);
    }
    return true;
}
const PlaybackRuntime = {
    syncLegacyWindowFlags,
    ensureDebugRuntime,
    clearDebugRuntime
};
module.exports = PlaybackRuntime;
//# sourceMappingURL=playback-runtime.js.map