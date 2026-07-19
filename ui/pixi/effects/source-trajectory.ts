import {
  BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY,
  resolveBoardSourceTrajectoryDurationMs,
  type BoardSourceTrajectoryPrimitive,
  type BoardSourceTrajectoryProfile,
  type BoardSourceTrajectoryProfileKey,
  type BoardSourceTrajectoryRequest
} from '../../board-visual/source-trajectory';
import type {
  PixiSourceTrajectoryGeometrySnapshot,
  PixiSourceTrajectoryHandle,
  PixiSourceTrajectoryLineVisual,
  PixiSourceTrajectoryPoint,
  PixiSourceTrajectoryRect,
  PixiSourceTrajectoryTextureLease,
  PixiSourceTrajectoryVisualState
} from '../board-scene';
import type {
  PixiSourceTrajectoryBatchRun,
  PixiSourceTrajectoryProjection,
  PixiSourceTrajectoryRendererDiagnostics,
  PixiSourceTrajectoryRuntimeCounter
} from './types';
import * as PresentationVisualSeed from '../../presentation/visual-seed';

export interface PixiSourceTrajectoryTiming {
  readonly animationDurationMs: number;
  readonly settlementDurationMs: number;
  readonly noObjectReason: 'no-animation' | 'reduced-motion' | 'offscreen' | null;
}

export interface PixiSourceTrajectoryRendererOptions {
  readonly record?: (event: string, detail?: unknown) => void;
}

export interface PixiSourceTrajectoryRenderer {
  start(
    request: BoardSourceTrajectoryRequest,
    projection: PixiSourceTrajectoryProjection
  ): Promise<void>;
  startBatch<T>(
    requests: readonly BoardSourceTrajectoryRequest[],
    projection: PixiSourceTrajectoryProjection,
    startBoard: (trajectoryById: ReadonlyMap<string, Promise<void>>) => T | Promise<T>
  ): PixiSourceTrajectoryBatchRun<T>;
  getDiagnostics(): PixiSourceTrajectoryRendererDiagnostics;
}

interface MutableRuntimeCounter {
  started: number;
  active: number;
  completed: number;
  failed: number;
  noObject: number;
  offscreenNoObject: number;
}

interface LightningGeometry {
  readonly main: readonly PixiSourceTrajectoryPoint[];
  readonly branches: readonly (readonly PixiSourceTrajectoryPoint[])[];
}

const PROFILE_KEYS: readonly BoardSourceTrajectoryProfileKey[] = Object.freeze([
  'sniperShot',
  'robotVacuumSuck',
  'destroyDragonBreath',
  'meteorGodBlackBeam',
  'lightningDestroyed',
  'udgDestroyed',
  'zombieBite'
]);

const PRIMITIVES: readonly BoardSourceTrajectoryPrimitive[] = Object.freeze([
  'projectile',
  'suction',
  'beam',
  'lightning',
  'bite'
]);

function clamp(value: unknown, min = 0, max = 1): number {
  const numeric = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : min));
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp(progress);
}

function point(x: number, y: number): PixiSourceTrajectoryPoint {
  return Object.freeze({ x, y });
}

function pointAt(
  start: PixiSourceTrajectoryPoint,
  end: PixiSourceTrajectoryPoint,
  progress: number
): PixiSourceTrajectoryPoint {
  return point(lerp(start.x, end.x, progress), lerp(start.y, end.y, progress));
}

function keyframed(progress: number, frames: readonly (readonly [number, number])[]): number {
  const t = clamp(progress);
  if (!frames.length) return 0;
  if (t <= frames[0][0]) return frames[0][1];
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (t <= current[0]) {
      const span = Math.max(1e-9, current[0] - previous[0]);
      return lerp(previous[1], current[1], (t - previous[0]) / span);
    }
  }
  return frames[frames.length - 1][1];
}

function cubicBezierProgress(progress: number, x1: number, y1: number, x2: number, y2: number): number {
  const target = clamp(progress);
  if (target === 0 || target === 1) return target;
  let lower = 0;
  let upper = 1;
  let parameter = target;
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const inverse = 1 - parameter;
    const x = 3 * inverse * inverse * parameter * x1
      + 3 * inverse * parameter * parameter * x2
      + parameter * parameter * parameter;
    if (x < target) lower = parameter;
    else upper = parameter;
    parameter = (lower + upper) / 2;
  }
  const inverse = 1 - parameter;
  return 3 * inverse * inverse * parameter * y1
    + 3 * inverse * parameter * parameter * y2
    + parameter * parameter * parameter;
}

