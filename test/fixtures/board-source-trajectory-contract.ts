export type BoardSourceTrajectoryBaselineProfileKey =
  | 'sniperShot'
  | 'robotVacuumSuck'
  | 'destroyDragonBreath'
  | 'meteorGodBlackBeam'
  | 'lightningDestroyed'
  | 'udgDestroyed'
  | 'fireWillFlameBeam'
  | 'waterWillHealingBeam'
  | 'grassWillSeedBeam'
  | 'zombieBite';

export type BoardSourceTrajectoryBaselinePrimitive =
  | 'projectile'
  | 'suction'
  | 'beam'
  | 'lightning'
  | 'bite';

export interface BoardSourceTrajectoryBaselineFixture {
  readonly profileKey: BoardSourceTrajectoryBaselineProfileKey;
  readonly eventType: 'destroy' | 'flip' | 'status_applied';
  readonly cause: string;
  readonly reason: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly primitive: BoardSourceTrajectoryBaselinePrimitive;
  readonly direction: 'source-to-target' | 'target-to-source';
  readonly duration: Readonly<{
    kind: 'distance' | 'fixed';
    baseMs: number;
    distanceFactor: number;
    minMs: number;
    maxMs: number;
  }>;
  readonly settlement: 'animation-finish' | 'fixed-deadline' | 'animations-or-deadline';
  readonly deadlinePaddingMs: number;
  readonly ownerPolicy: string;
  readonly targetImpactOwner: 'board-backend';
  readonly noAnimation: 'zero-duration-no-object';
  readonly reducedMotion: 'unchanged' | 'skip-source';
  readonly usesVisualSeed: boolean;
}

const distanceDuration = (
  baseMs: number,
  distanceFactor: number,
  minMs: number,
  maxMs: number
) => Object.freeze({ kind: 'distance' as const, baseMs, distanceFactor, minMs, maxMs });

const fixedDuration = (durationMs: number) => Object.freeze({
  kind: 'fixed' as const,
  baseMs: durationMs,
  distanceFactor: 0,
  minMs: durationMs,
  maxMs: durationMs
});

