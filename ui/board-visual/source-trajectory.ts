import * as PlayerSeatContract from '../../shared/player-seat-contract';
import PresentationEffectProfiles = require('../../shared/presentation-effect-profiles');
import * as PresentationVisualSeed from '../presentation/visual-seed';
import type { PresentationPlaybackEvent } from './playback-types';

export type BoardSourceTrajectoryProfileKey =
  | 'sniperShot'
  | 'robotVacuumSuck'
  | 'destroyDragonBreath'
  | 'meteorGodBlackBeam'
  | 'lightningDestroyed'
  | 'udgDestroyed'
  | 'zombieBite';

export type BoardSourceTrajectoryPrimitive =
  | 'projectile'
  | 'suction'
  | 'beam'
  | 'lightning'
  | 'bite';

export type BoardSourceTrajectoryDirection = 'source-to-target' | 'target-to-source';

export interface BoardSourceTrajectoryDurationPolicy {
  readonly kind: 'distance' | 'fixed';
  readonly baseMs: number;
  readonly distanceFactor: number;
  readonly minMs: number;
  readonly maxMs: number;
}

export interface BoardSourceTrajectoryProfile {
  readonly profileKey: BoardSourceTrajectoryProfileKey;
  readonly eventType: 'destroy' | 'flip';
  readonly primitive: BoardSourceTrajectoryPrimitive;
  readonly direction: BoardSourceTrajectoryDirection;
  readonly duration: BoardSourceTrajectoryDurationPolicy;
  readonly settlement: 'animation-finish' | 'fixed-deadline' | 'animations-or-deadline';
  readonly deadlinePaddingMs: number;
  readonly easing: string;
  readonly ownerPolicy: 'sniper-projectile' | 'owner-before' | 'owner-after' | 'none';
  readonly texturePolicy: 'normal-stone' | 'none';
  readonly targetImpactOwner: 'board-backend';
  readonly noAnimation: 'zero-duration-no-object';
  readonly reducedMotion: 'unchanged' | 'skip-source';
  readonly visualSeedPolicy: 'destroy-source' | 'none';
  readonly haloCells: number;
}

export interface BoardSourceTrajectoryRequest {
  readonly trajectoryId: string;
  readonly profileKey: BoardSourceTrajectoryProfileKey;
  readonly eventType: 'destroy' | 'flip';
  readonly eventOrdinal: number;
  readonly targetOrdinal: number;
  readonly source: Readonly<{ row: number; col: number }>;
  readonly target: Readonly<{ row: number; col: number }>;
  readonly direction: BoardSourceTrajectoryDirection;
  readonly owner: PlayerSeatContract.PlayerSeatKey | null;
  readonly visualSeed: number | null;
  readonly event: PresentationPlaybackEvent;
  readonly targetPayload: unknown;
}

export interface BoardSourceTrajectoryMembership {
  readonly trajectoryId: string;
  readonly eventOrdinal: number;
  readonly targetOrdinal: number;
  readonly eventType: 'destroy' | 'flip';
  readonly targetKey: string;
  readonly event: PresentationPlaybackEvent;
  readonly targetPayload: unknown;
}

export interface BoardSourceTrajectoryBatch {
  readonly phaseKey: string;
  readonly stepIndex: number;
  readonly requests: readonly BoardSourceTrajectoryRequest[];
  readonly memberships: readonly BoardSourceTrajectoryMembership[];
}

export class BoardSourceTrajectoryError extends Error {
  readonly code:
    | 'unknown_profile'
    | 'invalid_event_type'
    | 'invalid_source_coordinate'
    | 'invalid_target_coordinate'
    | 'duplicate_trajectory_id';
  readonly profileKey: string | null;
  readonly eventOrdinal: number | null;
  readonly targetOrdinal: number | null;

  constructor(
    code: BoardSourceTrajectoryError['code'],
    message: string,
    details: Partial<Pick<BoardSourceTrajectoryError, 'profileKey' | 'eventOrdinal' | 'targetOrdinal'>> = {}
  ) {
    super(message);
    this.name = 'BoardSourceTrajectoryError';
    this.code = code;
    this.profileKey = details.profileKey ?? null;
    this.eventOrdinal = details.eventOrdinal ?? null;
    this.targetOrdinal = details.targetOrdinal ?? null;
  }
}

function duration(
  baseMs: number,
  distanceFactor: number,
  minMs: number,
  maxMs: number
): BoardSourceTrajectoryDurationPolicy {
  return Object.freeze({
    kind: distanceFactor === 0 && baseMs === minMs && baseMs === maxMs ? 'fixed' : 'distance',
    baseMs,
    distanceFactor,
    minMs,
    maxMs
  });
}

