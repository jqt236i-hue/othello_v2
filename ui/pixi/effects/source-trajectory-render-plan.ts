import {
  BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY,
  type BoardSourceTrajectoryProfile,
  type BoardSourceTrajectoryProfileKey,
  type BoardSourceTrajectoryRequest
} from '../../board-visual/source-trajectory';
import * as PresentationVisualSeed from '../../presentation/visual-seed';
import type {
  PixiSourceTrajectoryGeometrySnapshot,
  PixiSourceTrajectoryPoint,
  PixiSourceTrajectoryRect
} from '../board-scene';

export type PixiSourceTrajectoryScalarChannel =
  | 'beamAlpha'
  | 'lightningMainAlpha'
  | 'lightningBranchAlpha'
  | 'shadowAlpha';

export type PixiSourceTrajectoryRevealChannel = 'pathReveal' | 'biteCrawl';

export interface PixiPreparedTrajectoryLineSet {
  readonly segments: readonly (readonly [PixiSourceTrajectoryPoint, PixiSourceTrajectoryPoint])[];
  readonly color: string | number;
  readonly baseAlpha: number;
  readonly width: number;
  readonly alphaChannel: PixiSourceTrajectoryScalarChannel;
  readonly revealChannel: PixiSourceTrajectoryRevealChannel | null;
  readonly revealStart: PixiSourceTrajectoryPoint | null;
  readonly revealAngle: number;
  readonly revealLength: number;
  readonly revealHalfExtent: number;
}

export interface PixiPreparedTrajectoryCircle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly color: string | number;
  readonly baseAlpha: number;
}

export interface PixiPreparedTrajectoryRadialRays {
  readonly center: PixiSourceTrajectoryPoint;
  readonly angles: readonly number[];
  readonly endScales: readonly number[];
  readonly color: string | number;
  readonly baseAlpha: number;
  readonly width: number;
}

export interface PixiPreparedTrajectoryFang {
  readonly center: PixiSourceTrajectoryPoint;
  readonly normalX: number;
  readonly normalY: number;
  readonly sign: -1 | 1;
  readonly points: readonly PixiSourceTrajectoryPoint[];
  readonly color: string | number;
  readonly strokeColor: string | number;
  readonly strokeAlphaRatio: number;
  readonly strokeWidth: number;
}

export interface PixiPreparedTrajectorySprite {
  readonly start: PixiSourceTrajectoryPoint;
  readonly end: PixiSourceTrajectoryPoint;
  readonly size: number;
  readonly rotation: number;
  readonly suction: boolean;
}

export interface PixiSourceTrajectoryScalarState {
  progress: number;
  visible: boolean;
  pathReveal: number;
  beamAlpha: number;
  lightningMainAlpha: number;
  lightningBranchAlpha: number;
  muzzleAlpha: number;
  muzzleScale: number;
  muzzleVisible: boolean;
  impactAlpha: number;
  impactRadius: number;
  biteCrawl: number;
  shadowAlpha: number;
  fangAlpha: number;
  fangGap: number;
  spriteVisible: boolean;
  spriteX: number;
  spriteY: number;
  spriteSize: number;
  spriteScale: number;
  spriteAlpha: number;
  spriteRotation: number;
}

export interface PixiSourceTrajectoryRenderPlan {
  readonly profileKey: BoardSourceTrajectoryProfileKey;
  readonly primitive: BoardSourceTrajectoryProfile['primitive'];
  readonly geometry: PixiSourceTrajectoryGeometrySnapshot;
  readonly clipRect: PixiSourceTrajectoryRect;
  readonly lineSets: readonly PixiPreparedTrajectoryLineSet[];
  readonly circles: readonly PixiPreparedTrajectoryCircle[];
  readonly radialRays: readonly PixiPreparedTrajectoryRadialRays[];
  readonly fangs: readonly PixiPreparedTrajectoryFang[];
  readonly sprite: PixiPreparedTrajectorySprite | null;
  readonly staticDescriptorCount: number;
  createScalarState(): PixiSourceTrajectoryScalarState;
  sampleInto(progress: number, target: PixiSourceTrajectoryScalarState): void;
}

