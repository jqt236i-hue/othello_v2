/**
 * @file timer-utils.js
 * Small helper utilities around injected timers for consistent retry scheduling.
 */
function hasUsableWaitMs(t) {
    if (!t || typeof t.waitMs !== 'function') return false;
    // game/timers default waitMs resolves immediately unless UI injected implementation exists.
    if (typeof t.hasTimerImpl === 'function' && !t.hasTimerImpl()) return false;
    return true;
}

function scheduleRetry(fn, delayMs = 80, timers = null) {
    let t = timers;
    if (!t) {
        try { t = require('./timers'); } catch (e) { /* use global fallback */ }
        if (!t && typeof globalThis !== 'undefined') t = globalThis.timers || null;
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
