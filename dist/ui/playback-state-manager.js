// @ts-nocheck
'use strict';
function getRoot() {
    const base = (typeof globalThis !== 'undefined' ? globalThis : {});
    if (base && base.window && typeof base.window === 'object')
        return base.window;
    try {
        if (typeof window !== 'undefined' && window)
            return window;
    }
    catch (e) { /* ignore */ }
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
    }
    catch (e) { /* ignore */ }
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
        }
        catch (e) { /* ignore */ }
    }
    return undefined;
}
function setMirroredValue(name, value) {
    const targets = getMirrorTargets();
    for (let index = 0; index < targets.length; index += 1) {
        try {
            targets[index][name] = value;
        }
        catch (e) { /* ignore */ }
    }
    return value;
}
function getBoardElement(options) {
    const config = (options && typeof options === 'object') ? options : {};
    if (config.boardElement && typeof config.boardElement === 'object')
        return config.boardElement;
    const target = getRoot();
    try {
        if (target && target.document && typeof target.document.getElementById === 'function') {
            return target.document.getElementById('board');
        }
    }
    catch (e) { /* ignore */ }
    return null;
}
function setBoardLockActive(active, options) {
    const boardElement = getBoardElement(options);
    const locked = active === true;
    if (boardElement && boardElement.classList && typeof boardElement.classList.toggle === 'function') {
        boardElement.classList.toggle('playback-locked', locked);
    }
    return locked;
}
function getAnimationEngine(options) {
    const config = (options && typeof options === 'object') ? options : {};
    if (config.animationEngine && typeof config.animationEngine === 'object')
        return config.animationEngine;
    const target = (config.root && typeof config.root === 'object') ? config.root : getRoot();
    try {
        if (target && target.AnimationEngine && typeof target.AnimationEngine === 'object') {
            return target.AnimationEngine;
        }
    }
    catch (e) { /* ignore */ }
    return null;
}
let activePlaybackAbortHandle = null;
function registerPlaybackAbortHandle(handle) {
    activePlaybackAbortHandle = (handle && typeof handle.abort === 'function') ? handle : null;
    return activePlaybackAbortHandle;
}
function clearPlaybackAbortHandle(handle) {
    if (!handle || activePlaybackAbortHandle === handle) {
        activePlaybackAbortHandle = null;
    }
    return true;
}
function getPlaybackActive() {
    return readMirroredValue('VisualPlaybackActive') === true;
}
function setPlaybackActive(active) {
    const next = active === true;
    setMirroredValue('VisualPlaybackActive', next);
    if (next) {
        if (getPlaybackStartedAt() === null) {
            setMirroredValue('__playbackActiveSince', Date.now());
        }
    }
    else {
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
    if (startedAt !== null)
        return startedAt;
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
    const rawValue = readMirroredValue('__playbackActiveSince');
    if (rawValue === null || typeof rawValue === 'undefined' || rawValue === '') {
        return null;
    }
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : null;
}
function getPlaybackStaleMs(options) {
    const config = (options && typeof options === 'object') ? options : {};
    if (Object.prototype.hasOwnProperty.call(config, 'staleMs')) {
        const explicitMs = Number(config.staleMs);
        if (Number.isFinite(explicitMs) && explicitMs > 0)
            return explicitMs;
    }
    const target = (config.root && typeof config.root === 'object') ? config.root : getRoot();
    if (target && typeof target === 'object') {
        const targetMs = Number(target.PASS_STALE_PLAYBACK_MS);
        if (Number.isFinite(targetMs) && targetMs > 0)
            return targetMs;
    }
    return 3500;
}
function isPlaybackRunning(options) {
    if (!getPlaybackActive())
        return false;
    const animationEngine = getAnimationEngine(options);
    if (animationEngine && typeof animationEngine.isPlaying === 'boolean') {
        return animationEngine.isPlaying === true;
    }
    return true;
}
function isPlaybackStale(options) {
    if (!getPlaybackActive())
        return false;
    const animationEngine = getAnimationEngine(options);
    if (animationEngine && typeof animationEngine.isPlaying === 'boolean') {
        return animationEngine.isPlaying !== true;
    }
    const startedAt = getPlaybackStartedAt();
    if (Number.isFinite(startedAt)) {
        return (Date.now() - startedAt) > getPlaybackStaleMs(options);
    }
    return false;
}
function getPresentationQueueState(source) {
    const resolved = (source && typeof source === 'object')
        ? source
        : (function () {
            const target = getRoot();
            try {
                if (target && target.cardState && typeof target.cardState === 'object')
                    return target.cardState;
            }
            catch (e) { /* ignore */ }
            try {
                if (typeof globalThis !== 'undefined' && globalThis && globalThis.cardState && typeof globalThis.cardState === 'object') {
                    return globalThis.cardState;
                }
            }
            catch (e) { /* ignore */ }
            return null;
        }());
    const presentationEvents = Array.isArray(resolved && resolved.presentationEvents) ? resolved.presentationEvents : [];
    const persistentEvents = Array.isArray(resolved && resolved._presentationEventsPersist) ? resolved._presentationEventsPersist : [];
    const mergedEvents = presentationEvents.concat(persistentEvents);
    return {
        presentationEvents,
        persistentEvents,
        hasPending: mergedEvents.length > 0,
        hasVisualPlayback: mergedEvents.some((ev) => ev && ev.type === 'PLAYBACK_EVENTS')
    };
}
function getPresentationQueueEntries(source) {
    const queueState = getPresentationQueueState(source);
    return queueState.presentationEvents.concat(queueState.persistentEvents);
}
function hasPendingPresentationEvents(source) {
    return getPresentationQueueState(source).hasPending === true;
}
function hasPendingVisualPlayback(source) {
    return getPresentationQueueState(source).hasVisualPlayback === true;
}
function cloneBoardUpdateContext(context) {
    if (!context || typeof context !== 'object')
        return null;
    return Object.assign({}, context);
}
function normalizeBoardUpdateContext(context) {
    if (!context || typeof context !== 'object')
        return null;
    const next = {};
    if (context.suppressFallbackFlip === true || context.suppressNextDiffFlip === true) {
        next.suppressFallbackFlip = true;
    }
    if (context.suppressBoardExpansionRevealSound === true || context.suppressNextBoardExpansionRevealSound === true) {
        next.suppressBoardExpansionRevealSound = true;
    }
    if (typeof context.reason === 'string' && context.reason.trim()) {
        next.reason = context.reason.trim();
    }
    if (typeof context.source === 'string' && context.source.trim()) {
        next.source = context.source.trim();
    }
    if (context.allowSelectionEntryDuringPlayback === true) {
        next.allowSelectionEntryDuringPlayback = true;
    }
    return Object.keys(next).length > 0 ? next : null;
}
function getBoardUpdateContext() {
    const explicit = normalizeBoardUpdateContext(readMirroredValue('__boardUpdateContext'));
    if (explicit)
        return cloneBoardUpdateContext(explicit);
    const suppressFallbackFlip = readMirroredValue('__suppressNextDiffFlip') === true;
    const suppressBoardExpansionRevealSound = readMirroredValue('__suppressNextBoardExpansionRevealSound') === true;
    if (suppressFallbackFlip || suppressBoardExpansionRevealSound) {
        return Object.assign({
            reason: 'legacy_board_update_context',
            source: 'legacy_window_flag'
        }, suppressFallbackFlip ? { suppressFallbackFlip: true } : null, suppressBoardExpansionRevealSound ? { suppressBoardExpansionRevealSound: true } : null);
    }
    return null;
}
function normalizeSelectionEntryPlayerKey(playerKey) {
    return String(playerKey || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
}
function normalizeSelectionEntryPendingType(pendingType) {
    const normalized = String(pendingType || '').trim().toUpperCase();
    return normalized || null;
}
function cloneSelectionEntryPlaybackContext(context) {
    if (!context || typeof context !== 'object')
        return null;
    return Object.assign({}, context);
}
function normalizeSelectionEntryPlaybackContext(context) {
    if (!context || typeof context !== 'object')
        return null;
    const next = {};
    if (typeof context.playerKey !== 'undefined' && context.playerKey !== null) {
        next.playerKey = normalizeSelectionEntryPlayerKey(context.playerKey);
    }
    if (typeof context.pendingType !== 'undefined' && context.pendingType !== null) {
        next.pendingType = normalizeSelectionEntryPendingType(context.pendingType);
    }
    const expiresAt = Number(context.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt > 0) {
        next.expiresAt = Math.trunc(expiresAt);
    }
    if (typeof context.source === 'string' && context.source.trim()) {
        next.source = context.source.trim();
    }
    if (typeof context.reason === 'string' && context.reason.trim()) {
        next.reason = context.reason.trim();
    }
    return Object.keys(next).length > 0 ? next : null;
}
function getSelectionEntryPlaybackContext() {
    const current = normalizeSelectionEntryPlaybackContext(readMirroredValue('__selectionEntryPlaybackContext'));
    if (!current)
        return null;
    if (Number.isFinite(current.expiresAt) && current.expiresAt < Date.now()) {
        clearSelectionEntryPlaybackContext();
        return null;
    }
    return cloneSelectionEntryPlaybackContext(current);
}
function setSelectionEntryPlaybackContext(context) {
    const next = normalizeSelectionEntryPlaybackContext(context);
    setMirroredValue('__selectionEntryPlaybackContext', next ? cloneSelectionEntryPlaybackContext(next) : null);
    return getSelectionEntryPlaybackContext();
}
function armSelectionEntryPlaybackContext(context) {
    const next = normalizeSelectionEntryPlaybackContext(context);
    if (!next) {
        clearSelectionEntryPlaybackContext();
        return null;
    }
    if (!Number.isFinite(next.expiresAt)) {
        next.expiresAt = Date.now() + 2500;
    }
    const current = getSelectionEntryPlaybackContext();
    return setSelectionEntryPlaybackContext(current ? Object.assign({}, current, next) : next);
}
function clearSelectionEntryPlaybackContext() {
    setMirroredValue('__selectionEntryPlaybackContext', null);
    return true;
}
function shouldAllowSelectionEntryDuringPlayback(options) {
    const current = getSelectionEntryPlaybackContext();
    if (!current)
        return false;
    const opts = (options && typeof options === 'object') ? options : {};
    if (typeof opts.playerKey !== 'undefined' && opts.playerKey !== null) {
        if (normalizeSelectionEntryPlayerKey(opts.playerKey) !== current.playerKey) {
            return false;
        }
    }
    if (typeof opts.pendingType !== 'undefined' && opts.pendingType !== null) {
        if (normalizeSelectionEntryPendingType(opts.pendingType) !== current.pendingType) {
            return false;
        }
    }
    return true;
}
function shouldDeferBoardUpdate(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (shouldAllowSelectionEntryDuringPlayback(opts) === true) {
        return false;
    }
    return getPlaybackActive() === true || hasPendingVisualPlayback(opts.cardState);
}
function shouldDeferUiSync(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (shouldAllowSelectionEntryDuringPlayback(opts) === true) {
        return false;
    }
    return getPlaybackActive() === true || hasPendingPresentationEvents(opts.cardState);
}
function setBoardUpdateContext(context) {
    const next = normalizeBoardUpdateContext(context);
    setMirroredValue('__boardUpdateContext', next ? cloneBoardUpdateContext(next) : null);
    setMirroredValue('__suppressNextDiffFlip', !!(next && next.suppressFallbackFlip === true));
    setMirroredValue('__suppressNextBoardExpansionRevealSound', !!(next && next.suppressBoardExpansionRevealSound === true));
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
    if (current)
        clearBoardUpdateContext();
    return current;
}
function clearBoardUpdateContext() {
    setMirroredValue('__boardUpdateContext', null);
    setMirroredValue('__suppressNextDiffFlip', false);
    setMirroredValue('__suppressNextBoardExpansionRevealSound', false);
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
function beginPlayback(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    setInteractionLock(true);
    if (opts.startedAt === null) {
        setPlaybackStartedAt(null);
    }
    else {
        ensurePlaybackStartedAt(opts.startedAt);
    }
    setBoardLockActive(true, opts);
    return {
        playbackActive: getPlaybackActive(),
        isCardAnimating: getCardAnimating(),
        isProcessing: getProcessing(),
        startedAt: getPlaybackStartedAt()
    };
}
function finalizePlayback(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (Object.prototype.hasOwnProperty.call(opts, 'boardUpdateContext')) {
        if (opts.boardUpdateContext) {
            armBoardUpdateContext(opts.boardUpdateContext);
        }
        else if (opts.clearBoardUpdateContext !== false) {
            clearBoardUpdateContext();
        }
    }
    else if (opts.clearBoardUpdateContext === true) {
        clearBoardUpdateContext();
    }
    if (opts.clearSelectionEntry !== false) {
        clearSelectionEntryPlaybackContext();
    }
    setBusyState({ processing: false, cardAnimating: false, playbackActive: false });
    setPlaybackStartedAt(null);
    setBoardLockActive(false, opts);
    if (typeof opts.emitBoardUpdate === 'function') {
        opts.emitBoardUpdate();
    }
    return getBoardUpdateContext();
}
function clearPlaybackLock(options) {
    clearBoardUpdateContext();
    clearSelectionEntryPlaybackContext();
    setBusyState({ processing: false, cardAnimating: false, playbackActive: false });
    setPlaybackStartedAt(null);
    setBoardLockActive(false, options);
    return true;
}
function abortPlayback(options) {
    const abortHandle = activePlaybackAbortHandle;
    activePlaybackAbortHandle = null;
    if (abortHandle && typeof abortHandle.abort === 'function') {
        abortHandle.abort();
    }
    clearPlaybackLock(options);
    setPlaybackStartedAt(null);
    return true;
}
let PlaybackRuntimeModule = null;
function getPlaybackRuntimeModule() {
    if (PlaybackRuntimeModule)
        return PlaybackRuntimeModule;
    if (typeof _require === 'function') {
        try {
            PlaybackRuntimeModule = _require('./playback-runtime');
        }
        catch (e) {
            PlaybackRuntimeModule = null;
        }
    }
    if (!PlaybackRuntimeModule) {
        try {
            if (typeof globalThis !== 'undefined' && globalThis && globalThis.PlaybackRuntime) {
                PlaybackRuntimeModule = globalThis.PlaybackRuntime;
            }
        }
        catch (e) { /* ignore */ }
    }
    return PlaybackRuntimeModule;
}
function getRuntimePlaybackState() {
    return {
        getPlaybackActive,
        setPlaybackActive,
        ensurePlaybackStartedAt,
        setPlaybackStartedAt,
        getCardAnimating,
        setCardAnimating,
        getProcessing,
        setProcessing,
        setBusyState,
        setInteractionLock,
        getPlaybackStartedAt,
        getPlaybackStaleMs,
        isPlaybackRunning,
        isPlaybackStale,
        getBoardUpdateContext,
        setBoardUpdateContext,
        armBoardUpdateContext,
        consumeBoardUpdateContext,
        clearBoardUpdateContext,
        getSelectionEntryPlaybackContext,
        setSelectionEntryPlaybackContext,
        armSelectionEntryPlaybackContext,
        clearSelectionEntryPlaybackContext,
        shouldAllowSelectionEntryDuringPlayback,
        getSuppressNextDiffFlip,
        setSuppressNextDiffFlip,
        consumeSuppressNextDiffFlip,
        registerPlaybackAbortHandle,
        clearPlaybackAbortHandle,
        abortPlayback,
        clearPlaybackLock,
        beginPlayback,
        finalizePlayback,
        getPresentationQueueState,
        getPresentationQueueEntries,
        hasPendingPresentationEvents,
        hasPendingVisualPlayback,
        shouldDeferBoardUpdate,
        shouldDeferUiSync,
        setBoardLockActive
    };
}
function syncLegacyWindowFlags(options) {
    const runtime = getPlaybackRuntimeModule();
    if (runtime && typeof runtime.syncLegacyWindowFlags === 'function') {
        return runtime.syncLegacyWindowFlags(getRuntimePlaybackState(), options);
    }
    return {
        isCardAnimating: getCardAnimating(),
        isProcessing: getProcessing(),
        playbackActive: getPlaybackActive()
    };
}
function ensureDebugRuntime(options) {
    const runtime = getPlaybackRuntimeModule();
    if (runtime && typeof runtime.ensureDebugRuntime === 'function') {
        return runtime.ensureDebugRuntime(getRuntimePlaybackState(), options);
    }
    return null;
}
function clearDebugRuntime() {
    const runtime = getPlaybackRuntimeModule();
    if (runtime && typeof runtime.clearDebugRuntime === 'function') {
        return runtime.clearDebugRuntime(getRuntimePlaybackState());
    }
    return true;
}
const PlaybackStateManager = {
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
    getPlaybackStaleMs,
    isPlaybackRunning,
    isPlaybackStale,
    ensurePlaybackStartedAt,
    beginPlayback,
    finalizePlayback,
    setBoardLockActive,
    getPresentationQueueState,
    getPresentationQueueEntries,
    hasPendingPresentationEvents,
    hasPendingVisualPlayback,
    shouldDeferBoardUpdate,
    shouldDeferUiSync,
    getBoardUpdateContext,
    setBoardUpdateContext,
    armBoardUpdateContext,
    consumeBoardUpdateContext,
    clearBoardUpdateContext,
    getSelectionEntryPlaybackContext,
    setSelectionEntryPlaybackContext,
    armSelectionEntryPlaybackContext,
    clearSelectionEntryPlaybackContext,
    shouldAllowSelectionEntryDuringPlayback,
    getSuppressNextDiffFlip,
    setSuppressNextDiffFlip,
    consumeSuppressNextDiffFlip,
    registerPlaybackAbortHandle,
    clearPlaybackAbortHandle,
    abortPlayback,
    clearPlaybackLock,
    syncLegacyWindowFlags,
    ensureDebugRuntime,
    clearDebugRuntime
};
module.exports = PlaybackStateManager;
//# sourceMappingURL=playback-state-manager.js.map