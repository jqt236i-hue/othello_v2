import type {
  BoardMarkerVisualState,
  BoardStoneVisualState
} from '../../board-visual/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined'
  ? __non_webpack_require__
  : require;

const OwnerHelpers = _require('../../../utils/owner-helpers');

export interface PixiPlaybackCoordinate {
  readonly row: number;
  readonly col: number;
}

export interface PixiPlaybackStoneVisual {
  readonly stone: BoardStoneVisualState;
  readonly markers: readonly BoardMarkerVisualState[];
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function finiteInteger(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || typeof value === 'boolean') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

export function normalizePlaybackCoordinate(value: unknown): PixiPlaybackCoordinate | null {
  const source = asRecord(value);
  const row = finiteInteger(Object.prototype.hasOwnProperty.call(source, 'r') ? source.r : source.row);
  const col = finiteInteger(
    Object.prototype.hasOwnProperty.call(source, 'col')
      ? source.col
      : (Object.prototype.hasOwnProperty.call(source, 'c') ? source.c : source.column)
  );
  return row === null || col === null ? null : Object.freeze({ row, col });
}

export function normalizePlaybackOwner(...values: unknown[]): 'black' | 'white' | null {
  for (const value of values) {
    const normalized = OwnerHelpers && typeof OwnerHelpers.normalizePlayerKeyOptional === 'function'
      ? OwnerHelpers.normalizePlayerKeyOptional(value)
      : null;
    if (normalized === 'black' || normalized === 'white') return normalized;
  }
  return null;
}

function specialTypeFromState(state: Record<string, any>): string | null {
  const raw = state.special;
  const value = raw && typeof raw === 'object' ? raw.type : raw;
  const normalized = String(value || state.specialType || '').trim().toUpperCase();
  return normalized || null;
}

function marker(
  kind: string,
  owner: 'black' | 'white' | null,
  data: Record<string, unknown>
): BoardMarkerVisualState {
  return Object.freeze({
    kind,
    owner,
    value: null,
    data: Object.freeze({ ...data })
  });
}

function playbackMarkers(
  state: Record<string, any>,
  owner: 'black' | 'white',
  specialType: string | null
): readonly BoardMarkerVisualState[] {
  const markers: BoardMarkerVisualState[] = [];
  if (state.livingWillAura) {
    markers.push(marker('living-will-aura', owner, asRecord(state.livingWillAura)));
  }
  if (state.manifestAura) {
    const aura = asRecord(state.manifestAura);
    markers.push(marker('manifest-aura', normalizePlaybackOwner(aura.owner, owner), aura));
  }
  const markerSources: ReadonlyArray<readonly [string, unknown]> = Object.freeze([
    ['guard', state.guard || (specialType === 'GUARD' ? { type: 'GUARD', remainingOwnerTurns: state.timer } : null)],
    ['bomb', state.bomb || ((specialType === 'TIME_BOMB' || specialType === 'BOMB')
      ? { type: specialType, remainingTurns: state.timer }
      : null)],
    ['frozen', state.frozen || (specialType === 'FREEZE' ? { type: 'FREEZE', remainingOwnerTurns: state.timer } : null)],
    ['poisoned', state.poisoned || (specialType === 'POISONED' ? { type: 'POISONED', timer: state.timer } : null)],
    ['breeding-sprout', state.breedingSprout]
  ]);
  for (const [kind, raw] of markerSources) {
    if (!raw) continue;
    const data = typeof raw === 'object' ? asRecord(raw) : { active: true };
    markers.push(marker(kind, normalizePlaybackOwner(data.owner, owner), data));
  }
  return Object.freeze(markers);
}

/**
 * Converts the existing presentation DTO state into the render model's stone
 * shape. It never reads canonical game state; missing ownership comes only
 * from the event's presentation metadata supplied as fallbacks.
 */
export function createPlaybackStoneVisual(
  rawState: unknown,
  ...ownerFallbacks: unknown[]
): PixiPlaybackStoneVisual | null {
  const state = asRecord(rawState);
  const owner = normalizePlaybackOwner(state.owner, state.color, ...ownerFallbacks);
  if (!owner) return null;
  const specialType = specialTypeFromState(state);
  const value = owner === 'black' ? 1 : -1;
  const specialRecord = state.special && typeof state.special === 'object'
    ? asRecord(state.special)
    : null;
  const status = Object.freeze({
    ...state,
    special: specialRecord || (specialType ? Object.freeze({
      type: specialType,
      remainingOwnerTurns: state.remainingOwnerTurns ?? state.timer ?? null,
      flipEvadeRemaining: state.flipEvadeRemaining ?? null,
      destroyEvadeRemaining: state.destroyEvadeRemaining ?? null,
      regenRemaining: state.regenRemaining ?? null
    }) : null),
    remainingOwnerTurns: state.remainingOwnerTurns ?? state.timer ?? specialRecord?.remainingOwnerTurns ?? null,
    remainingTurns: state.remainingTurns ?? state.timer ?? specialRecord?.remainingTurns ?? null,
    countdown: state.countdown ?? state.timer ?? null
  });
  return Object.freeze({
    stone: Object.freeze({ owner, value, specialType, status }),
    markers: playbackMarkers(state, owner, specialType)
  });
}

export function playbackTargetState(target: unknown, key: 'before' | 'after'): unknown {
  const source = asRecord(target);
  return source[key] && typeof source[key] === 'object' ? source[key] : null;
}

export function playbackTargetCause(target: unknown): string {
  return String(asRecord(target).cause || '').trim().toUpperCase();
}

export function playbackTargetReason(target: unknown): string {
  return String(asRecord(target).reason || '').trim().toLowerCase();
}

export function playbackTargetMeta(target: unknown): Readonly<Record<string, any>> {
  return asRecord(asRecord(target).meta);
}

export function isBreedingSpawnTarget(target: unknown): boolean {
  return playbackTargetCause(target) === 'BREEDING'
    && playbackTargetReason(target).startsWith('breeding_spawn');
}

export function isZombieInfectionTarget(target: unknown): boolean {
  return playbackTargetCause(target) === 'ZOMBIE'
    && playbackTargetReason(target) === 'zombie_infection';
}

export function isTeleportMoveTarget(target: unknown): boolean {
  const source = asRecord(target);
  const intent = String(playbackTargetMeta(target).moveIntent || '').trim().toLowerCase();
  const cause = playbackTargetCause(target);
  return intent === 'teleport_move'
    || cause === 'CELL_TELEPORT_WILL'
    || cause === 'TELEPORT_WILL'
    || playbackTargetReason(target) === 'teleport_move';
}

export function resolveMoveDurationScale(target: unknown): number {
  const source = asRecord(target);
  const cause = playbackTargetCause(target);
  const reason = playbackTargetReason(target);
  if (cause === 'SUPER_ATTRACTION_WILL'
    || reason.startsWith('super_attraction_move')
    || reason.startsWith('super_attraction_collision')) return 0.5;
  return source.isPositionSwapMove === true
    || String(playbackTargetMeta(target).moveIntent || '').toLowerCase() === 'position_swap'
    || cause === 'POSITION_SWAP_WILL'
    || reason === 'position_swap'
    ? 0.8
    : 1;
}

export function interpolate(start: number, end: number, progress: number): number {
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  return start + (end - start) * clamped;
}

export function easeOutCubic(progress: number): number {
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  return 1 - Math.pow(1 - clamped, 3);
}
