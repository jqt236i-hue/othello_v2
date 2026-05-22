declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file timer-utils.js
 * Small helper utilities around injected timers for consistent retry scheduling.
 */
function hasUsableWaitMs(t: any): boolean {
    if (!t || typeof t.waitMs !== 'function') return false;
    // game/timers default waitMs resolves immediately unless UI injected implementation exists.
    if (typeof t.hasTimerImpl === 'function' && !t.hasTimerImpl()) return false;
    return true;
}

function scheduleRetry(fn: any, delayMs: number = 80, timers: any = null) {
    let t: any = timers;
    if (!t) {
        try { t = _require('./timers'); } catch (e) { /* use setTimeout fallback */ }
    }

    if (hasUsableWaitMs(t)) {
        try {
            return t.waitMs(delayMs).then(() => { try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); } });
        } catch (e) {
            // fallback to setTimeout
        }
    }

    const tid = setTimeout(() => {
        try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); }
    }, delayMs);
    if (tid && typeof tid.unref === 'function') tid.unref();
}

module.exports = { scheduleRetry };

export {};
