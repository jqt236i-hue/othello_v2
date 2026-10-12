/**
 * Debug-only Pixi playfield performance harness.
 *
 * The module has no startup side effects. `installBoardVisualPerformanceHarness`
 * creates controls, observers, rAF work, and a debug global only when both
 * `debug=1` and `boardPerf=1` are present.
 */

declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined'
  ? __non_webpack_require__
  : require;

export type BoardPerformanceBackend = 'dom' | 'pixi';
export type BoardPerformanceLane = 'classic' | 'vite';
export type BoardPerformanceCaptureProfile = 'physical' | 'desktop' | 'development';

export const BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION = 'pixijs_playfield_performance_report.v1';
export const BOARD_PERFORMANCE_META_SCHEMA_VERSION = 'pixijs_playfield_performance_meta.v1';

export const BOARD_PERFORMANCE_SCENARIO_IDS = Object.freeze([
  'basic.multi-flip-8x8',
  'heavy.move-8x8',
  'heavy.destroy-spawn-8x8',
  'heavy.status-8x8',
  'heavy.destroy-source-8x8',
  'heavy.theory-manifest-8x8',
  'micro.full-marker-16x16',
  'stability.expansion-skin'
] as const);

export const BOARD_PERFORMANCE_PHASE_ZERO_COORDINATES = Object.freeze([
  Object.freeze([2, 2] as const),
  Object.freeze([2, 3] as const),
  Object.freeze([2, 4] as const),
  Object.freeze([3, 2] as const),
  Object.freeze([3, 5] as const),
  Object.freeze([4, 2] as const),
  Object.freeze([4, 5] as const),
  Object.freeze([5, 3] as const)
]);

export type BoardPerformanceScenarioId = typeof BOARD_PERFORMANCE_SCENARIO_IDS[number];

type StoneFixture = Readonly<{ row: number; col: number; color: 1 | -1 }>;
type ExpansionFixture = Readonly<{
  row: number;
  col: number;
  side: 'top' | 'right' | 'bottom' | 'left';
  owner: 0 | 1 | -1;
}>;

type ScenarioFixture = Readonly<{
  id: BoardPerformanceScenarioId;
  rows: number;
  cols: number;
  initialStones: readonly StoneFixture[];
  finalStones: readonly StoneFixture[];
  initialMarkers: readonly unknown[];
  finalMarkers: readonly unknown[];
  initialExpansionCells: readonly ExpansionFixture[];
  finalExpansionCells: readonly ExpansionFixture[];
  events: readonly Readonly<Record<string, unknown>>[];
}>;

export interface NumericSummary {
  readonly count: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
}

export interface RafSummary extends NumericSummary {
  readonly jankThresholdMs: number;
  readonly jankFrameCount: number;
  readonly jankRatio: number;
  readonly rafStall50msCount: number;
}

export interface BoardPerformanceMeta {
  readonly schemaVersion: string;
  readonly candidateCommit: string;
  readonly browserArtifactSha256: string;
  readonly fixtureDigest: string;
  readonly eventDigest: string;
  readonly lane: BoardPerformanceLane;
  readonly captureProfile: BoardPerformanceCaptureProfile;
  readonly referenceDevice: Readonly<Record<string, unknown>>;
  readonly captureOrder: 'dom-first' | 'pixi-first';
  readonly artifactFileCount?: number;
}

export interface BoardPerformanceRunConfig {
  readonly profile: BoardPerformanceCaptureProfile;
  readonly warmupCount: number;
  readonly basicSampleCount: number;
  readonly heavySampleCount: number;
  readonly microSampleCount: number;
  readonly nominalRafSampleCount: number;
  readonly stabilityDurationMs: number;
  readonly stabilitySampleIntervalMs: number;
  readonly sameModelApplyCount: number;
  readonly resetCount: number;
  readonly skinSwitchCount: number;
  readonly standard: boolean;
}

interface RuntimeModules {
  readonly root: any;
  readonly document: Document;
  readonly core: any;
  readonly cardLogic: any;
  readonly boardUtils: any;
  readonly animationEngine: any;
  readonly playbackEngine: any;
  readonly renderer: any;
  readonly debug: any;
  readonly boardElement: HTMLElement;
}

interface IterationSample {
  readonly rafTimestampsMs: readonly number[];
  readonly rafIntervalsMs: readonly number[];
  readonly presentationStartLatencyMs: number;
  readonly modelBuildMs: number;
  readonly backendApplySyncMs: number;
  readonly backendApplySettlementMs: number;
  readonly boardLocalPlaybackMs: number;
  readonly globalDomHudMs: number;
  readonly wholeTurnSettlementMs: number;
  readonly hitTestMs: number | null;
  readonly diagnosticsBefore: Readonly<Record<string, unknown>>;
  readonly diagnosticsAfter: Readonly<Record<string, unknown>>;
}

const PHYSICAL_STABILITY_DURATION_MS = 10 * 60 * 1000;
const PHYSICAL_COOLDOWN_MS = 5 * 60 * 1000;
const FIXED_WARMUP_COUNT = 5;
const FIXED_BASIC_SAMPLE_COUNT = 30;
const FIXED_HEAVY_SAMPLE_COUNT = 20;
const FIXED_MICRO_SAMPLE_COUNT = 100;
const FIXED_NOMINAL_RAF_SAMPLE_COUNT = 120;

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze(Array.from(values));
}

function specialMarker(
  id: string,
  row: number,
  col: number,
  owner: 'black' | 'white',
  type: string,
  remainingOwnerTurns = 3
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    id,
    kind: type === 'THEORY_INCARNATION' ? 'manifestStone' : 'specialStone',
    row,
    col,
    owner,
    data: Object.freeze({ type, remainingOwnerTurns })
  });
}

function flipTarget(row: number, col: number): Readonly<Record<string, unknown>> {
  return Object.freeze({
    r: row,
    row,
    col,
    ownerBefore: 'white',
    ownerAfter: 'black',
    before: Object.freeze({ color: -1 }),
    after: Object.freeze({ color: 1 }),
    cause: 'SYSTEM',
    reason: 'standard_flip'
  });
}

const BASIC_FLIP_COORDINATES = BOARD_PERFORMANCE_PHASE_ZERO_COORDINATES;

const BASIC_INITIAL_STONES = freezeArray([
  Object.freeze({ row: 3, col: 3, color: 1 as const }),
  ...BASIC_FLIP_COORDINATES.map(([row, col]) => Object.freeze({ row, col, color: -1 as const }))
]);
const BASIC_FINAL_STONES = freezeArray(BASIC_INITIAL_STONES.map((stone) => Object.freeze({
  row: stone.row,
  col: stone.col,
  color: 1 as const
})));

const MOVE_INITIAL_STONES = freezeArray(Array.from({ length: 6 }, (_, index) => Object.freeze({
  row: 1,
  col: index + 1,
  color: (index % 2 === 0 ? 1 : -1) as 1 | -1
})));
const MOVE_FINAL_STONES = freezeArray(MOVE_INITIAL_STONES.map((stone, index) => Object.freeze({
  row: 5,
  col: index + 1,
  color: stone.color
})));

const DESTROY_SPAWN_INITIAL = freezeArray(Array.from({ length: 12 }, (_, index) => Object.freeze({
  row: 2 + Math.floor(index / 6),
  col: index % 6 + 1,
  color: (index % 2 === 0 ? 1 : -1) as 1 | -1
})));
const DESTROY_SPAWN_FINAL = freezeArray(Array.from({ length: 12 }, (_, index) => Object.freeze({
  row: 4 + Math.floor(index / 6),
  col: index % 6 + 1,
  color: (index % 2 === 0 ? -1 : 1) as 1 | -1
})));

const STATUS_STONES = freezeArray(Array.from({ length: 12 }, (_, index) => Object.freeze({
  row: 1 + Math.floor(index / 6) * 4,
  col: index % 6 + 1,
  color: (index % 2 === 0 ? 1 : -1) as 1 | -1
})));
const STATUS_TYPES = Object.freeze(['GUARD', 'FREEZE', 'TIME_BOMB', 'POISONED'] as const);
const STATUS_MARKERS = freezeArray(STATUS_STONES.map((stone, index) => specialMarker(
  `board-perf-status-${index}`,
  stone.row,
  stone.col,
  stone.color === 1 ? 'black' : 'white',
  STATUS_TYPES[index % STATUS_TYPES.length],
  3 + (index % 3)
)));

const DESTROY_SOURCE_TARGETS = freezeArray([
  [1, 1], [1, 6], [2, 2], [2, 5], [5, 2], [5, 5], [6, 1], [6, 6]
] as const);
const DESTROY_SOURCE_INITIAL = freezeArray([
  Object.freeze({ row: 3, col: 3, color: 1 as const }),
  ...DESTROY_SOURCE_TARGETS.map(([row, col]) => Object.freeze({ row, col, color: -1 as const }))
]);
const DESTROY_SOURCE_FINAL = freezeArray([
  Object.freeze({ row: 3, col: 3, color: 1 as const })
]);

const THEORY_INITIAL = freezeArray([
  Object.freeze({ row: 4, col: 4, color: -1 as const }),
  Object.freeze({ row: 3, col: 3, color: 1 as const })
]);
const THEORY_FINAL = freezeArray([
  Object.freeze({ row: 4, col: 4, color: -1 as const }),
  Object.freeze({ row: 3, col: 3, color: 1 as const }),
  Object.freeze({ row: 1, col: 4, color: 1 as const })
]);

const EMPTY_MARKERS = Object.freeze([] as unknown[]);
const EMPTY_EXPANSION = Object.freeze([] as ExpansionFixture[]);

