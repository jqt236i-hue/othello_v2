"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _require = (typeof __non_webpack_require__ !== "undefined")
    ? __non_webpack_require__
    : require;
/**
 * @file timer-service.js
 * Timer abstraction for game/ layer to avoid direct browser API dependency.
 */
class TimerService {
    constructor(mode = 'browser') {
        this.mode = mode;
    }
    setTimeout(callback, delay) {
        if (this.mode === 'browser') {
            return setTimeout(callback, delay);
        }
        // headlessモード: 即時実行
        const id = { _immediate: true };
        if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
            process.nextTick(callback);
        }
        else {
            try {
                callback();
            }
            catch (e) { /* ignore */ }
        }
        return id;
    }
    clearTimeout(id) {
        if (this.mode === 'browser') {
            clearTimeout(id);
        }
        // headlessモードでは即時実行なのでクリア不要
    }
    setInterval(callback, delay) {
        if (this.mode === 'browser') {
            return setInterval(callback, delay);
        }
        // headlessモード: 一度だけ即時実行
        if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
            process.nextTick(callback);
        }
        else {
            try {
                callback();
            }
            catch (e) { /* ignore */ }
        }
        return { _immediate: true };
    }
    clearInterval(id) {
        if (this.mode === 'browser') {
            clearInterval(id);
        }
    }
}
function createTimerService(mode) {
    return new TimerService(mode);
}
module.exports = { TimerService, createTimerService };
//# sourceMappingURL=timer-service.js.map