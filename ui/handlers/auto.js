/**
 * @file auto.js
 * @description Auto mode handlers
 */

/**
 * オートモードの設定
 * Setup auto toggle button
 */
const Auto = (typeof require === 'function') ? require('../../game/auto') : (window.autoSimple || null);
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

function _setUiAutoActive(enabled) {
    try {
        if (typeof window !== 'undefined') window.AUTO_MODE_ACTIVE = !!enabled;
        if (typeof document !== 'undefined' && document.body) {
            document.body.classList.toggle('auto-mode-active', !!enabled);
        }
    } catch (e) { /* ignore */ }
}

function _uiAutoTick() {
    if (!_uiAutoEnabled) return;
    try {
        // Safety rail: prevent tight loop even if delay is misconfigured
        const now = Date.now();
        const since = now - _lastAutoTickAt;
        _lastAutoTickAt = now;
        if (since >= 0 && since < _MIN_AUTO_INTERVAL_MS) {
            // skip action this tick; delay below will enforce minimum
        }

        // Stop AUTO if it runs too long without progress
        if (_autoTickCount >= _MAX_AUTO_TICKS || _stallTickCount >= _MAX_STALL_TICKS) {
            _uiAutoDisable();
            if (typeof addLog === 'function') addLog('Auto mode stopped (safety limit reached)');
            return;
        }

        const turnNum = (typeof gameState !== 'undefined' && gameState) ? gameState.turnNumber : null;
        if (_lastTurnNumber !== null && turnNum === _lastTurnNumber) {
            _stallTickCount++;
        } else if (turnNum !== null) {
            _stallTickCount = 0;
            _lastTurnNumber = turnNum;
        }

        if (typeof gameState !== 'undefined' && gameState && gameState.currentPlayer === BLACK) {
            const winBusy = (typeof window !== 'undefined') && (
                window.VisualPlaybackActive === true ||
                window.isCardAnimating === true ||
                window.isProcessing === true
            );
            if (!isProcessing && !isCardAnimating && !winBusy) {
                if (typeof processAutoBlackTurn === 'function') processAutoBlackTurn();
            }
        }
    } catch (e) { /* ignore */ }
    const delay = Math.max(_uiAutoIntervalMs, _MIN_AUTO_INTERVAL_MS);
    _autoTickCount++;
    _uiAutoTimer = setTimeout(_uiAutoTick, delay);
}

function _uiAutoEnable() {
    if (_uiAutoEnabled) return;
    _uiAutoEnabled = true;
    _setUiAutoActive(true);
    _lastAutoTickAt = 0;
    _autoTickCount = 0;
    _stallTickCount = 0;
    _lastTurnNumber = (typeof gameState !== 'undefined' && gameState) ? gameState.turnNumber : null;
    _uiAutoTick();
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

function setupAutoToggle(autoToggleBtn, autoSmartBlack, autoSmartWhite) {
    if (!autoToggleBtn) return;
    autoToggleBtn.textContent = 'AUTO: OFF';
    autoToggleBtn.addEventListener('click', () => {
        if (typeof window !== 'undefined' && window.DEBUG_UNLIMITED_USAGE === true) {
            // Do not allow auto while debug mode is active (avoid interference)
            if (typeof addLog === 'function') addLog('Auto mode is disabled while DEBUG is ON');
            _uiAutoDisable();
            autoToggleBtn.textContent = 'AUTO: OFF';
            return;
        }
        // UI-driven auto loop (single authority). Backend auto loop is disabled to avoid double loops.
        if (_uiAutoEnabled) {
            _uiAutoDisable();
        } else {
            _uiAutoEnable();
        }
        autoToggleBtn.textContent = _uiAutoEnabled ? 'AUTO: ON' : 'AUTO: OFF';
        if (typeof addLog === 'function') addLog(`Auto mode ${_uiAutoEnabled ? 'ON' : 'OFF'}`);
    });
    // reflect current state if any (and disable backend loop if active)
    if (Auto && Auto.isEnabled && Auto.isEnabled()) {
        try { if (typeof Auto.disable === 'function') Auto.disable(); } catch (e) { /* ignore */ }
        _uiAutoEnable();
        autoToggleBtn.textContent = 'AUTO: ON';
    }
}

function triggerAutoIfNeeded() {
    // Backward-compatible legacy API: call processAutoBlackTurn once if possible
    if (typeof processAutoBlackTurn === 'function') {
        try { processAutoBlackTurn(); return true; } catch (e) { return false; }
    }
    return false;
}

if (typeof window !== 'undefined') {
    window.setupAutoToggle = setupAutoToggle;
    window.triggerAutoIfNeeded = triggerAutoIfNeeded;
    window.disableAutoMode = _uiAutoDisable;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { setupAutoToggle, triggerAutoIfNeeded };
} 
