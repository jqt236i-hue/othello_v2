(function () {
/**
 * @file game/auto.js
 * Minimal, simple Auto mode implementation.
 * - Start/stop/toggle API only (no loop in game layer)
 * - UI layer owns the auto loop and scheduling
 */

// Default interval between checks (ms) - used by UI auto loop
let AUTO_SIMPLE_INTERVAL_MS = 800;
let _enabled = false;

function isEnabled() {
  return _enabled === true;
}

function enable() {
  if (_enabled) return;
  _enabled = true;
  console.warn('[AUTO] Auto loop is UI-owned; game/auto does not start a loop.');
}

function disable() {
  if (!_enabled) return;
  _enabled = false;
}

function toggle() {
  if (isEnabled()) disable(); else enable();
}

function setIntervalMs(ms) {
  AUTO_SIMPLE_INTERVAL_MS = Number(ms) || AUTO_SIMPLE_INTERVAL_MS;
}

function getIntervalMs() {
  return AUTO_SIMPLE_INTERVAL_MS;
}

// Export API
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    enable,
    disable,
    toggle,
    isEnabled,
    setIntervalMs,
    getIntervalMs
  };
} else if (typeof globalThis !== 'undefined') {
  // Browser/global attach for UI handlers
  try { globalThis.autoSimple = { enable, disable, toggle, isEnabled, setIntervalMs, getIntervalMs }; } catch (e) { /* ignore */ }
}
})();


