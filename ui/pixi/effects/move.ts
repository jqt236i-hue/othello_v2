import { worldToScene } from '../../board-visual/layout';
import type { PresentationPlaybackEvent } from '../../board-visual/playback-types';
import type {
  PixiPlaybackCellHighlightHandle,
  PixiPlaybackGhostHandle
} from '../board-scene';
import {
  createPlaybackStoneVisual,
  easeOutCubic,
  interpolate,
  isTeleportMoveTarget,
  normalizePlaybackCoordinate,
  playbackTargetCause,
  playbackTargetMeta,
  playbackTargetReason,
  resolveMoveDurationScale,
  type PixiPlaybackCoordinate,
  type PixiPlaybackStoneVisual
} from './common';
import { resolvePlaybackHighlightTone } from './highlight';
import type { PixiBoardEffectProjection } from './types';

interface MoveSemantics {
  readonly cause: string;
  readonly reason: string;
  readonly moveIntent: string;
  readonly isPositionSwapMove: boolean;
  readonly isFlipEvadeMove: boolean;
  readonly isDestroyEvadeMove: boolean;
  readonly isTeleportMove: boolean;
  readonly isCloneMove: boolean;
  readonly isOverlapReturnMove: boolean;
  readonly isExtremeForcedSwapMove: boolean;
  readonly shouldHighlightBothCells: boolean;
}