export const BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY: Readonly<
Record<BoardSourceTrajectoryProfileKey, BoardSourceTrajectoryProfile>
> = Object.freeze({
  sniperShot: Object.freeze({
    profileKey: 'sniperShot', eventType: 'destroy', primitive: 'projectile', direction: 'source-to-target',
    duration: duration(90, 0.35, 120, 420), settlement: 'animation-finish', deadlinePaddingMs: 120,
    easing: 'linear', ownerPolicy: 'sniper-projectile', texturePolicy: 'normal-stone',
    targetImpactOwner: 'board-backend', noAnimation: 'zero-duration-no-object', reducedMotion: 'unchanged',
    visualSeedPolicy: 'none', haloCells: 0.5
  }),
  robotVacuumSuck: Object.freeze({
    profileKey: 'robotVacuumSuck', eventType: 'destroy', primitive: 'suction', direction: 'target-to-source',
    duration: duration(140, 0.28, 140, 360), settlement: 'animation-finish', deadlinePaddingMs: 120,
    easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)', ownerPolicy: 'owner-before', texturePolicy: 'normal-stone',
    targetImpactOwner: 'board-backend', noAnimation: 'zero-duration-no-object', reducedMotion: 'unchanged',
    visualSeedPolicy: 'none', haloCells: 0.75
  }),
  destroyDragonBreath: Object.freeze({
    profileKey: 'destroyDragonBreath', eventType: 'destroy', primitive: 'beam', direction: 'source-to-target',
    duration: duration(240, 0.28, 280, 520), settlement: 'fixed-deadline', deadlinePaddingMs: 120,
    easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', ownerPolicy: 'none', texturePolicy: 'none',
    targetImpactOwner: 'board-backend', noAnimation: 'zero-duration-no-object', reducedMotion: 'unchanged',
    visualSeedPolicy: 'none', haloCells: 0.75
  }),
  meteorGodBlackBeam: Object.freeze({
    profileKey: 'meteorGodBlackBeam', eventType: 'destroy', primitive: 'beam', direction: 'source-to-target',
    duration: duration(230, 0.22, 260, 460), settlement: 'fixed-deadline', deadlinePaddingMs: 140,
    easing: 'cubic-bezier(0.2, 0.78, 0.18, 1)', ownerPolicy: 'none', texturePolicy: 'none',
    targetImpactOwner: 'board-backend', noAnimation: 'zero-duration-no-object', reducedMotion: 'unchanged',
    visualSeedPolicy: 'none', haloCells: 1
  }),
  lightningDestroyed: Object.freeze({
    profileKey: 'lightningDestroyed', eventType: 'destroy', primitive: 'lightning', direction: 'source-to-target',
    duration: duration(170, 0.12, 170, 300), settlement: 'animations-or-deadline', deadlinePaddingMs: 140,
    easing: 'linear', ownerPolicy: 'none', texturePolicy: 'none',
    targetImpactOwner: 'board-backend', noAnimation: 'zero-duration-no-object', reducedMotion: 'unchanged',
    visualSeedPolicy: 'destroy-source', haloCells: 1
  }),
  udgDestroyed: Object.freeze({
    profileKey: 'udgDestroyed', eventType: 'destroy', primitive: 'lightning', direction: 'source-to-target',
    duration: duration(170, 0.12, 170, 300), settlement: 'animations-or-deadline', deadlinePaddingMs: 140,
    easing: 'linear', ownerPolicy: 'none', texturePolicy: 'none',
    targetImpactOwner: 'board-backend', noAnimation: 'zero-duration-no-object', reducedMotion: 'unchanged',
    visualSeedPolicy: 'destroy-source', haloCells: 1
  }),
  zombieBite: Object.freeze({
    profileKey: 'zombieBite', eventType: 'flip', primitive: 'bite', direction: 'source-to-target',
    duration: duration(800, 0, 800, 800), settlement: 'fixed-deadline', deadlinePaddingMs: 0,
    easing: 'linear', ownerPolicy: 'owner-after', texturePolicy: 'none',
    targetImpactOwner: 'board-backend', noAnimation: 'zero-duration-no-object', reducedMotion: 'skip-source',
    visualSeedPolicy: 'none', haloCells: 1
  })
});

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function readIntegerCoordinate(
  value: unknown,
  rowKeys: readonly string[],
  colKeys: readonly string[]
): Readonly<{ row: number; col: number }> | null {
  const source = asRecord(value);
  const rowKey = rowKeys.find((key) => Object.prototype.hasOwnProperty.call(source, key));
  const colKey = colKeys.find((key) => Object.prototype.hasOwnProperty.call(source, key));
  const row = rowKey ? Number(source[rowKey]) : Number.NaN;
  const col = colKey ? Number(source[colKey]) : Number.NaN;
  return Number.isInteger(row) && Number.isInteger(col)
    ? Object.freeze({ row, col })
    : null;
}

