(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
    } else {
        root.PlaybackStateManager = factory(root);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
    'use strict';

    function getRoot() {
        const base = root || (typeof globalThis !== 'undefined' ? globalThis : {});
        if (base && base.window && typeof base.window === 'object') return base.window;
        try {
            if (typeof window !== 'undefined' && window) return window;
        } catch (e) { /* ignore */ }
        return base;
    }

    function getMirrorTargets() {
        const targets = [];
        const primary = getRoot();
        if (primary && typeof primary === 'object') {
            targets.push(primary);
        }
        try {
            if (typeof globalThis !== 'undefined' && globalThis && targets.indexOf(globalThis) === -1) {
                targets.push(globalThis);
            }
        } catch (e) { /* ignore */ }
        return targets;
    }

    function readMirroredValue(name) {
        const targets = getMirrorTargets();
        for (let index = 0; index < targets.length; index += 1) {
            const target = targets[index];
            try {
                if (typeof target[name] !== 'undefined') {
                    return target[name];
                }
            } catch (e) { /* ignore */ }
        }
        return undefined;
    }

    function setMirroredValue(name, value) {
        const targets = getMirrorTargets();
        for (let index = 0; index < targets.length; index += 1) {
            try {
                targets[index][name] = value;
            } catch (e) { /* ignore */ }
        }
        return value;
    }

    function getPlaybackActive() {
        return readMirroredValue('VisualPlaybackActive') === true;
    }

    function setPlaybackActive(active) {
        const next = active === true;
        setMirroredValue('VisualPlaybackActive', next);
        if (next) {
            if (!Number.isFinite(Number(readMirroredValue('__playbackActiveSince')))) {
                setMirroredValue('__playbackActiveSince', Date.now());
            }
        } else {
            setMirroredValue('__playbackActiveSince', null);
        }
        return next;
    }

    function setPlaybackStartedAt(value) {
        if (value === null || typeof value === 'undefined' || value === '') {
            return setMirroredValue('__playbackActiveSince', null);
        }
        const next = Number(value);
        return setMirroredValue('__playbackActiveSince', Number.isFinite(next) ? next : null);
    }

    function ensurePlaybackStartedAt(nowValue) {
        if (!getPlaybackActive()) {
            setPlaybackStartedAt(null);
            return null;
        }
        const startedAt = getPlaybackStartedAt();
        if (startedAt !== null) return startedAt;
        const next = Number(nowValue);
        return setPlaybackStartedAt(Number.isFinite(next) ? next : Date.now());
    }

    function getCardAnimating() {
        return readMirroredValue('isCardAnimating') === true || getPlaybackActive();
    }

    function setCardAnimating(active) {
        return setMirroredValue('isCardAnimating', active === true) === true;
    }

    function getProcessing() {
        return readMirroredValue('isProcessing') === true;
    }

    function setProcessing(active) {
        return setMirroredValue('isProcessing', active === true) === true;
    }

    function setBusyState(options) {
        const config = (options && typeof options === 'object')
            ? options
            : {
                processing: options === true,
                cardAnimating: options === true
            };

        if (Object.prototype.hasOwnProperty.call(config, 'processing')) {
            setProcessing(config.processing === true);
        }
        if (Object.prototype.hasOwnProperty.call(config, 'cardAnimating')) {
            setCardAnimating(config.cardAnimating === true);
        }
        if (Object.prototype.hasOwnProperty.call(config, 'playbackActive')) {
            setPlaybackActive(config.playbackActive === true);
        }

        return {
            isProcessing: getProcessing(),
            isCardAnimating: getCardAnimating(),
            playbackActive: getPlaybackActive()
        };
    }

    function setInteractionLock(locked) {
        setBusyState({
            processing: locked === true,
            cardAnimating: locked === true,
            playbackActive: locked === true
        });
        return locked === true;
    }

    function getPlaybackStartedAt() {
        const value = Number(readMirroredValue('__playbackActiveSince'));
        return Number.isFinite(value) ? value : null;
    }

    function cloneBoardUpdateContext(context) {
        if (!context || typeof context !== 'object') return null;
        return Object.assign({}, context);
    }

    function normalizeBoardUpdateContext(context) {
        if (!context || typeof context !== 'object') return null;
        const next = {};
        if (context.suppressFallbackFlip === true || context.suppressNextDiffFlip === true) {
            next.suppressFallbackFlip = true;
        }
        if (typeof context.reason === 'string' && context.reason.trim()) {
            next.reason = context.reason.trim();
        }
        if (typeof context.source === 'string' && context.source.trim()) {
            next.source = context.source.trim();
        }
        return Object.keys(next).length > 0 ? next : null;
    }

    function getBoardUpdateContext() {
        const explicit = normalizeBoardUpdateContext(readMirroredValue('__boardUpdateContext'));
        if (explicit) return cloneBoardUpdateContext(explicit);
        if (readMirroredValue('__suppressNextDiffFlip') === true) {
            return {
                suppressFallbackFlip: true,
                reason: 'legacy_suppress_next_diff_flip',
                source: 'legacy_window_flag'
            };
        }
        return null;
    }

    function setBoardUpdateContext(context) {
        const next = normalizeBoardUpdateContext(context);
        setMirroredValue('__boardUpdateContext', next ? cloneBoardUpdateContext(next) : null);
        setMirroredValue('__suppressNextDiffFlip', !!(next && next.suppressFallbackFlip === true));
        return getBoardUpdateContext();
    }

    function armBoardUpdateContext(context) {
        const next = normalizeBoardUpdateContext(context);
        if (!next) {
            clearBoardUpdateContext();
            return null;
        }
        const current = getBoardUpdateContext();
        if (current && current.suppressFallbackFlip === true) {
            next.suppressFallbackFlip = true;
        }
        return setBoardUpdateContext(current ? Object.assign({}, current, next) : next);
    }

    function consumeBoardUpdateContext() {
        const current = getBoardUpdateContext();
        if (current) clearBoardUpdateContext();
        return current;
    }

    function clearBoardUpdateContext() {
        setMirroredValue('__boardUpdateContext', null);
        setMirroredValue('__suppressNextDiffFlip', false);
        return true;
    }

    function getSuppressNextDiffFlip() {
        const context = getBoardUpdateContext();
        return !!(context && context.suppressFallbackFlip === true);
    }

    function setSuppressNextDiffFlip(active) {
        if (active === true) {
            return !!(armBoardUpdateContext({
                suppressFallbackFlip: true,
                reason: 'legacy_suppress_next_diff_flip',
                source: 'legacy_playback_state_api'
            }) || {}).suppressFallbackFlip;
        }
        clearBoardUpdateContext();
        return false;
    }

    function consumeSuppressNextDiffFlip() {
        const context = consumeBoardUpdateContext();
        return !!(context && context.suppressFallbackFlip === true);
    }

    function clearPlaybackLock() {
        clearBoardUpdateContext();
        setBusyState({ processing: false, cardAnimating: false, playbackActive: false });
        return true;
    }

    function syncLegacyWindowFlags(options) {
        const target = getRoot();
        const config = (options && typeof options === 'object') ? options : {};
        if (typeof config.readCardAnimating === 'function') {
            setCardAnimating(config.readCardAnimating() === true);
        } else if (Object.prototype.hasOwnProperty.call(config, 'cardAnimating')) {
            setCardAnimating(config.cardAnimating === true);
        }
        if (typeof config.readProcessing === 'function') {
            setProcessing(config.readProcessing() === true);
        } else if (Object.prototype.hasOwnProperty.call(config, 'processing')) {
            setProcessing(config.processing === true);
        }
        return {
            isCardAnimating: getCardAnimating(),
            isProcessing: getProcessing()
        };
    }

    function ensureDebugRuntime(options) {
        const target = getRoot();
        const config = (options && typeof options === 'object') ? options : {};
        const readCardAnimating = (typeof config.readCardAnimating === 'function')
            ? config.readCardAnimating
            : function () { return target.isCardAnimating === true; };
        const readProcessing = (typeof config.readProcessing === 'function')
            ? config.readProcessing
            : function () { return target.isProcessing === true; };
        const abortPlayback = (typeof config.abortPlayback === 'function')
            ? config.abortPlayback
            : function () {
                try {
                    if (target.AnimationEngine && typeof target.AnimationEngine.abortAndSync === 'function') {
                        target.AnimationEngine.abortAndSync();
                    }
                } catch (e) { /* ignore */ }
            };
        const getBoardElement = (typeof config.getBoardElement === 'function')
            ? config.getBoardElement
            : function () {
                try {
                    if (target.document && typeof target.document.getElementById === 'function') {
                        return target.document.getElementById('board');
                    }
                } catch (e) { /* ignore */ }
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

        syncLegacyWindowFlags({
            readCardAnimating,
            readProcessing
        });

        if (setIntervalImpl && (typeof target._uiMirrorIntervalId === 'undefined' || target._uiMirrorIntervalId === null)) {
            target._uiMirrorIntervalId = setIntervalImpl(function () {
                try {
                    syncLegacyWindowFlags({
                        readCardAnimating,
                        readProcessing
                    });
                } catch (e) { /* ignore */ }
            }, mirrorIntervalMs);
        }

        if (setIntervalImpl && (typeof target._playbackWatchdogId === 'undefined' || target._playbackWatchdogId === null)) {
            target._playbackWatchdogId = setIntervalImpl(function () {
                try {
                    if (getPlaybackActive()) {
                        const startedAt = ensurePlaybackStartedAt();
                        if (startedAt !== null && (Date.now() - startedAt) > watchdogTimeoutMs) {
                            abortPlayback();
                            clearPlaybackLock();
                            const board = getBoardElement();
                            if (board && board.classList && typeof board.classList.remove === 'function') {
                                board.classList.remove('playback-locked');
                            }
                        }
                    } else {
                        setPlaybackStartedAt(null);
                    }
                } catch (e) { /* ignore */ }
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

    function clearDebugRuntime() {
        const target = getRoot();
        const clearIntervalImpl = (typeof clearInterval === 'function')
            ? clearInterval
            : ((typeof target.clearInterval === 'function') ? target.clearInterval.bind(target) : null);
        if (target._uiMirrorIntervalId !== null && typeof target._uiMirrorIntervalId !== 'undefined') {
            if (clearIntervalImpl) clearIntervalImpl(target._uiMirrorIntervalId);
            target._uiMirrorIntervalId = null;
        }
        if (target._playbackWatchdogId !== null && typeof target._playbackWatchdogId !== 'undefined') {
            if (clearIntervalImpl) clearIntervalImpl(target._playbackWatchdogId);
            target._playbackWatchdogId = null;
        }
        return true;
    }

    return {
        getPlaybackActive,
        setPlaybackActive,
        setPlaybackStartedAt,
        getCardAnimating,
        setCardAnimating,
        getProcessing,
        setProcessing,
        setBusyState,
        setInteractionLock,
        getPlaybackStartedAt,
        getBoardUpdateContext,
        setBoardUpdateContext,
        armBoardUpdateContext,
        consumeBoardUpdateContext,
        clearBoardUpdateContext,
        getSuppressNextDiffFlip,
        setSuppressNextDiffFlip,
        consumeSuppressNextDiffFlip,
        clearPlaybackLock,
        syncLegacyWindowFlags,
        ensureDebugRuntime,
        clearDebugRuntime
    };
}));