const EMPTY_POINTS = Object.freeze([]) as readonly PixiSourceTrajectoryPoint[];
const EMPTY_SEGMENTS = Object.freeze([]) as readonly (readonly [PixiSourceTrajectoryPoint, PixiSourceTrajectoryPoint])[];
const EMPTY_LINES = Object.freeze([]) as readonly PixiPreparedTrajectoryLineSet[];
const EMPTY_CIRCLES = Object.freeze([]) as readonly PixiPreparedTrajectoryCircle[];
const EMPTY_RAYS = Object.freeze([]) as readonly PixiPreparedTrajectoryRadialRays[];
const EMPTY_FANGS = Object.freeze([]) as readonly PixiPreparedTrajectoryFang[];
const RAY_ANGLES = Object.freeze([-1.56, -0.96, -0.38, 0.2, 0.86, 1.42, 2.08, 2.7, 3.28, 3.94, 4.54]);
const RAY_SCALES = Object.freeze([1, 0.68, 0.88, 0.62, 0.94, 0.7, 0.86, 0.64, 0.92, 0.66, 0.82]);
const BEAM_REVEAL = Object.freeze([[0, 0.2], [0.18, 1], [0.72, 1], [1, 0.92]] as const);
const BLACK_BEAM_REVEAL = Object.freeze([[0, 0.08], [0.16, 1], [0.74, 1], [1, 0.96]] as const);
const BEAM_ALPHA = Object.freeze([[0, 0], [0.18, 1], [0.72, 0.94], [1, 0]] as const);
const BLACK_BEAM_ALPHA = Object.freeze([[0, 0], [0.16, 1], [0.74, 0.94], [1, 0]] as const);
const MUZZLE_ALPHA = Object.freeze([[0, 0], [0.24, 1], [0.68, 0.86], [1, 0]] as const);
const BLACK_MUZZLE_ALPHA = Object.freeze([[0, 0], [0.18, 0.95], [0.72, 0.78], [1, 0]] as const);
const MUZZLE_SCALE = Object.freeze([[0, 0.45], [0.22, 1.08], [0.72, 0.96], [1, 0.62]] as const);
const IMPACT_ALPHA = Object.freeze([[0, 0], [0.22, 1], [0.7, 0.88], [1, 0]] as const);
const IMPACT_SCALE = Object.freeze([[0, 0.35], [0.22, 1.15], [0.7, 1.35], [1, 1.75]] as const);
const LIGHTNING_MAIN_ALPHA = Object.freeze([
  [0, 0], [0.12, 1], [0.27, 0.46], [0.44, 1], [0.63, 0.34], [0.78, 0.94], [1, 0]
] as const);
const LIGHTNING_BRANCH_ALPHA = Object.freeze([
  [0, 0], [0.16, 0.9], [0.41, 0.26], [0.66, 0.75], [1, 0]
] as const);
const BITE_SHADOW_ALPHA = Object.freeze([[0, 0], [0.14, 0.74], [0.64, 0.82], [1, 0]] as const);
const BITE_FANG_ALPHA = Object.freeze([[0, 0], [0.42, 0], [0.56, 0.72], [0.82, 0.64], [1, 0]] as const);

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