function resolveSourceCoordinate(target: unknown): Readonly<{ row: number; col: number }> | null {
  const source = asRecord(target);
  const direct = readIntegerCoordinate(source, ['sourceRow'], ['sourceCol']);
  return direct || readIntegerCoordinate(source.meta, ['sourceRow'], ['sourceCol']);
}

function resolveTargetCoordinate(target: unknown): Readonly<{ row: number; col: number }> | null {
  return readIntegerCoordinate(target, ['r', 'row'], ['col', 'c', 'column']);
}

function resolveOwner(
  profile: BoardSourceTrajectoryProfile,
  targetPayload: unknown
): PlayerSeatContract.PlayerSeatKey | null {
  const target = asRecord(targetPayload);
  const meta = asRecord(target.meta);
  if (profile.ownerPolicy === 'sniper-projectile') {
    const explicit = PlayerSeatContract.parsePlayerSeatKey(target.projectileOwner)
      || PlayerSeatContract.parsePlayerSeatKey(meta.projectileOwner);
    if (explicit) return explicit;
    return PlayerSeatContract.getOpposingPlayerSeatKey(target.ownerBefore) || 'black';
  }
  if (profile.ownerPolicy === 'owner-before') {
    return PlayerSeatContract.parsePlayerSeatKey(target.ownerBefore) || 'black';
  }
  if (profile.ownerPolicy === 'owner-after') {
    return PlayerSeatContract.parsePlayerSeatKey(target.ownerAfter);
  }
  return null;
}

function resolveVisualSeed(
  profile: BoardSourceTrajectoryProfile,
  event: PresentationPlaybackEvent,
  target: Readonly<{ row: number; col: number }>
): number | null {
  if (profile.visualSeedPolicy === 'none') return null;
  return PresentationVisualSeed.createVisualSeed({
    event: {
      ...event,
      presentationBatchId: event.presentationBatchId || 'local-presentation:0',
      effectKind: profile.visualSeedPolicy,
      target
    }
  });
}

function normalizeEventType(event: PresentationPlaybackEvent): 'destroy' | 'flip' | null {
  const type = String(event?.type || '').trim().toLowerCase();
  return type === 'destroy' || type === 'flip' ? type : null;
}

function stableTrajectoryId(
  phaseKey: string,
  stepIndex: number,
  eventOrdinal: number,
  targetOrdinal: number,
  profileKey: BoardSourceTrajectoryProfileKey
): string {
  return `${encodeURIComponent(phaseKey)}/${stepIndex}/${eventOrdinal}/${targetOrdinal}/${profileKey}`;
}

function coordinateKey(coordinate: Readonly<{ row: number; col: number }>): string {
  return `${coordinate.row},${coordinate.col}`;
}

export function resolveBoardSourceTrajectoryDurationMs(
  profileKey: BoardSourceTrajectoryProfileKey,
  distancePx: unknown
): number {
  const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[profileKey];
  if (!profile) {
    throw new BoardSourceTrajectoryError('unknown_profile', `Unknown board source trajectory profile: ${String(profileKey)}`, {
      profileKey: String(profileKey)
    });
  }
  const distance = Math.max(0, Number(distancePx) || 0);
  const raw = profile.duration.baseMs + distance * profile.duration.distanceFactor;
  return Math.max(profile.duration.minMs, Math.min(profile.duration.maxMs, Math.round(raw)));
}