function easedProgress(profile: BoardSourceTrajectoryProfile, progress: number): number {
  const match = /^cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i
    .exec(profile.easing);
  if (!match) return clamp(progress);
  return cubicBezierProgress(progress, Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]));
}

function intersectRect(a: PixiSourceTrajectoryRect, b: PixiSourceTrajectoryRect): PixiSourceTrajectoryRect {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.max(left, Math.min(a.right, b.right));
  const bottom = Math.max(top, Math.min(a.bottom, b.bottom));
  return Object.freeze({ left, top, right, bottom, width: right - left, height: bottom - top });
}

function profilePaintRect(
  geometry: PixiSourceTrajectoryGeometrySnapshot,
  profile: BoardSourceTrajectoryProfile
): PixiSourceTrajectoryRect {
  const halo = Math.max(0, profile.haloCells * geometry.cellSize);
  return intersectRect(geometry.paintedHaloClip, Object.freeze({
    left: geometry.visibleClip.left - halo,
    top: geometry.visibleClip.top - halo,
    right: geometry.visibleClip.right + halo,
    bottom: geometry.visibleClip.bottom + halo,
    width: geometry.visibleClip.width + halo * 2,
    height: geometry.visibleClip.height + halo * 2
  }));
}

function pointInsideRect(candidate: PixiSourceTrajectoryPoint, rect: PixiSourceTrajectoryRect): boolean {
  return candidate.x >= rect.left && candidate.x <= rect.right
    && candidate.y >= rect.top && candidate.y <= rect.bottom;
}

function clampPointToRect(candidate: PixiSourceTrajectoryPoint, rect: PixiSourceTrajectoryRect): PixiSourceTrajectoryPoint {
  return point(clamp(candidate.x, rect.left, rect.right), clamp(candidate.y, rect.top, rect.bottom));
}

function clipSegment(
  start: PixiSourceTrajectoryPoint,
  end: PixiSourceTrajectoryPoint,
  rect: PixiSourceTrajectoryRect
): readonly [PixiSourceTrajectoryPoint, PixiSourceTrajectoryPoint] | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    return pointInsideRect(start, rect) ? Object.freeze([start, end]) : null;
  }
  let startT = 0;
  let endT = 1;
  const boundaries = [
    [-dx, start.x - rect.left],
    [dx, rect.right - start.x],
    [-dy, start.y - rect.top],
    [dy, rect.bottom - start.y]
  ] as const;
  for (const [p, q] of boundaries) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) startT = Math.max(startT, ratio);
    else endT = Math.min(endT, ratio);
    if (startT > endT) return null;
  }
  return Object.freeze([pointAt(start, end, startT), pointAt(start, end, endT)]);
}

function clipPath(
  points: readonly PixiSourceTrajectoryPoint[],
  rect: PixiSourceTrajectoryRect
): readonly (readonly [PixiSourceTrajectoryPoint, PixiSourceTrajectoryPoint])[] {
  const segments: Array<readonly [PixiSourceTrajectoryPoint, PixiSourceTrajectoryPoint]> = [];
  for (let index = 1; index < points.length; index += 1) {
    const clipped = clipSegment(points[index - 1], points[index], rect);
    if (clipped) segments.push(clipped);
  }
  return Object.freeze(segments);
}

