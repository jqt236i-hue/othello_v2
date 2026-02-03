// ===== Animation Timing Constants =====
// Centralized animation duration values to ensure consistency across all modules

const ANIMATION_TIMINGS = {
    // Card deal animation timings
    CARD_APPROACH_DURATION: 210,      // Time for card to approach target position
    CARD_GRAB_DURATION: 105,          // Time for hand to grab/close on card
    CARD_MOVE_DURATION: 280,          // Time for card to move to drop location
    CARD_RELEASE_DURATION: 175,       // Time for hand to open/release card
    
    // Hand placement animation
    PLACEMENT_BOB_DURATION: 150,      // Bobbing motion when placing piece
    PLACEMENT_RETREAT_DURATION: 300,  // Hand retreat duration
    
    // Board flip animation
    FLIP_ANIMATION_DURATION: 600,     // Time for disc to flip (0.6s)
    
    // General delays
    ANIMATION_FRAME_DELAY: 100,       // Delay between animation frames
    INTERACTION_LOCK_TIME: 500,       // Time to lock interactions during animation
};

/**
 * Get animation timing constant by name
 * @param {string} key - Timing constant key
 * @returns {number} Duration in milliseconds
 */
const _getAnimationTiming_impl = (key) => {
    return ANIMATION_TIMINGS[key] || 0;
};

// CommonJS export for node/tests
if (typeof module === 'object' && module.exports) {
    module.exports = { ANIMATION_TIMINGS, getAnimationTiming: _getAnimationTiming_impl };
}
// Expose helper on globalThis for browser contexts where require/module are not available
if (typeof globalThis !== 'undefined' && typeof globalThis.getAnimationTiming !== 'function') {
    globalThis.getAnimationTiming = _getAnimationTiming_impl;
}
