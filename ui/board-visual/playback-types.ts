export interface PresentationPlaybackEvent {
  type: string;
  phase?: number;
  sequenceIndex?: number;
  actionId?: string | number;
  effectBlockId?: string | number;
  targets?: readonly unknown[];
  meta?: Readonly<Record<string, unknown>>;
  [key: string]: unknown;
}

export type BoardPlaybackEventType =
  | 'place'
  | 'flip'
  | 'destroy'
  | 'spawn'
  | 'move'
  | 'status_applied'
  | 'status_removed'
  | 'crossfade_stone'
  | 'protection_expire'
  | 'legacy_fade_out'
  | 'legacy_strong_will_apply'
  | 'legacy_hyperactive_move'
  | 'legacy_sacrifice_absorb_pulse'
  | 'theory_incarnation_spawn_roulette';

export type HybridPresentationEventType = 'manifest_ending';

export const DOM_COMPATIBILITY_FINAL_STATE_EVENT = '__dom_compatibility_final_state';

const BOARD_EVENT_TYPES = Object.freeze([
  'place',
  'flip',
  'destroy',
  'spawn',
  'move',
  'status_applied',
  'status_removed',
  'crossfade_stone',
  'protection_expire',
  'legacy_fade_out',
  'legacy_strong_will_apply',
  'legacy_hyperactive_move',
  'legacy_sacrifice_absorb_pulse',
  'theory_incarnation_spawn_roulette'
] as const);

const GLOBAL_EVENT_TYPES = Object.freeze([
  'place_hand_animation',
  'hand_add',
  'capture_to_hand_animation',
  'hand_remove',
  'card_use_animation',
  'special_card_cinematic',
  'round_bonus_banner',
  'observer_bubble',
  'sound_effect',
  'log'
] as const);

const BOARD_EVENT_TYPE_SET = new Set<string>(BOARD_EVENT_TYPES);
const GLOBAL_EVENT_TYPE_SET = new Set<string>(GLOBAL_EVENT_TYPES);

export function normalizePresentationEventType(eventOrType: unknown): string {
  const raw = eventOrType && typeof eventOrType === 'object'
    ? (eventOrType as { type?: unknown }).type
    : eventOrType;
  return String(raw || '').trim().toLowerCase();
}

export function isBoardPlaybackEvent(event: unknown): event is PresentationPlaybackEvent {
  return BOARD_EVENT_TYPE_SET.has(normalizePresentationEventType(event));
}

export function isHybridPresentationEvent(event: unknown): event is PresentationPlaybackEvent {
  return normalizePresentationEventType(event) === 'manifest_ending';
}

export function isKnownGlobalPresentationEvent(event: unknown): event is PresentationPlaybackEvent {
  return GLOBAL_EVENT_TYPE_SET.has(normalizePresentationEventType(event));
}

export function isKnownPresentationEvent(event: unknown): event is PresentationPlaybackEvent {
  return isBoardPlaybackEvent(event)
    || isHybridPresentationEvent(event)
    || isKnownGlobalPresentationEvent(event);
}

export function isDomCompatibilityFinalStateEvent(event: unknown): event is PresentationPlaybackEvent {
  return normalizePresentationEventType(event) === DOM_COMPATIBILITY_FINAL_STATE_EVENT;
}

export class PresentationPlaybackError extends Error {
  readonly code: string;
  readonly eventType: string;
  readonly strictNetworkPlayback: boolean;

  constructor(
    code: string,
    eventType: unknown,
    options?: { strictNetworkPlayback?: boolean; cause?: unknown }
  ) {
    const normalizedType = normalizePresentationEventType(eventType) || 'unknown';
    super(`${code}:${normalizedType}`);
    this.name = 'PresentationPlaybackError';
    this.code = String(code || 'presentation_playback_error');
    this.eventType = normalizedType;
    this.strictNetworkPlayback = options?.strictNetworkPlayback === true;
    if (options && Object.prototype.hasOwnProperty.call(options, 'cause')) {
      Object.defineProperty(this, 'cause', {
        value: options.cause,
        configurable: true,
        enumerable: false,
        writable: false
      });
    }
  }
}

export const BOARD_PLAYBACK_EVENT_TYPES = BOARD_EVENT_TYPES;
export const GLOBAL_PRESENTATION_EVENT_TYPES = GLOBAL_EVENT_TYPES;