export const BOARD_PERFORMANCE_FIXTURES: readonly ScenarioFixture[] = Object.freeze([
  Object.freeze({
    id: 'basic.multi-flip-8x8' as const,
    rows: 8,
    cols: 8,
    initialStones: BASIC_INITIAL_STONES,
    finalStones: BASIC_FINAL_STONES,
    initialMarkers: EMPTY_MARKERS,
    finalMarkers: EMPTY_MARKERS,
    initialExpansionCells: EMPTY_EXPANSION,
    finalExpansionCells: EMPTY_EXPANSION,
    events: Object.freeze([
      Object.freeze({
        type: 'flip',
        phase: 1,
        targets: Object.freeze(BASIC_FLIP_COORDINATES.map(([row, col]) => flipTarget(row, col)))
      })
    ])
  }),
  Object.freeze({
    id: 'heavy.move-8x8' as const,
    rows: 8,
    cols: 8,
    initialStones: MOVE_INITIAL_STONES,
    finalStones: MOVE_FINAL_STONES,
    initialMarkers: EMPTY_MARKERS,
    finalMarkers: EMPTY_MARKERS,
    initialExpansionCells: EMPTY_EXPANSION,
    finalExpansionCells: EMPTY_EXPANSION,
    events: Object.freeze([
      Object.freeze({
        type: 'move',
        phase: 1,
        targets: Object.freeze(MOVE_INITIAL_STONES.map((stone, index) => Object.freeze({
          from: Object.freeze({ r: stone.row, row: stone.row, col: stone.col }),
          to: Object.freeze({ r: 5, row: 5, col: index + 1 }),
          owner: stone.color === 1 ? 'black' : 'white',
          before: Object.freeze({ color: stone.color }),
          after: Object.freeze({ color: stone.color }),
          cause: 'STRONG_WIND_WILL',
          reason: 'strong_wind_move'
        })))
      })
    ])
  }),
  Object.freeze({
    id: 'heavy.destroy-spawn-8x8' as const,
    rows: 8,
    cols: 8,
    initialStones: DESTROY_SPAWN_INITIAL,
    finalStones: DESTROY_SPAWN_FINAL,
    initialMarkers: EMPTY_MARKERS,
    finalMarkers: EMPTY_MARKERS,
    initialExpansionCells: EMPTY_EXPANSION,
    finalExpansionCells: EMPTY_EXPANSION,
    events: Object.freeze([
      Object.freeze({
        type: 'destroy',
        phase: 1,
        targets: Object.freeze(DESTROY_SPAWN_INITIAL.map((stone) => Object.freeze({
          r: stone.row,
          row: stone.row,
          col: stone.col,
          ownerBefore: stone.color === 1 ? 'black' : 'white',
          before: Object.freeze({ color: stone.color }),
          cause: 'SYSTEM',
          reason: 'board_effect'
        })))
      }),
      Object.freeze({
        type: 'spawn',
        phase: 2,
        targets: Object.freeze(DESTROY_SPAWN_FINAL.map((stone) => Object.freeze({
          r: stone.row,
          row: stone.row,
          col: stone.col,
          owner: stone.color === 1 ? 'black' : 'white',
          after: Object.freeze({ color: stone.color }),
          cause: 'BREEDING',
          reason: 'breeding_spawn'
        })))
      })
    ])
  }),
  Object.freeze({
    id: 'heavy.status-8x8' as const,
    rows: 8,
    cols: 8,
    initialStones: STATUS_STONES,
    finalStones: STATUS_STONES,
    initialMarkers: EMPTY_MARKERS,
    finalMarkers: STATUS_MARKERS,
    initialExpansionCells: EMPTY_EXPANSION,
    finalExpansionCells: EMPTY_EXPANSION,
    events: Object.freeze([
      Object.freeze({
        type: 'status_applied',
        rawType: 'STATUS_APPLIED',
        phase: 1,
        meta: Object.freeze({ special: 'GUARD', highlightTone: 'positive' }),
        targets: Object.freeze(STATUS_STONES.map((stone, index) => Object.freeze({
          r: stone.row,
          row: stone.row,
          col: stone.col,
          owner: stone.color === 1 ? 'black' : 'white',
          before: Object.freeze({ color: stone.color }),
          after: Object.freeze({
            color: stone.color,
            special: STATUS_TYPES[index % STATUS_TYPES.length],
            remainingOwnerTurns: 3 + (index % 3)
          })
        })))
      })
    ])
  }),
  Object.freeze({
    id: 'heavy.destroy-source-8x8' as const,
    rows: 8,
    cols: 8,
    initialStones: DESTROY_SOURCE_INITIAL,
    finalStones: DESTROY_SOURCE_FINAL,
    initialMarkers: EMPTY_MARKERS,
    finalMarkers: EMPTY_MARKERS,
    initialExpansionCells: EMPTY_EXPANSION,
    finalExpansionCells: EMPTY_EXPANSION,
    events: Object.freeze([
      Object.freeze({
        type: 'destroy',
        phase: 1,
        targets: Object.freeze(DESTROY_SOURCE_TARGETS.map(([row, col]) => Object.freeze({
          r: row,
          row,
          col,
          sourceRow: 3,
          sourceCol: 3,
          ownerBefore: 'white',
          before: Object.freeze({ color: -1 }),
          cause: 'DESTROY_DRAGON_WILL',
          reason: 'destroy_dragon_breath'
        })))
      })
    ])
  }),
  Object.freeze({
    id: 'heavy.theory-manifest-8x8' as const,
    rows: 8,
    cols: 8,
    initialStones: THEORY_INITIAL,
    finalStones: THEORY_FINAL,
    initialMarkers: Object.freeze([
      specialMarker('board-perf-manifest', 4, 4, 'white', 'ULTIMATE_REVERSE_DRAGON', 1)
    ]),
    finalMarkers: Object.freeze([
      specialMarker('board-perf-theory', 1, 4, 'black', 'THEORY_INCARNATION', 4)
    ]),
    initialExpansionCells: EMPTY_EXPANSION,
    finalExpansionCells: EMPTY_EXPANSION,
    events: Object.freeze([
      Object.freeze({
        type: 'theory_incarnation_spawn_roulette',
        phase: 1,
        durationMs: 2500,
        materializeMs: 2000,
        targets: Object.freeze([Object.freeze({
          r: 1,
          row: 1,
          col: 4,
          owner: 'black',
          ownerAfter: 'black',
          selectedIndex: 3,
          selectedCell: Object.freeze({ row: 1, col: 4 }),
          candidateCells: Object.freeze([
            Object.freeze({ row: 1, col: 1, value: 3 }),
            Object.freeze({ row: 1, col: 2, value: 7 }),
            Object.freeze({ row: 1, col: 3, value: 12 }),
            Object.freeze({ row: 1, col: 4, value: 19 })
          ]),
          after: Object.freeze({ color: 1, special: 'THEORY_INCARNATION', remainingOwnerTurns: 4 })
        })])
      }),
      Object.freeze({
        type: 'manifest_ending',
        phase: 2,
        durationMs: 2000,
        targets: Object.freeze([Object.freeze({
          r: 4,
          row: 4,
          col: 4,
          ownerBefore: 'white',
          ownerAfter: 'white',
          before: Object.freeze({ color: -1, special: 'ULTIMATE_REVERSE_DRAGON' }),
          after: Object.freeze({ color: -1, special: null, timer: null })
        })])
      })
    ])
  }),
  Object.freeze({
    id: 'micro.full-marker-16x16' as const,
    rows: 16,
    cols: 16,
    initialStones: Object.freeze([]),
    finalStones: Object.freeze([]),
    initialMarkers: Object.freeze([]),
    finalMarkers: Object.freeze([]),
    initialExpansionCells: EMPTY_EXPANSION,
    finalExpansionCells: EMPTY_EXPANSION,
    events: Object.freeze([])
  }),
  Object.freeze({
    id: 'stability.expansion-skin' as const,
    rows: 8,
    cols: 8,
    initialStones: BASIC_INITIAL_STONES,
    finalStones: BASIC_INITIAL_STONES,
    initialMarkers: EMPTY_MARKERS,
    finalMarkers: EMPTY_MARKERS,
    initialExpansionCells: EMPTY_EXPANSION,
    finalExpansionCells: Object.freeze([
      Object.freeze({ row: 3, col: -1, side: 'left' as const, owner: 0 as const }),
      Object.freeze({ row: 4, col: 8, side: 'right' as const, owner: 0 as const })
    ]),
    events: Object.freeze([])
  })
]);

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => (
    [key, stableValue((value as Record<string, unknown>)[key])]
  )));
}

export function stablePerformanceJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function fnv1a32(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export const BOARD_PERFORMANCE_FIXTURE_DIGEST = fnv1a32(stablePerformanceJson(
  BOARD_PERFORMANCE_FIXTURES.map((fixture) => ({
    id: fixture.id,
    rows: fixture.rows,
    cols: fixture.cols,
    initialStones: fixture.initialStones,
    finalStones: fixture.finalStones,
    initialMarkers: fixture.initialMarkers,
    finalMarkers: fixture.finalMarkers,
    initialExpansionCells: fixture.initialExpansionCells,
    finalExpansionCells: fixture.finalExpansionCells,
    materialization: fixture.id === 'micro.full-marker-16x16'
      ? { markerGrid: 'full', markerCount: fixture.rows * fixture.cols }
      : null
  }))
));

export const BOARD_PERFORMANCE_EVENT_DIGEST = fnv1a32(stablePerformanceJson(
  BOARD_PERFORMANCE_FIXTURES.map((fixture) => ({ id: fixture.id, events: fixture.events }))
));

export const BOARD_PERFORMANCE_PHASE_ZERO_MICRO_DIGEST = fnv1a32(stablePerformanceJson({
  coordinates: BOARD_PERFORMANCE_PHASE_ZERO_COORDINATES,
  multiFlip: { rows: 8, cols: 8, sampleCount: 30 },
  largeApply: { rows: 16, cols: 16, markers: 0 }
}));

function finite(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function nearestRank(values: readonly number[], percentile: number): number {
  if (!values.length) return 0;
  const sorted = Array.from(values, (value) => finite(value)).sort((left, right) => left - right);
  const rank = Math.max(0, Math.min(sorted.length - 1, Math.ceil(percentile * sorted.length) - 1));
  return round(sorted[rank]);
}

export function summarizeNumericSamples(values: readonly number[]): NumericSummary {
  const normalized = Array.from(values, (value) => finite(value));
  return Object.freeze({
    count: normalized.length,
    p50: nearestRank(normalized, 0.5),
    p95: nearestRank(normalized, 0.95),
    p99: nearestRank(normalized, 0.99),
    max: normalized.length ? round(Math.max(...normalized)) : 0
  });
}

export function summarizeRafIntervals(
  values: readonly number[],
  nominalFrameIntervalMs: number
): RafSummary {
  const normalized = Array.from(values, (value) => finite(value));
  const jankThresholdMs = finite(nominalFrameIntervalMs) * 1.5;
  const jankFrameCount = normalized.filter((value) => value > jankThresholdMs).length;
  return Object.freeze({
    ...summarizeNumericSamples(normalized),
    jankThresholdMs: round(jankThresholdMs),
    jankFrameCount,
    jankRatio: normalized.length ? round(jankFrameCount / normalized.length) : 0,
    rafStall50msCount: normalized.filter((value) => value >= 50).length
  });
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = Array.from(values, (value) => finite(value)).sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]);
}

