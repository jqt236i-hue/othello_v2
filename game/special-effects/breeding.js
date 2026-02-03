/**
 * @file breeding.js
 * @description Breeding effect handlers
 */

(function () {
let __uiImpl_breeding = {};
function setUIImpl(obj) { __uiImpl_breeding = obj || {}; }

// Timers abstraction (UI may inject via timers.setTimerImpl)
let timers = null;
if (typeof require === 'function') {
    try { timers = require('../timers'); } catch (e) { /* ignore */ }
}
const waitMs = (ms) => (timers && typeof timers.waitMs === 'function' ? timers.waitMs(ms) : Promise.resolve());

function _isNoAnim() {
    try {
        if (__uiImpl_breeding && __uiImpl_breeding.DISABLE_ANIMATIONS === true) return true;
        if (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)) return true;
        if (typeof process !== 'undefined' && (process.env.NOANIM === '1' || process.env.NOANIM === 'true' || process.env.DISABLE_ANIMATIONS === '1')) return true;
    } catch (e) { }
    return false;
}

/**
 * Process breeding effects (Stone spawning)
 * @async
 * @param {number} player - Current player (BLACK=1 or WHITE=-1)
 * @param {Object} [precomputedResult] - Optional pre-computed result from logic layer
 * @returns {Promise<void>}
 */
async function processBreedingEffectsAtTurnStart(player, precomputedEvents = null) {
    const playerKey = player === BLACK ? 'black' : 'white';

    const hasPlayback = (typeof globalThis !== 'undefined' && globalThis.PlaybackEngine && typeof globalThis.PlaybackEngine.playPresentationEvents === 'function');

    // Prefer a precomputed result from pipeline events if provided
    let result = null;
    if (precomputedEvents && Array.isArray(precomputedEvents)) {
        result = { spawned: [], destroyed: [], flipped: [], anchors: [] };
        for (const ev of precomputedEvents) {
            if (ev.type === 'breeding_spawned_start' || ev.type === 'breeding_spawned_immediate') {
                if (Array.isArray(ev.details)) result.spawned.push(...ev.details);
            }
            if (ev.type === 'breeding_destroyed_start' || ev.type === 'breeding_destroyed_immediate') {
                if (Array.isArray(ev.details)) result.destroyed.push(...ev.details);
            }
            if (ev.type === 'breeding_flipped_start' || ev.type === 'breeding_flipped_immediate') {
                if (Array.isArray(ev.details)) result.flipped.push(...ev.details);
            }
            if (ev.type === 'breeding_anchor_start' || ev.type === 'breeding_anchor_immediate') {
                if (Array.isArray(ev.details)) result.anchors.push(...ev.details);
            }
        }
    } else {
        // Fallback: call CardLogic (discouraged for UI-only path)
        result = CardLogic.processBreedingEffects(cardState, gameState, playerKey);
    }

    if (result.spawned.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.breedingSpawnedImmediate(getPlayerName(player), result.spawned.length));
    }

    // Refresh breeding timers BEFORE any fade-out so "0" can be visible on the last tick.
    // Prefer anchors[] returned by the logic layer, because the marker may be removed immediately.
    const timerAnchors = Array.isArray(result.anchors) ? result.anchors : null;
    // Timer updates are UI concerns. UI should derive timer values from `cardState.specialStones`
    // and/or provided presentationEvents (anchors) and render them. Skip DOM manipulation here.

    // Charge updates MUST be applied by the rule pipeline; do not mutate rule state here.
    if (result.flipped.length > 0) {
        if (typeof emitCardStateChange === 'function') emitCardStateChange();
        else console.warn('[BREEDING] charge updates should come from pipeline; emitCardStateChange not available');
    }

    if (hasPlayback) {
        // PlaybackEngine will handle visuals; ensure UI consumes presentation events.
        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
        return;
    }

    // Spawn each stone sequentially (no opacity animation)
    for (const spawn of result.spawned) {
        // UI should create the disc from presentationEvents/BoardOps; preserve timing only
        await waitMs(800);
    }

    // Flip animations for stones affected by the spawned stone
    if (result.flipped.length > 0) {
        // Flip animations are UI responsibilities. Preserve pacing but do not perform DOM changes here.
        let _getAnimationTiming_breeding = null;
        if (typeof require === 'function') {
            try { ({ getAnimationTiming: _getAnimationTiming_breeding } = require('../../constants/animation-constants')); } catch (e) { /* ignore */ }
        }
        if (typeof _getAnimationTiming_breeding !== 'function' && typeof globalThis !== 'undefined' && typeof globalThis.getAnimationTiming === 'function') {
            _getAnimationTiming_breeding = globalThis.getAnimationTiming;
        }
        const delay = (typeof _getAnimationTiming_breeding === 'function' ? _getAnimationTiming_breeding('FLIP_ANIMATION_DURATION') : undefined) || 800;
        await waitMs(delay);
    }

    // After spawning and splitting, handle destroyed anchors (fade-out)
    for (const pos of result.destroyed) {
        if (typeof animateFadeOutAt === 'function') {
            await animateFadeOutAt(pos.row, pos.col);
        } else {
            await waitMs(300);
        }
    }

    // Final UI sync after all animations
    emitBoardUpdate();
    emitGameStateChange();
}

