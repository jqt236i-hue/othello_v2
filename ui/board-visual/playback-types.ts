import SpecialStoneRegistry = require('../../shared/special-stone-registry');

export type StatusPlaybackSubjectKind =
  | 'stone_body'
  | 'stone_status'
  | 'cell_marker'
  | 'topology'
  | 'placement_effect';

export type StatusPlaybackStoneMutation = 'preserve' | 'replace' | 'remove' | 'timer-only';

export interface PlaybackStoneState {
  color?: number;
  owner?: 'black' | 'white' | number | null;
  special?: unknown;
  timer?: number | null;
  [key: string]: unknown;
}

export interface PresentationPlaybackTarget {
  r?: number;
  row?: number;
  col?: number;
  c?: number;
  subjectKind?: StatusPlaybackSubjectKind;
  stoneMutation?: StatusPlaybackStoneMutation;
  before?: PlaybackStoneState | null;
  after?: PlaybackStoneState | null;
  meta?: Readonly<Record<string, unknown>>;
  [key: string]: unknown;
}

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

function normalizeStatusSubjectKind(value: unknown): StatusPlaybackSubjectKind | null {
  const key = String(value || '').trim().toLowerCase();
  if (
    key === 'stone_body'
    || key === 'stone_status'
    || key === 'cell_marker'
    || key === 'topology'
    || key === 'placement_effect'
  ) {
    return key;
  }
  return null;
}

function normalizeStatusStoneMutation(value: unknown): StatusPlaybackStoneMutation | null {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'preserve' || key === 'replace' || key === 'remove' || key === 'timer-only') {
    return key;
  }
  return null;
}

function statusSpecial(event: PresentationPlaybackEvent, target: PresentationPlaybackTarget): string {
  const targetMeta = target?.meta && typeof target.meta === 'object' ? target.meta : {};
  const eventMeta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
  return String(
    targetMeta.special
      || eventMeta.special
      || (target.after && target.after.special)
      || ''
  ).trim().toUpperCase();
}

export function resolveStatusPlaybackSubjectKind(
  event: PresentationPlaybackEvent,
  target: PresentationPlaybackTarget
): StatusPlaybackSubjectKind {
  const targetMeta = target?.meta && typeof target.meta === 'object' ? target.meta : {};
  const eventMeta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
  const explicit = normalizeStatusSubjectKind(
    target.subjectKind || targetMeta.subjectKind || eventMeta.subjectKind
  );
  if (explicit) return explicit;
  const special = statusSpecial(event, target);
  const registry = SpecialStoneRegistry as any;
  const inferred = registry
    && typeof registry.getMarkerSubjectKind === 'function'
    ? normalizeStatusSubjectKind(registry.getMarkerSubjectKind(special))
    : null;
  return inferred || 'stone_body';
}

export function resolveStatusPlaybackStoneMutation(
  event: PresentationPlaybackEvent,
  target: PresentationPlaybackTarget
): StatusPlaybackStoneMutation {
  const targetMeta = target?.meta && typeof target.meta === 'object' ? target.meta : {};
  const eventMeta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
  const explicit = normalizeStatusStoneMutation(
    target.stoneMutation || targetMeta.stoneMutation || eventMeta.stoneMutation
  );
  if (explicit) return explicit;
  const subjectKind = resolveStatusPlaybackSubjectKind(event, target);
  if (subjectKind === 'cell_marker') return 'preserve';
  if (subjectKind === 'topology') return 'remove';
  const special = statusSpecial(event, target);
  const rawType = String(event?.rawType || '').trim().toUpperCase();
  const registry = SpecialStoneRegistry as any;
  const isHazardStoneStatus = registry
    && typeof registry.isHazardStoneStatusType === 'function'
    && registry.isHazardStoneStatusType(special) === true;
  if (isHazardStoneStatus) return rawType === 'STATUS_TICK' ? 'timer-only' : 'preserve';
  return 'replace';
}

export function isStonePreservingStatusPlaybackTarget(
  event: PresentationPlaybackEvent,
  target: PresentationPlaybackTarget
): boolean {
  const mutation = resolveStatusPlaybackStoneMutation(event, target);
  return mutation === 'preserve' || mutation === 'timer-only';
}

export function isBoardPlaybackEvent(event: unknown): event is PresentationPlaybackEvent {
  return BOARD_EVENT_TYPE_SET.has(normalizePresentationEventType(event));
}

export function isSpawnOwnedStatusVisualEvent(event: unknown): boolean {
  if (normalizePresentationEventType(event) !== 'status_applied') return false;
  const meta = event && typeof event === 'object'
    ? (event as PresentationPlaybackEvent).meta
    : null;
  return !!meta && meta.visualOwnedBySpawn === true;
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