export function expectedCaptureOrder(candidateCommit: string): 'dom-first' | 'pixi-first' {
  const normalized = String(candidateCommit || '').trim().toLowerCase();
  const lastByte = Number.parseInt(normalized.slice(-2), 16);
  if (!/^[0-9a-f]{40}$/.test(normalized) || !Number.isFinite(lastByte)) {
    throw new Error('Candidate commit must be a full 40-character SHA');
  }
  return lastByte % 2 === 0 ? 'dom-first' : 'pixi-first';
}

export function createBoardPerformanceRunConfig(
  profile: BoardPerformanceCaptureProfile,
  overrides: Partial<BoardPerformanceRunConfig> = {}
): BoardPerformanceRunConfig {
  const defaults: BoardPerformanceRunConfig = profile === 'physical'
    ? {
      profile,
      warmupCount: FIXED_WARMUP_COUNT,
      basicSampleCount: FIXED_BASIC_SAMPLE_COUNT,
      heavySampleCount: FIXED_HEAVY_SAMPLE_COUNT,
      microSampleCount: FIXED_MICRO_SAMPLE_COUNT,
      nominalRafSampleCount: FIXED_NOMINAL_RAF_SAMPLE_COUNT,
      stabilityDurationMs: PHYSICAL_STABILITY_DURATION_MS,
      stabilitySampleIntervalMs: 1000,
      sameModelApplyCount: 100,
      resetCount: 50,
      skinSwitchCount: 50,
      standard: true
    }
    : profile === 'desktop'
      ? {
        profile,
        warmupCount: FIXED_WARMUP_COUNT,
        basicSampleCount: FIXED_BASIC_SAMPLE_COUNT,
        heavySampleCount: FIXED_HEAVY_SAMPLE_COUNT,
        microSampleCount: FIXED_MICRO_SAMPLE_COUNT,
        nominalRafSampleCount: FIXED_NOMINAL_RAF_SAMPLE_COUNT,
        stabilityDurationMs: PHYSICAL_STABILITY_DURATION_MS,
        stabilitySampleIntervalMs: 500,
        sameModelApplyCount: 100,
        resetCount: 50,
        skinSwitchCount: 50,
        standard: true
      }
      : {
        profile,
        warmupCount: 1,
        basicSampleCount: 2,
        heavySampleCount: 1,
        microSampleCount: 3,
        nominalRafSampleCount: 8,
        stabilityDurationMs: 500,
        stabilitySampleIntervalMs: 50,
        sameModelApplyCount: 2,
        resetCount: 2,
        skinSwitchCount: 2,
        standard: false
      };
  const result = Object.freeze({ ...defaults, ...overrides, profile });
  const standard = result.warmupCount === defaults.warmupCount
    && result.basicSampleCount === defaults.basicSampleCount
    && result.heavySampleCount === defaults.heavySampleCount
    && result.microSampleCount === defaults.microSampleCount
    && result.nominalRafSampleCount === defaults.nominalRafSampleCount
    && result.stabilityDurationMs === defaults.stabilityDurationMs
    && result.sameModelApplyCount === defaults.sameModelApplyCount
    && result.resetCount === defaults.resetCount
    && result.skinSwitchCount === defaults.skinSwitchCount
    && defaults.standard;
  return Object.freeze({ ...result, standard });
}

export function isBoardPerformanceHarnessRequested(locationLike?: Pick<Location, 'search'> | null): boolean {
  try {
    const params = new URLSearchParams(String(locationLike?.search || ''));
    return params.get('debug') === '1' && params.get('boardPerf') === '1';
  } catch (_error) {
    return false;
  }
}

function resolveModule(root: any, globalNames: readonly string[], moduleId: string, localId: string): any {
  for (const name of globalNames) {
    try { if (root && root[name]) return root[name]; } catch (_error) { /* continue */ }
  }
  try {
    if (root && typeof root.require === 'function') return root.require(moduleId);
  } catch (_error) { /* local require below */ }
  try { return _require(localId); } catch (_error) { return null; }
}

function resolveRuntimeModules(root: any, documentRef: Document): RuntimeModules {
  const core = resolveModule(root, ['CoreLogic', 'Core'], 'game/logic/core', '../../game/logic/core');
  const cardLogic = resolveModule(root, ['CardLogic'], 'game/logic/cards', '../../game/logic/cards');
  const boardUtils = resolveModule(root, ['SharedBoardUtils'], 'shared/shared-board-utils', '../../shared/shared-board-utils');
  const animationEngine = resolveModule(root, ['AnimationEngine'], 'ui/animation-engine', '../animation-engine');
  const playbackEngine = resolveModule(root, ['PlaybackEngine'], 'ui/playback-engine', '../playback-engine');
  const renderer = resolveModule(root, ['BoardRenderer'], 'ui/board-renderer', '../board-renderer');
  const debug = root && root.__boardVisualDebug;
  const boardElement = documentRef.getElementById('board');
  if (!core || !cardLogic || !boardUtils || !animationEngine || !playbackEngine || !renderer
    || !debug || !boardElement) {
    throw new Error('Board performance runtime is unavailable');
  }
  if (typeof playbackEngine.dispatchPresentationEvent !== 'function'
    || typeof renderer.prepareBoardVisualUpdate !== 'function'
    || typeof renderer.renderBoard !== 'function'
    || typeof renderer.getBoardVisualControllerReady !== 'function'
    || typeof debug.waitForIdle !== 'function') {
    throw new Error('Board performance runtime contract is incomplete');
  }
  return Object.freeze({
    root,
    document: documentRef,
    core,
    cardLogic,
    boardUtils,
    animationEngine,
    playbackEngine,
    renderer,
    debug,
    boardElement
  });
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createFullMarkerFixture(): ScenarioFixture {
  const stones: StoneFixture[] = [];
  const markers: unknown[] = [];
  for (let row = 0; row < 16; row += 1) {
    for (let col = 0; col < 16; col += 1) {
      const color = (row + col) % 2 === 0 ? 1 : -1;
      stones.push(Object.freeze({ row, col, color }));
      markers.push(specialMarker(
        `board-perf-full-${row}-${col}`,
        row,
        col,
        color === 1 ? 'black' : 'white',
        STATUS_TYPES[(row * 16 + col) % STATUS_TYPES.length],
        2 + ((row + col) % 5)
      ));
    }
  }
  const base = BOARD_PERFORMANCE_FIXTURES.find((fixture) => fixture.id === 'micro.full-marker-16x16')!;
  return Object.freeze({
    ...base,
    initialStones: Object.freeze(stones),
    finalStones: Object.freeze(stones),
    initialMarkers: Object.freeze(markers),
    finalMarkers: Object.freeze(markers)
  });
}

function createGameState(runtime: RuntimeModules, fixture: ScenarioFixture, finalState: boolean): any {
  const state = runtime.core.createGameState({
    rows: fixture.rows,
    cols: fixture.cols,
    shape: 'rectangle'
  });
  const stones = finalState ? fixture.finalStones : fixture.initialStones;
  const markers = finalState ? fixture.finalMarkers : fixture.initialMarkers;
  const expansion = finalState ? fixture.finalExpansionCells : fixture.initialExpansionCells;
  state.board = Array.from({ length: fixture.rows }, () => Array(fixture.cols).fill(0));
  for (const stone of stones) {
    if (stone.row < 0 || stone.row >= fixture.rows || stone.col < 0 || stone.col >= fixture.cols) continue;
    state.board[stone.row][stone.col] = stone.color;
  }
  const expansionCells = Array.from(expansion, (cell) => ({ ...cell }));
  const latest = expansionCells[expansionCells.length - 1] || null;
  state.boardExpansion = {
    active: expansionCells.length > 0,
    side: latest?.side || null,
    row: latest?.row ?? null,
    owner: latest?.owner ?? 0,
    usedByPlayer: { black: false, white: false },
    cells: expansionCells
  };
  return state;
}

function createCardState(runtime: RuntimeModules, fixture: ScenarioFixture, finalState: boolean): any {
  const markers = finalState ? fixture.finalMarkers : fixture.initialMarkers;
  const cardState = runtime.cardLogic.createCardState(null, {
    plainReversi: true,
    boardConfig: { rows: fixture.rows, cols: fixture.cols, shape: 'rectangle' }
  });
  cardState.markers = cloneJson(markers);
  cardState.pendingEffectByPlayer = { black: null, white: null };
  cardState.boardBonusByCell = {};
  cardState.boardBonusConsumedByCell = {};
  cardState.theoryNumberCellByCell = {};
  cardState.presentationEvents = [];
  cardState._presentationEventsPersist = [];
  return cardState;
}

function applyFixtureState(runtime: RuntimeModules, fixture: ScenarioFixture, finalState: boolean): void {
  runtime.root.cardState = createCardState(runtime, fixture, finalState);
  runtime.root.gameState = createGameState(runtime, fixture, finalState);
}

async function nextAnimationFrames(root: any, count = 1): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => root.requestAnimationFrame(() => resolve()));
  }
}

