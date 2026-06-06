/**
 * @file animation-constants.ts
 * @description Centralized timing and geometric constants for the Playback Engine.
 * Aligns with 03-visual-rulebook.v2.txt.
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface AnimationConstantsModule {
  ANIMATION_TIMINGS?: Record<string, number>;
  getAnimationTiming?: (key: string) => number | undefined;
}

let baseTimings: Record<string, number> | null = null;
let getAnimationTiming: ((key: string) => number | undefined) | null = null;

// Prefer shared constants as source-of-truth.
try {
  const mod: AnimationConstantsModule = _require('../constants/animation-constants');
  baseTimings = mod && mod.ANIMATION_TIMINGS ? mod.ANIMATION_TIMINGS : null;
  getAnimationTiming = mod && typeof mod.getAnimationTiming === 'function' ? mod.getAnimationTiming : null;
} catch (e) {
  // In browser, require may be unavailable; fall back to globals.
  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as unknown as Record<string, unknown>).getAnimationTiming === 'function') {
      getAnimationTiming = (globalThis as unknown as { getAnimationTiming: (key: string) => number | undefined }).getAnimationTiming;
    }
  } catch (e2) { /* ignore */ }
}

const getTiming = (key: string, fallback: number): number => {
  try {
    if (typeof getAnimationTiming === 'function') return getAnimationTiming(key) || fallback;
  } catch (e) { /* ignore */ }
  if (baseTimings && typeof baseTimings[key] === 'number') return baseTimings[key];
  return fallback;
};

const PHASE_GAP_MS = 200;
const POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS = Math.round(PHASE_GAP_MS * 1.5);

const AnimationConstants = {
  // Timing (ms)
  FLIP_MS: getTiming('FLIP_ANIMATION_DURATION', 600),
  PHASE_GAP_MS,
  POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS,
  TURN_TRANSITION_GAP_MS: 200,
  FADE_IN_MS: 300,
  BREEDING_SPAWN_FADE_MS: getTiming('BREEDING_SPAWN_FADE_MS', 500),
  REGEN_CONSUME_FADE_MS: getTiming('REGEN_CONSUME_FADE_MS', 500),
  FADE_OUT_MS: getTiming('FADE_OUT_MS', 500),
  OVERLAY_CROSSFADE_MS: 600,
  MOVE_MS: 400,
  OBSERVER_BUBBLE_MS: 3000,
  OBSERVER_BUBBLE_FADE_MS: 700,
  THEORY_SPAWN_ROULETTE_MS: getTiming('THEORY_SPAWN_ROULETTE_MS', 2500),
  THEORY_SPAWN_MATERIALIZE_MS: getTiming('THEORY_SPAWN_MATERIALIZE_MS', 2000),

  // Geometry
  OVERLAY_SIZE_PERCENT: 82, // Percentage of the base disc size

  // Core Enums
  EVENT_TYPES: {
    PLACE: 'place',
    PLACE_HAND_ANIMATION: 'place_hand_animation',
    FLIP: 'flip',
    DESTROY: 'destroy',
    SPAWN: 'spawn',
    MOVE: 'move',
    STATUS_APPLIED: 'status_applied',
    STATUS_REMOVED: 'status_removed',
    HAND_ADD: 'hand_add',
    CAPTURE_TO_HAND_ANIMATION: 'capture_to_hand_animation',
    HAND_REMOVE: 'hand_remove',
    CARD_USE_ANIMATION: 'card_use_animation',
    SPECIAL_CARD_CINEMATIC: 'special_card_cinematic',
    THEORY_INCARNATION_SPAWN_ROULETTE: 'theory_incarnation_spawn_roulette',
    OBSERVER_BUBBLE: 'observer_bubble',
    ROUND_BONUS_BANNER: 'round_bonus_banner',
    SOUND_EFFECT: 'sound_effect',
    LOG: 'log'
  } as const
};

export = AnimationConstants;