/**
 * Placement-turn immediate activation for a newly placed breeding anchor.
 * Runs AFTER normal flip animations, and before turn ends.
 * @param {number} player
 * @param {number} row
 * @param {number} col
 * @param {Object} [precomputedResult]
 */
async function processBreedingImmediateAtPlacement(player, row, col, precomputedResult = null) {
    const playerKey = player === BLACK ? 'black' : 'white';
    const result = precomputedResult || CardLogic.processBreedingEffectsAtAnchor(cardState, gameState, playerKey, row, col);

    if (result.spawned.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.breedingSpawned(getPlayerName(player), result.spawned.length));
    }
    if (result.flipped.length > 0) {
        if (typeof emitCardStateChange === 'function') emitCardStateChange();
        else console.warn('[BREEDING IMMEDIATE] charge updates should come from pipeline; emitCardStateChange not available');
    }

    // Spawn animation removed — UI should create discs from presentationEvents. Preserve pacing.
    const BREEDING_FADE_MS = 350; // preserve previous pacing
    for (const spawn of result.spawned) {
        await waitMs(BREEDING_FADE_MS);
    }

    // Flip animation for affected stones: UI responsibility. Preserve pacing.
    if (result.flipped.length > 0) {
        let _getAnimationTiming_breeding = null;
        if (typeof require === 'function') {
            try { ({ getAnimationTiming: _getAnimationTiming_breeding } = require('../../constants/animation-constants')); } catch (e) { /* ignore */ }
        }
        if (typeof _getAnimationTiming_breeding !== 'function' && typeof globalThis !== 'undefined' && typeof globalThis.getAnimationTiming === 'function') {
            _getAnimationTiming_breeding = globalThis.getAnimationTiming;
        }
        const delay = (typeof _getAnimationTiming_breeding === 'function' ? _getAnimationTiming_breeding('FLIP_ANIMATION_DURATION') : undefined) || 800;
        await waitMs(delay);
    }

}

// Exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        processBreedingEffectsAtTurnStart,
        processBreedingImmediateAtPlacement,
        setUIImpl
    };
}
if (typeof globalThis !== 'undefined') {
    try { globalThis.processBreedingEffectsAtTurnStart = processBreedingEffectsAtTurnStart; } catch (e) {}
    try { globalThis.processBreedingImmediateAtPlacement = processBreedingImmediateAtPlacement; } catch (e) {}
    try { globalThis.setBreedingUIImpl = setUIImpl; } catch (e) {}
}
})();
