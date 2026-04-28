'use strict';
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const Auto = (typeof _require === 'function') ? _require('../../game/auto') : (window.autoSimple || null);
let _uiAutoEnabled = false;
let _uiAutoTimer = null;
let _uiAutoIntervalMs = 800;
let _lastAutoTickAt = 0;
const _MIN_AUTO_INTERVAL_MS = 16;
const _MAX_AUTO_TICKS = 2000;
const _MAX_STALL_TICKS = 50;
let _autoTickCount = 0;
let _stallTickCount = 0;
let _lastTurnNumber = null;
function _getPlaybackStateModule() {
    if (typeof window.PlaybackStateManager !== 'undefined' && window.PlaybackStateManager)
        return window.PlaybackStateManager;
    try {
        return _require('../playback-state-manager');
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.PlaybackStateManager)
            return globalThis.PlaybackStateManager;
    }
    catch (e) { /* ignore */ }
    return null;
}
function _isPlaybackActiveForAuto() {
    const playbackState = _getPlaybackStateModule();
    if (playbackState && typeof playbackState.getPlaybackActive === 'function') {
        return playbackState.getPlaybackActive() === true;
    }
    return (typeof window !== 'undefined') && window.VisualPlaybackActive === true;
}
function _isCardAnimatingForAuto() {
    const playbackState = _getPlaybackStateModule();
    if (playbackState && typeof playbackState.getCardAnimating === 'function') {
        return playbackState.getCardAnimating() === true;
    }
    return (typeof window !== 'undefined') && window.isCardAnimating === true;
}
function _hasPendingPresentationEvents() {
    try {
        const cs = (typeof window.cardState !== 'undefined') ? window.cardState : ((typeof window !== 'undefined') ? window.cardState : null);
        if (!cs)
            return false;
        const pendingPersist = Array.isArray(cs._presentationEventsPersist) ? cs._presentationEventsPersist.length : 0;
        const pendingLive = Array.isArray(cs.presentationEvents) ? cs.presentationEvents.length : 0;
        return pendingPersist > 0 || pendingLive > 0;
    }
    catch (e) {
        return false;
    }
}
function _setUiAutoActive(enabled) {
    try {
        if (typeof window !== 'undefined')
            window.AUTO_MODE_ACTIVE = !!enabled;
        if (typeof document !== 'undefined' && document.body) {
            document.body.classList.toggle('auto-mode-active', !!enabled);
        }
    }
    catch (e) { /* ignore */ }
}
function _uiAutoDisable() {
    _uiAutoEnabled = false;
    _setUiAutoActive(false);
    if (_uiAutoTimer) {
        clearTimeout(_uiAutoTimer);
        _uiAutoTimer = null;
    }
    _autoTickCount = 0;
    _stallTickCount = 0;
}
function _uiAutoTick() {
    if (!_uiAutoEnabled)
        return;
    try {
        const now = Date.now();
        const since = now - _lastAutoTickAt;
        _lastAutoTickAt = now;
        if (_autoTickCount >= _MAX_AUTO_TICKS || _stallTickCount >= _MAX_STALL_TICKS) {
            _uiAutoDisable();
            if (typeof window.addLog === 'function')
                window.addLog('Auto mode stopped (safety limit reached)');
            return;
        }
        const turnNum = (typeof window.gameState !== 'undefined' && window.gameState) ? window.gameState.turnNumber : null;
        if (_lastTurnNumber !== null && turnNum === _lastTurnNumber) {
            _stallTickCount++;
        }
        else if (turnNum !== null) {
            _stallTickCount = 0;
            _lastTurnNumber = turnNum;
        }
        if (typeof window.gameState !== 'undefined' && window.gameState && window.gameState.currentPlayer === window.BLACK) {
            const winBusy = (typeof window !== 'undefined') && (_isPlaybackActiveForAuto() ||
                _isCardAnimatingForAuto() ||
                window.isProcessing === true);
            const hasPendingPresentation = _hasPendingPresentationEvents();
            if (!window.isProcessing && !window.isCardAnimating && !winBusy && !hasPendingPresentation) {
                if (typeof window.processAutoBlackTurn === 'function')
                    window.processAutoBlackTurn();
            }
        }
    }
    catch (e) { /* ignore */ }
    const delay = Math.max(_uiAutoIntervalMs, _MIN_AUTO_INTERVAL_MS);
    _autoTickCount++;
    _uiAutoTimer = setTimeout(_uiAutoTick, delay);
}
function _uiAutoEnable() {
    if (_uiAutoEnabled)
        return;
    _uiAutoEnabled = true;
    _setUiAutoActive(true);
    _lastAutoTickAt = 0;
    _autoTickCount = 0;
    _stallTickCount = 0;
    _lastTurnNumber = (typeof window.gameState !== 'undefined' && window.gameState) ? window.gameState.turnNumber : null;
    _uiAutoTick();
}
function setupAutoToggle(autoToggleBtn, autoSmartBlack, autoSmartWhite) {
    if (!autoToggleBtn)
        return;
    autoToggleBtn.textContent = 'AUTO: OFF';
    autoToggleBtn.addEventListener('click', () => {
        if (typeof window !== 'undefined' && window.DEBUG_UNLIMITED_USAGE === true) {
            if (typeof window.addLog === 'function')
                window.addLog('Auto mode is disabled while DEBUG is ON');
            _uiAutoDisable();
            autoToggleBtn.textContent = 'AUTO: OFF';
            return;
        }
        if (_uiAutoEnabled) {
            _uiAutoDisable();
        }
        else {
            _uiAutoEnable();
        }
        autoToggleBtn.textContent = _uiAutoEnabled ? 'AUTO: ON' : 'AUTO: OFF';
        if (typeof window.addLog === 'function')
            window.addLog(`Auto mode ${_uiAutoEnabled ? 'ON' : 'OFF'}`);
    });
    if (Auto && Auto.isEnabled && Auto.isEnabled()) {
        try {
            if (typeof Auto.disable === 'function')
                Auto.disable();
        }
        catch (e) { /* ignore */ }
        _uiAutoEnable();
        autoToggleBtn.textContent = 'AUTO: ON';
    }
}
function triggerAutoIfNeeded() {
    if (typeof window.processAutoBlackTurn === 'function') {
        try {
            window.processAutoBlackTurn();
            return true;
        }
        catch (e) {
            return false;
        }
    }
    return false;
}
if (typeof window !== 'undefined') {
    window.setupAutoToggle = setupAutoToggle;
    window.triggerAutoIfNeeded = triggerAutoIfNeeded;
    window.disableAutoMode = _uiAutoDisable;
}
const AutoModule = { setupAutoToggle, triggerAutoIfNeeded };
module.exports = AutoModule;
//# sourceMappingURL=auto.js.map