'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const Auto = (typeof _require === 'function') ? _require('../../game/auto') : ((window as any).autoSimple || null);
let _uiAutoEnabled = false;
let _uiAutoTimer: any = null;
let _uiAutoIntervalMs = 800;
let _lastAutoTickAt = 0;
const _MIN_AUTO_INTERVAL_MS = 16;
const _MAX_AUTO_TICKS = 2000;
const _MAX_STALL_TICKS = 50;
let _autoTickCount = 0;
let _stallTickCount = 0;
let _lastTurnNumber: any = null;

function _getPlaybackStateModule(): any {
  if (typeof (window as any).PlaybackStateManager !== 'undefined' && (window as any).PlaybackStateManager) return (window as any).PlaybackStateManager;
  try {
    return _require('../playback-state-manager');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).PlaybackStateManager) return (globalThis as any).PlaybackStateManager;
  } catch (e) { /* ignore */ }
  return null;
}

function _isPlaybackActiveForAuto(): boolean {
  const playbackState = _getPlaybackStateModule();
  if (playbackState && typeof playbackState.getPlaybackActive === 'function') {
    return playbackState.getPlaybackActive() === true;
  }
  return (typeof window !== 'undefined') && (window as any).VisualPlaybackActive === true;
}

function _isCardAnimatingForAuto(): boolean {
  const playbackState = _getPlaybackStateModule();
  if (playbackState && typeof playbackState.getCardAnimating === 'function') {
    return playbackState.getCardAnimating() === true;
  }
  return (typeof window !== 'undefined') && (window as any).isCardAnimating === true;
}

function _hasPendingPresentationEvents(): boolean {
  try {
    const cs = (typeof (window as any).cardState !== 'undefined') ? (window as any).cardState : ((typeof window !== 'undefined') ? (window as any).cardState : null);
    if (!cs) return false;
    const pendingPersist = Array.isArray(cs._presentationEventsPersist) ? cs._presentationEventsPersist.length : 0;
    const pendingLive = Array.isArray(cs.presentationEvents) ? cs.presentationEvents.length : 0;
    return pendingPersist > 0 || pendingLive > 0;
  } catch (e) {
    return false;
  }
}

function _setUiAutoActive(enabled: boolean): void {
  try {
    if (typeof window !== 'undefined') (window as any).AUTO_MODE_ACTIVE = !!enabled;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('auto-mode-active', !!enabled);
    }
  } catch (e) { /* ignore */ }
}

function _uiAutoDisable(): void {
  _uiAutoEnabled = false;
  _setUiAutoActive(false);
  if (_uiAutoTimer) {
    clearTimeout(_uiAutoTimer);
    _uiAutoTimer = null;
  }
  _autoTickCount = 0;
  _stallTickCount = 0;
}

function _uiAutoTick(): void {
  if (!_uiAutoEnabled) return;
  try {
    const now = Date.now();
    const since = now - _lastAutoTickAt;
    _lastAutoTickAt = now;

    if (_autoTickCount >= _MAX_AUTO_TICKS || _stallTickCount >= _MAX_STALL_TICKS) {
      _uiAutoDisable();
      if (typeof (window as any).addLog === 'function') (window as any).addLog('Auto mode stopped (safety limit reached)');
      return;
    }

    const turnNum = (typeof (window as any).gameState !== 'undefined' && (window as any).gameState) ? (window as any).gameState.turnNumber : null;
    if (_lastTurnNumber !== null && turnNum === _lastTurnNumber) {
      _stallTickCount++;
    } else if (turnNum !== null) {
      _stallTickCount = 0;
      _lastTurnNumber = turnNum;
    }

    if (typeof (window as any).gameState !== 'undefined' && (window as any).gameState && (window as any).gameState.currentPlayer === (window as any).BLACK) {
      const winBusy = (typeof window !== 'undefined') && (
        _isPlaybackActiveForAuto() ||
        _isCardAnimatingForAuto() ||
        (window as any).isProcessing === true
      );
      const hasPendingPresentation = _hasPendingPresentationEvents();
      if (!(window as any).isProcessing && !(window as any).isCardAnimating && !winBusy && !hasPendingPresentation) {
        if (typeof (window as any).processAutoBlackTurn === 'function') (window as any).processAutoBlackTurn();
      }
    }
  } catch (e) { /* ignore */ }
  const delay = Math.max(_uiAutoIntervalMs, _MIN_AUTO_INTERVAL_MS);
  _autoTickCount++;
  _uiAutoTimer = setTimeout(_uiAutoTick, delay);
}

function _uiAutoEnable(): void {
  if (_uiAutoEnabled) return;
  _uiAutoEnabled = true;
  _setUiAutoActive(true);
  _lastAutoTickAt = 0;
  _autoTickCount = 0;
  _stallTickCount = 0;
  _lastTurnNumber = (typeof (window as any).gameState !== 'undefined' && (window as any).gameState) ? (window as any).gameState.turnNumber : null;
  _uiAutoTick();
}

function setupAutoToggle(autoToggleBtn: HTMLElement, autoSmartBlack?: any, autoSmartWhite?: any): void {
  if (!autoToggleBtn) return;
  autoToggleBtn.textContent = 'AUTO: OFF';
  autoToggleBtn.addEventListener('click', () => {
    if (typeof window !== 'undefined' && (window as any).DEBUG_UNLIMITED_USAGE === true) {
      if (typeof (window as any).addLog === 'function') (window as any).addLog('Auto mode is disabled while DEBUG is ON');
      _uiAutoDisable();
      autoToggleBtn.textContent = 'AUTO: OFF';
      return;
    }
    if (_uiAutoEnabled) {
      _uiAutoDisable();
    } else {
      _uiAutoEnable();
    }
    autoToggleBtn.textContent = _uiAutoEnabled ? 'AUTO: ON' : 'AUTO: OFF';
    if (typeof (window as any).addLog === 'function') (window as any).addLog(`Auto mode ${_uiAutoEnabled ? 'ON' : 'OFF'}`);
  });
  if (Auto && Auto.isEnabled && Auto.isEnabled()) {
    try { if (typeof Auto.disable === 'function') Auto.disable(); } catch (e) { /* ignore */ }
    _uiAutoEnable();
    autoToggleBtn.textContent = 'AUTO: ON';
  }
}

function triggerAutoIfNeeded(): boolean {
  if (typeof (window as any).processAutoBlackTurn === 'function') {
    try { (window as any).processAutoBlackTurn(); return true; } catch (e) { return false; }
  }
  return false;
}

if (typeof window !== 'undefined') {
  (window as any).setupAutoToggle = setupAutoToggle;
  (window as any).triggerAutoIfNeeded = triggerAutoIfNeeded;
  (window as any).disableAutoMode = _uiAutoDisable;
}

const AutoModule = { setupAutoToggle, triggerAutoIfNeeded };

export = AutoModule;