function now(root: any): number {
  return root.performance && typeof root.performance.now === 'function'
    ? root.performance.now()
    : Date.now();
}

async function renderCurrentState(runtime: RuntimeModules): Promise<Readonly<{
  modelBuildMs: number;
  backendApplySyncMs: number;
  backendApplySettlementMs: number;
}>> {
  const modelStart = now(runtime.root);
  const prepared = runtime.renderer.prepareBoardVisualUpdate();
  const modelBuildMs = now(runtime.root) - modelStart;
  const applyStart = now(runtime.root);
  runtime.renderer.renderBoard(prepared);
  const backendApplySyncMs = now(runtime.root) - applyStart;
  await runtime.debug.waitForIdle();
  const backendApplySettlementMs = now(runtime.root) - applyStart;
  return Object.freeze({
    modelBuildMs: round(modelBuildMs),
    backendApplySyncMs: round(backendApplySyncMs),
    backendApplySettlementMs: round(backendApplySettlementMs)
  });
}

function sumNumericRecord(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value as Record<string, unknown>).reduce<number>((total, entry) => (
    total + (Number.isFinite(Number(entry)) ? Number(entry) : 0)
  ), 0);
}

function readDiagnostics(runtime: RuntimeModules): Readonly<Record<string, unknown>> {
  const backend = runtime.debug.getBackendDiagnostics?.() || {};
  const displayObjects = runtime.debug.getDisplayObjectCounts?.() || {};
  const textureLeases = runtime.debug.getTextureLeaseCounts?.() || {};
  return Object.freeze({
    backend: runtime.debug.getBackendKind?.() || null,
    writerMode: runtime.debug.getWriterMode?.() || null,
    displayObjectCount: sumNumericRecord(displayObjects),
    textureLeaseCount: sumNumericRecord(textureLeases),
    displayObjects,
    textureLeases,
    canvasBackingWidth: finite(backend.canvasBackingWidth),
    canvasBackingHeight: finite(backend.canvasBackingHeight),
    canvasCount: finite(backend.canvasCount),
    contextCount: finite(backend.contextCount),
    domCellCount: finite(backend.domCellCount),
    tickerRunning: backend.tickerRunning === true,
    contextLossCount: finite(backend.contextRecovery?.lossCount),
    activeViewCount: finite(backend.scene?.activeViewCount ?? backend.pool?.activeViewCount),
    activeTextureLeaseCount: finite(backend.textures?.activeLeaseCount),
    textureUploadCount: finite(backend.textures?.uploadCount),
    textureReadyPixelCount: finite(backend.textures?.readyResourcePixelCount),
    textureActivePixelCount: finite(backend.textures?.activeResourcePixelCount)
  });
}

async function waitForLifecycleIdle(runtime: RuntimeModules, timeoutMs = 2_000): Promise<void> {
  await runtime.debug.waitForIdle();
  const startedAt = now(runtime.root);
  while (readDiagnostics(runtime).tickerRunning === true) {
    if (now(runtime.root) - startedAt >= timeoutMs) {
      throw new Error('Board performance lifecycle did not reach ticker idle');
    }
    await nextAnimationFrames(runtime.root, 1);
  }
}

function readDeliveryMetrics(root: any, diagnostics: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const resourceEntries = typeof root.performance?.getEntriesByType === 'function'
    ? root.performance.getEntriesByType('resource')
    : [];
  const resources = Array.from(resourceEntries || [], (entry: any) => Object.freeze({
    name: String(entry.name || ''),
    initiatorType: String(entry.initiatorType || ''),
    startTimeMs: round(finite(entry.startTime)),
    durationMs: round(finite(entry.duration)),
    transferSizeBytes: Math.max(0, Math.trunc(finite(entry.transferSize))),
    encodedBodySizeBytes: Math.max(0, Math.trunc(finite(entry.encodedBodySize))),
    decodedBodySizeBytes: Math.max(0, Math.trunc(finite(entry.decodedBodySize)))
  }));
  const sum = (key: string) => resources.reduce((total, entry) => total + finite((entry as any)[key]), 0);
  return Object.freeze({
    applicationReadyAtMs: round(now(root)),
    resourceCount: resources.length,
    transferSizeBytes: sum('transferSizeBytes'),
    encodedBodySizeBytes: sum('encodedBodySizeBytes'),
    decodedBodySizeBytes: sum('decodedBodySizeBytes'),
    resources: Object.freeze(resources),
    textureUploadCount: diagnostics.textureUploadCount,
    textureReadyPixelCount: diagnostics.textureReadyPixelCount,
    textureActivePixelCount: diagnostics.textureActivePixelCount
  });
}

type RafRecorder = Readonly<{
  timestamps: number[];
  intervals: number[];
  stop: () => void;
}>;

function startRafRecorder(root: any): RafRecorder {
  const timestamps: number[] = [];
  const intervals: number[] = [];
  let lastTimestamp: number | null = null;
  let requestId: number | null = null;
  let active = true;
  const tick = (timestamp: number) => {
    if (!active) return;
    timestamps.push(round(timestamp));
    if (lastTimestamp !== null) intervals.push(round(timestamp - lastTimestamp));
    lastTimestamp = timestamp;
    requestId = root.requestAnimationFrame(tick);
  };
  requestId = root.requestAnimationFrame(tick);
  return Object.freeze({
    timestamps,
    intervals,
    stop() {
      active = false;
      if (requestId !== null && typeof root.cancelAnimationFrame === 'function') {
        root.cancelAnimationFrame(requestId);
      }
    }
  });
}

export async function startPrimedRafRecorder(root: any): Promise<Readonly<{
  startedAtPerformanceMs: number;
  recorder: RafRecorder;
}>> {
  let startedAtPerformanceMs: number | null = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const sample = await new Promise<Readonly<{ timestamp: number; observedAt: number }>>((resolve) => {
      root.requestAnimationFrame((timestamp: number) => resolve(Object.freeze({
        timestamp,
        observedAt: now(root)
      })));
    });
    if (sample.timestamp >= 0 && sample.observedAt - sample.timestamp < 50) {
      startedAtPerformanceMs = sample.timestamp;
      break;
    }
  }
  if (startedAtPerformanceMs === null) {
    throw new Error('Unable to establish a fresh rAF measurement boundary');
  }
  return Object.freeze({
    startedAtPerformanceMs,
    recorder: startRafRecorder(root)
  });
}

async function collectNominalRafSamples(root: any, count: number): Promise<Readonly<{
  timestampsMs: readonly number[];
  intervalsMs: readonly number[];
}>> {
  const timestamps: number[] = [];
  while (timestamps.length < count + 1) {
    await new Promise<void>((resolve) => root.requestAnimationFrame((timestamp: number) => {
      timestamps.push(timestamp);
      resolve();
    }));
  }
  return Object.freeze({
    timestampsMs: Object.freeze(timestamps.map(round)),
    intervalsMs: Object.freeze(timestamps.slice(1).map((timestamp, index) => round(timestamp - timestamps[index])))
  });
}

async function runPlaybackIteration(
  runtime: RuntimeModules,
  fixture: ScenarioFixture
): Promise<IterationSample> {
  applyFixtureState(runtime, fixture, false);
  runtime.renderer.resetBoardVisualRenderSession?.();
  await renderCurrentState(runtime);
  await nextAnimationFrames(runtime.root, 2);
  applyFixtureState(runtime, fixture, true);
  runtime.animationEngine.boardEl = runtime.boardElement;

  const diagnosticsBefore = readDiagnostics(runtime);
  const originalPlayBoardVisualPhase = runtime.renderer.playBoardVisualPhase;
  const boardSpans: Array<{ start: number; end: number }> = [];
  let presentationStart: number | null = null;
  runtime.renderer.playBoardVisualPhase = async function (...args: any[]) {
    const start = now(runtime.root);
    try {
      return await originalPlayBoardVisualPhase.apply(this, args);
    } finally {
      boardSpans.push({ start, end: now(runtime.root) });
    }
  };

  let raf: ReturnType<typeof startRafRecorder> | null = null;
  const getRafRecorder = (): ReturnType<typeof startRafRecorder> | null => raf;
  let turnStart = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      runtime.root.requestAnimationFrame(() => {
        raf = startRafRecorder(runtime.root);
        turnStart = now(runtime.root);
        try {
          Promise.resolve(runtime.playbackEngine.dispatchPresentationEvent({
            type: 'PLAYBACK_EVENTS',
            events: fixture.events
          }, {
            AnimationEngine: runtime.animationEngine,
            onPresentationStart: () => {
              if (presentationStart === null) presentationStart = now(runtime.root);
            }
          })).then(() => resolve(), reject);
        } catch (error) {
          reject(error);
        }
      });
    });
    await runtime.debug.waitForIdle();
    await nextAnimationFrames(runtime.root, 2);
  } finally {
    runtime.renderer.playBoardVisualPhase = originalPlayBoardVisualPhase;
    getRafRecorder()?.stop();
  }
  const wholeTurnSettlementMs = now(runtime.root) - turnStart;
  const renderMetrics = await renderCurrentState(runtime);
  const boardStart = presentationStart ?? (boardSpans.length ? Math.min(...boardSpans.map((span) => span.start)) : turnStart);
  const boardEnd = boardSpans.length ? Math.max(...boardSpans.map((span) => span.end)) : boardStart;
  const boardLocalPlaybackMs = Math.max(0, boardEnd - boardStart);
  const recordedRaf = getRafRecorder();
  const firstPresentationFrameAt = recordedRaf && recordedRaf.timestamps.length ? recordedRaf.timestamps[0] : turnStart;
  const diagnosticsAfter = readDiagnostics(runtime);
  return Object.freeze({
    rafTimestampsMs: Object.freeze(recordedRaf ? recordedRaf.timestamps.slice() : []),
    rafIntervalsMs: Object.freeze(recordedRaf ? recordedRaf.intervals.slice() : []),
    presentationStartLatencyMs: round(Math.max(0, firstPresentationFrameAt - turnStart)),
    modelBuildMs: renderMetrics.modelBuildMs,
    backendApplySyncMs: renderMetrics.backendApplySyncMs,
    backendApplySettlementMs: renderMetrics.backendApplySettlementMs,
    boardLocalPlaybackMs: round(boardLocalPlaybackMs),
    globalDomHudMs: round(Math.max(0, wholeTurnSettlementMs - boardLocalPlaybackMs)),
    wholeTurnSettlementMs: round(wholeTurnSettlementMs),
    hitTestMs: null,
    diagnosticsBefore,
    diagnosticsAfter
  });
}

