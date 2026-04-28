"use strict";
// ===== Animation Timing Constants =====
// Centralized animation duration values to ensure consistency across all modules
const _require = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
const ANIMATION_TIMINGS = {
    // Card deal animation timings
    CARD_APPROACH_DURATION: 210, // Time for card to approach target position
    CARD_GRAB_DURATION: 105, // Time for hand to grab/close on card
    CARD_MOVE_DURATION: 280, // Time for card to move to drop location
    CARD_RELEASE_DURATION: 175, // Time for hand to open/release card
    // Hand placement animation
    PLACEMENT_BOB_DURATION: 150, // Bobbing motion when placing piece
    PLACEMENT_RETREAT_DURATION: 300, // Hand retreat duration
    // Board flip animation
    FLIP_ANIMATION_DURATION: 600, // Time for disc to flip (0.6s)
    BREEDING_SPAWN_FADE_MS: 500, // Fade-in when BREEDING spawns a new stone
    REGEN_CONSUME_FADE_MS: 500, // Fade when REGEN visual is consumed and returns to normal
    // General delays
    ANIMATION_FRAME_DELAY: 100, // Delay between animation frames
    INTERACTION_LOCK_TIME: 500, // Time to lock interactions during animation
};
/**
 * Get animation timing constant by name
 * @param key - Timing constant key
 * @returns Duration in milliseconds
 */
const getAnimationTiming = (key) => {
    return ANIMATION_TIMINGS[key] || 0;
};
module.exports = { ANIMATION_TIMINGS, getAnimationTiming };
//# sourceMappingURL=animation-constants.js.map