function lineVisuals(
  segments: readonly (readonly [PixiSourceTrajectoryPoint, PixiSourceTrajectoryPoint])[],
  color: string | number,
  alpha: number,
  width: number
): readonly PixiSourceTrajectoryLineVisual[] {
  return Object.freeze(segments.map((segment) => Object.freeze({
    points: segment,
    color,
    alpha: clamp(alpha),
    width: Math.max(0, width)
  })));
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildJaggedPath(
  start: PixiSourceTrajectoryPoint,
  end: PixiSourceTrajectoryPoint,
  segments: number,
  jitter: number,
  random: () => number
): readonly PixiSourceTrajectoryPoint[] {
  const count = Math.max(2, Math.trunc(segments));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  const output: PixiSourceTrajectoryPoint[] = [];
  for (let index = 0; index <= count; index += 1) {
    const progress = index / count;
    let x = start.x + dx * progress;
    let y = start.y + dy * progress;
    if (index > 0 && index < count) {
      const centerWeight = 1 - Math.abs(progress * 2 - 1);
      const offset = (random() - 0.5) * jitter * (0.45 + centerWeight);
      x += normalX * offset;
      y += normalY * offset;
    }
    output.push(point(x, y));
  }
  return Object.freeze(output);
}

function buildLightningGeometry(
  request: BoardSourceTrajectoryRequest,
  geometry: PixiSourceTrajectoryGeometrySnapshot
): LightningGeometry {
  const seed = Number.isInteger(request.visualSeed)
    ? Number(request.visualSeed) >>> 0
    : hashText(request.trajectoryId);
  // The DOM compatibility renderer consumes this shared visual PRNG with the
  // same seed. Reusing it here keeps the lightning polyline identical across
  // the mutually exclusive renderers without involving canonical game RNG.
  const random = PresentationVisualSeed.createVisualRandom(seed);
  const segmentCount = Math.max(5, Math.min(11, Math.round(geometry.distancePx / 42)));
  const jitter = Math.max(8, Math.min(24, Math.round(geometry.distancePx / 13)));
  const main = buildJaggedPath(
    geometry.movementStart,
    geometry.movementEnd,
    segmentCount,
    jitter,
    random
  );
  const branches: Array<readonly PixiSourceTrajectoryPoint[]> = [];
  for (const rawIndex of [Math.floor(main.length * 0.34), Math.floor(main.length * 0.62)]) {
    const index = Math.max(1, Math.min(main.length - 1, rawIndex));
    const anchor = main[index];
    if (!anchor) continue;
    const branchEnd = point(
      anchor.x + ((random() - 0.5) * 54) + ((geometry.movementEnd.x - geometry.movementStart.x) * 0.12),
      anchor.y + ((random() - 0.5) * 54) - ((geometry.movementEnd.y - geometry.movementStart.y) * 0.08)
    );
    branches.push(buildJaggedPath(
      anchor,
      branchEnd,
      Math.max(3, segmentCount - 3),
      Math.max(5, jitter * 0.68),
      random
    ));
  }
  return Object.freeze({ main, branches: Object.freeze(branches) });
}

function projectileVisual(
  request: BoardSourceTrajectoryRequest,
  profile: BoardSourceTrajectoryProfile,
  geometry: PixiSourceTrajectoryGeometrySnapshot,
  progress: number
): PixiSourceTrajectoryVisualState {
  const traveled = easedProgress(profile, progress);
  const visible = geometry.visibleSegment
    && traveled >= geometry.visibleSegment.startT - 1e-7
    && traveled <= geometry.visibleSegment.endT + 1e-7;
  if (!visible) return Object.freeze({ visible: false });
  const position = pointAt(geometry.movementStart, geometry.movementEnd, traveled);
  const suction = request.profileKey === 'robotVacuumSuck';
  const size = suction
    ? Math.max(18, Math.round(geometry.cellSize * 0.82))
    : Math.max(8, Math.round(geometry.cellSize * 0.82 * 0.25));
  return Object.freeze({
    visible: true,
    sprite: Object.freeze({
      x: position.x,
      y: position.y,
      size,
      scale: suction ? lerp(1, 0.68, traveled) : 1,
      alpha: suction ? lerp(1, 0.78, traveled) : 1,
      rotation: geometry.angleRad,
      visible: true
    })
  });
}

function beamVisual(
  request: BoardSourceTrajectoryRequest,
  profile: BoardSourceTrajectoryProfile,
  geometry: PixiSourceTrajectoryGeometrySnapshot,
  progress: number
): PixiSourceTrajectoryVisualState {
  const blackBeam = request.profileKey === 'meteorGodBlackBeam';
  const reveal = blackBeam
    ? keyframed(progress, [[0, 0.08], [0.16, 1], [0.74, 1], [1, 0.96]])
    : keyframed(progress, [[0, 0.2], [0.18, 1], [0.72, 1], [1, 0.92]]);
  const alpha = blackBeam
    ? keyframed(progress, [[0, 0], [0.16, 1], [0.74, 0.94], [1, 0]])
    : keyframed(progress, [[0, 0], [0.18, 1], [0.72, 0.94], [1, 0]]);
  const dynamicEnd = pointAt(geometry.movementStart, geometry.movementEnd, reveal);
  const clipped = clipSegment(geometry.movementStart, dynamicEnd, geometry.visibleClip);
  const segments = clipped ? Object.freeze([clipped]) : Object.freeze([]);
  const lines = blackBeam
    ? Object.freeze([
      ...lineVisuals(segments, '#6f3aa6', alpha * 0.78, Math.max(6, geometry.cellSize * 0.44)),
      ...lineVisuals(segments, '#08050d', alpha, Math.max(3, geometry.cellSize * 0.19))
    ])
    : Object.freeze([
      ...lineVisuals(segments, '#ff4614', alpha * 0.04, Math.max(18, geometry.cellSize * 1.5)),
      ...lineVisuals(segments, '#ff781e', alpha * 0.07, Math.max(12, geometry.cellSize * 0.9)),
      ...lineVisuals(segments, '#ff5a1f', alpha * 0.12, Math.max(5, geometry.cellSize * 0.38)),
      ...lineVisuals(segments, '#ffb234', alpha * 0.18, Math.max(3, geometry.cellSize * 0.24)),
      ...lineVisuals(segments, '#fff0a8', alpha * 0.22, Math.max(1.5, geometry.cellSize * 0.08))
    ]);
  const paintRect = profilePaintRect(geometry, profile);
  const muzzleProgress = blackBeam
    ? keyframed(progress, [[0, 0], [0.18, 0.95], [0.72, 0.78], [1, 0]])
    : keyframed(progress, [[0, 0], [0.24, 1], [0.68, 0.86], [1, 0]]);
  const muzzleRadius = (blackBeam ? geometry.cellSize * 0.38 : geometry.cellSize * 0.25)
    * keyframed(progress, [[0, 0.45], [0.22, 1.08], [0.72, 0.96], [1, 0.62]]);
  const muzzleCenter = clampPointToRect(geometry.sourceCenter, Object.freeze({
    ...paintRect,
    left: paintRect.left + muzzleRadius,
    top: paintRect.top + muzzleRadius,
    right: Math.max(paintRect.left + muzzleRadius, paintRect.right - muzzleRadius),
    bottom: Math.max(paintRect.top + muzzleRadius, paintRect.bottom - muzzleRadius)
  }));
  const sourceNearPaint = geometry.sourceCenter.x + muzzleRadius >= paintRect.left
    && geometry.sourceCenter.x - muzzleRadius <= paintRect.right
    && geometry.sourceCenter.y + muzzleRadius >= paintRect.top
    && geometry.sourceCenter.y - muzzleRadius <= paintRect.bottom;
  const circles = sourceNearPaint && muzzleProgress > 0
    ? blackBeam
      ? Object.freeze([Object.freeze({
        x: muzzleCenter.x,
        y: muzzleCenter.y,
        radius: muzzleRadius,
        color: '#160b24',
        alpha: muzzleProgress
      })])
      : Object.freeze([
        Object.freeze({
          x: muzzleCenter.x,
          y: muzzleCenter.y,
          radius: muzzleRadius * 1.9,
          color: '#ff5014',
          alpha: muzzleProgress * 0.07
        }),
        Object.freeze({
          x: muzzleCenter.x,
          y: muzzleCenter.y,
          radius: muzzleRadius,
          color: '#ff9a28',
          alpha: muzzleProgress * 0.2
        }),
        Object.freeze({
          x: muzzleCenter.x,
          y: muzzleCenter.y,
          radius: muzzleRadius * 0.34,
          color: '#fff5be',
          alpha: muzzleProgress * 0.52
        })
      ])
    : Object.freeze([]);
  return Object.freeze({
    visible: lines.length > 0 || circles.length > 0,
    lines,
    circles
  });
}

function lightningVisual(
  request: BoardSourceTrajectoryRequest,
  profile: BoardSourceTrajectoryProfile,
  geometry: PixiSourceTrajectoryGeometrySnapshot,
  progress: number,
  preparedLightning?: LightningGeometry
): PixiSourceTrajectoryVisualState {
  const lightning = preparedLightning || buildLightningGeometry(request, geometry);
  const mainAlpha = keyframed(progress, [
    [0, 0], [0.12, 1], [0.27, 0.46], [0.44, 1],
    [0.63, 0.34], [0.78, 0.94], [1, 0]
  ]);
  const branchAlpha = keyframed(progress, [
    [0, 0], [0.16, 0.9], [0.41, 0.26], [0.66, 0.75], [1, 0]
  ]);
  const mainSegments = clipPath(lightning.main, geometry.visibleClip);
  const paintRect = profilePaintRect(geometry, profile);
  const branchSegments = lightning.branches.flatMap((branch) => clipPath(branch, paintRect));
  const lines = Object.freeze([
    ...lineVisuals(mainSegments, '#4bbfff', mainAlpha * 0.04, Math.max(14, geometry.cellSize * 0.72)),
    ...lineVisuals(mainSegments, '#70d8ff', mainAlpha * 0.1, Math.max(8, geometry.cellSize * 0.4)),
    ...lineVisuals(mainSegments, '#86e3ff', mainAlpha * 0.86, Math.max(3, geometry.cellSize * 0.145)),
    ...lineVisuals(mainSegments, '#ffffff', mainAlpha * 0.8, Math.max(1.4, geometry.cellSize * 0.066)),
    ...lineVisuals(branchSegments, '#65cfff', branchAlpha * 0.06, Math.max(7, geometry.cellSize * 0.34)),
    ...lineVisuals(branchSegments, '#97eaff', branchAlpha * 0.72, Math.max(1.8, geometry.cellSize * 0.075)),
    ...lineVisuals(branchSegments, '#ffffff', branchAlpha * 0.78, Math.max(0.9, geometry.cellSize * 0.038))
  ]);
  return Object.freeze({ visible: lines.length > 0 && (mainAlpha > 0 || branchAlpha > 0), lines });
}

function rotatedFang(
  center: PixiSourceTrajectoryPoint,
  directionX: number,
  directionY: number,
  normalX: number,
  normalY: number,
  sign: -1 | 1,
  gap: number,
  size: number,
  width: number,
  rect: PixiSourceTrajectoryRect
): readonly PixiSourceTrajectoryPoint[] {
  const tip = point(center.x + normalX * sign * gap, center.y + normalY * sign * gap);
  const baseCenter = point(
    center.x + normalX * sign * (gap + size),
    center.y + normalY * sign * (gap + size)
  );
  return Object.freeze([
    clampPointToRect(tip, rect),
    clampPointToRect(point(baseCenter.x + directionX * width, baseCenter.y + directionY * width), rect),
    clampPointToRect(point(baseCenter.x - directionX * width, baseCenter.y - directionY * width), rect)
  ]);
}

function biteVisual(
  profile: BoardSourceTrajectoryProfile,
  geometry: PixiSourceTrajectoryGeometrySnapshot,
  progress: number
): PixiSourceTrajectoryVisualState {
  const crawl = clamp(progress / 0.58);
  const shadowEnd = pointAt(geometry.sourceCenter, geometry.targetCenter, crawl);
  const shadow = clipSegment(geometry.sourceCenter, shadowEnd, geometry.visibleClip);
  const shadowAlpha = keyframed(progress, [[0, 0], [0.14, 0.74], [0.64, 0.82], [1, 0]]);
  const lines = shadow
    ? Object.freeze([
      ...lineVisuals([shadow], '#100817', shadowAlpha, Math.max(6, geometry.cellSize * 0.38)),
      ...lineVisuals([shadow], '#442052', shadowAlpha * 0.48, Math.max(2, geometry.cellSize * 0.14))
    ])
    : Object.freeze([]);
  const fangAlpha = keyframed(progress, [[0, 0], [0.42, 0], [0.56, 0.72], [0.82, 0.64], [1, 0]]);
  const paintRect = profilePaintRect(geometry, profile);
  const targetNearPaint = geometry.targetCenter.x >= paintRect.left - geometry.cellSize
    && geometry.targetCenter.x <= paintRect.right + geometry.cellSize
    && geometry.targetCenter.y >= paintRect.top - geometry.cellSize
    && geometry.targetCenter.y <= paintRect.bottom + geometry.cellSize;
  const dx = geometry.targetCenter.x - geometry.sourceCenter.x;
  const dy = geometry.targetCenter.y - geometry.sourceCenter.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const directionX = dx / length;
  const directionY = dy / length;
  const normalX = -directionY;
  const normalY = directionX;
  const close = clamp((progress - 0.42) / 0.42);
  const gap = lerp(geometry.cellSize * 0.42, geometry.cellSize * 0.08, close);
  const size = geometry.cellSize * 0.34;
  const width = geometry.cellSize * 0.18;
  const polygons = targetNearPaint && fangAlpha > 0
    ? Object.freeze(([-1, 1] as const).map((sign) => Object.freeze({
      points: rotatedFang(
        geometry.targetCenter,
        directionX,
        directionY,
        normalX,
        normalY,
        sign,
        gap,
        size,
        width,
        paintRect
      ),
      color: '#31133d',
      alpha: fangAlpha,
      strokeColor: '#9b67a8',
      strokeAlpha: fangAlpha * 0.48,
      strokeWidth: Math.max(1, geometry.cellSize * 0.035)
    })))
    : Object.freeze([]);
  return Object.freeze({ visible: lines.length > 0 || polygons.length > 0, lines, polygons });
}

function buildVisualState(
  request: BoardSourceTrajectoryRequest,
  geometry: PixiSourceTrajectoryGeometrySnapshot,
  progress: number,
  preparedLightning?: LightningGeometry
): PixiSourceTrajectoryVisualState {
  const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[request.profileKey];
  if (!profile) throw new Error(`Unknown Pixi source trajectory profile: ${String(request.profileKey)}`);
  if (!geometry.visibleSegment) return Object.freeze({ visible: false });
  const normalizedProgress = clamp(progress);
  switch (profile.primitive) {
    case 'projectile':
    case 'suction':
      return projectileVisual(request, profile, geometry, normalizedProgress);
    case 'beam':
      return beamVisual(request, profile, geometry, normalizedProgress);
    case 'lightning':
      return lightningVisual(request, profile, geometry, normalizedProgress, preparedLightning);
    case 'bite':
      return biteVisual(profile, geometry, normalizedProgress);
    default:
      return Object.freeze({ visible: false });
  }
}

export function buildPixiSourceTrajectoryVisualState(
  request: BoardSourceTrajectoryRequest,
  geometry: PixiSourceTrajectoryGeometrySnapshot,
  progress: number
): PixiSourceTrajectoryVisualState {
  return buildVisualState(request, geometry, progress);
}

export function resolvePixiSourceTrajectoryTiming(
  request: BoardSourceTrajectoryRequest,
  geometry: PixiSourceTrajectoryGeometrySnapshot,
  options: Readonly<{ noAnimation: boolean; reducedMotion: boolean }>
): PixiSourceTrajectoryTiming {
  const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[request.profileKey];
  if (!profile) throw new Error(`Unknown Pixi source trajectory profile: ${String(request.profileKey)}`);
  if (options.noAnimation) {
    return Object.freeze({ animationDurationMs: 0, settlementDurationMs: 0, noObjectReason: 'no-animation' });
  }
  if (options.reducedMotion && profile.reducedMotion === 'skip-source') {
    return Object.freeze({ animationDurationMs: 0, settlementDurationMs: 0, noObjectReason: 'reduced-motion' });
  }
  const animationDurationMs = resolveBoardSourceTrajectoryDurationMs(request.profileKey, geometry.distancePx);
  const settlementDurationMs = profile.settlement === 'fixed-deadline'
    ? animationDurationMs + profile.deadlinePaddingMs
    : animationDurationMs;
  return Object.freeze({
    animationDurationMs,
    settlementDurationMs,
    noObjectReason: geometry.visibleSegment ? null : 'offscreen'
  });
}

function mutableCounter(): MutableRuntimeCounter {
  return { started: 0, active: 0, completed: 0, failed: 0, noObject: 0, offscreenNoObject: 0 };
}

function counterMap<K extends string>(keys: readonly K[]): Record<K, MutableRuntimeCounter> {
  return Object.fromEntries(keys.map((key) => [key, mutableCounter()])) as Record<K, MutableRuntimeCounter>;
}

function frozenCounter(counter: MutableRuntimeCounter): PixiSourceTrajectoryRuntimeCounter {
  return Object.freeze({ ...counter });
}

function frozenCounterMap<K extends string>(
  source: Record<K, MutableRuntimeCounter>
): Readonly<Record<K, PixiSourceTrajectoryRuntimeCounter>> {
  return Object.freeze(Object.fromEntries(Object.entries(source).map(([key, value]) => [
    key,
    frozenCounter(value as MutableRuntimeCounter)
  ]))) as Readonly<Record<K, PixiSourceTrajectoryRuntimeCounter>>;
}

export function createPixiSourceTrajectoryRenderer(
  options: PixiSourceTrajectoryRendererOptions = {}
): PixiSourceTrajectoryRenderer {
  const record = typeof options.record === 'function' ? options.record : () => undefined;
  const byProfile = counterMap(PROFILE_KEYS);
  const byPrimitive = counterMap(PRIMITIVES);
  let activeRunCount = 0;
  let startedRunCount = 0;
  let completedRunCount = 0;
  let failedRunCount = 0;
  let noObjectRunCount = 0;
  let offscreenNoObjectRunCount = 0;
  let lastProjection: PixiSourceTrajectoryProjection | null = null;

  function markNoObject(
    request: BoardSourceTrajectoryRequest,
    reason: PixiSourceTrajectoryTiming['noObjectReason']
  ): void {
    if (!reason) return;
    noObjectRunCount += 1;
    byProfile[request.profileKey].noObject += 1;
    byPrimitive[BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[request.profileKey].primitive].noObject += 1;
    if (reason === 'offscreen') {
      offscreenNoObjectRunCount += 1;
      byProfile[request.profileKey].offscreenNoObject += 1;
      byPrimitive[BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[request.profileKey].primitive].offscreenNoObject += 1;
    }
  }

  function startInternal(
    request: BoardSourceTrajectoryRequest,
    projection: PixiSourceTrajectoryProjection
  ): Promise<void> {
    const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[request.profileKey];
    if (!profile) return Promise.reject(new Error(`Unknown Pixi source trajectory profile: ${String(request.profileKey)}`));
    if (profile.eventType !== request.eventType || profile.direction !== request.direction) {
      return Promise.reject(new Error(`Pixi source trajectory request does not match profile ${request.profileKey}`));
    }
    const geometry = projection.scene.snapshotSourceTrajectoryGeometry(request);
    const timing = resolvePixiSourceTrajectoryTiming(request, geometry, projection);
    const preparedLightning = profile.primitive === 'lightning' && geometry.visibleSegment
      ? buildLightningGeometry(request, geometry)
      : undefined;
    markNoObject(request, timing.noObjectReason);
    record('pixi-source-trajectory:start', {
      trajectoryId: request.trajectoryId,
      profileKey: request.profileKey,
      primitive: profile.primitive,
      source: request.source,
      target: request.target,
      direction: request.direction,
      animationDurationMs: timing.animationDurationMs,
      settlementDurationMs: timing.settlementDurationMs,
      noObjectReason: timing.noObjectReason,
      layoutRevision: geometry.layoutRevision,
      topologySignature: geometry.topologySignature,
      geometry: Object.freeze({
        sourceCenter: geometry.sourceCenter,
        targetCenter: geometry.targetCenter,
        movementStart: geometry.movementStart,
        movementEnd: geometry.movementEnd,
        distancePx: geometry.distancePx,
        visibleClip: geometry.visibleClip,
        paintedHaloClip: geometry.paintedHaloClip,
        visibleSegment: geometry.visibleSegment
      })
    });

    let handle: PixiSourceTrajectoryHandle | null = null;
    if (!timing.noObjectReason) {
      let textureLease: PixiSourceTrajectoryTextureLease | null = null;
      if (profile.texturePolicy === 'normal-stone') {
        if (request.owner !== 'black' && request.owner !== 'white') {
          return Promise.reject(new Error(`Pixi source trajectory ${request.profileKey} has no stone owner`));
        }
        textureLease = projection.acquireStoneTextureLease(request.owner);
      }
      try {
        handle = projection.scene.acquireSourceTrajectory(projection.scope, {
          trajectoryId: request.trajectoryId,
          profileKey: request.profileKey,
          primitive: profile.primitive,
          geometry,
          textureLease
        });
      } catch (error) {
        // Scene acquisition normally takes ownership even on pool failure.
        // The idempotent fallback also covers validation/scope failures that
        // happen before the scene record can accept the lease.
        try { textureLease?.release(); }
        catch (_releaseError) { /* acquisition error remains authoritative */ }
        throw error;
      }
    }

    const releaseHandle = () => {
      if (!handle) return;
      const current = handle;
      handle = null;
      if (!projection.scene.getSourceTrajectory(current)) return;
      if (projection.scene.getDiagnostics().playbackScopeKey !== projection.scope.key) return;
      projection.scene.releaseSourceTrajectory(projection.scope, current);
    };
    const run = projection.timeline.run({
      durationMs: timing.settlementDurationMs,
      effectFamily: 'board-source-trajectory',
      event: request.event,
      onStart() {
        if (handle) {
          projection.scene.updateSourceTrajectory(
            projection.scope,
            handle,
            buildVisualState(request, geometry, 0, preparedLightning)
          );
        }
      },
      onUpdate(_progress, frame) {
        if (!handle) return;
        const visualProgress = timing.animationDurationMs <= 0
          ? 1
          : clamp(frame.elapsedMs / timing.animationDurationMs);
        projection.scene.updateSourceTrajectory(
          projection.scope,
          handle,
          buildVisualState(request, geometry, visualProgress, preparedLightning)
        );
      }
    });
    return run.then(() => undefined).finally(releaseHandle);
  }

  function start(
    request: BoardSourceTrajectoryRequest,
    projection: PixiSourceTrajectoryProjection
  ): Promise<void> {
    lastProjection = projection;
    const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[request.profileKey];
    if (!profile) return Promise.reject(new Error(`Unknown Pixi source trajectory profile: ${String(request.profileKey)}`));
    const profileCounter = byProfile[request.profileKey];
    const primitiveCounter = byPrimitive[profile.primitive];
    profileCounter.started += 1;
    profileCounter.active += 1;
    primitiveCounter.started += 1;
    primitiveCounter.active += 1;
    activeRunCount += 1;
    startedRunCount += 1;
    let run: Promise<void>;
    try {
      run = startInternal(request, projection);
    } catch (error) {
      run = Promise.reject(error);
    }
    return run.then(
      () => {
        completedRunCount += 1;
        profileCounter.completed += 1;
        primitiveCounter.completed += 1;
        record('pixi-source-trajectory:settle', {
          trajectoryId: request.trajectoryId,
          profileKey: request.profileKey,
          status: 'completed'
        });
      },
      (error) => {
        failedRunCount += 1;
        profileCounter.failed += 1;
        primitiveCounter.failed += 1;
        record('pixi-source-trajectory:settle', {
          trajectoryId: request.trajectoryId,
          profileKey: request.profileKey,
          status: 'failed',
          error
        });
        throw error;
      }
    ).finally(() => {
      activeRunCount = Math.max(0, activeRunCount - 1);
      profileCounter.active = Math.max(0, profileCounter.active - 1);
      primitiveCounter.active = Math.max(0, primitiveCounter.active - 1);
    });
  }

  function startBatch<T>(
    requests: readonly BoardSourceTrajectoryRequest[],
    projection: PixiSourceTrajectoryProjection,
    startBoard: (trajectoryById: ReadonlyMap<string, Promise<void>>) => T | Promise<T>
  ): PixiSourceTrajectoryBatchRun<T> {
    const orderedRequests = Object.freeze(Array.from(requests || []));
    const trajectoryById = new Map<string, Promise<void>>();
    // Deliberately no await: every raw source starts in received order before
    // the first board target callback is allowed to run.
    for (const request of orderedRequests) {
      trajectoryById.set(request.trajectoryId, start(request, projection));
    }
    let boardResult: Promise<T>;
    try {
      boardResult = Promise.resolve(startBoard(trajectoryById));
    } catch (error) {
      boardResult = Promise.reject(error);
    }
    const settlement = Promise.all([
      ...Array.from(trajectoryById.values()),
      boardResult.then(() => undefined)
    ]).then(() => undefined);
    return Object.freeze({
      requests: orderedRequests,
      trajectoryById,
      boardResult,
      settlement
    });
  }

  function getDiagnostics(): PixiSourceTrajectoryRendererDiagnostics {
    const sceneDiagnostics = lastProjection?.scene.getDiagnostics();
    return Object.freeze({
      activeRunCount,
      activeTextureLeaseCount: sceneDiagnostics?.activeSourceTrajectoryTextureLeaseCount || 0,
      startedRunCount,
      completedRunCount,
      failedRunCount,
      noObjectRunCount,
      offscreenNoObjectRunCount,
      byProfile: frozenCounterMap(byProfile),
      byPrimitive: frozenCounterMap(byPrimitive)
    });
  }

  return Object.freeze({ start, startBatch, getDiagnostics });
}