async function runMicroIteration(runtime: RuntimeModules, fixture: ScenarioFixture): Promise<IterationSample> {
  applyFixtureState(runtime, fixture, true);
  const diagnosticsBefore = readDiagnostics(runtime);
  const apply = await renderCurrentState(runtime);
  const hitStart = now(runtime.root);
  const controller = runtime.renderer.getBoardVisualController?.();
  const input = runtime.renderer.getBoardInputController?.();
  const rect = controller?.getCellClientRect?.(7, 7) || runtime.debug.getCellClientRect?.(7, 7);
  if (rect && input && typeof input.hitTestClientPoint === 'function') {
    input.hitTestClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  const hitTestMs = now(runtime.root) - hitStart;
  const diagnosticsAfter = readDiagnostics(runtime);
  return Object.freeze({
    rafTimestampsMs: Object.freeze([]),
    rafIntervalsMs: Object.freeze([]),
    presentationStartLatencyMs: 0,
    modelBuildMs: apply.modelBuildMs,
    backendApplySyncMs: apply.backendApplySyncMs,
    backendApplySettlementMs: apply.backendApplySettlementMs,
    boardLocalPlaybackMs: 0,
    globalDomHudMs: 0,
    wholeTurnSettlementMs: apply.backendApplySettlementMs,
    hitTestMs: round(hitTestMs),
    diagnosticsBefore,
    diagnosticsAfter
  });
}

async function runPhaseZeroMicroComparison(
  runtime: RuntimeModules,
  standard: boolean
): Promise<Readonly<Record<string, unknown>>> {
  const sampleCount = standard ? 30 : 3;
  const frameSamples: Array<Readonly<Record<string, number>>> = [];
  const empty8: ScenarioFixture = Object.freeze({
    id: 'basic.multi-flip-8x8',
    rows: 8,
    cols: 8,
    initialStones: EMPTY_MARKERS as readonly StoneFixture[],
    finalStones: EMPTY_MARKERS as readonly StoneFixture[],
    initialMarkers: EMPTY_MARKERS,
    finalMarkers: EMPTY_MARKERS,
    initialExpansionCells: EMPTY_EXPANSION,
    finalExpansionCells: EMPTY_EXPANSION,
    events: EMPTY_MARKERS as readonly Readonly<Record<string, unknown>>[]
  });
  applyFixtureState(runtime, empty8, true);
  runtime.renderer.resetBoardVisualRenderSession?.();
  await renderCurrentState(runtime);
  for (let index = 0; index < sampleCount; index += 1) {
    await nextAnimationFrames(runtime.root, 1);
    const stones = BOARD_PERFORMANCE_PHASE_ZERO_COORDINATES.map(([row, col]) => Object.freeze({
      row,
      col,
      color: (index % 2 === 0 ? 1 : -1) as 1 | -1
    }));
    applyFixtureState(runtime, Object.freeze({ ...empty8, finalStones: Object.freeze(stones) }), true);
    const startedAt = now(runtime.root);
    const apply = await renderCurrentState(runtime);
    await nextAnimationFrames(runtime.root, 1);
    frameSamples.push(Object.freeze({
      frameDeltaMs: round(now(runtime.root) - startedAt),
      modelBuildMs: apply.modelBuildMs,
      backendApplySyncMs: apply.backendApplySyncMs,
      backendApplySettlementMs: apply.backendApplySettlementMs
    }));
  }
  const empty16: ScenarioFixture = Object.freeze({
    ...empty8,
    id: 'micro.full-marker-16x16',
    rows: 16,
    cols: 16
  });
  applyFixtureState(runtime, empty16, true);
  const largeApply = await renderCurrentState(runtime);
  const largeDiagnostics = readDiagnostics(runtime);
  return Object.freeze({
    role: 'synthetic-model-apply-microcomparison-not-animation',
    fixtureDigest: BOARD_PERFORMANCE_PHASE_ZERO_MICRO_DIGEST,
    standard,
    frameSampleCount: frameSamples.length,
    rawFrameSamples: Object.freeze(frameSamples),
    multiFlipFrameDeltaMs: summarizeNumericSamples(frameSamples.map((sample) => sample.frameDeltaMs)),
    multiFlipModelBuildMs: summarizeNumericSamples(frameSamples.map((sample) => sample.modelBuildMs)),
    multiFlipBackendApplySyncMs: summarizeNumericSamples(frameSamples.map((sample) => sample.backendApplySyncMs)),
    multiFlipBackendApplySettlementMs: summarizeNumericSamples(frameSamples.map((sample) => sample.backendApplySettlementMs)),
    sixteenBySixteen: Object.freeze({
      ...largeApply,
      activeViewCount: largeDiagnostics.activeViewCount,
      domCellCount: largeDiagnostics.domCellCount,
      displayObjectCount: largeDiagnostics.displayObjectCount
    })
  });
}

function scenarioSummary(samples: readonly IterationSample[], nominal: number): Readonly<Record<string, unknown>> {
  return Object.freeze({
    raf: summarizeRafIntervals(samples.flatMap((sample) => sample.rafIntervalsMs), nominal),
    presentationStartLatencyMs: summarizeNumericSamples(samples.map((sample) => sample.presentationStartLatencyMs)),
    modelBuildMs: summarizeNumericSamples(samples.map((sample) => sample.modelBuildMs)),
    backendApplySyncMs: summarizeNumericSamples(samples.map((sample) => sample.backendApplySyncMs)),
    backendApplySettlementMs: summarizeNumericSamples(samples.map((sample) => sample.backendApplySettlementMs)),
    boardLocalPlaybackMs: summarizeNumericSamples(samples.map((sample) => sample.boardLocalPlaybackMs)),
    globalDomHudMs: summarizeNumericSamples(samples.map((sample) => sample.globalDomHudMs)),
    wholeTurnSettlementMs: summarizeNumericSamples(samples.map((sample) => sample.wholeTurnSettlementMs)),
    hitTestMs: summarizeNumericSamples(samples.flatMap((sample) => (
      sample.hitTestMs === null ? [] : [sample.hitTestMs]
    )))
  });
}

async function runMeasuredScenario(
  runtime: RuntimeModules,
  fixture: ScenarioFixture,
  warmupCount: number,
  sampleCount: number,
  nominal: number,
  progress: (message: string) => void
): Promise<Readonly<Record<string, unknown>>> {
  const isMicro = fixture.id === 'micro.full-marker-16x16';
  const measuredFixture = isMicro ? createFullMarkerFixture() : fixture;
  for (let index = 0; index < warmupCount; index += 1) {
    progress(`${fixture.id}: warm-up ${index + 1}/${warmupCount}`);
    if (isMicro) await runMicroIteration(runtime, measuredFixture);
    else await runPlaybackIteration(runtime, measuredFixture);
  }
  const rawSamples: IterationSample[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    progress(`${fixture.id}: sample ${index + 1}/${sampleCount}`);
    rawSamples.push(isMicro
      ? await runMicroIteration(runtime, measuredFixture)
      : await runPlaybackIteration(runtime, measuredFixture));
  }
  return Object.freeze({
    id: fixture.id,
    warmupCount,
    sampleCount,
    rawSamples: Object.freeze(rawSamples),
    summary: scenarioSummary(rawSamples, nominal)
  });
}

function stabilityFixture(base: ScenarioFixture, expanded: boolean): ScenarioFixture {
  return Object.freeze({
    ...base,
    initialExpansionCells: expanded ? base.finalExpansionCells : EMPTY_EXPANSION,
    finalExpansionCells: expanded ? base.finalExpansionCells : EMPTY_EXPANSION
  });
}

// A temporary diagnostics-only texture keeps skin-switch sampling meaningful
// when the player-facing standard catalog contains only the default board.
export function installStabilityBoardSkinFixture(root: any): Readonly<{ id: string; restore(): void }> {
  const hadCatalog = Object.prototype.hasOwnProperty.call(root, 'BoardSkinCatalogModule');
  const previousCatalog = root.BoardSkinCatalogModule;
  const catalog = previousCatalog || _require('../board-skin/catalog');
  const id = 'board-perf-alternate';
  const definition = Object.freeze({
    id,
    label: '計測専用下地',
    note: '永続化しない計測用テクスチャ',
    imagePath: 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path fill="#264a38" d="M0 0h16v16H0z"/><path fill="#335a43" d="M0 0h8v8H0zM8 8h8v8H8z"/></svg>'
    )
  });
  root.BoardSkinCatalogModule = {
    ...catalog,
    normalizeBoardSkinId(value: unknown, rootRef: any) {
      return value === id ? id : catalog.normalizeBoardSkinId(value, rootRef);
    },
    getBoardSkinDefinition(value: string, rootRef: any) {
      return value === id ? { ...definition } : catalog.getBoardSkinDefinition(value, rootRef);
    }
  };
  return Object.freeze({
    id,
    restore() {
      if (hadCatalog) root.BoardSkinCatalogModule = previousCatalog;
      else delete root.BoardSkinCatalogModule;
    }
  });
}

