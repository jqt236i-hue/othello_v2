import type {
  BoardSourceTrajectoryProfile,
  BoardSourceTrajectoryRequest,
} from '../../board-visual/source-trajectory';
import type {
  PixiSourceTrajectoryGeometrySnapshot,
  PixiSourceTrajectoryPoint,
  PixiSourceTrajectoryRect,
} from '../board-scene';
import * as PresentationVisualSeed from '../../presentation/visual-seed';

export interface SourceTrajectoryLightningPaths {
  readonly main: readonly PixiSourceTrajectoryPoint[];
  readonly branches: readonly (readonly PixiSourceTrajectoryPoint[])[];
}

export function clamp(value: unknown, min = 0, max = 1): number {
  const numeric = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : min));
}

export function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp(progress);
}

export function point(x: number, y: number): PixiSourceTrajectoryPoint {
  return Object.freeze({ x, y });
}

export function cubicBezierProgress(
  progress: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
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

function intersectRect(
  a: PixiSourceTrajectoryRect,
  b: PixiSourceTrajectoryRect,
): PixiSourceTrajectoryRect {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.max(left, Math.min(a.right, b.right));
  const bottom = Math.max(top, Math.min(a.bottom, b.bottom));
  return Object.freeze({
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  });
}

export function getSourceTrajectoryPaintRect(
  geometry: PixiSourceTrajectoryGeometrySnapshot,
  profile: BoardSourceTrajectoryProfile,
): PixiSourceTrajectoryRect {
  const halo = Math.max(0, profile.haloCells * geometry.cellSize);
  return intersectRect(geometry.paintedHaloClip, Object.freeze({
    left: geometry.visibleClip.left - halo,
    top: geometry.visibleClip.top - halo,
    right: geometry.visibleClip.right + halo,
    bottom: geometry.visibleClip.bottom + halo,
    width: geometry.visibleClip.width + halo * 2,
    height: geometry.visibleClip.height + halo * 2,
  }));
}

export function pointInsideRect(
  candidate: PixiSourceTrajectoryPoint,
  rect: PixiSourceTrajectoryRect,
): boolean {
  return candidate.x >= rect.left && candidate.x <= rect.right
    && candidate.y >= rect.top && candidate.y <= rect.bottom;
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
  random: () => number,
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

export function buildSourceTrajectoryLightningPaths(
  request: BoardSourceTrajectoryRequest,
  geometry: PixiSourceTrajectoryGeometrySnapshot,
): SourceTrajectoryLightningPaths {
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
    random,
  );
  const branches: Array<readonly PixiSourceTrajectoryPoint[]> = [];
  for (const rawIndex of [Math.floor(main.length * 0.34), Math.floor(main.length * 0.62)]) {
    const index = Math.max(1, Math.min(main.length - 1, rawIndex));
    const anchor = main[index];
    if (!anchor) continue;
    const branchEnd = point(
      anchor.x + ((random() - 0.5) * 54) + ((geometry.movementEnd.x - geometry.movementStart.x) * 0.12),
      anchor.y + ((random() - 0.5) * 54) - ((geometry.movementEnd.y - geometry.movementStart.y) * 0.08),
    );
    branches.push(buildJaggedPath(
      anchor,
      branchEnd,
      Math.max(3, segmentCount - 3),
      Math.max(5, jitter * 0.68),
      random,
    ));
  }
  return Object.freeze({ main, branches: Object.freeze(branches) });
}
