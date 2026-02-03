/**
 * @file timer-utils.js
 * Small helper utilities around injected timers for consistent retry scheduling.
 */
function scheduleRetry(fn, delayMs = 80, timers = null) {
    let t = timers;
    if (!t) {
        try { t = require('./timers'); } catch (e) { /* use global fallback */ }
        if (!t && typeof globalThis !== 'undefined') t = globalThis.timers || null;
    }

    if (t && typeof t.waitMs === 'function') {
        try {
            return t.waitMs(delayMs).then(() => { try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); } });
        } catch (e) {
            // fallback to setTimeout
        }
    }

    setTimeout(() => {
        try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); }
    }, delayMs);
}

module.exports = { scheduleRetry };