async function runStabilityScenario(
  runtime: RuntimeModules,
  fixture: ScenarioFixture,
  config: BoardPerformanceRunConfig,
  nominal: number,
  progress: (message: string) => void
): Promise<Readonly<Record<string, unknown>>> {
  const elements = [runtime.boardElement, runtime.document.documentElement];
  const previousBoardIds = elements.map((element) => element.dataset.boardSkinId);
  const previousStoneId = runtime.document.documentElement.dataset.stoneSkinId;
  const skinFixture = installStabilityBoardSkinFixture(runtime.root);
  try {
    return await runStabilityScenarioWithFixture(runtime, fixture, config, nominal, progress);
  } finally {
    skinFixture.restore();
    elements.forEach((element, index) => {
      if (previousBoardIds[index] === undefined) delete element.dataset.boardSkinId;
      else element.dataset.boardSkinId = previousBoardIds[index];
    });
    if (previousStoneId === undefined) delete runtime.document.documentElement.dataset.stoneSkinId;
    else runtime.document.documentElement.dataset.stoneSkinId = previousStoneId;
  }
}

async function runStabilityScenarioWithFixture(
  runtime: RuntimeModules,
  fixture: ScenarioFixture,
  config: BoardPerformanceRunConfig,
  nominal: number,
  progress: (message: string) => void
): Promise<Readonly<Record<string, unknown>>> {
  for (let index = 0; index < config.warmupCount; index += 1) {
    applyFixtureState(runtime, stabilityFixture(fixture, index % 2 === 1), true);
    await renderCurrentState(runtime);
  }
  const rootElement = runtime.document.documentElement;
  const previousBoardSkinId = runtime.boardElement.dataset.boardSkinId || null;
  const previousStoneSkinId = rootElement.dataset.stoneSkinId || null;
  // Prime both skin families before raw stability sampling. Texture creation is
  // deliberately lazy in production; the readiness gate measures reuse after
  // that first-use work instead of misclassifying the expected warm-up upload
  // as monotonic lifecycle growth.
  runtime.boardElement.dataset.boardSkinId = 'board-perf-alternate';
  rootElement.dataset.stoneSkinId = 'jade-rim';
  applyFixtureState(runtime, stabilityFixture(fixture, true), true);
  await renderCurrentState(runtime);
  runtime.boardElement.dataset.boardSkinId = 'bluegreen-felt';
  rootElement.dataset.stoneSkinId = 'o-stone';
  applyFixtureState(runtime, stabilityFixture(fixture, false), true);
  await renderCurrentState(runtime);
  const rawSamples: Array<Readonly<Record<string, unknown>>> = [];
  const primedStabilityRaf = await startPrimedRafRecorder(runtime.root);
  const stabilityRaf = primedStabilityRaf.recorder;
  const startedAt = primedStabilityRaf.startedAtPerformanceMs;
  let index = 0;
  try {
    do {
      const expanded = index % 2 === 1;
      runtime.boardElement.dataset.boardSkinId = expanded ? 'board-perf-alternate' : 'bluegreen-felt';
      rootElement.dataset.stoneSkinId = expanded ? 'jade-rim' : 'o-stone';
      applyFixtureState(runtime, stabilityFixture(fixture, expanded), true);
      const sampleStartedAt = now(runtime.root);
      const apply = await renderCurrentState(runtime);
      await nextAnimationFrames(runtime.root, 1);
      rawSamples.push(Object.freeze({
        elapsedMs: round(now(runtime.root) - startedAt),
        apply,
        diagnostics: readDiagnostics(runtime)
      }));
      index += 1;
      progress(`${fixture.id}: ${Math.min(100, Math.floor(((now(runtime.root) - startedAt) / Math.max(1, config.stabilityDurationMs)) * 100))}%`);
      const remainingDelay = Math.max(0, config.stabilitySampleIntervalMs - (now(runtime.root) - sampleStartedAt));
      if (remainingDelay > 0) await new Promise<void>((resolve) => runtime.root.setTimeout(resolve, remainingDelay));
    } while (now(runtime.root) - startedAt < config.stabilityDurationMs || rawSamples.length === 0);

    stabilityRaf.stop();
    const lifecycle: Record<string, unknown> = {};
    applyFixtureState(runtime, stabilityFixture(fixture, false), true);
    await renderCurrentState(runtime);
    await waitForLifecycleIdle(runtime);
    const steadyState = readDiagnostics(runtime);
    for (let run = 0; run < config.sameModelApplyCount; run += 1) await renderCurrentState(runtime);
    await waitForLifecycleIdle(runtime);
    lifecycle.sameModelApply = Object.freeze({
      count: config.sameModelApplyCount,
      diagnostics: readDiagnostics(runtime)
    });
    for (let run = 0; run < config.resetCount; run += 1) {
      runtime.renderer.resetBoardVisualRenderSession?.();
      await renderCurrentState(runtime);
    }
    await waitForLifecycleIdle(runtime);
    lifecycle.reset = Object.freeze({ count: config.resetCount, diagnostics: readDiagnostics(runtime) });
    for (let run = 0; run < config.skinSwitchCount; run += 1) {
      const alternate = run % 2 === 0;
      runtime.boardElement.dataset.boardSkinId = alternate ? 'board-perf-alternate' : 'bluegreen-felt';
      rootElement.dataset.stoneSkinId = alternate ? 'jade-rim' : 'o-stone';
      await renderCurrentState(runtime);
    }
    runtime.boardElement.dataset.boardSkinId = 'bluegreen-felt';
    rootElement.dataset.stoneSkinId = 'o-stone';
    await renderCurrentState(runtime);
    await waitForLifecycleIdle(runtime);
    lifecycle.skinSwitch = Object.freeze({ count: config.skinSwitchCount, diagnostics: readDiagnostics(runtime) });
    lifecycle.steadyState = steadyState;

    const firstWindow = rawSamples.filter((sample) => finite(sample.elapsedMs) <= 120_000);
    const lastWindowStart = Math.max(0, config.stabilityDurationMs - 120_000);
    const lastWindow = rawSamples.filter((sample) => finite(sample.elapsedMs) >= lastWindowStart);
    const applyValues = (samples: readonly Readonly<Record<string, unknown>>[]) => samples.map((sample) => (
      finite((sample.apply as Readonly<Record<string, unknown>>)?.backendApplySettlementMs)
    ));
    const timedRafIntervals = stabilityRaf.intervals.map((intervalMs, rafIndex) => Object.freeze({
      timestampMs: stabilityRaf.timestamps[rafIndex + 1],
      elapsedMs: round(stabilityRaf.timestamps[rafIndex + 1] - startedAt),
      intervalMs
    }));
    const firstRafWindow = timedRafIntervals
      .filter((sample) => sample.elapsedMs <= 120_000)
      .map((sample) => sample.intervalMs);
    const lastRafWindow = timedRafIntervals
      .filter((sample) => sample.elapsedMs >= lastWindowStart)
      .map((sample) => sample.intervalMs);
    return Object.freeze({
      id: fixture.id,
      warmupCount: config.warmupCount,
      sampleCount: rawSamples.length,
      startedAtPerformanceMs: round(startedAt),
      durationMs: round(now(runtime.root) - startedAt),
      requiredDurationMs: config.profile === 'physical' ? PHYSICAL_STABILITY_DURATION_MS : config.stabilityDurationMs,
      rawSamples: Object.freeze(rawSamples),
      rawRafTimestampsMs: Object.freeze(stabilityRaf.timestamps.slice()),
      rawRafIntervalsMs: Object.freeze(stabilityRaf.intervals.slice()),
      summary: Object.freeze({
        nominalFrameIntervalMs: nominal,
        firstTwoMinutes: Object.freeze({
          raf: summarizeRafIntervals(firstRafWindow, nominal),
          backendApplySettlementMs: summarizeNumericSamples(applyValues(firstWindow))
        }),
        lastTwoMinutes: Object.freeze({
          raf: summarizeRafIntervals(lastRafWindow, nominal),
          backendApplySettlementMs: summarizeNumericSamples(applyValues(lastWindow))
        })
      }),
      lifecycle: Object.freeze(lifecycle)
    });
  } finally {
    stabilityRaf.stop();
    if (previousBoardSkinId === null) delete runtime.boardElement.dataset.boardSkinId;
    else runtime.boardElement.dataset.boardSkinId = previousBoardSkinId;
    if (previousStoneSkinId === null) delete rootElement.dataset.stoneSkinId;
    else rootElement.dataset.stoneSkinId = previousStoneSkinId;
  }
}

function createValidityMonitor(root: any, documentRef: Document): Readonly<{
  snapshot: () => Readonly<Record<string, unknown>>;
  destroy: () => void;
}> {
  let visibilityChangeCount = 0;
  let focusChangeCount = 0;
  const invalidReasons: string[] = [];
  const visibleAtStart = documentRef.visibilityState === 'visible';
  const focusedAtStart = typeof documentRef.hasFocus !== 'function' || documentRef.hasFocus();
  if (!visibleAtStart) invalidReasons.push('document_not_visible_at_start');
  if (!focusedAtStart) invalidReasons.push('document_not_focused_at_start');
  const onVisibilityChange = () => {
    visibilityChangeCount += 1;
    invalidReasons.push(`visibility_changed:${documentRef.visibilityState}`);
  };
  const onFocusChange = () => {
    focusChangeCount += 1;
    invalidReasons.push(documentRef.hasFocus() ? 'focus_regained' : 'focus_lost');
  };
  documentRef.addEventListener('visibilitychange', onVisibilityChange);
  root.addEventListener('focus', onFocusChange);
  root.addEventListener('blur', onFocusChange);
  return Object.freeze({
    snapshot: () => Object.freeze({
      visibleAtStart,
      focusedAtStart,
      visibilityChangeCount,
      focusChangeCount,
      invalidReasons: Object.freeze(invalidReasons.slice()),
      valid: invalidReasons.length === 0
    }),
    destroy() {
      documentRef.removeEventListener('visibilitychange', onVisibilityChange);
      root.removeEventListener('focus', onFocusChange);
      root.removeEventListener('blur', onFocusChange);
    }
  });
}