interface MovePathPoint {
  readonly offset: number;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

interface ExtremeForcedSwapPair {
  readonly lead: any;
  readonly follow: any;
}

function isPlayableCoordinate(
  projection: PixiBoardEffectProjection,
  coordinate: PixiPlaybackCoordinate
): boolean {
  return projection.frame.model.topology.playableKeys.includes(`${coordinate.row},${coordinate.col}`);
}

function resolveMoveSemantics(target: any): MoveSemantics {
  const cause = playbackTargetCause(target);
  const reason = playbackTargetReason(target);
  const moveIntent = String(playbackTargetMeta(target).moveIntent || '').trim().toLowerCase();
  const extremeForcedSwapRole = String(target?.extremeForcedSwapRole || '').trim().toLowerCase();
  const isPositionSwapMove = moveIntent === 'position_swap'
    || cause === 'POSITION_SWAP_WILL'
    || reason === 'position_swap';
  const isFlipEvadeMove = moveIntent === 'evade_move'
    || reason.includes('flip_evade_move');
  const isDestroyEvadeMove = moveIntent === 'evade_move'
    || cause === 'DESTROY_EVADE'
    || reason.startsWith('destroy_evade_move');
  const isOverlapReturnMove = (
    cause === 'GLUTTONOUS_WILL'
    && reason.startsWith('gluttonous_eat_overlap_return')
  ) || (
    cause === 'WILL_HUNTER_KING'
    && reason.startsWith('will_hunter_king_slash_overlap_return')
  );
  return Object.freeze({
    cause,
    reason,
    moveIntent,
    isPositionSwapMove,
    isFlipEvadeMove,
    isDestroyEvadeMove,
    isTeleportMove: isTeleportMoveTarget(target),
    isCloneMove: target?.clone === true,
    isOverlapReturnMove,
    isExtremeForcedSwapMove: extremeForcedSwapRole === 'lead'
      && cause === 'EXTREME_HYPERACTIVE_WILL'
      && reason.startsWith('extreme_hyperactive_forced_swap'),
    shouldHighlightBothCells: isPositionSwapMove
  });
}

function resolveMoveHighlightCoordinates(
  from: PixiPlaybackCoordinate,
  to: PixiPlaybackCoordinate,
  semantics: MoveSemantics
): readonly PixiPlaybackCoordinate[] {
  if (semantics.shouldHighlightBothCells) return Object.freeze([from, to]);
  return Object.freeze([
    semantics.isDestroyEvadeMove || semantics.isFlipEvadeMove ? from : to
  ]);
}

function resolveExpectedMovingVisual(
  event: PresentationPlaybackEvent,
  target: any
): PixiPlaybackStoneVisual | null {
  if (isRenderableRawStoneState(target?.after)) {
    return createPlaybackStoneVisual(
      target.after,
      target?.ownerAfter,
      target?.owner,
      event?.owner
    );
  }
  if (isRenderableRawStoneState(target?.before)) {
    return createPlaybackStoneVisual(
      target.before,
      target?.ownerBefore,
      target?.owner,
      event?.owner
    );
  }
  const meta = playbackTargetMeta(target);
  return createPlaybackStoneVisual({
    owner: target?.ownerAfter || target?.ownerBefore || target?.owner,
    special: meta.special,
    timer: meta.timer,
    remainingOwnerTurns: meta.timer,
    flipEvadeRemaining: meta.flipEvadeRemaining,
    destroyEvadeRemaining: meta.destroyEvadeRemaining
  }, target?.ownerAfter, target?.ownerBefore, target?.owner, event?.owner);
}

function playbackStoneIdentity(visual: PixiPlaybackStoneVisual | null): string | null {
  if (!visual || !visual.stone) return null;
  const owner = String(visual.stone.owner || '').trim().toLowerCase();
  if (owner !== 'black' && owner !== 'white') return null;
  return `${owner}:${String(visual.stone.specialType || '').trim().toUpperCase()}`;
}

function projectedStoneIsMovingStone(
  projected: PixiPlaybackStoneVisual | null,
  expected: PixiPlaybackStoneVisual | null
): boolean {
  if (!projected) return false;
  if (!expected) return true;
  const projectedIdentity = playbackStoneIdentity(projected);
  const expectedIdentity = playbackStoneIdentity(expected);
  return !!projectedIdentity && !!expectedIdentity && projectedIdentity === expectedIdentity;
}

function resolveSourceVisual(
  event: PresentationPlaybackEvent,
  target: any,
  projection: PixiBoardEffectProjection,
  from: PixiPlaybackCoordinate,
  expectedMoving: PixiPlaybackStoneVisual | null
): PixiPlaybackStoneVisual | null {
  const fromVisual = projection.getProjectedStone(from.row, from.col);
  if (projectedStoneIsMovingStone(fromVisual, expectedMoving)) return fromVisual;
  return expectedMoving
    || createPlaybackStoneVisual(
      target?.before,
      target?.ownerBefore,
      target?.owner,
      event?.owner
    )
    || createPlaybackStoneVisual(
      target?.after,
      target?.ownerAfter,
      target?.owner,
      event?.owner
    );
}

function resolveFinalVisual(
  event: PresentationPlaybackEvent,
  target: any,
  sourceVisual: PixiPlaybackStoneVisual | null
): PixiPlaybackStoneVisual | null {
  return createPlaybackStoneVisual(
    target?.after,
    target?.ownerAfter,
    target?.owner,
    event?.owner
  ) || sourceVisual;
}

function coordinateDelta(
  projection: PixiBoardEffectProjection,
  from: PixiPlaybackCoordinate,
  to: PixiPlaybackCoordinate
): Readonly<{ x: number; y: number }> {
  const topology = projection.frame.model.topology;
  const layout = projection.frame.layout;
  const start = worldToScene(topology, layout, from.row, from.col);
  const end = worldToScene(topology, layout, to.row, to.col);
  return Object.freeze({ x: end.x - start.x, y: end.y - start.y });
}

function normalizeWaypoint(rawPoint: unknown): PixiPlaybackCoordinate | null {
  return normalizePlaybackCoordinate(rawPoint);
}

function resolveWaypointPoints(
  target: any,
  projection: PixiBoardEffectProjection,
  from: PixiPlaybackCoordinate,
  to: PixiPlaybackCoordinate
): readonly Readonly<{ coordinate: PixiPlaybackCoordinate; x: number; y: number; offset: number }>[] {
  const meta = playbackTargetMeta(target);
  const waypoints = (Array.isArray(meta.waypoints) ? meta.waypoints : [])
    .map(normalizeWaypoint)
    .filter((coordinate): coordinate is PixiPlaybackCoordinate => !!coordinate);
  if (!waypoints.some((coordinate) => coordinate.row === to.row && coordinate.col === to.col)) {
    waypoints.push(to);
  }
  const segments = Array.isArray(meta.segments) ? meta.segments : [];
  const lengths = segments.map((segment: any) => {
    const length = Number(segment?.length);
    return Number.isFinite(length) && length > 0 ? length : 0;
  });
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  let travelled = 0;
  return Object.freeze(waypoints.map((coordinate, index) => {
    if (index < lengths.length) travelled += lengths[index];
    const delta = coordinateDelta(projection, from, coordinate);
    const isLast = index === waypoints.length - 1;
    const weightedOffset = totalLength > 0 ? travelled / totalLength : 0;
    return Object.freeze({
      coordinate,
      x: delta.x,
      y: delta.y,
      offset: isLast
        ? 1
        : Math.max(0, Math.min(1, weightedOffset || ((index + 1) / waypoints.length)))
    });
  }));
}

function normalizedPath(points: readonly MovePathPoint[]): readonly MovePathPoint[] {
  return Object.freeze(Array.from(points)
    .map((point) => Object.freeze({
      offset: Math.max(0, Math.min(1, Number(point.offset) || 0)),
      x: Number(point.x) || 0,
      y: Number(point.y) || 0,
      scale: Number.isFinite(Number(point.scale)) ? Number(point.scale) : 1
    }))
    .sort((left, right) => left.offset - right.offset));
}

function buildMovePath(
  target: any,
  projection: PixiBoardEffectProjection,
  from: PixiPlaybackCoordinate,
  to: PixiPlaybackCoordinate,
  semantics: MoveSemantics
): readonly MovePathPoint[] {
  const delta = coordinateDelta(projection, from, to);
  const dominantTravel = Math.max(Math.abs(delta.x), Math.abs(delta.y));
  const start = Object.freeze({ offset: 0, x: 0, y: 0, scale: 1 });
  const end = Object.freeze({ offset: 1, x: delta.x, y: delta.y, scale: 1 });
  if (!(dominantTravel > 0)) return normalizedPath([start, end]);

  if (semantics.moveIntent === 'wind_move'
    || semantics.cause === 'STRONG_WIND_WILL'
    || semantics.reason.startsWith('strong_wind_move')) {
    const gustOffset = Math.max(10, Math.round(dominantTravel * 0.14));
    const absX = Math.abs(delta.x);
    const absY = Math.abs(delta.y);
    return normalizedPath([start, {
      offset: 0.5,
      x: absX >= absY
        ? Math.round(delta.x * 0.58)
        : Math.round(delta.x * 0.54) + (delta.x >= 0 ? gustOffset : -gustOffset),
      y: absX >= absY
        ? Math.round(delta.y * 0.54) - gustOffset
        : Math.round(delta.y * 0.58),
      scale: 1.08
    }, end]);
  }

  if (semantics.cause === 'BUOYANCY_WILL'
    || semantics.cause === 'SUPER_BUOYANCY_WILL'
    || (semantics.moveIntent === 'crush_move'
      && (semantics.reason.startsWith('buoyancy_move')
        || semantics.reason.startsWith('super_buoyancy_move')))) {
    const lift = Math.max(18, Math.round(dominantTravel * 0.2));
    return normalizedPath([start, {
      offset: 0.5,
      x: Math.round(delta.x * 0.45),
      y: Math.round(delta.y * 0.45) - lift,
      scale: 1.06
    }, end]);
  }

  if (semantics.cause === 'GRAVITY_WILL'
    || semantics.cause === 'SUPER_GRAVITY_WILL'
    || semantics.cause === 'SUPER_ATTRACTION_WILL'
    || (semantics.moveIntent === 'crush_move'
      && (semantics.reason.startsWith('super_attraction_move')
        || semantics.reason.startsWith('gravity_move')
        || semantics.reason.startsWith('super_gravity_move')))) {
    const waypoints = resolveWaypointPoints(target, projection, from, to);
    if (semantics.cause === 'SUPER_ATTRACTION_WILL' && waypoints.length > 1) {
      return normalizedPath([
        start,
        ...waypoints.map((point, index) => ({
          offset: point.offset,
          x: point.x,
          y: point.y,
          scale: index === waypoints.length - 1 ? 1 : 1.05
        }))
      ]);
    }
    const drop = Math.max(20, Math.round(dominantTravel * 0.22));
    return normalizedPath([start, {
      offset: 0.5,
      x: Math.round(delta.x * 0.7),
      y: Math.round(delta.y * 0.7) + drop,
      scale: 1.05
    }, end]);
  }

  if (semantics.isOverlapReturnMove) {
    return normalizedPath([start, {
      offset: 0.5,
      x: delta.x,
      y: delta.y,
      scale: semantics.cause === 'WILL_HUNTER_KING' ? 1.06 : 1.03
    }, { ...start, offset: 1 }]);
  }

  if (semantics.isExtremeForcedSwapMove) {
    return normalizedPath([start, {
      offset: 0.5,
      x: Math.round(delta.x * 0.65),
      y: Math.round(delta.y * 0.65),
      scale: 1.03
    }, { ...end, scale: 1.06 }]);
  }

  return normalizedPath([start, end]);
}

function sampleMovePath(
  points: readonly MovePathPoint[],
  rawProgress: number
): Readonly<{ x: number; y: number; scale: number }> {
  if (!points.length) return Object.freeze({ x: 0, y: 0, scale: 1 });
  const progress = easeOutCubic(rawProgress);
  let left = points[0];
  let right = points[points.length - 1];
  for (let index = 1; index < points.length; index += 1) {
    if (progress <= points[index].offset) {
      right = points[index];
      left = points[index - 1];
      break;
    }
  }
  const span = Math.max(0.000001, right.offset - left.offset);
  const localProgress = Math.max(0, Math.min(1, (progress - left.offset) / span));
  return Object.freeze({
    x: interpolate(left.x, right.x, localProgress),
    y: interpolate(left.y, right.y, localProgress),
    scale: interpolate(left.scale, right.scale, localProgress)
  });
}

function isRenderableRawStoneState(value: any): boolean {
  return value && (Number(value.color) === 1 || Number(value.color) === -1);
}

function isExtremeForcedSwapEvent(event: PresentationPlaybackEvent): boolean {
  const meta = event?.meta && typeof event.meta === 'object' ? event.meta as any : {};
  if (String(meta.sequence || '').trim().toLowerCase() === 'extreme_hyperactive_forced_swap') {
    return true;
  }
  const targets: readonly any[] = Array.isArray(event?.targets) ? event.targets as readonly any[] : [];
  return targets.length === 2 && targets.every((target) => (
    playbackTargetCause(target) === 'EXTREME_HYPERACTIVE_WILL'
    && playbackTargetReason(target) === 'extreme_hyperactive_forced_swap'
  ));
}

function resolveExtremeForcedSwapPair(event: PresentationPlaybackEvent): ExtremeForcedSwapPair | null {
  const targets: readonly any[] = Array.isArray(event?.targets) ? event.targets as readonly any[] : [];
  if (targets.length !== 2) return null;
  let lead = targets.find((target) => String(target?.extremeForcedSwapRole || '').toLowerCase() === 'lead');
  let follow = targets.find((target) => String(target?.extremeForcedSwapRole || '').toLowerCase() === 'follow');
  if (!lead || !follow) [lead, follow] = targets;
  const leadFrom = normalizePlaybackCoordinate(lead?.from);
  const leadTo = normalizePlaybackCoordinate(lead?.to);
  const followFrom = normalizePlaybackCoordinate(follow?.from);
  const followTo = normalizePlaybackCoordinate(follow?.to);
  if (!leadFrom || !leadTo || !followFrom || !followTo) return null;
  if (leadTo.row !== followFrom.row
    || leadTo.col !== followFrom.col
    || leadFrom.row !== followTo.row
    || leadFrom.col !== followTo.col) return null;
  if (!isRenderableRawStoneState(lead?.after) || !isRenderableRawStoneState(follow?.after)) return null;
  return Object.freeze({ lead, follow });
}

async function playExtremeForcedSwap(
  event: PresentationPlaybackEvent,
  pair: ExtremeForcedSwapPair,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const leadFrom = normalizePlaybackCoordinate(pair.lead.from)!;
  const leadTo = normalizePlaybackCoordinate(pair.lead.to)!;
  const followTo = normalizePlaybackCoordinate(pair.follow.to)!;
  if (![leadFrom, leadTo, followTo].every((coordinate) => isPlayableCoordinate(projection, coordinate))) return;
  const leadVisual = createPlaybackStoneVisual(
    pair.lead.after,
    pair.lead.ownerAfter,
    pair.lead.ownerBefore,
    event.owner
  );
  const followVisual = createPlaybackStoneVisual(
    pair.follow.after,
    pair.follow.ownerAfter,
    pair.follow.ownerBefore,
    event.owner
  );
  if (!leadVisual || !followVisual) return;

  // The dedicated DOM forced-swap branch intentionally uses the generic red
  // target class whenever the normal move tone resolver returns any tone.
  const resolvedTone = resolvePlaybackHighlightTone(event.type, pair.lead, projection.noAnimation);
  const tone = resolvedTone ? 'negative' as const : null;
  let highlight: PixiPlaybackCellHighlightHandle | null = null;
  let leadGhost: PixiPlaybackGhostHandle | null = null;
  let followGhost: PixiPlaybackGhostHandle | null = null;
  const releaseHighlight = () => {
    if (!highlight) return;
    const owned = highlight;
    highlight = null;
    projection.releaseHighlight(owned);
  };
  const releaseLeadGhost = () => {
    if (!leadGhost) return;
    const owned = leadGhost;
    leadGhost = null;
    projection.releaseGhost(owned);
  };
  const releaseFollowGhost = () => {
    if (!followGhost) return;
    const owned = followGhost;
    followGhost = null;
    projection.releaseGhost(owned);
  };

  try {
    if (projection.noAnimation) {
      await projection.timeline.run({
        durationMs: projection.timings.moveMs * 2,
        effectFamily: 'move-extreme-forced-swap',
        event,
        onStart: () => {
          projection.setProjectedStone(leadFrom.row, leadFrom.col, followVisual);
          projection.setProjectedStone(leadTo.row, leadTo.col, leadVisual);
        },
        onUpdate: () => {}
      });
      return;
    }

    const leadSemantics = resolveMoveSemantics(pair.lead);
    const leadPath = buildMovePath(pair.lead, projection, leadFrom, leadTo, leadSemantics);
    await projection.timeline.run({
      durationMs: projection.timings.moveMs,
      effectFamily: 'move-extreme-forced-swap-lead',
      event,
      onStart: () => {
        projection.setProjectedStone(leadFrom.row, leadFrom.col, null);
        projection.setProjectedStone(leadTo.row, leadTo.col, null);
        leadGhost = projection.acquireTransientGhost(leadFrom.row, leadFrom.col, leadVisual);
        if (tone) highlight = projection.acquireHighlight(leadTo.row, leadTo.col, tone);
      },
      onUpdate: (progress) => {
        const sample = sampleMovePath(leadPath, progress);
        if (leadGhost) projection.updateGhost(leadGhost, {
          offsetX: sample.x,
          offsetY: sample.y,
          scaleX: sample.scale,
          scaleY: sample.scale
        });
        if (progress >= 1) {
          releaseLeadGhost();
          projection.setProjectedStone(leadTo.row, leadTo.col, leadVisual);
        }
      }
    });

    const followSemantics = resolveMoveSemantics(pair.follow);
    const followPath = buildMovePath(pair.follow, projection, leadTo, followTo, followSemantics);
    await projection.timeline.run({
      durationMs: projection.timings.moveMs,
      effectFamily: 'move-extreme-forced-swap-follow',
      event,
      onStart: () => {
        followGhost = projection.acquireTransientGhost(leadTo.row, leadTo.col, followVisual);
      },
      onUpdate: (progress) => {
        const sample = sampleMovePath(followPath, progress);
        if (followGhost) projection.updateGhost(followGhost, {
          offsetX: sample.x,
          offsetY: sample.y,
          scaleX: sample.scale,
          scaleY: sample.scale
        });
        if (progress >= 1) {
          releaseFollowGhost();
          projection.setProjectedStone(followTo.row, followTo.col, followVisual);
          releaseHighlight();
        }
      }
    });
  } finally {
    releaseLeadGhost();
    releaseFollowGhost();
    releaseHighlight();
  }
}

async function playMoveTarget(
  event: PresentationPlaybackEvent,
  target: any,
  projection: PixiBoardEffectProjection
): Promise<void> {
  const from = normalizePlaybackCoordinate(target?.from);
  const to = normalizePlaybackCoordinate(target?.to);
  if (!from || !to || !isPlayableCoordinate(projection, from) || !isPlayableCoordinate(projection, to)) return;
  const semantics = resolveMoveSemantics(target);
  const expectedMoving = resolveExpectedMovingVisual(event, target);
  const sourceBefore = projection.getProjectedStone(from.row, from.col);
  const destBefore = projection.getProjectedStone(to.row, to.col);
  const sourceIsMovingStone = projectedStoneIsMovingStone(sourceBefore, expectedMoving);
  const destIsMovingStone = projectedStoneIsMovingStone(destBefore, expectedMoving);
  const sourceVisual = resolveSourceVisual(event, target, projection, from, expectedMoving)
    || (destIsMovingStone ? destBefore : null);
  const finalVisual = resolveFinalVisual(event, target, sourceVisual);
  const tone = resolvePlaybackHighlightTone(event.type, target, projection.noAnimation);
  const highlightCoordinates = tone
    ? resolveMoveHighlightCoordinates(from, to, semantics)
    : [];
  const highlights: PixiPlaybackCellHighlightHandle[] = [];
  let ghost: PixiPlaybackGhostHandle | null = null;
  let finalApplied = false;
  const releaseHighlights = () => {
    while (highlights.length) projection.releaseHighlight(highlights.pop()!);
  };
  const releaseGhost = () => {
    if (!ghost) return;
    const owned = ghost;
    ghost = null;
    projection.releaseGhost(owned);
  };
  const applyFinal = () => {
    if (finalApplied) return;
    releaseGhost();
    if (semantics.isOverlapReturnMove) {
      projection.setProjectedStone(from.row, from.col, sourceVisual || sourceBefore);
    } else {
      if (!semantics.isCloneMove && sourceIsMovingStone) {
        projection.setProjectedStone(from.row, from.col, null);
      }
      projection.setProjectedStone(to.row, to.col, finalVisual);
    }
    finalApplied = true;
  };

  try {
    if (semantics.isTeleportMove) {
      await projection.timeline.run({
        durationMs: projection.timings.teleportPulseMs,
        effectFamily: 'move-teleport',
        event,
        onStart: () => {
          if (!semantics.isCloneMove && sourceIsMovingStone) {
            projection.setProjectedStone(from.row, from.col, null);
          }
          if (!destBefore || destIsMovingStone) projection.setProjectedStone(to.row, to.col, null);
          if (finalVisual) {
            ghost = projection.acquireTransientGhost(to.row, to.col, finalVisual);
            projection.updateGhost(ghost, { alpha: 0.25, scaleX: 0.5, scaleY: 0.5 });
          }
          if (tone) {
            for (const coordinate of highlightCoordinates) {
              highlights.push(projection.acquireHighlight(coordinate.row, coordinate.col, tone));
            }
          }
        },
        onUpdate: (progress) => {
          const eased = easeOutCubic(progress);
          if (ghost) projection.updateGhost(ghost, {
            alpha: interpolate(0.25, 1, eased),
            scaleX: interpolate(0.5, 1, eased),
            scaleY: interpolate(0.5, 1, eased)
          });
          if (progress >= 1) {
            applyFinal();
            releaseHighlights();
          }
        }
      });
      return;
    }

    const path = buildMovePath(target, projection, from, to, semantics);
    const durationMs = Math.max(1, Math.round(
      projection.timings.moveMs * resolveMoveDurationScale(target)
    ));
    await projection.timeline.run({
      durationMs,
      effectFamily: semantics.isOverlapReturnMove ? 'move-overlap-return' : 'move',
      event,
      onStart: () => {
        if (!semantics.isCloneMove && sourceIsMovingStone) {
          projection.setProjectedStone(from.row, from.col, null);
        }
        if (!semantics.isOverlapReturnMove && (!destBefore || destIsMovingStone)) {
          projection.setProjectedStone(to.row, to.col, null);
        }
        if (sourceVisual) ghost = projection.acquireTransientGhost(from.row, from.col, sourceVisual);
        if (tone) {
          for (const coordinate of highlightCoordinates) {
            highlights.push(projection.acquireHighlight(coordinate.row, coordinate.col, tone));
          }
        }
      },
      onUpdate: (progress) => {
        const sample = sampleMovePath(path, progress);
        if (ghost) projection.updateGhost(ghost, {
          offsetX: sample.x,
          offsetY: sample.y,
          scaleX: sample.scale,
          scaleY: sample.scale
        });
        if (progress >= 1) {
          applyFinal();
          releaseHighlights();
        }
      }
    });
  } finally {
    releaseGhost();
    releaseHighlights();
  }
}

export async function playPixiMoveEffect(
  event: PresentationPlaybackEvent,
  projection: PixiBoardEffectProjection
): Promise<void> {
  if (isExtremeForcedSwapEvent(event)) {
    const pair = resolveExtremeForcedSwapPair(event);
    if (pair) {
      await playExtremeForcedSwap(event, pair, projection);
      return;
    }
  }
  const targets: readonly unknown[] = Array.isArray(event?.targets) ? event.targets : [];
  await Promise.all(targets.map((target) => playMoveTarget(event, target, projection)));
}
