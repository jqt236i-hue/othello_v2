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
const waitMs = (ms) => (timers && typeof timers.waitMs === 'function' ? timers.waitMs(ms) : Promise.resolve());

async function processExpiredProtectionsAtTurnEnd(player) {
    // Find protected stones from unified specialStones
    const protectedStones = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
        ? MarkersAdapter.getSpecialMarkers(cardState).filter(m => m.data && m.data.type === 'PROTECTED')
        : (cardState && cardState.markers ? cardState.markers.filter(m => m.kind === 'specialStone' && m.data && m.data.type === 'PROTECTED') : []);
    if (protectedStones.length === 0) return;

    // Find protected stones that are expiring for this player
    const expiringStones = protectedStones.filter(p => p.data && p.data.expiresForPlayer === player);

    if (expiringStones.length === 0) return;

    // Animate fade-out for each expiring stone
    const animationPromises = expiringStones.map(p => animateProtectionExpireAt(p.row, p.col));
    await Promise.all(animationPromises);

    // Remove expired protections from cardState (unified array)
    if (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
        for (const p of expiringStones) {
            MarkersAdapter.removeMarkersAt(cardState, p.row, p.col, { kind: 'specialStone', type: 'PROTECTED', owner: p.owner });
        }
    } else if (cardState && cardState.markers) {
        cardState.markers = cardState.markers.filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'PROTECTED' && m.data.expiresForPlayer === player));
    }

    // Update display
    emitBoardUpdate();
    emitGameStateChange();
}

/**
 * Animate protection expiration (fade out from gray to normal color)
 * @param {number} row
 * @param {number} col
 */
async function animateProtectionExpireAt(row, col) {
    // Ask UI to animate protection expiry; UI may ignore if not present.
    try {
        var BoardPresentation = (typeof require === 'function') ? require('../logic/presentation') : null;
        if (BoardPresentation && typeof BoardPresentation.emitPresentationEvent === 'function') {
            BoardPresentation.emitPresentationEvent(cardState, { type: 'PROTECTION_EXPIRE', row, col, durationMs: 600, effectKey: 'protectionExpire' });
        } else {
            try { console.warn('[protections] Presentation helper not available'); } catch (e) { }
        }
    } catch (e) { try { console.warn('[protections] Presentation helper not available'); } catch (e) { } }
    // Preserve pacing: wait same duration so turn sequencing remains unchanged.
    await waitMs(600);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { processExpiredProtectionsAtTurnEnd };
}
})();