function createOptionalPerformanceObservers(root: any): Readonly<{
  support: Readonly<Record<string, string>>;
  entries: Readonly<Record<string, unknown[]>>;
  destroy: () => void;
}> {
  const entries: Record<string, unknown[]> = { longAnimationFrame: [], longTask: [] };
  const observers: PerformanceObserver[] = [];
  const supported = Array.isArray(root.PerformanceObserver?.supportedEntryTypes)
    ? root.PerformanceObserver.supportedEntryTypes
    : [];
  const install = (entryType: string, key: string) => {
    if (!supported.includes(entryType)) return false;
    try {
      const observer = new root.PerformanceObserver((list: PerformanceObserverEntryList) => {
        entries[key].push(...list.getEntries().map((entry) => ({
          startTime: round(entry.startTime),
          duration: round(entry.duration),
          name: entry.name || null
        })));
      });
      observer.observe({ type: entryType, buffered: true });
      observers.push(observer);
      return true;
    } catch (_error) {
      return false;
    }
  };
  const loaf = install('long-animation-frame', 'longAnimationFrame');
  const longTask = install('longtask', 'longTask');
  return Object.freeze({
    support: Object.freeze({
      longAnimationFrame: loaf ? 'supported' : 'unsupported',
      longTask: longTask ? 'supported' : 'unsupported'
    }),
    entries,
    destroy: () => observers.forEach((observer) => observer.disconnect())
  });
}

function reportId(root: any): string {
  if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
  if (!root.crypto || typeof root.crypto.getRandomValues !== 'function') {
    throw new Error('Secure UUID generation is unavailable');
  }
  const bytes = new Uint8Array(16);
  root.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value: number) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function validateMeta(meta: BoardPerformanceMeta, backend: BoardPerformanceBackend): void {
  if (!meta || meta.schemaVersion !== BOARD_PERFORMANCE_META_SCHEMA_VERSION) {
    throw new Error('Board performance metadata schema is invalid');
  }
  if (!/^[0-9a-f]{40}$/i.test(String(meta.candidateCommit || ''))) {
    throw new Error('Board performance metadata candidate commit is invalid');
  }
  if (!/^[0-9a-f]{64}$/i.test(String(meta.browserArtifactSha256 || ''))) {
    throw new Error('Board performance metadata artifact digest is invalid');
  }
  if (meta.fixtureDigest !== BOARD_PERFORMANCE_FIXTURE_DIGEST
    || meta.eventDigest !== BOARD_PERFORMANCE_EVENT_DIGEST) {
    throw new Error('Board performance server/browser fixture digest mismatch');
  }
  if (meta.captureOrder !== expectedCaptureOrder(meta.candidateCommit)) {
    throw new Error('Board performance capture order does not match candidate SHA');
  }
  if (backend !== 'dom' && backend !== 'pixi') throw new Error('Board performance backend is invalid');
}

