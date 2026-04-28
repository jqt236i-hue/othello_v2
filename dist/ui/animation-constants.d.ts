/**
 * @file animation-constants.ts
 * @description Centralized timing and geometric constants for the Playback Engine.
 * Aligns with 03-visual-rulebook.v2.txt.
 */
declare const AnimationConstants: {
    FLIP_MS: number;
    PHASE_GAP_MS: number;
    POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS: number;
    TURN_TRANSITION_GAP_MS: number;
    FADE_IN_MS: number;
    BREEDING_SPAWN_FADE_MS: number;
    REGEN_CONSUME_FADE_MS: number;
    FADE_OUT_MS: number;
    OVERLAY_CROSSFADE_MS: number;
    MOVE_MS: number;
    OBSERVER_BUBBLE_MS: number;
    OBSERVER_BUBBLE_FADE_MS: number;
    OVERLAY_SIZE_PERCENT: number;
    EVENT_TYPES: {
        readonly PLACE: "place";
        readonly PLACE_HAND_ANIMATION: "place_hand_animation";
        readonly FLIP: "flip";
        readonly DESTROY: "destroy";
        readonly SPAWN: "spawn";
        readonly MOVE: "move";
        readonly STATUS_APPLIED: "status_applied";
        readonly STATUS_REMOVED: "status_removed";
        readonly HAND_ADD: "hand_add";
        readonly CAPTURE_TO_HAND_ANIMATION: "capture_to_hand_animation";
        readonly HAND_REMOVE: "hand_remove";
        readonly CARD_USE_ANIMATION: "card_use_animation";
        readonly OBSERVER_BUBBLE: "observer_bubble";
        readonly ROUND_BONUS_BANNER: "round_bonus_banner";
        readonly SOUND_EFFECT: "sound_effect";
        readonly LOG: "log";
    };
};
export = AnimationConstants;
//# sourceMappingURL=animation-constants.d.ts.map