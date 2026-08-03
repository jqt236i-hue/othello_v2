import {
  BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY,
  type BoardSourceTrajectoryProfileKey,
  type BoardSourceTrajectoryRequest
} from '../ui/board-visual/source-trajectory';
import type {
  PixiSourceTrajectoryGeometrySnapshot,
  PixiSourceTrajectoryVisualState
} from '../ui/pixi/board-scene';
import {
  buildPixiSourceTrajectoryVisualState
} from '../ui/pixi/effects/source-trajectory';
import {
  compilePixiSourceTrajectoryRenderPlan,
  type PixiSourceTrajectoryRenderPlan,
  type PixiSourceTrajectoryScalarState
} from '../ui/pixi/effects/source-trajectory-render-plan';

const PROFILE_KEYS = Object.freeze(Object.keys(
  BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY
) as BoardSourceTrajectoryProfileKey[]);
const PROGRESS_POINTS = Object.freeze([0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]);

function requestFor(profileKey: BoardSourceTrajectoryProfileKey): BoardSourceTrajectoryRequest {
  const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[profileKey];
  return Object.freeze({
    trajectoryId: `prepared:${profileKey}`,
    profileKey,
    eventType: profile.eventType,
    eventOrdinal: 0,
    targetOrdinal: 0,
    source: Object.freeze({ row: 1, col: 1 }),
    target: Object.freeze({ row: 5, col: 6 }),
    direction: profile.direction,
    owner: profile.texturePolicy === 'normal-stone' ? 'black' : null,
    visualSeed: profile.primitive === 'lightning' ? 0x1234abcd : null,
    event: Object.freeze({ type: profile.eventType, targets: Object.freeze([]) }) as any,
    targetPayload: Object.freeze({})
  });
}

function geometryFor(request: BoardSourceTrajectoryRequest): PixiSourceTrajectoryGeometrySnapshot {
  const sourceCenter = Object.freeze({ x: 52, y: 68 });
  const targetCenter = Object.freeze({ x: 244, y: 196 });
  const movementStart = request.direction === 'target-to-source' ? targetCenter : sourceCenter;
  const movementEnd = request.direction === 'target-to-source' ? sourceCenter : targetCenter;
  const dx = movementEnd.x - movementStart.x;
  const dy = movementEnd.y - movementStart.y;
  return Object.freeze({
    frameToken: 'prepared:frame',
    layoutRevision: 1,
    topologySignature: 'prepared:8x8',
    direction: request.direction,
    cellSize: 32,
    sourceCenter,
    targetCenter,
    movementStart,
    movementEnd,
    distancePx: Math.hypot(dx, dy),
    angleRad: Math.atan2(dy, dx),
    visibleClip: Object.freeze({ left: 0, top: 0, right: 320, bottom: 256, width: 320, height: 256 }),
    paintedHaloClip: Object.freeze({ left: -64, top: -64, right: 384, bottom: 320, width: 448, height: 384 }),
    visibleSegment: Object.freeze({ start: movementStart, end: movementEnd, startT: 0, endT: 1 })
  });
}