export const BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES: readonly BoardSourceTrajectoryBaselineFixture[] = Object.freeze([
  Object.freeze({
    profileKey: 'sniperShot',
    eventType: 'destroy',
    cause: 'SNIPER_WILL',
    reason: 'sniper_shot',
    primitive: 'projectile',
    direction: 'source-to-target',
    duration: distanceDuration(90, 0.35, 120, 420),
    settlement: 'animation-finish',
    deadlinePaddingMs: 120,
    ownerPolicy: 'projectileOwner>meta.projectileOwner>opposite(ownerBefore)>black',
    targetImpactOwner: 'board-backend',
    noAnimation: 'zero-duration-no-object',
    reducedMotion: 'unchanged',
    usesVisualSeed: false
  }),
  Object.freeze({
    profileKey: 'robotVacuumSuck',
    eventType: 'destroy',
    cause: 'ROBOT_VACUUM',
    reason: 'robot_vacuum_suck',
    primitive: 'suction',
    direction: 'target-to-source',
    duration: distanceDuration(140, 0.28, 140, 360),
    settlement: 'animation-finish',
    deadlinePaddingMs: 120,
    ownerPolicy: 'ownerBefore',
    targetImpactOwner: 'board-backend',
    noAnimation: 'zero-duration-no-object',
    reducedMotion: 'unchanged',
    usesVisualSeed: false
  }),
  Object.freeze({
    profileKey: 'destroyDragonBreath',
    eventType: 'destroy',
    cause: 'DESTROY_DRAGON_WILL',
    reason: 'destroy_dragon_breath',
    primitive: 'beam',
    direction: 'source-to-target',
    duration: distanceDuration(240, 0.28, 280, 520),
    settlement: 'animations-or-deadline',
    deadlinePaddingMs: 120,
    ownerPolicy: 'none',
    targetImpactOwner: 'board-backend',
    noAnimation: 'zero-duration-no-object',
    reducedMotion: 'unchanged',
    usesVisualSeed: false
  }),
  Object.freeze({
    profileKey: 'meteorGodBlackBeam',
    eventType: 'destroy',
    cause: 'METEOR_GOD',
    reason: 'meteor_god_cell_destroy',
    primitive: 'beam',
    direction: 'source-to-target',
    duration: distanceDuration(230, 0.22, 260, 460),
    settlement: 'animations-or-deadline',
    deadlinePaddingMs: 140,
    ownerPolicy: 'none',
    targetImpactOwner: 'board-backend',
    noAnimation: 'zero-duration-no-object',
    reducedMotion: 'unchanged',
    usesVisualSeed: false
  }),
  Object.freeze({
    profileKey: 'lightningDestroyed',
    eventType: 'destroy',
    cause: 'LIGHTNING_WILL',
    reason: 'lightning_destroyed',
    primitive: 'lightning',
    direction: 'source-to-target',
    duration: distanceDuration(170, 0.12, 170, 300),
    settlement: 'animations-or-deadline',
    deadlinePaddingMs: 140,
    ownerPolicy: 'none',
    targetImpactOwner: 'board-backend',
    noAnimation: 'zero-duration-no-object',
    reducedMotion: 'unchanged',
    usesVisualSeed: true
  }),
  Object.freeze({
    profileKey: 'udgDestroyed',
    eventType: 'destroy',
    cause: 'ULTIMATE_DESTROY_GOD',
    reason: 'udg_destroyed',
    primitive: 'lightning',
    direction: 'source-to-target',
    duration: distanceDuration(170, 0.12, 170, 300),
    settlement: 'animations-or-deadline',
    deadlinePaddingMs: 140,
    ownerPolicy: 'none',
    targetImpactOwner: 'board-backend',
    noAnimation: 'zero-duration-no-object',
    reducedMotion: 'unchanged',
    usesVisualSeed: true
  }),
  Object.freeze({
    profileKey: 'fireWillFlameBeam',
    eventType: 'status_applied',
    cause: 'FIRE_WILL',
    reason: 'scorched_cell_applied',
    meta: Object.freeze({
      special: 'SCORCHED_CELL',
      cause: 'FIRE_WILL',
      reason: 'scorched_cell_applied',
      sourceTrajectoryProfile: 'fireWillFlameBeam'
    }),
    primitive: 'beam',
    direction: 'source-to-target',
    duration: distanceDuration(240, 0.28, 280, 520),
    settlement: 'animations-or-deadline',
    deadlinePaddingMs: 120,
    ownerPolicy: 'none',
    targetImpactOwner: 'board-backend',
    noAnimation: 'zero-duration-no-object',
    reducedMotion: 'skip-source',
    usesVisualSeed: false
  }),
  Object.freeze({
    profileKey: 'waterWillHealingBeam',
    eventType: 'status_applied',
    cause: 'WATER_WILL',
    reason: 'healing_cell_applied',
    meta: Object.freeze({
      special: 'HEALING_CELL',
      cause: 'WATER_WILL',
      reason: 'healing_cell_applied',
      sourceTrajectoryProfile: 'waterWillHealingBeam'
    }),
    primitive: 'beam',
    direction: 'source-to-target',
    duration: distanceDuration(240, 0.28, 280, 520),
    settlement: 'animations-or-deadline',
    deadlinePaddingMs: 120,
    ownerPolicy: 'none',
    targetImpactOwner: 'board-backend',
    noAnimation: 'zero-duration-no-object',
    reducedMotion: 'skip-source',
    usesVisualSeed: false
  }),
  Object.freeze({
    profileKey: 'grassWillSeedBeam',
    eventType: 'status_applied',
    cause: 'GRASS_WILL',
    reason: 'grass_seeded',
    meta: Object.freeze({
      special: 'SEED',
      cause: 'GRASS_WILL',
      reason: 'grass_seeded',
      sourceTrajectoryProfile: 'grassWillSeedBeam'
    }),
    primitive: 'beam',
    direction: 'source-to-target',
    duration: distanceDuration(240, 0.28, 280, 520),
    settlement: 'animations-or-deadline',
    deadlinePaddingMs: 120,
    ownerPolicy: 'none',
    targetImpactOwner: 'board-backend',
    noAnimation: 'zero-duration-no-object',
    reducedMotion: 'skip-source',
    usesVisualSeed: false
  }),
  Object.freeze({
    profileKey: 'zombieBite',
    eventType: 'flip',
    cause: 'ZOMBIE',
    reason: 'zombie_infection',
    primitive: 'bite',
    direction: 'source-to-target',
    duration: fixedDuration(800),
    settlement: 'fixed-deadline',
    deadlinePaddingMs: 0,
    ownerPolicy: 'ownerAfter',
    targetImpactOwner: 'board-backend',
    noAnimation: 'zero-duration-no-object',
    reducedMotion: 'skip-source',
    usesVisualSeed: false
  })
]);

