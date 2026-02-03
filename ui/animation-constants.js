/**
 * @file animation-constants.js
 * @description Centralized timing and geometric constants for the Playback Engine.
 * Aligns with 03-visual-rulebook.v2.txt.
 */

var baseTimings = null;
var getAnimationTiming = null;

// Prefer shared constants as source-of-truth.
try {
    const mod = require('../constants/animation-constants');
    baseTimings = mod && mod.ANIMATION_TIMINGS ? mod.ANIMATION_TIMINGS : null;
    getAnimationTiming = mod && typeof mod.getAnimationTiming === 'function' ? mod.getAnimationTiming : null;
} catch (e) {
    // In browser, require may be unavailable; fall back to globals.
    try {
        if (typeof globalThis !== 'undefined' && typeof globalThis.getAnimationTiming === 'function') {
            getAnimationTiming = globalThis.getAnimationTiming;
        }
    } catch (e2) { /* ignore */ }
}

const getTiming = (key, fallback) => {
    try {
        if (typeof getAnimationTiming === 'function') return getAnimationTiming(key) || fallback;
    } catch (e) { /* ignore */ }
    if (baseTimings && typeof baseTimings[key] === 'number') return baseTimings[key];
    return fallback;
};

const AnimationConstants = {
    // Timing (ms)
    FLIP_MS: getTiming('FLIP_ANIMATION_DURATION', 600),
    PHASE_GAP_MS: 200,
    TURN_TRANSITION_GAP_MS: 200,
    FADE_IN_MS: 300,
    FADE_OUT_MS: getTiming('FADE_OUT_MS', 500),
    OVERLAY_CROSSFADE_MS: 600,
    MOVE_MS: 300,

    // Geometry
    OVERLAY_SIZE_PERCENT: 82, // Percentage of the base disc size

    // Core Enums
    EVENT_TYPES: {
        PLACE: 'place',
        FLIP: 'flip',
        DESTROY: 'destroy',
        SPAWN: 'spawn',
        MOVE: 'move',
        STATUS_APPLIED: 'status_applied',
        STATUS_REMOVED: 'status_removed',
        HAND_ADD: 'hand_add',
        HAND_REMOVE: 'hand_remove',
        LOG: 'log'
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnimationConstants;
} else {
    window.AnimationConstants = AnimationConstants;
}
