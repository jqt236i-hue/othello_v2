
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

// Timers abstraction for game/ to avoid direct use of browser timing APIs
// UI layer can inject real implementations via setTimerImpl
let _impl: Record<string, any> = {};
let _hasImpl = false;
function setTimerImpl(obj: Record<string, any> | null): void {
    _impl = obj || {};
    _hasImpl = !!(_impl && (typeof _impl.waitMs === 'function' || typeof _impl.requestFrame === 'function'));
}
function waitMs(ms: number): Promise<void> {
    if (_impl && typeof _impl.waitMs === 'function') return _impl.waitMs(ms);
    // Default: non-blocking immediate resolution to keep game logic headless-friendly
    return Promise.resolve();
}
function requestFrame(): Promise<void> {
    if (_impl && typeof _impl.requestFrame === 'function') return _impl.requestFrame();
    // Default: immediate resolution
    return Promise.resolve();
}
function hasTimerImpl(): boolean { return _hasImpl === true; }
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { setTimerImpl, waitMs, requestFrame, hasTimerImpl };
}

export {};
