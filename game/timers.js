// Timers abstraction for game/ to avoid direct use of browser timing APIs
// UI layer can inject real implementations via setTimerImpl
let _impl = {};
let _hasImpl = false;
function setTimerImpl(obj) {
    _impl = obj || {};
    _hasImpl = !!(_impl && (typeof _impl.waitMs === 'function' || typeof _impl.requestFrame === 'function'));
}
function waitMs(ms) {
    if (_impl && typeof _impl.waitMs === 'function') return _impl.waitMs(ms);
    // Default: non-blocking immediate resolution to keep game logic headless-friendly
    return Promise.resolve();
}
function requestFrame() {
    if (_impl && typeof _impl.requestFrame === 'function') return _impl.requestFrame();
    // Default: immediate resolution
    return Promise.resolve();
}
function hasTimerImpl() { return _hasImpl === true; }
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { setTimerImpl, waitMs, requestFrame, hasTimerImpl };
}

    // Global fallback (without touching DOM APIs)
if (typeof globalThis !== 'undefined') {
    try { globalThis.GameTimers = { setTimerImpl, waitMs, requestFrame, hasTimerImpl }; } catch (e) { /* ignore */ }
}