function rounded(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

function visualDigest(visual: PixiSourceTrajectoryVisualState) {
  return {
    visible: visual.visible,
    sprite: visual.sprite ? {
      x: rounded(visual.sprite.x),
      y: rounded(visual.sprite.y),
      size: rounded(visual.sprite.size),
      scale: rounded(visual.sprite.scale ?? 1),
      alpha: rounded(visual.sprite.alpha),
      rotation: rounded(visual.sprite.rotation ?? 0),
      visible: visual.sprite.visible !== false
    } : null,
    lines: (visual.lines || []).flatMap((line) => {
      const output = [];
      for (let index = 1; index < line.points.length; index += 1) {
        output.push({
          start: [rounded(line.points[index - 1].x), rounded(line.points[index - 1].y)],
          end: [rounded(line.points[index].x), rounded(line.points[index].y)],
          color: line.color,
          alpha: rounded(line.alpha),
          width: rounded(line.width)
        });
      }
      return output;
    }),
    circles: (visual.circles || []).map((circle) => ({
      x: rounded(circle.x),
      y: rounded(circle.y),
      radius: rounded(circle.radius),
      color: circle.color,
      alpha: rounded(circle.alpha)
    })),
    polygons: (visual.polygons || []).map((polygon) => ({
      points: polygon.points.map((point) => [rounded(point.x), rounded(point.y)]),
      color: polygon.color,
      alpha: rounded(polygon.alpha),
      strokeColor: polygon.strokeColor,
      strokeAlpha: rounded(polygon.strokeAlpha || 0),
      strokeWidth: rounded(polygon.strokeWidth || 0)
    }))
  };
}

function stateAlpha(state: PixiSourceTrajectoryScalarState, channel: string): number {
  return channel === 'beamAlpha'
    ? state.beamAlpha
    : channel === 'lightningMainAlpha'
      ? state.lightningMainAlpha
      : channel === 'lightningBranchAlpha'
        ? state.lightningBranchAlpha
        : state.shadowAlpha;
}

function preparedDigest(
  plan: PixiSourceTrajectoryRenderPlan,
  state: PixiSourceTrajectoryScalarState
) {
  const lines: any[] = [];
  for (const line of plan.lineSets) {
    for (const segment of line.segments) {
      let start = segment[0];
      let end = segment[1];
      if (line.revealChannel) {
        const reveal = line.revealChannel === 'pathReveal' ? state.pathReveal : state.biteCrawl;
        start = plan.geometry.movementStart;
        end = {
          x: start.x + (plan.geometry.movementEnd.x - start.x) * reveal,
          y: start.y + (plan.geometry.movementEnd.y - start.y) * reveal
        };
      }
      lines.push({
        start: [rounded(start.x), rounded(start.y)],
        end: [rounded(end.x), rounded(end.y)],
        color: line.color,
        alpha: rounded(line.baseAlpha * stateAlpha(state, line.alphaChannel)),
        width: rounded(line.width)
      });
    }
  }
  if (state.impactAlpha > 0) {
    for (const raySet of plan.radialRays) {
      for (let index = 0; index < raySet.angles.length; index += 1) {
        const angle = raySet.angles[index];
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const startRadius = state.impactRadius * 0.18;
        const endRadius = state.impactRadius * raySet.endScales[index];
        lines.push({
          start: [rounded(raySet.center.x + dx * startRadius), rounded(raySet.center.y + dy * startRadius)],
          end: [rounded(raySet.center.x + dx * endRadius), rounded(raySet.center.y + dy * endRadius)],
          color: raySet.color,
          alpha: rounded(raySet.baseAlpha * state.impactAlpha),
          width: rounded(raySet.width)
        });
      }
    }
  }
  const circles = state.muzzleVisible
    ? plan.circles.map((circle) => ({
      x: rounded(circle.x),
      y: rounded(circle.y),
      radius: rounded(circle.radius * state.muzzleScale),
      color: circle.color,
      alpha: rounded(circle.baseAlpha * state.muzzleAlpha)
    }))
    : [];
  const polygons = state.fangAlpha > 0
    ? plan.fangs.map((fang) => {
      const offset = state.fangGap * fang.sign;
      const x = fang.center.x + fang.normalX * offset;
      const y = fang.center.y + fang.normalY * offset;
      return {
        points: fang.points.map((point) => [rounded(point.x + x), rounded(point.y + y)]),
        color: fang.color,
        alpha: rounded(state.fangAlpha),
        strokeColor: fang.strokeColor,
        strokeAlpha: rounded(state.fangAlpha * fang.strokeAlphaRatio),
        strokeWidth: rounded(fang.strokeWidth)
      };
    })
    : [];
  return {
    visible: state.visible,
    sprite: plan.sprite && state.spriteVisible ? {
      x: rounded(state.spriteX),
      y: rounded(state.spriteY),
      size: rounded(state.spriteSize),
      scale: rounded(state.spriteScale),
      alpha: rounded(state.spriteAlpha),
      rotation: rounded(state.spriteRotation),
      visible: true
    } : null,
    lines,
    circles,
    polygons
  };
}

describe('prepared Pixi source trajectory render plan', () => {
  test.each(PROFILE_KEYS)('%s preserves the legacy semantic digest at fixed progress points', (profileKey) => {
    const request = requestFor(profileKey);
    const geometry = geometryFor(request);
    const plan = compilePixiSourceTrajectoryRenderPlan(request, geometry);
    const state = plan.createScalarState();

    for (const progress of PROGRESS_POINTS) {
      plan.sampleInto(progress, state);
      expect(preparedDigest(plan, state)).toEqual(visualDigest(
        buildPixiSourceTrajectoryVisualState(request, geometry, progress)
      ));
    }
  });

  test('reuses one scalar state object without producing per-tick descriptors', () => {
    const request = requestFor('lightningDestroyed');
    const plan = compilePixiSourceTrajectoryRenderPlan(request, geometryFor(request));
    const state = plan.createScalarState();
    const identity = state;
    const staticLines = plan.lineSets;

    for (let index = 0; index < 120; index += 1) plan.sampleInto(index / 119, state);

    expect(state).toBe(identity);
    expect(plan.lineSets).toBe(staticLines);
    expect(plan.staticDescriptorCount).toBeGreaterThan(0);
    expect(Object.isFrozen(state)).toBe(false);
  });
});