function keyframed(progress: number, frames: readonly (readonly [number, number])[]): number {
  const t = clamp(progress);
  if (t <= frames[0][0]) return frames[0][1];
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (t <= current[0]) {
      const span = Math.max(1e-9, current[0] - previous[0]);
      return previous[1] + (current[1] - previous[1]) * ((t - previous[0]) / span);
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

function compileEasing(profile: BoardSourceTrajectoryProfile): (progress: number) => number {
  const match = /^cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i
    .exec(profile.easing);
  if (!match) return clamp;
  const x1 = Number(match[1]);
  const y1 = Number(match[2]);
  const x2 = Number(match[3]);
  const y2 = Number(match[4]);
  return (progress: number) => cubicBezierProgress(progress, x1, y1, x2, y2);
}

function intersectRect(a: PixiSourceTrajectoryRect, b: PixiSourceTrajectoryRect): PixiSourceTrajectoryRect {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.max(left, Math.min(a.right, b.right));
  const bottom = Math.max(top, Math.min(a.bottom, b.bottom));
  return Object.freeze({ left, top, right, bottom, width: right - left, height: bottom - top });
}

function paintRect(
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

function squareIntersectsRect(x: number, y: number, sideLength: number, rect: PixiSourceTrajectoryRect): boolean {
  const half = Math.max(0, sideLength) / 2;
  return x + half >= rect.left && x - half <= rect.right
    && y + half >= rect.top && y - half <= rect.bottom;
}

function circleIntersectsRect(x: number, y: number, radius: number, rect: PixiSourceTrajectoryRect): boolean {
  return x + radius >= rect.left && x - radius <= rect.right
    && y + radius >= rect.top && y - radius <= rect.bottom;
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
  const p0 = -dx; const q0 = start.x - rect.left;
  const p1 = dx; const q1 = rect.right - start.x;
  const p2 = -dy; const q2 = start.y - rect.top;
  const p3 = dy; const q3 = rect.bottom - start.y;
  for (let index = 0; index < 4; index += 1) {
    const p = index === 0 ? p0 : index === 1 ? p1 : index === 2 ? p2 : p3;
    const q = index === 0 ? q0 : index === 1 ? q1 : index === 2 ? q2 : q3;
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) startT = Math.max(startT, ratio);
    else endT = Math.min(endT, ratio);
    if (startT > endT) return null;
  }
  return Object.freeze([
    point(start.x + dx * startT, start.y + dy * startT),
    point(start.x + dx * endT, start.y + dy * endT)
  ]);
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

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function jaggedPath(
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

function lightningPaths(
  request: BoardSourceTrajectoryRequest,
  geometry: PixiSourceTrajectoryGeometrySnapshot
): Readonly<{ main: readonly PixiSourceTrajectoryPoint[]; branches: readonly (readonly PixiSourceTrajectoryPoint[])[] }> {
  const seed = Number.isInteger(request.visualSeed)
    ? Number(request.visualSeed) >>> 0
    : hashText(request.trajectoryId);
  const random = PresentationVisualSeed.createVisualRandom(seed);
  const segmentCount = Math.max(5, Math.min(11, Math.round(geometry.distancePx / 42)));
  const jitter = Math.max(8, Math.min(24, Math.round(geometry.distancePx / 13)));
  const main = jaggedPath(geometry.movementStart, geometry.movementEnd, segmentCount, jitter, random);
  const branches: Array<readonly PixiSourceTrajectoryPoint[]> = [];
  const firstIndex = Math.floor(main.length * 0.34);
  const secondIndex = Math.floor(main.length * 0.62);
  for (const rawIndex of [firstIndex, secondIndex]) {
    const index = Math.max(1, Math.min(main.length - 1, rawIndex));
    const anchor = main[index];
    if (!anchor) continue;
    const branchEnd = point(
      anchor.x + ((random() - 0.5) * 54) + ((geometry.movementEnd.x - geometry.movementStart.x) * 0.12),
      anchor.y + ((random() - 0.5) * 54) - ((geometry.movementEnd.y - geometry.movementStart.y) * 0.08)
    );
    branches.push(jaggedPath(anchor, branchEnd, Math.max(3, segmentCount - 3), Math.max(5, jitter * 0.68), random));
  }
  return Object.freeze({ main, branches: Object.freeze(branches) });
}

function lineSet(
  segments: readonly (readonly [PixiSourceTrajectoryPoint, PixiSourceTrajectoryPoint])[],
  color: string | number,
  baseAlpha: number,
  width: number,
  alphaChannel: PixiSourceTrajectoryScalarChannel,
  revealChannel: PixiSourceTrajectoryRevealChannel | null,
  geometry: PixiSourceTrajectoryGeometrySnapshot
): PixiPreparedTrajectoryLineSet {
  return Object.freeze({
    segments,
    color,
    baseAlpha,
    width,
    alphaChannel,
    revealChannel,
    revealStart: revealChannel ? geometry.movementStart : null,
    revealAngle: geometry.angleRad,
    revealLength: Math.max(1, geometry.distancePx),
    revealHalfExtent: Math.max(
      geometry.paintedHaloClip.width,
      geometry.paintedHaloClip.height,
      geometry.cellSize * 4
    )
  });
}
function makeState(): PixiSourceTrajectoryScalarState {
  return {
    progress: 0,
    visible: false,
    pathReveal: 0,
    beamAlpha: 0,
    lightningMainAlpha: 0,
    lightningBranchAlpha: 0,
    muzzleAlpha: 0,
    muzzleScale: 1,
    muzzleVisible: false,
    impactAlpha: 0,
    impactRadius: 0,
    biteCrawl: 0,
    shadowAlpha: 0,
    fangAlpha: 0,
    fangGap: 0,
    spriteVisible: false,
    spriteX: 0,
    spriteY: 0,
    spriteSize: 0,
    spriteScale: 1,
    spriteAlpha: 1,
    spriteRotation: 0
  };
}

function planDescriptorCount(
  lines: readonly PixiPreparedTrajectoryLineSet[],
  circles: readonly PixiPreparedTrajectoryCircle[],
  rays: readonly PixiPreparedTrajectoryRadialRays[],
  fangs: readonly PixiPreparedTrajectoryFang[],
  sprite: PixiPreparedTrajectorySprite | null
): number {
  let count = circles.length + fangs.length + (sprite ? 1 : 0);
  for (const line of lines) count += line.segments.length;
  for (const ray of rays) count += ray.angles.length;
  return count;
}

export function compilePixiSourceTrajectoryRenderPlan(
  request: BoardSourceTrajectoryRequest,
  geometry: PixiSourceTrajectoryGeometrySnapshot
): PixiSourceTrajectoryRenderPlan {
  const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[request.profileKey];
  if (!profile) throw new Error(`Unknown Pixi source trajectory profile: ${String(request.profileKey)}`);
  const clipRect = paintRect(geometry, profile);
  const easing = compileEasing(profile);
  let lineSets: readonly PixiPreparedTrajectoryLineSet[] = EMPTY_LINES;
  let circles: readonly PixiPreparedTrajectoryCircle[] = EMPTY_CIRCLES;
  let radialRays: readonly PixiPreparedTrajectoryRadialRays[] = EMPTY_RAYS;
  let fangs: readonly PixiPreparedTrajectoryFang[] = EMPTY_FANGS;
  let sprite: PixiPreparedTrajectorySprite | null = null;

  if (profile.primitive === 'projectile' || profile.primitive === 'suction') {
    const suction = request.profileKey === 'robotVacuumSuck';
    sprite = Object.freeze({
      start: geometry.movementStart,
      end: geometry.movementEnd,
      size: suction
        ? Math.max(18, Math.round(geometry.cellSize * 0.82))
        : Math.max(8, Math.round(geometry.cellSize * 0.82 * 0.25)),
      rotation: geometry.angleRad,
      suction
    });
  } else if (profile.primitive === 'lightning') {
    const paths = lightningPaths(request, geometry);
    const main = clipPath(paths.main, geometry.visibleClip);
    const branchList: Array<readonly [PixiSourceTrajectoryPoint, PixiSourceTrajectoryPoint]> = [];
    for (const branch of paths.branches) {
      for (const segment of clipPath(branch, clipRect)) branchList.push(segment);
    }
    const branches = Object.freeze(branchList);
    lineSets = Object.freeze([
      lineSet(main, '#4bbfff', 0.04, Math.max(14, geometry.cellSize * 0.72), 'lightningMainAlpha', null, geometry),
      lineSet(main, '#70d8ff', 0.1, Math.max(8, geometry.cellSize * 0.4), 'lightningMainAlpha', null, geometry),
      lineSet(main, '#86e3ff', 0.86, Math.max(3, geometry.cellSize * 0.145), 'lightningMainAlpha', null, geometry),
      lineSet(main, '#ffffff', 0.8, Math.max(1.4, geometry.cellSize * 0.066), 'lightningMainAlpha', null, geometry),
      lineSet(branches, '#65cfff', 0.06, Math.max(7, geometry.cellSize * 0.34), 'lightningBranchAlpha', null, geometry),
      lineSet(branches, '#97eaff', 0.72, Math.max(1.8, geometry.cellSize * 0.075), 'lightningBranchAlpha', null, geometry),
      lineSet(branches, '#ffffff', 0.78, Math.max(0.9, geometry.cellSize * 0.038), 'lightningBranchAlpha', null, geometry)
    ]);
  } else if (profile.primitive === 'beam') {
    const clipped = clipSegment(geometry.movementStart, geometry.movementEnd, geometry.visibleClip);
    const segments = clipped ? Object.freeze([clipped]) : EMPTY_SEGMENTS;
    const black = request.profileKey === 'meteorGodBlackBeam';
    const fire = request.profileKey === 'fireWillFlameBeam';
    const water = request.profileKey === 'waterWillHealingBeam';
    const grass = request.profileKey === 'grassWillSeedBeam';
    const styles = black
      ? [['#6f3aa6', 0.78, Math.max(6, geometry.cellSize * 0.44)], ['#08050d', 1, Math.max(3, geometry.cellSize * 0.19)]] as const
      : fire
        ? [['#ff2a0a', 0.04, Math.max(18, geometry.cellSize * 1.5)], ['#ff4b0f', 0.07, Math.max(12, geometry.cellSize * 0.9)], ['#ff5a1f', 0.12, Math.max(5, geometry.cellSize * 0.38)], ['#ffb234', 0.18, Math.max(3, geometry.cellSize * 0.24)], ['#fff0a8', 0.22, Math.max(1.5, geometry.cellSize * 0.08)]] as const
        : water
          ? [['#075b9e', 0.05, Math.max(18, geometry.cellSize * 1.5)], ['#0c8fd6', 0.09, Math.max(12, geometry.cellSize * 0.9)], ['#22b8ee', 0.16, Math.max(5, geometry.cellSize * 0.38)], ['#67d9ff', 0.28, Math.max(3, geometry.cellSize * 0.24)], ['#e6fbff', 0.48, Math.max(1.5, geometry.cellSize * 0.08)]] as const
          : grass
            ? [['#0f7d3c', 0.05, Math.max(18, geometry.cellSize * 1.5)], ['#22a84f', 0.09, Math.max(12, geometry.cellSize * 0.9)], ['#34c759', 0.16, Math.max(5, geometry.cellSize * 0.38)], ['#8ce35f', 0.28, Math.max(3, geometry.cellSize * 0.24)], ['#eaffb8', 0.48, Math.max(1.5, geometry.cellSize * 0.08)]] as const
            : [['#ff4614', 0.04, Math.max(18, geometry.cellSize * 1.5)], ['#ff781e', 0.07, Math.max(12, geometry.cellSize * 0.9)], ['#ff5a1f', 0.12, Math.max(5, geometry.cellSize * 0.38)], ['#ffb234', 0.18, Math.max(3, geometry.cellSize * 0.24)], ['#fff0a8', 0.22, Math.max(1.5, geometry.cellSize * 0.08)]] as const;
    lineSets = Object.freeze(styles.map(([color, alpha, width]) => (
      lineSet(segments, color, alpha, width, 'beamAlpha', 'pathReveal', geometry)
    )));
    const baseRadius = black ? geometry.cellSize * 0.38 : geometry.cellSize * 0.25;
    circles = black
      ? Object.freeze([{ x: geometry.sourceCenter.x, y: geometry.sourceCenter.y, radius: baseRadius, color: '#160b24', baseAlpha: 1 }])
      : grass
        ? Object.freeze([
          { x: geometry.sourceCenter.x, y: geometry.sourceCenter.y, radius: baseRadius * 1.9, color: '#19a94b', baseAlpha: 0.09 },
          { x: geometry.sourceCenter.x, y: geometry.sourceCenter.y, radius: baseRadius, color: '#62d65f', baseAlpha: 0.24 },
          { x: geometry.sourceCenter.x, y: geometry.sourceCenter.y, radius: baseRadius * 0.34, color: '#efffbc', baseAlpha: 0.58 }
        ])
        : water
          ? Object.freeze([
            { x: geometry.sourceCenter.x, y: geometry.sourceCenter.y, radius: baseRadius * 1.9, color: '#0b74b8', baseAlpha: 0.09 },
            { x: geometry.sourceCenter.x, y: geometry.sourceCenter.y, radius: baseRadius, color: '#34b9ef', baseAlpha: 0.24 },
            { x: geometry.sourceCenter.x, y: geometry.sourceCenter.y, radius: baseRadius * 0.34, color: '#e6fbff', baseAlpha: 0.58 }
          ])
          : Object.freeze([
            { x: geometry.sourceCenter.x, y: geometry.sourceCenter.y, radius: baseRadius * 1.9, color: '#ff5014', baseAlpha: 0.07 },
            { x: geometry.sourceCenter.x, y: geometry.sourceCenter.y, radius: baseRadius, color: '#ff9a28', baseAlpha: 0.2 },
            { x: geometry.sourceCenter.x, y: geometry.sourceCenter.y, radius: baseRadius * 0.34, color: '#fff5be', baseAlpha: 0.52 }
          ]);
    if (fire) {
      radialRays = Object.freeze([
        Object.freeze({ center: geometry.targetCenter, angles: RAY_ANGLES, endScales: RAY_SCALES, color: '#ff3b0a', baseAlpha: 0.22, width: Math.max(3, geometry.cellSize * 0.18) }),
        Object.freeze({ center: geometry.targetCenter, angles: RAY_ANGLES, endScales: RAY_SCALES, color: '#ffd36b', baseAlpha: 0.72, width: Math.max(1.2, geometry.cellSize * 0.055) })
      ]);
    }
  } else if (profile.primitive === 'bite') {
    const segment = clipSegment(geometry.sourceCenter, geometry.targetCenter, geometry.visibleClip);
    const segments = segment ? Object.freeze([segment]) : EMPTY_SEGMENTS;
    lineSets = Object.freeze([
      lineSet(segments, '#100817', 1, Math.max(6, geometry.cellSize * 0.38), 'shadowAlpha', 'biteCrawl', geometry),
      lineSet(segments, '#442052', 0.48, Math.max(2, geometry.cellSize * 0.14), 'shadowAlpha', 'biteCrawl', geometry)
    ]);
    const dx = geometry.targetCenter.x - geometry.sourceCenter.x;
    const dy = geometry.targetCenter.y - geometry.sourceCenter.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const directionX = dx / length;
    const directionY = dy / length;
    const normalX = -directionY;
    const normalY = directionX;
    const size = geometry.cellSize * 0.34;
    const width = geometry.cellSize * 0.18;
    fangs = Object.freeze(([-1, 1] as const).map((sign) => Object.freeze({
      center: geometry.targetCenter,
      normalX,
      normalY,
      sign,
      points: Object.freeze([
        point(0, 0),
        point(normalX * sign * size + directionX * width, normalY * sign * size + directionY * width),
        point(normalX * sign * size - directionX * width, normalY * sign * size - directionY * width)
      ]),
      color: '#31133d',
      strokeColor: '#9b67a8',
      strokeAlphaRatio: 0.48,
      strokeWidth: Math.max(1, geometry.cellSize * 0.035)
    })));
  }

  const stateFactory = () => makeState();
  const sampleInto = (rawProgress: number, target: PixiSourceTrajectoryScalarState): void => {
    const progress = clamp(rawProgress);
    target.progress = progress;
    target.visible = false;
    target.spriteVisible = false;
    target.muzzleVisible = false;
    if (sprite) {
      const traveled = easing(progress);
      target.spriteX = sprite.start.x + (sprite.end.x - sprite.start.x) * traveled;
      target.spriteY = sprite.start.y + (sprite.end.y - sprite.start.y) * traveled;
      target.spriteSize = sprite.size;
      target.spriteScale = sprite.suction ? lerp(1, 0.68, traveled) : 1;
      target.spriteAlpha = sprite.suction ? lerp(1, 0.78, traveled) : 1;
      target.spriteRotation = sprite.rotation;
      target.spriteVisible = squareIntersectsRect(
        target.spriteX,
        target.spriteY,
        target.spriteSize * target.spriteScale,
        clipRect
      );
      target.visible = target.spriteVisible;
      return;
    }
    if (profile.primitive === 'lightning') {
      target.lightningMainAlpha = keyframed(progress, LIGHTNING_MAIN_ALPHA);
      target.lightningBranchAlpha = keyframed(progress, LIGHTNING_BRANCH_ALPHA);
      target.visible = lineSets.length > 0
        && (target.lightningMainAlpha > 0 || target.lightningBranchAlpha > 0);
      return;
    }
    if (profile.primitive === 'beam') {
      const black = request.profileKey === 'meteorGodBlackBeam';
      const fire = request.profileKey === 'fireWillFlameBeam';
      target.pathReveal = keyframed(progress, black ? BLACK_BEAM_REVEAL : BEAM_REVEAL);
      target.beamAlpha = keyframed(progress, black ? BLACK_BEAM_ALPHA : BEAM_ALPHA);
      target.muzzleAlpha = keyframed(progress, black ? BLACK_MUZZLE_ALPHA : MUZZLE_ALPHA);
      target.muzzleScale = keyframed(progress, MUZZLE_SCALE);
      const maximumRadius = circles.length ? circles[0].radius * target.muzzleScale : 0;
      target.muzzleVisible = target.muzzleAlpha > 0 && circleIntersectsRect(
        geometry.sourceCenter.x,
        geometry.sourceCenter.y,
        maximumRadius,
        clipRect
      );
      target.impactAlpha = fire ? keyframed(progress, IMPACT_ALPHA) : 0;
      target.impactRadius = fire
        ? geometry.cellSize * 0.54 * keyframed(progress, IMPACT_SCALE)
        : 0;
      target.visible = lineSets.length > 0 || target.muzzleVisible || target.impactAlpha > 0;
      return;
    }
    if (profile.primitive === 'bite') {
      target.biteCrawl = clamp(progress / 0.58);
      target.shadowAlpha = keyframed(progress, BITE_SHADOW_ALPHA);
      target.fangAlpha = keyframed(progress, BITE_FANG_ALPHA);
      const close = clamp((progress - 0.42) / 0.42);
      target.fangGap = lerp(geometry.cellSize * 0.42, geometry.cellSize * 0.08, close);
      target.visible = lineSets.length > 0 || target.fangAlpha > 0;
    }
  };
  const staticDescriptorCount = planDescriptorCount(lineSets, circles, radialRays, fangs, sprite);
  return Object.freeze({
    profileKey: request.profileKey,
    primitive: profile.primitive,
    geometry,
    clipRect,
    lineSets,
    circles,
    radialRays,
    fangs,
    sprite,
    staticDescriptorCount,
    createScalarState: stateFactory,
    sampleInto
  });
}
