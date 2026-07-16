import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type { PixiPlaybackCellHighlightTone } from '../board-scene';
import {
  playbackTargetCause,
  playbackTargetMeta,
  playbackTargetReason
} from './common';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined'
  ? __non_webpack_require__
  : require;

const PresentationEffectProfiles = _require('../../../shared/presentation-effect-profiles');

function eventType(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function placementTone(type: string, target: any): PixiPlaybackCellHighlightTone | null {
  if (type !== 'spawn' && type !== 'place') return null;
  const meta = playbackTargetMeta(target);
  const kind = String(meta.placementKind || '').trim().toLowerCase();
  if (kind === 'normal_placement') return 'placement';
  if (kind === 'effect_placement') return 'positive';
  const cause = playbackTargetCause(target);
  const reason = playbackTargetReason(target);
  if (cause !== 'SYSTEM' || reason !== 'standard_place') return null;
  const after = target && typeof target.after === 'object' ? target.after : {};
  const special = String(meta.special || after.special || target?.special || '').trim();
  return special ? 'positive' : 'placement';
}

/** Exact Pixi projection of the DOM runtime's transient target-tone policy. */
export function resolvePlaybackHighlightTone(
  rawType: unknown,
  target: unknown,
  noAnimation: boolean
): PixiPlaybackCellHighlightTone | null {
  if (noAnimation) return null;
  const type = eventType(rawType);
  const meta = playbackTargetMeta(target);
  if (meta.blockedByGhost === true || meta.proliferated === true || meta.regenerated === true) {
    return type === 'destroy' ? 'negative' : 'positive';
  }
  const placement = placementTone(type, target);
  if (placement) return placement;
  const cause = playbackTargetCause(target);
  if (!cause || cause === 'SYSTEM') return null;
  if (type === 'destroy') return 'negative';
  if (type === 'move'
    && (cause === 'DESTROY_EVADE' || playbackTargetReason(target).startsWith('destroy_evade_move'))) {
    return 'negative';
  }
  return ['flip', 'spawn', 'place', 'move'].includes(type) ? 'positive' : null;
}

export function resolveSpawnHighlightMinimumMs(target: unknown, fallbackMs: number): number {
  const profiles = PresentationEffectProfiles?.POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS || [];
  const matches = PresentationEffectProfiles?.matchesSpawnProfileTarget;
  if (typeof matches !== 'function') return 0;
  const cause = playbackTargetCause(target);
  const reason = playbackTargetReason(target);
  return profiles.some((profile: unknown) => matches(target, cause, reason, profile))
    ? Math.max(0, Number(fallbackMs) || 0)
    : 0;
}

export function resolveDestroyHighlightMinimumMs(
  target: unknown,
  moveMs: number
): number {
  const meta = playbackTargetMeta(target);
  if (!(meta.proliferated === true || meta.blockedByGhost === true || meta.regenerated === true)) return 0;
  const cause = playbackTargetCause(target);
  const reason = playbackTargetReason(target);
  return (cause === 'GLUTTONOUS_WILL' && reason.startsWith('gluttonous_eat'))
    || (cause === 'WILL_HUNTER_KING' && reason.startsWith('will_hunter_king_slash'))
    ? Math.max(120, Math.floor((Number(moveMs) || 0) / 2))
    : 0;
}

export function resolveStatusHighlightTone(
  event: PresentationPlaybackEvent,
  target: unknown,
  noAnimation: boolean
): PixiPlaybackCellHighlightTone | null {
  if (noAnimation) return null;
  const type = eventType(event?.type);
  if (type !== 'status_applied' && type !== 'status_removed') return null;
  const meta = event && event.meta && typeof event.meta === 'object' ? event.meta as any : {};
  const explicit = String(meta.highlightTone || '').toLowerCase();
  if (explicit === 'none') return null;
  const reason = String(meta.reason || event.reason || (target as any)?.reason || '').toLowerCase();
  const special = String(meta.special || (target as any)?.after?.special || '').toUpperCase();
  if (special === 'BLOCKADE' || special === 'FREEZE') return null;
  if (special === 'TRAP_REVEAL' || reason === 'trap_expired_reveal') return 'negative';
  // Preserve the legacy presentation policy: either explicit non-none tone
  // chooses the shared positive status highlight.
  if (explicit === 'positive' || explicit === 'negative') return 'positive';
  if (String(event.rawType || '').toUpperCase() === 'STATUS_TICK' || !special) return null;
  return 'positive';
}