export const BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY = Object.freeze(
  Object.fromEntries(BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES.map((fixture) => [fixture.profileKey, fixture]))
) as Readonly<Record<BoardSourceTrajectoryBaselineProfileKey, BoardSourceTrajectoryBaselineFixture>>;

export function resolveBaselineDurationMs(
  fixture: BoardSourceTrajectoryBaselineFixture,
  distancePx: number
): number {
  const raw = fixture.duration.baseMs + (Math.max(0, Number(distancePx) || 0) * fixture.duration.distanceFactor);
  return Math.max(fixture.duration.minMs, Math.min(fixture.duration.maxMs, Math.round(raw)));
}

export const BOARD_SOURCE_TRAJECTORY_MULTI_TARGET_TRACE = Object.freeze([
  'trajectory:start:sniperShot:0:0',
  'trajectory:start:robotVacuumSuck:0:2',
  'board:impact:first',
  'trajectory:settle:sniperShot:0:0',
  'trajectory:settle:robotVacuumSuck:0:2',
  'board:commit'
]);

export const BOARD_SOURCE_TRAJECTORY_LONG_RANGE_CLIP_FIXTURE = Object.freeze({
  logicalRows: 16,
  logicalCols: 16,
  visibleOriginRow: 4,
  visibleOriginCol: 4,
  source: Object.freeze({ row: 0, col: 0 }),
  target: Object.freeze({ row: 15, col: 15 }),
  profileKey: 'sniperShot' as const,
  expectedLegacyOverflow: true,
  expectedPixiPolicy: 'clip-centerline-to-board-viewport-halo-to-two-cell-gutter' as const
});

export function normalizeBoardSourceTrajectoryTraceEntry(entry: string): string {
  const value = String(entry || '');
  if (value.startsWith('global:destroy_source_animation:')) {
    return value.replace('global:destroy_source_animation:', 'trajectory:start:');
  }
  if (value.startsWith('global:zombie_bite_source_animation:')) {
    return value.replace('global:zombie_bite_source_animation:', 'trajectory:start:');
  }
  if (value.startsWith('backend:source-trajectory:')) {
    return value.replace('backend:source-trajectory:', 'trajectory:start:');
  }
  return value;
}

/**
 * 2026-07-19 Chromium headless capture of the pre-cutover DOM presenter.
 * Bounds are [left, top, right, bottom] CSS pixels and are the union of every
 * requestAnimationFrame painted-leaf sample from synchronous start to settle.
 * This is historical evidence, not the post-cutover clipping expectation.
 */