async function readMeta(root: any, params: URLSearchParams): Promise<BoardPerformanceMeta> {
  const referenceDevice = params.get('referenceDevice') || '';
  const response = await root.fetch(
    `/__board_perf_meta.json?referenceDevice=${encodeURIComponent(referenceDevice)}`,
    { cache: 'no-store', credentials: 'same-origin' }
  );
  if (!response.ok) throw new Error(`Board performance metadata request failed: ${response.status}`);
  const meta = await response.json();
  const head = await root.fetch('/', { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' });
  const headerDigest = String(head.headers.get('x-board-perf-artifact-sha256') || '');
  if (!headerDigest || headerDigest !== String(meta.browserArtifactSha256 || '')) {
    throw new Error('Board performance document/artifact digest mismatch');
  }
  return meta;
}

function sampleCountForScenario(id: BoardPerformanceScenarioId, config: BoardPerformanceRunConfig): number {
  if (id === 'basic.multi-flip-8x8') return config.basicSampleCount;
  if (id.startsWith('heavy.')) return config.heavySampleCount;
  if (id === 'micro.full-marker-16x16') return config.microSampleCount;
  return 0;
}

async function runSuite(
  runtime: RuntimeModules,
  meta: BoardPerformanceMeta,
  backend: BoardPerformanceBackend,
  config: BoardPerformanceRunConfig,
  params: URLSearchParams,
  progress: (message: string) => void
): Promise<Readonly<Record<string, unknown>>> {
  await runtime.renderer.getBoardVisualControllerReady();
  await runtime.debug.waitForIdle();
  if (runtime.debug.getBackendKind() !== backend) {
    throw new Error(`Board performance backend mismatch: expected ${backend}, got ${runtime.debug.getBackendKind()}`);
  }
  if (runtime.root.NetworkMatchClient?.isActive?.() === true) {
    throw new Error('Board performance harness cannot run inside a live network match');
  }
  if (runtime.document.fonts?.ready) await runtime.document.fonts.ready;
  await runtime.debug.waitForIdle();

  const validity = createValidityMonitor(runtime.root, runtime.document);
  const observers = createOptionalPerformanceObservers(runtime.root);
  const originalGameState = runtime.root.gameState;
  const originalCardState = runtime.root.cardState;
  const startedAtIso = new Date().toISOString();
  const startedAt = now(runtime.root);
  try {
    const initialValidity = validity.snapshot();
    if (initialValidity.valid !== true) {
      throw new Error(`Board performance capture is not visible/focused: ${stablePerformanceJson(initialValidity)}`);
    }
    progress('idle rAF intervalを120件計測中');
    const nominalSamples = await collectNominalRafSamples(runtime.root, config.nominalRafSampleCount);
    const nominalRawIntervalsMs = nominalSamples.intervalsMs;
    const nominalFrameIntervalMs = median(nominalRawIntervalsMs);
    const scenarios: unknown[] = [];
    for (const fixture of BOARD_PERFORMANCE_FIXTURES) {
      if (fixture.id === 'stability.expansion-skin') {
        scenarios.push(await runStabilityScenario(
          runtime,
          fixture,
          config,
          nominalFrameIntervalMs,
          progress
        ));
        continue;
      }
      scenarios.push(await runMeasuredScenario(
        runtime,
        fixture,
        config.warmupCount,
        sampleCountForScenario(fixture.id, config),
        nominalFrameIntervalMs,
        progress
      ));
    }
    const phaseZeroMicroComparison = config.profile === 'physical'
      ? null
      : await runPhaseZeroMicroComparison(runtime, config.standard);
    const validityResult = validity.snapshot();
    const id = reportId(runtime.root);
    const captureIndex = Math.trunc(finite(params.get('captureIndex'), 0));
    const cooldownRequiredMs = Math.max(0, Math.trunc(finite(params.get('cooldownMs'), 0)));
    const installedAt = finite(params.get('installedAt'), startedAt);
    const finalDiagnostics = readDiagnostics(runtime);
    const report = Object.freeze({
      schemaVersion: BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION,
      reportId: id,
      capturedAt: new Date().toISOString(),
      captureStartedAt: startedAtIso,
      captureUrl: String(runtime.root.location?.href || ''),
      captureDurationMs: round(now(runtime.root) - startedAt),
      captureProfile: config.profile,
      standardRun: config.standard,
      candidateCommit: meta.candidateCommit,
      browserArtifactSha256: meta.browserArtifactSha256,
      artifactFileCount: meta.artifactFileCount ?? null,
      fixtureDigest: BOARD_PERFORMANCE_FIXTURE_DIGEST,
      eventDigest: BOARD_PERFORMANCE_EVENT_DIGEST,
      lane: meta.lane,
      backend,
      captureOrder: Object.freeze({
        expected: meta.captureOrder,
        actual: String(params.get('captureOrder') || ''),
        sequenceIndex: captureIndex
      }),
      cooldown: Object.freeze({
        requiredMs: cooldownRequiredMs,
        observedMs: round(Math.max(0, now(runtime.root) - installedAt)),
        passed: config.profile !== 'physical'
          || Math.max(0, now(runtime.root) - installedAt) >= Math.max(PHYSICAL_COOLDOWN_MS, cooldownRequiredMs)
      }),
      environment: Object.freeze({
        referenceDevice: meta.referenceDevice,
        userAgent: String(runtime.root.navigator?.userAgent || ''),
        platform: String(runtime.root.navigator?.platform || ''),
        language: String(runtime.root.navigator?.language || ''),
        screen: Object.freeze({
          width: finite(runtime.root.screen?.width),
          height: finite(runtime.root.screen?.height),
          availWidth: finite(runtime.root.screen?.availWidth),
          availHeight: finite(runtime.root.screen?.availHeight)
        }),
        viewport: Object.freeze({ width: runtime.root.innerWidth, height: runtime.root.innerHeight }),
        dpr: finite(runtime.root.devicePixelRatio, 1),
        orientation: String(runtime.root.screen?.orientation?.type || ''),
        hardwareConcurrency: finite(runtime.root.navigator?.hardwareConcurrency),
        deviceMemory: finite(runtime.root.navigator?.deviceMemory)
      }),
      readiness: Object.freeze({
        fontsReady: true,
        texturesReady: true,
        applicationReady: true,
        writerMode: runtime.debug.getWriterMode(),
        backendDiagnostics: finalDiagnostics
      }),
      delivery: readDeliveryMetrics(runtime.root, finalDiagnostics),
      validity: validityResult,
      nominal: Object.freeze({
        sampleCount: nominalRawIntervalsMs.length,
        rawTimestampsMs: nominalSamples.timestampsMs,
        rawIntervalsMs: nominalRawIntervalsMs,
        nominalFrameIntervalMs,
        aggregation: 'median'
      }),
      percentileRule: 'nearest-rank:ceil(p*N)-1',
      rawSamplePolicy: 'unfiltered-no-winsorization',
      attribution: Object.freeze({
        presentationStart: 'PlaybackEngine dispatch to first subsequent requestAnimationFrame presentation opportunity',
        boardLocal: 'PlaybackEngine presentation handoff through playBoardVisualPhase settlement',
        globalDomHud: 'whole-turn settlement minus board-local span',
        wholeTurn: 'PlaybackEngine dispatch through controller settlement'
      }),
      support: observers.support,
      optionalPerformanceEntries: Object.freeze({
        longAnimationFrame: Object.freeze(observers.entries.longAnimationFrame.slice()),
        longTask: Object.freeze(observers.entries.longTask.slice())
      }),
      runConfig: config,
      phaseZeroMicroComparison,
      scenarios: Object.freeze(scenarios)
    });
    if (validityResult.valid !== true) {
      throw Object.assign(new Error('Board performance capture became hidden or unfocused'), { report });
    }
    if (config.profile === 'physical' && (report.cooldown as any).passed !== true) {
      throw Object.assign(new Error('Physical board performance cooldown was not satisfied'), { report });
    }
    return report;
  } finally {
    observers.destroy();
    validity.destroy();
    runtime.root.gameState = originalGameState;
    runtime.root.cardState = originalCardState;
    try {
      runtime.renderer.resetBoardVisualRenderSession?.();
      await renderCurrentState(runtime);
    } catch (_error) { /* page is discarded after evidence capture */ }
  }
}

function reportFilename(report: Readonly<Record<string, any>>): string {
  const referenceId = String(report.environment?.referenceDevice?.id || 'desktop').replace(/[^a-z0-9_-]+/gi, '-');
  return `pixijs-playfield-${referenceId}-${report.backend}-${report.reportId}.json`;
}

export async function exportBoardPerformanceReport(
  root: any,
  documentRef: Document,
  report: Readonly<Record<string, any>>
): Promise<Readonly<{ method: 'share' | 'download'; filename: string }>> {
  if (!report || report.schemaVersion !== BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION) {
    throw new Error('A completed board performance report is required');
  }
  const filename = reportFilename(report);
  const body = `${JSON.stringify(report, null, 2)}\n`;
  const file = new root.File([body], filename, { type: 'application/json' });
  if (typeof root.navigator?.canShare === 'function'
    && typeof root.navigator?.share === 'function'
    && root.navigator.canShare({ files: [file] })) {
    await root.navigator.share({ files: [file], title: 'PixiJS playfield performance report' });
    return Object.freeze({ method: 'share' as const, filename });
  }
  const blob = new root.Blob([body], { type: 'application/json' });
  const objectUrl = root.URL.createObjectURL(blob);
  try {
    const anchor = documentRef.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    documentRef.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    await new Promise<void>((resolve) => root.setTimeout(resolve, 0));
    root.URL.revokeObjectURL(objectUrl);
  }
  return Object.freeze({ method: 'download' as const, filename });
}

function createControls(documentRef: Document): Readonly<{
  root: HTMLElement;
  runButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  status: HTMLElement;
  meta: HTMLElement;
}> {
  const container = documentRef.createElement('section');
  container.id = 'board-performance-controls';
  container.dataset.boardPerfControls = '1';
  container.setAttribute('aria-label', 'PixiJS盤面性能計測');
  Object.assign(container.style, {
    position: 'fixed',
    left: '8px',
    bottom: '8px',
    zIndex: '2147483647',
    maxWidth: 'min(520px, calc(100vw - 16px))',
    padding: '10px',
    borderRadius: '8px',
    background: 'rgba(8, 18, 18, 0.96)',
    color: '#f2f6f6',
    font: '12px/1.45 system-ui, sans-serif',
    boxShadow: '0 4px 20px rgba(0,0,0,.45)'
  });
  const title = documentRef.createElement('strong');
  title.textContent = 'PixiJS盤面 performance evidence';
  const meta = documentRef.createElement('div');
  meta.dataset.role = 'meta';
  const controls = documentRef.createElement('div');
  controls.style.marginTop = '8px';
  const runButton = documentRef.createElement('button');
  runButton.type = 'button';
  runButton.textContent = 'Run Suite';
  runButton.disabled = true;
  const exportButton = documentRef.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Export JSON';
  exportButton.disabled = true;
  exportButton.style.marginLeft = '8px';
  const status = documentRef.createElement('div');
  status.dataset.role = 'status';
  status.style.marginTop = '6px';
  status.textContent = 'metadataを確認中';
  controls.append(runButton, exportButton);
  container.append(title, meta, controls, status);
  documentRef.body.appendChild(container);
  return Object.freeze({ root: container, runButton, exportButton, status, meta });
}

export async function installBoardVisualPerformanceHarness(options: {
  root?: any;
  document?: Document;
  meta?: BoardPerformanceMeta;
  runConfig?: Partial<BoardPerformanceRunConfig>;
} = {}): Promise<any> {
  const root = options.root || (typeof window !== 'undefined' ? window : null);
  const documentRef = options.document || (typeof document !== 'undefined' ? document : null);
  if (!root || !documentRef || !isBoardPerformanceHarnessRequested(root.location)) return null;
  if (root.__boardPerfHarness) return root.__boardPerfHarness;
  const params = new URLSearchParams(String(root.location?.search || ''));
  const backend = params.get('boardRenderer') as BoardPerformanceBackend;
  if (backend !== 'dom' && backend !== 'pixi') {
    throw new Error('boardPerf requires an explicit boardRenderer=dom or boardRenderer=pixi');
  }
  const controls = createControls(documentRef);
  const installedAt = now(root);
  params.set('installedAt', String(installedAt));
  let meta: BoardPerformanceMeta;
  let latestReport: Readonly<Record<string, unknown>> | null = null;
  let running = false;
  try {
    meta = options.meta || await readMeta(root, params);
    validateMeta(meta, backend);
  } catch (error) {
    controls.status.textContent = `実行不可: ${error instanceof Error ? error.message : error}`;
    controls.status.dataset.state = 'error';
    throw error;
  }
  const profile = meta.captureProfile;
  const config = createBoardPerformanceRunConfig(profile, options.runConfig || {});
  const cooldownMs = profile === 'physical'
    ? Math.max(PHYSICAL_COOLDOWN_MS, Math.trunc(finite(params.get('cooldownMs'), PHYSICAL_COOLDOWN_MS)))
    : Math.max(0, Math.trunc(finite(params.get('cooldownMs'), 0)));
  params.set('cooldownMs', String(cooldownMs));
  const actualOrder = String(params.get('captureOrder') || '');
  const captureIndex = Math.trunc(finite(params.get('captureIndex'), 0));
  const expectedBackend = meta.captureOrder === 'dom-first'
    ? (captureIndex === 1 ? 'dom' : 'pixi')
    : (captureIndex === 1 ? 'pixi' : 'dom');
  if (profile === 'physical' && (actualOrder !== meta.captureOrder || captureIndex < 1 || captureIndex > 2
    || backend !== expectedBackend)) {
    throw new Error('Physical capture URL does not follow the SHA-derived backend order');
  }
  controls.meta.textContent = `${meta.lane}/${backend} commit=${meta.candidateCommit.slice(0, 12)} artifact=${meta.browserArtifactSha256.slice(0, 12)}`;

  const updateCooldown = () => {
    if (running) return;
    const remaining = Math.max(0, cooldownMs - (now(root) - installedAt));
    controls.runButton.disabled = remaining > 0;
    controls.status.textContent = remaining > 0
      ? `cool-down中: あと${Math.ceil(remaining / 1000)}秒`
      : '計測準備完了';
    if (remaining > 0) root.setTimeout(updateCooldown, Math.min(1000, remaining));
  };
  updateCooldown();

  const api = Object.freeze({
    getMeta: () => meta,
    getRunConfig: () => config,
    getLatestReport: () => latestReport,
    async runSuite(runOverrides?: Partial<BoardPerformanceRunConfig>) {
      if (running) throw new Error('Board performance suite is already running');
      if (now(root) - installedAt < cooldownMs) throw new Error('Board performance cooldown is still active');
      running = true;
      controls.runButton.disabled = true;
      controls.exportButton.disabled = true;
      controls.status.dataset.state = 'running';
      try {
        const runtime = resolveRuntimeModules(root, documentRef);
        const selectedConfig = runOverrides
          ? createBoardPerformanceRunConfig(profile, { ...config, ...runOverrides })
          : config;
        latestReport = await runSuite(runtime, meta, backend, selectedConfig, params, (message) => {
          controls.status.textContent = message;
        });
        controls.status.textContent = '計測完了。Export JSONで未加工reportを保存してください。';
        controls.status.dataset.state = 'complete';
        controls.exportButton.disabled = false;
        return latestReport;
      } catch (error) {
        latestReport = (error as any)?.report || null;
        controls.status.textContent = `計測失敗: ${error instanceof Error ? error.message : error}`;
        controls.status.dataset.state = 'error';
        controls.exportButton.disabled = !latestReport;
        throw error;
      } finally {
        running = false;
        controls.runButton.disabled = false;
      }
    },
    async exportJSON() {
      if (!latestReport) throw new Error('Completed performance report is unavailable');
      return exportBoardPerformanceReport(root, documentRef, latestReport);
    }
  });
  Object.defineProperty(root, '__boardPerfHarness', {
    value: api,
    configurable: true,
    enumerable: false,
    writable: false
  });
  controls.runButton.addEventListener('click', () => {
    void api.runSuite().catch(() => undefined);
  });
  controls.exportButton.addEventListener('click', () => {
    void api.exportJSON().catch((error) => {
      controls.status.textContent = `Export失敗: ${error instanceof Error ? error.message : error}`;
    });
  });
  return api;
}

export const BOARD_PERFORMANCE_PHYSICAL_COOLDOWN_MS = PHYSICAL_COOLDOWN_MS;
export const BOARD_PERFORMANCE_PHYSICAL_STABILITY_MS = PHYSICAL_STABILITY_DURATION_MS;