export function collectBoardSourceTrajectoryRequests(
  rawEvents: readonly PresentationPlaybackEvent[],
  context?: Readonly<{ phaseKey?: unknown; stepIndex?: unknown }>
): BoardSourceTrajectoryBatch {
  const events = Array.isArray(rawEvents) ? rawEvents : [];
  const phaseKey = String(context?.phaseKey ?? 'phase').trim() || 'phase';
  const stepIndex = Number.isInteger(Number(context?.stepIndex)) ? Number(context?.stepIndex) : 0;
  const requests: BoardSourceTrajectoryRequest[] = [];
  const memberships: BoardSourceTrajectoryMembership[] = [];
  const seenIds = new Set<string>();

  for (let eventOrdinal = 0; eventOrdinal < events.length; eventOrdinal += 1) {
    const event = events[eventOrdinal];
    const eventType = normalizeEventType(event);
    if (!eventType) continue;
    const targets = Array.isArray(event.targets) ? event.targets : [];
    for (let targetOrdinal = 0; targetOrdinal < targets.length; targetOrdinal += 1) {
      const targetPayload = targets[targetOrdinal];
      const rawProfileKey = PresentationEffectProfiles.getBoardSourceTrajectoryProfileKey(
        eventType,
        targetPayload as any
      );
      if (!rawProfileKey) continue;
      const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[
        rawProfileKey as BoardSourceTrajectoryProfileKey
      ];
      if (!profile) {
        throw new BoardSourceTrajectoryError('unknown_profile', `Board source trajectory profile is not registered: ${rawProfileKey}`, {
          profileKey: rawProfileKey,
          eventOrdinal,
          targetOrdinal
        });
      }
      if (profile.eventType !== eventType) {
        throw new BoardSourceTrajectoryError('invalid_event_type', `Board source trajectory ${profile.profileKey} cannot handle ${eventType}`, {
          profileKey: profile.profileKey,
          eventOrdinal,
          targetOrdinal
        });
      }
      const source = resolveSourceCoordinate(targetPayload);
      if (!source) {
        throw new BoardSourceTrajectoryError('invalid_source_coordinate', `Board source trajectory ${profile.profileKey} has no integer source coordinate`, {
          profileKey: profile.profileKey,
          eventOrdinal,
          targetOrdinal
        });
      }
      const target = resolveTargetCoordinate(targetPayload);
      if (!target) {
        throw new BoardSourceTrajectoryError('invalid_target_coordinate', `Board source trajectory ${profile.profileKey} has no integer target coordinate`, {
          profileKey: profile.profileKey,
          eventOrdinal,
          targetOrdinal
        });
      }
      const trajectoryId = stableTrajectoryId(
        phaseKey,
        stepIndex,
        eventOrdinal,
        targetOrdinal,
        profile.profileKey
      );
      if (seenIds.has(trajectoryId)) {
        throw new BoardSourceTrajectoryError('duplicate_trajectory_id', `Duplicate board source trajectory id: ${trajectoryId}`, {
          profileKey: profile.profileKey,
          eventOrdinal,
          targetOrdinal
        });
      }
      seenIds.add(trajectoryId);
      const request: BoardSourceTrajectoryRequest = Object.freeze({
        trajectoryId,
        profileKey: profile.profileKey,
        eventType,
        eventOrdinal,
        targetOrdinal,
        source,
        target,
        direction: profile.direction,
        owner: resolveOwner(profile, targetPayload),
        visualSeed: resolveVisualSeed(profile, event, target),
        event,
        targetPayload
      });
      requests.push(request);
      memberships.push(Object.freeze({
        trajectoryId,
        eventOrdinal,
        targetOrdinal,
        eventType,
        targetKey: coordinateKey(target),
        event,
        targetPayload
      }));
    }
  }
  return Object.freeze({
    phaseKey,
    stepIndex,
    requests: Object.freeze(requests),
    memberships: Object.freeze(memberships)
  });
}

/**
 * Resolves raw membership for an existing target or for a coordinate-merged
 * flip target. The flip fallback deliberately returns every raw trajectory at
 * that coordinate in received order.
 */
export function getBoardSourceTrajectoryIdsForTarget(
  batch: BoardSourceTrajectoryBatch,
  eventType: 'destroy' | 'flip',
  targetPayload: unknown,
  event?: PresentationPlaybackEvent | null
): readonly string[] {
  const exact = batch.memberships.filter((membership) => (
    membership.eventType === eventType
    && membership.targetPayload === targetPayload
    && (!event || membership.event === event)
  ));
  if (exact.length) return Object.freeze(exact.map((membership) => membership.trajectoryId));
  const coordinate = resolveTargetCoordinate(targetPayload);
  if (!coordinate) return Object.freeze([]);
  const key = coordinateKey(coordinate);
  return Object.freeze(batch.memberships.filter((membership) => (
    membership.eventType === eventType
    && membership.targetKey === key
    && (eventType === 'flip' || !event || membership.event === event)
  )).map((membership) => membership.trajectoryId));
}

export function getBoardSourceTrajectoryRequest(
  batch: BoardSourceTrajectoryBatch,
  trajectoryId: unknown
): BoardSourceTrajectoryRequest | null {
  const id = String(trajectoryId || '');
  return batch.requests.find((request) => request.trajectoryId === id) || null;
}