export const BOARD_SOURCE_TRAJECTORY_DOM_BROWSER_BASELINE = Object.freeze({
  schemaVersion: 1,
  capturedAt: '2026-07-19',
  method: 'requestAnimationFrame-conservative-painted-leaf-union',
  captures: Object.freeze([
    Object.freeze({
      viewport: 'desktop-dpr1',
      dpr: 1,
      boardViewport: Object.freeze([507, 223, 859, 575]),
      paintedHaloOwner: Object.freeze([419, 135, 947, 663]),
      samples: Object.freeze([
        Object.freeze(['sniperShot', 'normal', 'source-to-target', 11, Object.freeze([612.5, 328.5, 749.2, 465.2]), false, 1, 1200]),
        Object.freeze(['robotVacuumSuck', 'normal', 'target-to-source', 12, Object.freeze([604.8, 320.8, 716, 432]), false, 1, 1200]),
        Object.freeze(['destroyDragonBreath', 'normal', 'source-to-target', 25, Object.freeze([590.2, 306.2, 775.8, 491.8]), false, 3, 1250]),
        Object.freeze(['meteorGodBlackBeam', 'normal', 'source-to-target', 26, Object.freeze([583.9, 299.9, 779.9, 495.9]), false, 4, 1260]),
        Object.freeze(['lightningDestroyed', 'normal', 'source-to-target', 12, Object.freeze([607, 323, 759, 475]), false, 8, 1250]),
        Object.freeze(['udgDestroyed', 'normal', 'source-to-target', 12, Object.freeze([607, 323, 759, 475]), false, 8, 1250]),
        Object.freeze(['zombieBite', 'normal', 'source-to-target', 49, Object.freeze([604.2, 320.2, 790.5, 512.4]), false, 4, 1250]),
        Object.freeze(['sniperShot', 'scrolled-expanded', 'source-to-target', 10, Object.freeze([582.8, 298.8, 705.2, 421.2]), false, 1, 1200]),
        Object.freeze(['robotVacuumSuck', 'scrolled-expanded', 'target-to-source', 12, Object.freeze([560.8, 276.8, 672.1, 388.1]), false, 1, 1200]),
        Object.freeze(['destroyDragonBreath', 'scrolled-expanded', 'source-to-target', 25, Object.freeze([546.2, 262.2, 731.8, 447.8]), false, 3, 1250]),
        Object.freeze(['meteorGodBlackBeam', 'scrolled-expanded', 'source-to-target', 26, Object.freeze([539.9, 255.9, 735.9, 451.9]), false, 4, 1260]),
        Object.freeze(['lightningDestroyed', 'scrolled-expanded', 'source-to-target', 12, Object.freeze([563, 279, 715, 431]), false, 8, 1250]),
        Object.freeze(['udgDestroyed', 'scrolled-expanded', 'source-to-target', 12, Object.freeze([563, 279, 715, 431]), false, 8, 1250]),
        Object.freeze(['zombieBite', 'scrolled-expanded', 'source-to-target', 49, Object.freeze([560.2, 276.2, 746.5, 468.4]), false, 4, 1250]),
        Object.freeze(['sniperShot', 'long-range-offscreen-sniper', 'source-to-target', 26, Object.freeze([374.9, 90.9, 1016.9, 732.9]), true, 1, 1200])
      ])
    }),
    Object.freeze({
      viewport: 'mobile-dpr2',
      dpr: 2,
      boardViewport: Object.freeze([163, 392, 267, 496]),
      paintedHaloOwner: Object.freeze([137, 366, 293, 522]),
      samples: Object.freeze([
        Object.freeze(['sniperShot', 'normal', 'source-to-target', 9, Object.freeze([191.5, 420.5, 237.4, 466.4]), false, 1, 1200]),
        Object.freeze(['robotVacuumSuck', 'normal', 'target-to-source', 10, Object.freeze([189.4, 418.4, 224.9, 453.9]), false, 1, 1200]),
        Object.freeze(['destroyDragonBreath', 'normal', 'source-to-target', 25, Object.freeze([168.7, 397.7, 261.3, 490.3]), false, 3, 1250]),
        Object.freeze(['meteorGodBlackBeam', 'normal', 'source-to-target', 25, Object.freeze([162.4, 391.4, 265.4, 494.4]), false, 4, 1260]),
        Object.freeze(['lightningDestroyed', 'normal', 'source-to-target', 11, Object.freeze([184.6, 414.5, 255.4, 473.5]), false, 8, 1250]),
        Object.freeze(['udgDestroyed', 'normal', 'source-to-target', 11, Object.freeze([184.6, 414.5, 255.4, 473.5]), false, 8, 1250]),
        Object.freeze(['zombieBite', 'normal', 'source-to-target', 49, Object.freeze([182.7, 408.6, 269.3, 502.2]), false, 4, 1250]),
        Object.freeze(['sniperShot', 'scrolled-expanded', 'source-to-target', 8, Object.freeze([183.9, 412.9, 224.4, 453.4]), false, 1, 1200]),
        Object.freeze(['robotVacuumSuck', 'scrolled-expanded', 'target-to-source', 10, Object.freeze([176.4, 405.4, 211.8, 440.8]), false, 1, 1200]),
        Object.freeze(['destroyDragonBreath', 'scrolled-expanded', 'source-to-target', 25, Object.freeze([155.7, 384.7, 248.3, 477.3]), false, 3, 1250]),
        Object.freeze(['meteorGodBlackBeam', 'scrolled-expanded', 'source-to-target', 25, Object.freeze([149.4, 378.4, 252.4, 481.4]), false, 4, 1260]),
        Object.freeze(['lightningDestroyed', 'scrolled-expanded', 'source-to-target', 11, Object.freeze([171.6, 401.5, 242.4, 460.5]), false, 8, 1250]),
        Object.freeze(['udgDestroyed', 'scrolled-expanded', 'source-to-target', 11, Object.freeze([171.6, 401.5, 242.4, 460.5]), false, 8, 1250]),
        Object.freeze(['zombieBite', 'scrolled-expanded', 'source-to-target', 49, Object.freeze([169.7, 395.6, 256.3, 489.2]), false, 4, 1250]),
        Object.freeze(['sniperShot', 'long-range-offscreen-sniper', 'source-to-target', 12, Object.freeze([131, 360, 312.7, 541.7]), true, 1, 1200])
      ])
    })
  ])
});
