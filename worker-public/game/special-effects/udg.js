/**
 * @file udg.js
 * @description Ultimate Destroy God effect handlers
 */

/**
 * Process ultimate destroy gods: destroy surrounding enemy stones (Destroy)
 * @async
 * @param {number} player - Current player (BLACK=1 or WHITE=-1)
 * @returns {Promise<void>}
 */
async function processUltimateDestroyGodsAtTurnStart(player, precomputedResult = null, precomputedEvents = null) {
    const udgs = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
        ? MarkersAdapter.getSpecialMarkers(cardState).filter(m => m.data && m.data.type === 'ULTIMATE_DESTROY_GOD')
        : (cardState && cardState.markers ? cardState.markers.filter(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_DESTROY_GOD') : []);
    if (!udgs.length) return;

    const hasPlayback = (typeof globalThis !== 'undefined' && globalThis.PlaybackEngine && typeof globalThis.PlaybackEngine.playPresentationEvents === 'function');

    const playerKey = player === BLACK ? 'black' : 'white';
    // Prefer precomputed result (from pipeline). If not provided, try to extract from events.
    let result = precomputedResult;
    if (!result) {
        if (Array.isArray(precomputedEvents) && precomputedEvents.length) {
            // Build result from events
            result = { destroyed: [], expired: [], anchors: [] };
            for (const ev of precomputedEvents) {
                if (ev.type === 'udg_destroyed_start' || ev.type === 'udg_destroyed_immediate') {
                    if (Array.isArray(ev.details)) result.destroyed.push(...ev.details);
                }
                if (ev.type === 'udg_expired_start' || ev.type === 'udg_expired_immediate') {
                    if (Array.isArray(ev.details)) result.expired.push(...ev.details);
                }
                if (ev.type === 'udg_anchor_start' || ev.type === 'udg_anchor_immediate') {
                    if (Array.isArray(ev.details)) result.anchors.push(...ev.details);
                }
            }
        } else {
            // Fall back to logic-layer call, but this is discouraged for UI-only path
            console.warn('[UDG] No precomputed pipeline result/events provided; falling back to CardLogic (discouraged)');
            result = CardLogic.processUltimateDestroyGodEffects(cardState, gameState, playerKey);
        }
    }

    // UDG anchor timer visuals are UI-only. Let the UI sync timers from state (emit a board update).
    if (Array.isArray(result.anchors) && result.anchors.length > 0) {
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
    }

    if (result.destroyed.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.udgDestroyed(getPlayerName(player), result.destroyed.length));
    }

    if (hasPlayback) {
        // PlaybackEngine will handle destroy visuals; ensure UI consumes presentation events.
        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
        return;
    }

    // Fade-out destroyed stones as a batch
    if (result.destroyed.length > 0) {
        const unique = new Map();
        for (const p of result.destroyed) unique.set(`${p.row},${p.col}`, p);
        await Promise.all(Array.from(unique.values()).map(p => animateFadeOutAt(p.row, p.col)));
    }

    // Fade-out expired anchors AFTER destroying surroundings
    if (Array.isArray(result.expired) && result.expired.length > 0) {
        const unique = new Map();
        for (const p of result.expired) unique.set(`${p.row},${p.col}`, p);
        for (const p of unique.values()) {
            await animateFadeOutAt(p.row, p.col, { createGhost: true, color: player, effectKey: 'ultimateDestroyGod' });
        }
    }

    emitBoardUpdate();
    emitGameStateChange();
}

/**
 * Placement-turn immediate activation for a newly placed UDG anchor.
 * Runs AFTER normal flip animations, and before turn ends.
 * @param {number} player
 * @param {number} row
 * @param {number} col
 * @param {Object} [precomputedResult]
 */
async function processUltimateDestroyGodImmediateAtPlacement(player, row, col, precomputedResult = null) {
    const playerKey = player === BLACK ? 'black' : 'white';
    const result = precomputedResult || CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, { decrementRemainingOwnerTurns: false });

    if (result.destroyed.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.udgDestroyedImmediate(getPlayerName(player), result.destroyed.length));
        const unique = new Map();
        for (const p of result.destroyed) unique.set(`${p.row},${p.col}`, p);
        await Promise.all(Array.from(unique.values()).map(p => animateFadeOutAt(p.row, p.col)));
    }

    emitBoardUpdate();
    emitGameStateChange();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        processUltimateDestroyGodsAtTurnStart,
        processUltimateDestroyGodImmediateAtPlacement
    };
}
