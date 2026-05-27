declare const __non_webpack_require__: NodeRequire | undefined;
declare const BoardOps: any;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file protections.js
 * @description Protection expiry handlers
 */

/**
 * Process expired protected stones at turn end
 * @async
 * @param {number} player - Player whose turn just ended (BLACK=1 or WHITE=-1)
 * @returns {Promise<void>}
 */
// Timers abstraction (injected by UI)
(function () {
let timers = null;
if (typeof require === 'function') {
    try { timers = require('../timers'); } catch (e) { /* ignore */ }
}
var BoardOpsModule = null;
try { BoardOpsModule = (typeof require === 'function') ? require('../logic/board_ops') : (typeof BoardOps !== 'undefined' ? BoardOps : null); } catch (e) { BoardOpsModule = BoardOpsModule || null; }
const waitMs = (ms: number) => (timers && typeof timers.waitMs === 'function' ? timers.waitMs(ms) : Promise.resolve());

async function processExpiredProtectionsAtTurnEnd(player: number, precomputedEvents: any[] | null = null) {
    const events = Array.isArray(precomputedEvents) ? precomputedEvents : [];
    const expired = events
        .filter((ev: any) => ev && ev.type === 'protection_expired' && Array.isArray(ev.details))
        .flatMap((ev: any) => ev.details);
    if (!expired.length) return;

    // Rule state cleanup is owned by the turn pipeline; this module only preserves presentation pacing.
    const animationPromises = expired.map((p: any) => animateProtectionExpireAt(p.row, p.col));
    await Promise.all(animationPromises);
}

/**
 * Animate protection expiration (fade out from gray to normal color)
 * @param {number} row
 * @param {number} col
 */
async function animateProtectionExpireAt(row: number, col: number) {
    // Ask UI to animate protection expiry; UI may ignore if not present.
    try {
        var BoardPresentation = (typeof require === 'function') ? require('../logic/presentation') : null;
        if (BoardPresentation && typeof BoardPresentation.emitPresentationEvent === 'function') {
            BoardPresentation.emitPresentationEvent(cardState, { type: 'PROTECTION_EXPIRE', row, col, durationMs: 600, effectKey: 'protectionExpire' });
        } else {
            try { console.warn('[protections] Presentation helper not available'); } catch (e) { /* Intentionally empty: console.warn unavailable */ }
        }
    } catch (e) { try { console.warn('[protections] Presentation helper not available'); } catch (e) { /* Intentionally empty: console.warn unavailable */ } }
    // Preserve pacing: wait same duration so turn sequencing remains unchanged.
    await waitMs(600);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { processExpiredProtectionsAtTurnEnd };
}
})();

export {};
