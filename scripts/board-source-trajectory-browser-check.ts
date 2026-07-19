import { chromium, firefox, webkit } from 'playwright';

import BrowserUiControlSmoke = require('./browser-ui-control-smoke');

export type BoardSourceTrajectoryBrowserBackend = 'dom' | 'pixi';
export type BoardSourceTrajectoryBrowserLane = 'classic' | 'vite';
export type BoardSourceTrajectoryBrowserEngine = 'chromium' | 'firefox' | 'webkit';

export interface TrajectoryPoint {
  readonly x: number;
  readonly y: number;
}

export interface BoundsRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface BoardSourceTrajectoryResourceSnapshot {
  readonly canvasCount: number;
  readonly contextCount: number;
  readonly domCellCount: number;
  readonly activeViewCount: number;
  readonly ephemeralVoidCount: number;
  readonly activeSourceTrajectoryCount: number;
  readonly activeSourceTrajectoryTextureLeaseCount: number;
  readonly createdSourceTrajectoryViewCount: number;
  readonly pooledSourceTrajectoryCount: number;
  readonly textureLeaseCount: number;
  readonly canvasBackingWidth: number;
  readonly canvasBackingHeight: number;
  readonly tickerRunning: boolean;
  readonly timelineTickerRunning: boolean;
  readonly timelineTickerSubscribed: boolean;
}

export interface BoardSourceTrajectoryBrowserSample {
  readonly profileKey: string;
  readonly primitive: string;
  readonly fixture: string;
  readonly lane: BoardSourceTrajectoryBrowserLane;
  readonly engine: BoardSourceTrajectoryBrowserEngine;
  readonly viewport: string;
  readonly dpr: number;
  readonly direction: 'source-to-target' | 'target-to-source';
  readonly logicalSource: Readonly<{ row: number; col: number }>;
  readonly logicalTarget: Readonly<{ row: number; col: number }>;
  readonly movementStart: Readonly<{ row: number; col: number }>;
  readonly movementEnd: Readonly<{ row: number; col: number }>;
  readonly sourceCenter: TrajectoryPoint | null;
  readonly targetCenter: TrajectoryPoint | null;
  readonly movementStartPoint: TrajectoryPoint | null;
  readonly movementEndPoint: TrajectoryPoint | null;
  readonly geometryVisibleClip: BoundsRect | null;
  readonly geometryVisibleSegment: Readonly<{
    start: TrajectoryPoint;
    end: TrajectoryPoint;
  }> | null;
  readonly geometryObserved: boolean;
  readonly payloadSourceAfter: Readonly<{ row: number; col: number }>;
  readonly payloadTargetAfter: Readonly<{ row: number; col: number }>;
  readonly endpointRetargeted: boolean;
  readonly boardViewport: BoundsRect;
  readonly paintedHaloOwner: BoundsRect;
  readonly paintedBoundsUnion: BoundsRect | null;
  readonly expectedClippedPaintedBounds: BoundsRect | null;
  readonly pathIntersectsViewport: boolean;
  readonly expectedPathIntersectsViewport: boolean;
  readonly scrolled: boolean;
  readonly scrollBefore: Readonly<{ left: number; top: number }>;
  readonly scrollAfter: Readonly<{ left: number; top: number }>;
  readonly frameCount: number;
  readonly elapsedMs: number;
  readonly expectedDurationMs: number;
  readonly canonicalEventsBefore: string;
  readonly canonicalEventsAfter: string;
  readonly semanticTrajectoryTrace: readonly string[];
  readonly expectedSemanticTrajectoryTrace: readonly string[];
  readonly trajectoryStartedDelta: number;
  readonly trajectoryCompletedDelta: number;
  readonly trajectoryFailedDelta: number;
  readonly offscreenNoObjectDelta: number;
  readonly activeObjectObserved: boolean;
  readonly maxTrajectoryOverlayNodeCount: number;
  readonly clipInstalled: boolean;
  readonly backingWithinLimit: boolean;
  readonly materializationStable: boolean;
  readonly resourcesBefore: BoardSourceTrajectoryResourceSnapshot;
  readonly resourcesAfter: BoardSourceTrajectoryResourceSnapshot;
  readonly initialVisualDigest: string;
  readonly finalVisualDigest: string;
  readonly soundCallCount: number;
  readonly logEntryDelta: number;
  readonly remainingOverlayNodeCount: number;
  readonly error: string | null;
}

export interface BoardSourceTrajectoryLifecycleReport {
  readonly iterations: number;
  readonly activeLeak: boolean;
  readonly textureLeaseLeak: boolean;
  readonly overlayLeak: boolean;
  readonly createdViewGrowthAfterWarmup: boolean;
  readonly textureLeaseGrowthAfterWarmup: boolean;
  readonly backingGrowthAfterWarmup: boolean;
  readonly tickerLeak: boolean;
  readonly resetApplied: boolean;
  readonly sameModelApplySettled: boolean;
  readonly skinSwitchSettled: boolean;
  readonly activeAbortSettled: boolean;
  readonly resourceSnapshots: readonly BoardSourceTrajectoryResourceSnapshot[];
  readonly operationSnapshots: Readonly<{
    abort: BoardSourceTrajectoryResourceSnapshot | null;
    reset: BoardSourceTrajectoryResourceSnapshot | null;
    skin: BoardSourceTrajectoryResourceSnapshot | null;
    sameModel: BoardSourceTrajectoryResourceSnapshot | null;
  }>;
  readonly error: string | null;
}

export interface BoardSourceTrajectoryBrowserReport {
  readonly backend: BoardSourceTrajectoryBrowserBackend;
  readonly baseline: boolean;
  readonly engine: BoardSourceTrajectoryBrowserEngine | 'aggregate';
  readonly requiredEngines?: readonly BoardSourceTrajectoryBrowserEngine[];
  readonly selectedEngines?: readonly BoardSourceTrajectoryBrowserEngine[];
  readonly requiredLanes?: readonly BoardSourceTrajectoryBrowserLane[];
  readonly captures: readonly Readonly<{
    lane: BoardSourceTrajectoryBrowserLane;
    engine: BoardSourceTrajectoryBrowserEngine;
    viewport: string;
    dpr: number;
    smokeOk: boolean;
    smokeErrors: readonly string[];
    samples: readonly BoardSourceTrajectoryBrowserSample[];
    lifecycle: BoardSourceTrajectoryLifecycleReport | null;
  }>[];
}

export interface BoardSourceTrajectoryBrowserEvaluation {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

interface ProfileDefinition {
  readonly profileKey: typeof BOARD_SOURCE_TRAJECTORY_BROWSER_PROFILE_KEYS[number];
  readonly eventType: 'destroy' | 'flip';
  readonly cause: string;
  readonly reason: string;
  readonly primitive: 'projectile' | 'suction' | 'beam' | 'lightning' | 'bite';
  readonly direction: 'source-to-target' | 'target-to-source';
  readonly baseMs: number;
  readonly distanceFactor: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly deadlinePaddingMs: number;
  readonly fixedDeadline: boolean;
}

interface BrowserScenario {
  readonly fixture: string;
  readonly source: Readonly<{ row: number; col: number }>;
  readonly target: Readonly<{ row: number; col: number }>;
  readonly expectedPathIntersectsViewport: boolean;
  readonly scrollByCells?: Readonly<{ left: number; top: number }>;
}

export const BOARD_SOURCE_TRAJECTORY_BROWSER_PROFILE_KEYS = Object.freeze([
  'sniperShot',
  'robotVacuumSuck',
  'destroyDragonBreath',
  'meteorGodBlackBeam',
  'lightningDestroyed',
  'udgDestroyed',
  'zombieBite'
] as const);

export const BOARD_SOURCE_TRAJECTORY_BROWSER_LANES = Object.freeze([
  'classic',
  'vite'
] as const);

export const BOARD_SOURCE_TRAJECTORY_BROWSER_ENGINES = Object.freeze([
  'chromium',
  'firefox',
  'webkit'
] as const);

export const BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS = Object.freeze([
  Object.freeze({ name: 'desktop-dpr1', width: 1366, height: 900, dpr: 1 }),
  Object.freeze({ name: 'mobile-dpr2', width: 430, height: 932, dpr: 2 })
]);

const PROFILE_DEFINITIONS: readonly ProfileDefinition[] = Object.freeze([
  Object.freeze({
    profileKey: 'sniperShot', eventType: 'destroy', cause: 'SNIPER_WILL', reason: 'sniper_shot',
    primitive: 'projectile', direction: 'source-to-target', baseMs: 90, distanceFactor: 0.35,
    minMs: 120, maxMs: 420, deadlinePaddingMs: 120, fixedDeadline: false
  }),
  Object.freeze({
    profileKey: 'robotVacuumSuck', eventType: 'destroy', cause: 'ROBOT_VACUUM', reason: 'robot_vacuum_suck',
    primitive: 'suction', direction: 'target-to-source', baseMs: 140, distanceFactor: 0.28,
    minMs: 140, maxMs: 360, deadlinePaddingMs: 120, fixedDeadline: false
  }),
  Object.freeze({
    profileKey: 'destroyDragonBreath', eventType: 'destroy', cause: 'DESTROY_DRAGON_WILL', reason: 'destroy_dragon_breath',
    primitive: 'beam', direction: 'source-to-target', baseMs: 240, distanceFactor: 0.28,
    minMs: 280, maxMs: 520, deadlinePaddingMs: 120, fixedDeadline: true
  }),
  Object.freeze({
    profileKey: 'meteorGodBlackBeam', eventType: 'destroy', cause: 'METEOR_GOD', reason: 'meteor_god_cell_destroy',
    primitive: 'beam', direction: 'source-to-target', baseMs: 230, distanceFactor: 0.22,
    minMs: 260, maxMs: 460, deadlinePaddingMs: 140, fixedDeadline: true
  }),
  Object.freeze({
    profileKey: 'lightningDestroyed', eventType: 'destroy', cause: 'LIGHTNING_WILL', reason: 'lightning_destroyed',
    primitive: 'lightning', direction: 'source-to-target', baseMs: 170, distanceFactor: 0.12,
    minMs: 170, maxMs: 300, deadlinePaddingMs: 140, fixedDeadline: false
  }),
  Object.freeze({
    profileKey: 'udgDestroyed', eventType: 'destroy', cause: 'ULTIMATE_DESTROY_GOD', reason: 'udg_destroyed',
    primitive: 'lightning', direction: 'source-to-target', baseMs: 170, distanceFactor: 0.12,
    minMs: 170, maxMs: 300, deadlinePaddingMs: 140, fixedDeadline: false
  }),
  Object.freeze({
    profileKey: 'zombieBite', eventType: 'flip', cause: 'ZOMBIE', reason: 'zombie_infection',
    primitive: 'bite', direction: 'source-to-target', baseMs: 800, distanceFactor: 0,
    minMs: 800, maxMs: 800, deadlinePaddingMs: 0, fixedDeadline: true
  })
]);

const REQUIRED_GEOMETRY_FIXTURES = Object.freeze([
  'source-offscreen-target-onscreen',
  'source-onscreen-target-offscreen',
  'offscreen-path-crossing',
  'fully-offscreen-nonintersecting',
  'negative-coordinate',
  'shrunk'
]);

function finite(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function sameCoordinate(
  first: Readonly<{ row: number; col: number }>,
  second: Readonly<{ row: number; col: number }>
): boolean {
  return first.row === second.row && first.col === second.col;
}

function samePoint(first: TrajectoryPoint | null, second: TrajectoryPoint | null, epsilon = 0.01): boolean {
  return !!first && !!second
    && Math.abs(first.x - second.x) <= epsilon
    && Math.abs(first.y - second.y) <= epsilon;
}

function rectWithin(inner: BoundsRect | null, outer: BoundsRect, epsilon = 1): boolean {
  if (!inner) return true;
  return inner.left >= outer.left - epsilon
    && inner.top >= outer.top - epsilon
    && inner.right <= outer.right + epsilon
    && inner.bottom <= outer.bottom + epsilon;
}

function expectedDirection(profileKey: string): 'source-to-target' | 'target-to-source' {
  return profileKey === 'robotVacuumSuck' ? 'target-to-source' : 'source-to-target';
}

function resourceIsSettled(resources: BoardSourceTrajectoryResourceSnapshot): boolean {
  return resources.activeSourceTrajectoryCount === 0
    && resources.activeSourceTrajectoryTextureLeaseCount === 0
    && resources.tickerRunning !== true
    && resources.timelineTickerRunning !== true
    && resources.timelineTickerSubscribed !== true;
}

export function evaluateBoardSourceTrajectoryBrowserReport(
  report: BoardSourceTrajectoryBrowserReport
): BoardSourceTrajectoryBrowserEvaluation {
  const errors: string[] = [];
  if (!report || !Array.isArray(report.captures) || !report.captures.length) {
    return Object.freeze({ ok: false, errors: Object.freeze(['browser captures are missing']) });
  }

  const lanes = new Set(report.captures.map((capture) => capture.lane));
  const requiredLanes = report.requiredLanes?.length
    ? report.requiredLanes
    : BOARD_SOURCE_TRAJECTORY_BROWSER_LANES;
  for (const lane of requiredLanes) {
    if (!lanes.has(lane)) errors.push(`${lane}: browser lane capture is missing`);
  }
  const viewports = new Set(report.captures.map((capture) => capture.viewport));
  for (const viewport of BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS) {
    if (!viewports.has(viewport.name)) errors.push(`${viewport.name}: viewport capture is missing`);
  }
  const requiredEngines = report.requiredEngines?.length
    ? report.requiredEngines
    : BOARD_SOURCE_TRAJECTORY_BROWSER_ENGINES;
  for (const engine of requiredEngines) {
    for (const lane of requiredLanes) {
      for (const viewport of BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS) {
        if (!report.captures.some((capture) => (
          capture.engine === engine && capture.lane === lane && capture.viewport === viewport.name
          && capture.dpr === viewport.dpr
        ))) {
          errors.push(`${engine}/${lane}/${viewport.name}: required aggregate capture is missing`);
        }
      }
    }
  }

  for (const capture of report.captures) {
    const prefix = `${capture.engine}/${capture.lane}/${capture.viewport}/dpr${capture.dpr}`;
    if (!capture.smokeOk) {
      errors.push(`${prefix}: startup smoke failed: ${capture.smokeErrors.join('; ')}`);
    }
    for (const profileKey of BOARD_SOURCE_TRAJECTORY_BROWSER_PROFILE_KEYS) {
      for (const fixture of ['normal', 'scrolled-expanded']) {
        const sample = capture.samples.find((candidate: BoardSourceTrajectoryBrowserSample) => (
          candidate.profileKey === profileKey && candidate.fixture === fixture
        ));
        if (!sample) {
          errors.push(`${prefix}/${fixture}: ${profileKey} sample is missing`);
          continue;
        }
      }
    }

    for (const sample of capture.samples) {
      const samplePrefix = `${prefix}/${sample.fixture}/${sample.profileKey}`;
      if (sample.error) errors.push(`${samplePrefix}: ${sample.error}`);
      if (sample.direction !== expectedDirection(sample.profileKey)) {
        errors.push(`${samplePrefix}: visible movement direction drifted`);
      }
      const expectedMovementStart = sample.direction === 'source-to-target'
        ? sample.logicalSource
        : sample.logicalTarget;
      const expectedMovementEnd = sample.direction === 'source-to-target'
        ? sample.logicalTarget
        : sample.logicalSource;
      if (!sameCoordinate(sample.movementStart, expectedMovementStart)
        || !sameCoordinate(sample.movementEnd, expectedMovementEnd)) {
        errors.push(`${samplePrefix}: movement endpoints drifted from the logical source/target contract`);
      }
      if (!sample.geometryObserved || !sample.sourceCenter || !sample.targetCenter
        || !sample.movementStartPoint || !sample.movementEndPoint || !sample.geometryVisibleClip) {
        errors.push(`${samplePrefix}: actual source trajectory geometry diagnostics are missing`);
      } else {
        const expectedStartPoint = sample.direction === 'source-to-target'
          ? sample.sourceCenter
          : sample.targetCenter;
        const expectedEndPoint = sample.direction === 'source-to-target'
          ? sample.targetCenter
          : sample.sourceCenter;
        if (!samePoint(sample.movementStartPoint, expectedStartPoint)
          || !samePoint(sample.movementEndPoint, expectedEndPoint)) {
          errors.push(`${samplePrefix}: diagnostic movement geometry reversed or retargeted its endpoints`);
        }
      }
      if (sample.endpointRetargeted
        || !sameCoordinate(sample.logicalSource, sample.payloadSourceAfter)
        || !sameCoordinate(sample.logicalTarget, sample.payloadTargetAfter)) {
        errors.push(`${samplePrefix}: logical source/target was retargeted by viewport state`);
      }
      if (sample.canonicalEventsBefore !== sample.canonicalEventsAfter) {
        errors.push(`${samplePrefix}: canonical events[] changed during presentation`);
      }
      if (JSON.stringify(sample.semanticTrajectoryTrace)
        !== JSON.stringify(sample.expectedSemanticTrajectoryTrace)) {
        errors.push(`${samplePrefix}: normalized semantic trajectory order drifted`);
      }
      if (sample.pathIntersectsViewport !== sample.expectedPathIntersectsViewport) {
        errors.push(`${samplePrefix}: viewport intersection classification drifted`);
      }
      if (report.backend === 'dom' && sample.expectedPathIntersectsViewport && !sample.paintedBoundsUnion) {
        errors.push(`${samplePrefix}: no clipped visible trajectory bounds were observed`);
      }
      if (!sample.expectedPathIntersectsViewport && sample.paintedBoundsUnion) {
        errors.push(`${samplePrefix}: a fully offscreen path produced visible bounds`);
      }
      if (report.backend === 'dom' && !rectWithin(sample.paintedBoundsUnion, sample.paintedHaloOwner)) {
        errors.push(`${samplePrefix}: painted trajectory exceeds the two-cell halo owner`);
      }
      if (sample.frameCount < 1) errors.push(`${samplePrefix}: no animation frame was sampled`);
      if (sample.elapsedMs < 0 || sample.elapsedMs > sample.expectedDurationMs + 2500) {
        errors.push(`${samplePrefix}: settlement duration exceeded the bounded deadline`);
      }
      if (sample.soundCallCount !== 0) errors.push(`${samplePrefix}: source trajectory emitted sound`);
      if (sample.logEntryDelta !== 0) errors.push(`${samplePrefix}: source trajectory emitted a log entry`);
      if (sample.initialVisualDigest !== sample.finalVisualDigest) {
        errors.push(`${samplePrefix}: final visual semantic digest drifted`);
      }
      if (sample.remainingOverlayNodeCount !== 0) {
        errors.push(`${samplePrefix}: trajectory DOM overlay leaked after settlement`);
      }
      if (!resourceIsSettled(sample.resourcesAfter)) {
        errors.push(`${samplePrefix}: trajectory resources or ticker remained active`);
      }
      if (!sample.backingWithinLimit) errors.push(`${samplePrefix}: canvas backing exceeded viewport plus gutter`);
      if (!sample.materializationStable) errors.push(`${samplePrefix}: path materialized board/void cells`);

      if (report.backend === 'pixi') {
        if (sample.resourcesAfter.canvasCount !== 1 || sample.resourcesAfter.contextCount !== 1) {
          errors.push(`${samplePrefix}: Pixi lane does not own exactly one canvas/context`);
        }
        if (sample.resourcesAfter.domCellCount !== 0) {
          errors.push(`${samplePrefix}: Pixi lane materialized DOM board cells`);
        }
        if (sample.maxTrajectoryOverlayNodeCount !== 0) {
          errors.push(`${samplePrefix}: Pixi lane materialized a DOM/SVG trajectory overlay`);
        }
        if (sample.trajectoryStartedDelta !== 1 || sample.trajectoryCompletedDelta !== 1
          || sample.trajectoryFailedDelta !== 0) {
          errors.push(`${samplePrefix}: Pixi trajectory did not start and settle exactly once`);
        }
        if (sample.expectedPathIntersectsViewport && !sample.activeObjectObserved) {
          errors.push(`${samplePrefix}: intersecting Pixi trajectory never materialized an effect object`);
        }
        if (!sample.expectedPathIntersectsViewport
          && (sample.activeObjectObserved || sample.offscreenNoObjectDelta !== 1)) {
          errors.push(`${samplePrefix}: fully offscreen Pixi trajectory did not use the zero-object settlement path`);
        }
      } else {
        if (sample.resourcesAfter.canvasCount !== 0 || sample.resourcesAfter.contextCount !== 0) {
          errors.push(`${samplePrefix}: forced DOM lane mounted Pixi canvas/context`);
        }
        if (sample.resourcesAfter.domCellCount <= 0) {
          errors.push(`${samplePrefix}: forced DOM lane did not materialize DOM cells`);
        }
        if (sample.resourcesAfter.activeSourceTrajectoryCount !== 0
          || sample.resourcesAfter.activeSourceTrajectoryTextureLeaseCount !== 0) {
          errors.push(`${samplePrefix}: forced DOM lane retained Pixi trajectory resources`);
        }
        if (sample.expectedPathIntersectsViewport && (!sample.activeObjectObserved || !sample.clipInstalled)) {
          errors.push(`${samplePrefix}: DOM trajectory was not visibly clipped by the board viewport`);
        }
        if (!sample.expectedPathIntersectsViewport && sample.activeObjectObserved) {
          errors.push(`${samplePrefix}: fully offscreen DOM trajectory materialized an overlay`);
        }
      }
    }
  }

  const allSamples = report.captures.flatMap((capture) => capture.samples);
  for (const fixture of REQUIRED_GEOMETRY_FIXTURES) {
    if (!allSamples.some((sample) => sample.fixture === fixture)) {
      errors.push(`${fixture}: geometry coverage is missing`);
    }
  }
  if (!allSamples.some((sample) => sample.fixture === 'scrolled-expanded' && sample.scrolled)) {
    errors.push('scrolled-expanded: scroll-before/after coverage is missing');
  }

  const lifecycle = report.captures.map((capture) => capture.lifecycle).find(Boolean) || null;
  if (!lifecycle || lifecycle.iterations !== 50) {
    errors.push('50-run lifecycle stress is missing');
  } else {
    if (lifecycle.error) errors.push(`lifecycle: ${lifecycle.error}`);
    if (lifecycle.activeLeak || lifecycle.textureLeaseLeak || lifecycle.overlayLeak
      || lifecycle.createdViewGrowthAfterWarmup || lifecycle.textureLeaseGrowthAfterWarmup
      || lifecycle.backingGrowthAfterWarmup || lifecycle.tickerLeak) {
      errors.push('lifecycle: trajectory resources grew or remained active after warmup');
    }
    if (!lifecycle.activeAbortSettled || !lifecycle.resetApplied
      || !lifecycle.sameModelApplySettled || !lifecycle.skinSwitchSettled) {
      errors.push('lifecycle: active abort, reset, same-model apply, or skin-switch settlement was not exercised');
    }
    if (!Array.isArray(lifecycle.resourceSnapshots) || lifecycle.resourceSnapshots.length !== 50
      || !lifecycle.operationSnapshots?.abort || !lifecycle.operationSnapshots?.reset
      || !lifecycle.operationSnapshots?.skin || !lifecycle.operationSnapshots?.sameModel) {
      errors.push('lifecycle: fresh per-run and post-operation resource snapshots are missing');
    } else {
      for (const [operation, snapshot] of Object.entries(lifecycle.operationSnapshots) as Array<[
        string,
        BoardSourceTrajectoryResourceSnapshot | null
      ]>) {
        if (!snapshot || !resourceIsSettled(snapshot)) {
          errors.push(`lifecycle: ${operation} did not settle trajectory/ticker resources`);
        }
      }
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function backendFromArgs(argv: readonly string[]): BoardSourceTrajectoryBrowserBackend {
  const argument = argv.find((value) => value.startsWith('--backend='));
  const backend = String(argument ? argument.slice('--backend='.length) : 'pixi').trim().toLowerCase();
  if (backend !== 'dom' && backend !== 'pixi') {
    throw new Error(`unsupported board source trajectory backend: ${backend}`);
  }
  return backend;
}

function enginesFromArgs(argv: readonly string[]): readonly BoardSourceTrajectoryBrowserEngine[] {
  const argument = argv.find((value) => value.startsWith('--engine='));
  if (!argument) return BOARD_SOURCE_TRAJECTORY_BROWSER_ENGINES;
  const engine = String(argument.slice('--engine='.length)).trim().toLowerCase();
  if (engine === 'all') return BOARD_SOURCE_TRAJECTORY_BROWSER_ENGINES;
  if (engine !== 'chromium' && engine !== 'firefox' && engine !== 'webkit') {
    throw new Error(`unsupported board source trajectory browser engine: ${engine}`);
  }
  return Object.freeze([engine]);
}

function lanesFromArgs(argv: readonly string[]): readonly BoardSourceTrajectoryBrowserLane[] {
  const argument = argv.find((value) => value.startsWith('--lane='));
  const lane = String(argument ? argument.slice('--lane='.length) : 'all').trim().toLowerCase();
  if (lane === 'all') return BOARD_SOURCE_TRAJECTORY_BROWSER_LANES;
  if (lane !== 'classic' && lane !== 'vite') {
    throw new Error(`unsupported board source trajectory browser lane: ${lane}`);
  }
  return Object.freeze([lane]);
}

function browserLaunch(engine: BoardSourceTrajectoryBrowserEngine): typeof chromium.launch {
  const browserType = engine === 'firefox' ? firefox : engine === 'webkit' ? webkit : chromium;
  return browserType.launch.bind(browserType) as typeof chromium.launch;
}

function entryPath(lane: BoardSourceTrajectoryBrowserLane, backend: BoardSourceTrajectoryBrowserBackend): string {
  const path = lane === 'vite' ? '/vite-dist/index.vite.html' : '/index.classic.html';
  return `${path}?boardRenderer=${backend}&debug=1`;
}

async function captureViewport(
  rootDir: string,
  backend: BoardSourceTrajectoryBrowserBackend,
  lane: BoardSourceTrajectoryBrowserLane,
  engine: BoardSourceTrajectoryBrowserEngine,
  viewport: typeof BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS[number],
  runLifecycleStress: boolean
): Promise<BoardSourceTrajectoryBrowserReport['captures'][number]> {
  const smoke = await BrowserUiControlSmoke.runBrowserUiControlSmoke({
    rootDir,
    launch: browserLaunch(engine),
    entryPath: entryPath(lane, backend),
    readyOnly: true,
    log: false,
    pageOptions: {
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dpr
    },
    beforeGoto: async (page: any) => page.addInitScript(() => {
      const root = window as any;
      const contexts: Array<{ canvas: HTMLCanvasElement; context: unknown }> = [];
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patchedGetContext(
        this: HTMLCanvasElement,
        type: any,
        ...args: any[]
      ): any {
        const context = (originalGetContext as any).call(this, type, ...args);
        if ((type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') && context) {
          if (!contexts.some((entry) => entry.canvas === this && entry.context === context)) {
            contexts.push({ canvas: this, context });
          }
        }
        return context;
      } as typeof HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(root, '__boardSourceTrajectoryContextProbe', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze({
          connectedCount() {
            return new Set(contexts
              .filter((entry) => entry.canvas.isConnected && !!entry.canvas.closest('#board'))
              .map((entry) => entry.context)).size;
          }
        })
      });
    }),
    afterReady: async (page: any) => page.evaluate(async (input: any) => {
      const root = window as any;
      const resolveModule = (globalName: string, moduleId: string): any => {
        if (root[globalName]) return root[globalName];
        try {
          return typeof root.require === 'function' ? root.require(moduleId) : null;
        } catch (_error) {
          return null;
        }
      };
      const renderer = resolveModule('BoardRenderer', 'ui/board-renderer');
      const engine = resolveModule('AnimationEngine', 'ui/animation-engine');
      const core = resolveModule('CoreLogic', 'game/logic/core') || resolveModule('Core', 'game/logic/core');
      const boardUtils = resolveModule('SharedBoardUtils', 'shared/shared-board-utils');
      const debug = root.__boardVisualDebug;
      if (!renderer || !engine || typeof engine.play !== 'function'
        || !core || typeof core.createGameState !== 'function' || !debug
        || typeof debug.getDiagnosticEntries !== 'function') {
        throw new Error('board trajectory browser seam is unavailable');
      }
      const requiredMethods = [
        'getBoardVisualControllerReady', 'getBoardVisualController'
      ];
      for (const method of requiredMethods) {
        if (typeof renderer[method] !== 'function') throw new Error(`board renderer is missing ${method}`);
      }

      const stableJson = (value: any): string => {
        const seen = new WeakSet<object>();
        const normalize = (candidate: any): any => {
          if (candidate == null || typeof candidate !== 'object') return candidate;
          if (seen.has(candidate)) return '[Circular]';
          seen.add(candidate);
          if (Array.isArray(candidate)) return candidate.map(normalize);
          const output: Record<string, unknown> = {};
          for (const key of Object.keys(candidate).sort()) {
            const item = candidate[key];
            if (typeof item !== 'function' && typeof item !== 'undefined') output[key] = normalize(item);
          }
          return output;
        };
        return JSON.stringify(normalize(value));
      };
      const withTimeout = <T>(pending: Promise<T> | T, label: string, timeoutMs = input.timeoutMs): Promise<T> => {
        let timerId: number | null = null;
        const timeout = new Promise<never>((_resolve, reject) => {
          timerId = window.setTimeout(() => reject(new Error(
            `${label} timed out after ${timeoutMs}ms`
          )), timeoutMs);
        });
        return Promise.race([Promise.resolve(pending), timeout]).finally(() => {
          if (timerId !== null) window.clearTimeout(timerId);
        });
      };
      const number = (value: any): number => Number.isFinite(Number(value)) ? Number(value) : 0;
      const rect = (raw: any) => ({
        left: number(raw?.left), top: number(raw?.top), right: number(raw?.right), bottom: number(raw?.bottom),
        width: number(raw?.width), height: number(raw?.height)
      });
      const diagnosticPoint = (raw: any) => raw
        && Number.isFinite(Number(raw.x)) && Number.isFinite(Number(raw.y))
        ? { x: Number(raw.x), y: Number(raw.y) }
        : null;
      const diagnosticRect = (raw: any) => raw
        && ['left', 'top', 'right', 'bottom', 'width', 'height']
          .every((key) => Number.isFinite(Number(raw[key])))
        ? rect(raw)
        : null;
      const center = (raw: any) => ({ x: number(raw?.left) + number(raw?.width) / 2, y: number(raw?.top) + number(raw?.height) / 2 });
      const intersectRects = (first: any, second: any) => {
        if (!first || !second) return null;
        const left = Math.max(first.left, second.left);
        const top = Math.max(first.top, second.top);
        const right = Math.min(first.right, second.right);
        const bottom = Math.min(first.bottom, second.bottom);
        return right > left && bottom > top
          ? { left, top, right, bottom, width: right - left, height: bottom - top }
          : null;
      };
      const unionRects = (first: any, second: any) => {
        if (!first) return second;
        if (!second) return first;
        const left = Math.min(first.left, second.left);
        const top = Math.min(first.top, second.top);
        const right = Math.max(first.right, second.right);
        const bottom = Math.max(first.bottom, second.bottom);
        return { left, top, right, bottom, width: right - left, height: bottom - top };
      };
      const segmentIntersects = (start: any, end: any, bounds: any) => {
        const inside = (point: any) => point.x >= bounds.left && point.x <= bounds.right
          && point.y >= bounds.top && point.y <= bounds.bottom;
        if (inside(start) || inside(end)) return true;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        let startT = 0;
        let endT = 1;
        for (const [p, q] of [
          [-dx, start.x - bounds.left], [dx, bounds.right - start.x],
          [-dy, start.y - bounds.top], [dy, bounds.bottom - start.y]
        ]) {
          if (Math.abs(p) < 1e-9) {
            if (q < 0) return false;
            continue;
          }
          const ratio = q / p;
          if (p < 0) startT = Math.max(startT, ratio);
          else endT = Math.min(endT, ratio);
          if (startT > endT) return false;
        }
        return true;
      };
      const clippedSegmentBounds = (start: any, end: any, bounds: any) => {
        if (!segmentIntersects(start, end, bounds)) return null;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        let startT = 0;
        let endT = 1;
        for (const [p, q] of [
          [-dx, start.x - bounds.left], [dx, bounds.right - start.x],
          [-dy, start.y - bounds.top], [dy, bounds.bottom - start.y]
        ]) {
          if (Math.abs(p) < 1e-9) continue;
          const ratio = q / p;
          if (p < 0) startT = Math.max(startT, ratio);
          else endT = Math.min(endT, ratio);
        }
        const first = { x: start.x + dx * startT, y: start.y + dy * startT };
        const last = { x: start.x + dx * endT, y: start.y + dy * endT };
        const left = Math.min(first.x, last.x);
        const top = Math.min(first.y, last.y);
        const right = Math.max(first.x, last.x);
        const bottom = Math.max(first.y, last.y);
        return { left, top, right, bottom, width: right - left, height: bottom - top };
      };
      const overlaySelector = [
        '[data-board-source-trajectory-layer="true"]',
        '.dom-board-source-trajectory-layer',
        '.dom-board-source-trajectory__zombie-shadow',
        '.dom-board-source-trajectory__zombie-fang',
        '.zombie-bite-global-overlay'
      ].join(',');
      const readResources = () => {
        const diagnostics = debug.getBackendDiagnostics?.() || {};
        const scene = diagnostics.scene || {};
        const timeline = diagnostics.timeline || diagnostics.playback?.timeline || {};
        const display = debug.getDisplayObjectCounts?.() || {};
        const leases = debug.getTextureLeaseCounts?.() || {};
        return {
          canvasCount: number(diagnostics.canvasCount ?? document.querySelectorAll('#board canvas').length),
          contextCount: input.backend === 'pixi'
            ? number(root.__boardSourceTrajectoryContextProbe?.connectedCount?.() ?? diagnostics.contextCount)
            : number(diagnostics.contextCount),
          // DOM compatibility owns its own materialization count. Do not
          // rediscover board cells from production selectors in this gate.
          domCellCount: number(diagnostics.domCellCount),
          activeViewCount: number(scene.activeViewCount ?? display.active),
          ephemeralVoidCount: number(scene.ephemeralVoidCount),
          activeSourceTrajectoryCount: number(scene.activeSourceTrajectoryCount),
          activeSourceTrajectoryTextureLeaseCount: number(scene.activeSourceTrajectoryTextureLeaseCount),
          createdSourceTrajectoryViewCount: number(scene.createdSourceTrajectoryViewCount),
          pooledSourceTrajectoryCount: number(scene.pooledSourceTrajectoryCount),
          textureLeaseCount: number(leases.total),
          canvasBackingWidth: number(diagnostics.canvasBackingWidth),
          canvasBackingHeight: number(diagnostics.canvasBackingHeight),
          tickerRunning: diagnostics.tickerRunning === true,
          timelineTickerRunning: timeline.tickerRunning === true,
          timelineTickerSubscribed: timeline.tickerSubscribed === true
        };
      };
      const profileCounters = (profileKey: string) => {
        const diagnostics = debug.getBackendDiagnostics?.() || {};
        const source = diagnostics.playback?.sourceTrajectory || {};
        const counter = source.byProfile?.[profileKey] || {};
        return {
          started: number(counter.started),
          completed: number(counter.completed),
          failed: number(counter.failed),
          offscreenNoObject: number(source.offscreenNoObjectRunCount)
        };
      };
      const nextFrame = () => withTimeout(
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
        'animation frame',
        Math.min(2000, input.timeoutMs)
      );
      const delay = (ms: number, label: string) => withTimeout(
        new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
        label,
        Math.max(ms + 1000, Math.min(2000, input.timeoutMs))
      );
      const waitIdle = async () => {
        await withTimeout(renderer.getBoardVisualControllerReady(), 'board visual controller readiness');
        await withTimeout(debug.waitForIdle(), 'board visual idle');
      };

      const applyFixture = async (definition: any) => {
        const gameState = core.createGameState({ rows: definition.rows, cols: definition.cols, shape: definition.shape || 'rectangle' });
        const expansionCells = Array.from(definition.expansionCells || []).map((cell: any) => ({ ...cell }));
        gameState.boardExpansion = {
          active: expansionCells.length > 0,
          side: expansionCells.length ? expansionCells[expansionCells.length - 1].side : null,
          row: expansionCells.length ? expansionCells[expansionCells.length - 1].row : null,
          owner: expansionCells.length ? expansionCells[expansionCells.length - 1].owner : 0,
          usedByPlayer: { black: false, white: false },
          cells: expansionCells
        };
        for (const stone of definition.baseStones || []) {
          if (gameState.board?.[stone.row] && Number.isInteger(stone.col)) {
            gameState.board[stone.row][stone.col] = stone.owner;
          }
        }
        const cardState = root.cardState && typeof root.cardState === 'object' ? root.cardState : {};
        cardState.markers = [];
        cardState.pendingEffectByPlayer = { black: null, white: null };
        cardState.boardBonusByCell = {};
        cardState.boardBonusConsumedByCell = {};
        cardState.theoryNumberCellByCell = {};
        cardState.presentationEvents = [];
        cardState._presentationEventsPersist = [];
        if (boardUtils && typeof boardUtils.attachBoardShape === 'function') {
          boardUtils.attachBoardShape(gameState.board, {
            boardConfig: gameState.boardConfig,
            boardExpansion: gameState.boardExpansion,
            cardState
          });
        }
        root.gameState = gameState;
        root.cardState = cardState;
        if (typeof root.renderBoard !== 'function') throw new Error('public renderBoard path is unavailable');
        await withTimeout(Promise.resolve(root.renderBoard()), 'fixture render');
        await waitIdle();
        if ((document as any).fonts?.ready) {
          await withTimeout((document as any).fonts.ready, 'font readiness');
        }
        // Topology changes can resize the DOM compatibility board after its
        // first committed frame. Let ResizeObserver/layout state settle, then
        // submit the same canonical fixture once more so the sample baseline
        // and the post-playback sync use the same camera geometry.
        await nextFrame();
        await nextFrame();
        await delay(160, 'fixture layout settlement');
        await withTimeout(Promise.resolve(root.renderBoard()), 'settled fixture render');
        await waitIdle();
      };
      const centerBaseViewport = async () => {
        const viewportElement = document.getElementById('board-scroll-viewport') as HTMLElement | null;
        const anchor = debug.getCellClientRect?.(3, 3);
        if (!viewportElement || !anchor) return;
        const boardBounds = viewportElement.getBoundingClientRect();
        viewportElement.scrollLeft += center(anchor).x - (boardBounds.left + boardBounds.width / 2);
        viewportElement.scrollTop += center(anchor).y - (boardBounds.top + boardBounds.height / 2);
        viewportElement.dispatchEvent(new Event('scroll', { bubbles: true }));
        await nextFrame();
        await nextFrame();
        await delay(160, 'camera scroll settlement');
        // Camera scrolling is backend-local until a public frame submission
        // captures the live camera in the controller checkpoint.
        await withTimeout(Promise.resolve(root.renderBoard()), 'camera checkpoint render');
        await waitIdle();
      };

      const makeEvent = (definition: any, scenario: any, serial: number) => {
        const target = {
          r: scenario.target.row,
          col: scenario.target.col,
          sourceRow: scenario.source.row,
          sourceCol: scenario.source.col,
          ownerBefore: 'white',
          ownerAfter: 'black',
          projectileOwner: 'black',
          cause: definition.cause,
          reason: definition.reason,
          meta: {
            sourceRow: scenario.source.row,
            sourceCol: scenario.source.col,
            projectileOwner: 'black'
          }
        };
        return Object.freeze({
          type: definition.eventType,
          phase: 2,
          actionId: `trajectory-browser-${serial}`,
          effectBlockId: `trajectory-browser-${serial}-${definition.profileKey}`,
          presentationBatchId: `trajectory-browser-batch-${serial}`,
          targets: Object.freeze([Object.freeze(target)])
        });
      };

      let serial = 0;
      const runSample = async (
        definition: any,
        scenario: any,
        runOptions: Readonly<{ abortActive?: boolean }> = {}
      ) => {
        serial += 1;
        let phasePromise: Promise<unknown> | null = null;
        let sampleError: any = null;
        const controller = renderer.getBoardVisualController();
        const scrollViewportElement = document.getElementById('board-scroll-viewport') as HTMLElement | null;
        const viewportElement = scrollViewportElement
          || document.getElementById('board') as HTMLElement | null;
        const beforeScroll = {
          left: scrollViewportElement ? number(scrollViewportElement.scrollLeft) : number(window.scrollX),
          top: scrollViewportElement ? number(scrollViewportElement.scrollTop) : number(window.scrollY)
        };
        if (scenario.scrollByCells && viewportElement) {
          const anchor = debug.getCellClientRect?.(3, 3);
          const cellSize = number(anchor?.width) || 1;
          if (scrollViewportElement) {
            scrollViewportElement.scrollLeft += number(scenario.scrollByCells.left) * cellSize;
            scrollViewportElement.scrollTop += number(scenario.scrollByCells.top) * cellSize;
            scrollViewportElement.dispatchEvent(new Event('scroll', { bubbles: true }));
          } else {
            // Forced DOM compatibility has no private board scroll surface.
            // Exercise its board clip after a real page scroll instead.
            document.body.style.minHeight = `${Math.max(document.body.scrollHeight, window.innerHeight + cellSize * 4)}px`;
            window.scrollBy({
              left: number(scenario.scrollByCells.left) * cellSize,
              top: number(scenario.scrollByCells.top) * cellSize,
              behavior: 'instant' as ScrollBehavior
            });
          }
          await nextFrame();
          await nextFrame();
          await delay(160, 'sample scroll settlement');
          await withTimeout(Promise.resolve(root.renderBoard()), 'sample scroll checkpoint render');
          await waitIdle();
        }
        const afterScroll = {
          left: scrollViewportElement ? number(scrollViewportElement.scrollLeft) : number(window.scrollX),
          top: scrollViewportElement ? number(scrollViewportElement.scrollTop) : number(window.scrollY)
        };
        const sourceRect = debug.getCellClientRect?.(scenario.source.row, scenario.source.col);
        const targetRect = debug.getCellClientRect?.(scenario.target.row, scenario.target.col);
        if (!sourceRect || !targetRect || !viewportElement) {
          throw new Error(`fixture geometry is unavailable for ${scenario.fixture}`);
        }
        const boardViewport = rect(viewportElement.getBoundingClientRect());
        const cellSize = Math.max(1, number(sourceRect.width), number(targetRect.width));
        const paintedHaloOwner = {
          left: boardViewport.left - cellSize * 2,
          top: boardViewport.top - cellSize * 2,
          right: boardViewport.right + cellSize * 2,
          bottom: boardViewport.bottom + cellSize * 2,
          width: boardViewport.width + cellSize * 4,
          height: boardViewport.height + cellSize * 4
        };
        const startCoordinate = definition.direction === 'source-to-target' ? scenario.source : scenario.target;
        const endCoordinate = definition.direction === 'source-to-target' ? scenario.target : scenario.source;
        const startRect = definition.direction === 'source-to-target' ? sourceRect : targetRect;
        const endRect = definition.direction === 'source-to-target' ? targetRect : sourceRect;
        const movementStartPoint = center(startRect);
        const movementEndPoint = center(endRect);
        const pathIntersectsViewport = segmentIntersects(movementStartPoint, movementEndPoint, boardViewport);
        const clippedLineBounds = clippedSegmentBounds(movementStartPoint, movementEndPoint, boardViewport);
        const expectedClippedPaintedBounds = clippedLineBounds
          ? intersectRects({
            left: clippedLineBounds.left - cellSize,
            top: clippedLineBounds.top - cellSize,
            right: clippedLineBounds.right + cellSize,
            bottom: clippedLineBounds.bottom + cellSize,
            width: clippedLineBounds.width + cellSize * 2,
            height: clippedLineBounds.height + cellSize * 2
          }, paintedHaloOwner)
          : null;
        const event = makeEvent(definition, scenario, serial);
        const events = Object.freeze([event]);
        const canonicalEventsBefore = stableJson(events);
        const diagnosticEntriesBefore = Array.from(debug.getDiagnosticEntries?.() || []);
        const diagnosticCursor = diagnosticEntriesBefore.reduce((maximum: number, entry: any) => (
          Math.max(maximum, Number(entry?.index) + 1 || 0)
        ), 0);
        const beforeResources = readResources();
        const beforeCounters = profileCounters(definition.profileKey);
        let initialVisualDigest = '';
        const soundEngine = root.SoundEngine;
        const originalSound = soundEngine && typeof soundEngine.playEffectByKey === 'function'
          ? soundEngine.playEffectByKey
          : null;
        let soundCallCount = 0;
        if (originalSound) {
          soundEngine.playEffectByKey = function (...args: any[]) {
            soundCallCount += 1;
            return originalSound.apply(this, args);
          };
        }
        const logBefore = document.querySelectorAll('#log .logEntry, #log .log-entry').length;
        let frameCount = 0;
        let activeAbortTriggered = false;
        let activeObjectObserved = false;
        let maxTrajectoryOverlayNodeCount = 0;
        let clipInstalled = input.backend === 'pixi';
        let paintedBoundsUnion: any = null;
        const identity = `${definition.profileKey}:${scenario.source.row},${scenario.source.col}->${scenario.target.row},${scenario.target.col}`;
        const expectedTrace = [
          `trajectory:start:${identity}`,
          `impact:start:${scenario.target.row},${scenario.target.col}`,
          `trajectory:settle:${identity}`,
          `target:commit:${scenario.target.row},${scenario.target.col}`
        ];
        const startedAt = performance.now();
        try {
          await waitIdle();
          initialVisualDigest = stableJson(debug.getVisualFrameDigest?.());
          // AnimationEngine owns writer claim/phase playback/frame commit. The
          // browser gate must exercise the same public path as a real turn.
          phasePromise = Promise.resolve(engine.play(events));
          let settled = false;
          phasePromise.finally(() => { settled = true; }).catch(() => { /* primary await below */ });
          const frameDeadline = performance.now() + input.timeoutMs;
          while (!settled && frameCount < 180 && performance.now() < frameDeadline) {
            await nextFrame();
            frameCount += 1;
            if (runOptions.abortActive === true && !activeAbortTriggered) {
              const activeEntries = Array.from(debug.getDiagnosticEntries?.() || []);
              const hasActualStart = activeEntries.some((entry: any) => (
                Number(entry?.index) >= diagnosticCursor
                && /^(pixi|dom)-source-trajectory:start$/.test(String(entry?.event || ''))
                && String(entry?.detail?.profileKey || '') === definition.profileKey
              ));
              if (hasActualStart) {
                engine.abortAndSync();
                activeAbortTriggered = true;
              }
            }
            const activeResources = readResources();
            const overlays = Array.from(document.querySelectorAll(overlaySelector)) as HTMLElement[];
            maxTrajectoryOverlayNodeCount = Math.max(maxTrajectoryOverlayNodeCount, overlays.length);
            if (input.backend === 'pixi') {
              activeObjectObserved = activeObjectObserved || activeResources.activeSourceTrajectoryCount > 0;
            } else if (overlays.length > 0) {
              activeObjectObserved = true;
              const layer = overlays.find((element) => element.matches('[data-board-source-trajectory-layer="true"], .dom-board-source-trajectory-layer'));
              if (layer) {
                const style = getComputedStyle(layer);
                clipInstalled = clipInstalled || (style.overflow === 'hidden' && style.clipPath !== 'none');
              }
              for (const element of overlays) {
                if (element.children.length) continue;
                paintedBoundsUnion = unionRects(
                  paintedBoundsUnion,
                  intersectRects(rect(element.getBoundingClientRect()), boardViewport)
                );
              }
            }
          }
          if (!settled && performance.now() >= frameDeadline) {
            throw new Error(`trajectory playback sampling timed out after ${input.timeoutMs}ms`);
          }
          if (activeAbortTriggered) {
            await withTimeout(Promise.allSettled([phasePromise]), 'aborted trajectory settlement');
          } else {
            await withTimeout(phasePromise, 'source trajectory playback settlement');
          }
          await waitIdle();
        } catch (error) {
          sampleError = error;
        } finally {
          if (originalSound) soundEngine.playEffectByKey = originalSound;
        }
        const elapsedMs = performance.now() - startedAt;
        const afterResources = readResources();
        const afterCounters = profileCounters(definition.profileKey);
        let finalVisualDigest = stableJson(debug.getVisualFrameDigest?.());
        if (!sampleError && finalVisualDigest !== initialVisualDigest) {
          // Playback finalization requests the canonical board sync after the
          // phase promise settles. DOM compatibility can observe that request
          // on the following frame, especially immediately after a topology
          // shrink, so wait for the public sync instead of sampling the
          // transient projected frame as the final digest.
          const digestDeadline = performance.now() + Math.min(1000, input.timeoutMs);
          while (finalVisualDigest !== initialVisualDigest && performance.now() < digestDeadline) {
            await nextFrame();
            await waitIdle();
            finalVisualDigest = stableJson(debug.getVisualFrameDigest?.());
          }
        }
        const diagnosticEntries = Array.from(debug.getDiagnosticEntries?.() || []).filter((entry: any) => (
          Number(entry?.index) >= diagnosticCursor
        ));
        const sourceStart = diagnosticEntries.find((entry: any) => (
          /^(pixi|dom)-source-trajectory:start$/.test(String(entry?.event || ''))
          && String(entry?.detail?.profileKey || '') === definition.profileKey
        )) as any;
        const trajectoryId = String(sourceStart?.detail?.trajectoryId || '');
        const sourceSettle = diagnosticEntries.find((entry: any) => (
          /^(pixi|dom)-source-trajectory:settle$/.test(String(entry?.event || ''))
          && String(entry?.detail?.trajectoryId || '') === trajectoryId
        )) as any;
        const actualSource = {
          row: number(sourceStart?.detail?.source?.row),
          col: number(sourceStart?.detail?.source?.col)
        };
        const actualTarget = {
          row: number(sourceStart?.detail?.target?.row),
          col: number(sourceStart?.detail?.target?.col)
        };
        const actualIdentity = `${definition.profileKey}:${actualSource.row},${actualSource.col}->${actualTarget.row},${actualTarget.col}`;
        const relevantEntries = diagnosticEntries.filter((entry: any) => {
          const eventName = String(entry?.event || '');
          if (/^(pixi|dom)-source-trajectory:start$/.test(eventName)) return entry === sourceStart;
          if (/^(pixi|dom)-source-trajectory:settle$/.test(eventName)) return entry === sourceSettle;
          if (/^(pixi|dom)-playback:target-(impact-start|commit)$/.test(eventName)) {
            return !entry?.detail?.profileKey
              || String(entry.detail.profileKey) === definition.profileKey;
          }
          return false;
        }).sort((left: any, right: any) => number(left?.index) - number(right?.index));
        const trace = relevantEntries.map((entry: any) => {
          const eventName = String(entry?.event || '');
          if (eventName.endsWith('source-trajectory:start')) return `trajectory:start:${actualIdentity}`;
          if (eventName.endsWith('source-trajectory:settle')) return `trajectory:settle:${actualIdentity}`;
          if (eventName.endsWith('target-impact-start')) {
            return `impact:start:${number(entry?.detail?.row)},${number(entry?.detail?.col)}`;
          }
          return `target:commit:${number(entry?.detail?.row)},${number(entry?.detail?.col)}`;
        });
        const actualDirection = sourceStart?.detail?.direction === 'target-to-source'
          ? 'target-to-source'
          : 'source-to-target';
        const actualGeometry = sourceStart?.detail?.geometry || null;
        const sourceCenterActual = diagnosticPoint(actualGeometry?.sourceCenter);
        const targetCenterActual = diagnosticPoint(actualGeometry?.targetCenter);
        const movementStartPointActual = diagnosticPoint(actualGeometry?.movementStart);
        const movementEndPointActual = diagnosticPoint(actualGeometry?.movementEnd);
        const visibleClipActual = diagnosticRect(actualGeometry?.visibleClip);
        const visibleSegmentActual = actualGeometry?.visibleSegment
          && diagnosticPoint(actualGeometry.visibleSegment.start)
          && diagnosticPoint(actualGeometry.visibleSegment.end)
          ? {
            start: diagnosticPoint(actualGeometry.visibleSegment.start),
            end: diagnosticPoint(actualGeometry.visibleSegment.end)
          }
          : null;
        const actualPathIntersectsViewport = typeof actualGeometry?.pathIntersectsViewport === 'boolean'
          ? actualGeometry.pathIntersectsViewport
          : !!visibleSegmentActual;
        const actualMovementStart = actualDirection === 'source-to-target' ? actualSource : actualTarget;
        const actualMovementEnd = actualDirection === 'source-to-target' ? actualTarget : actualSource;
        const payload = (event as any).targets[0];
        const payloadSourceAfter = { row: number(payload.sourceRow), col: number(payload.sourceCol) };
        const payloadTargetAfter = { row: number(payload.r), col: number(payload.col) };
        const distance = Math.hypot(
          center(sourceRect).x - center(targetRect).x,
          center(sourceRect).y - center(targetRect).y
        );
        const animationDuration = Math.max(
          definition.minMs,
          Math.min(definition.maxMs, Math.round(definition.baseMs + distance * definition.distanceFactor))
        );
        const expectedDurationMs = animationDuration + (definition.fixedDeadline ? definition.deadlinePaddingMs : 0);
        const resolution = Math.min(2, number(window.devicePixelRatio) || 1);
        const backingMaxWidth = Math.ceil((boardViewport.width + cellSize * 4) * resolution) + 4;
        const backingMaxHeight = Math.ceil((boardViewport.height + cellSize * 4) * resolution) + 4;
        return {
          profileKey: definition.profileKey,
          primitive: definition.primitive,
          fixture: scenario.fixture,
          lane: input.lane,
          engine: input.engine,
          viewport: input.viewport,
          dpr: input.dpr,
          direction: actualDirection,
          logicalSource: scenario.source,
          logicalTarget: scenario.target,
          movementStart: actualMovementStart,
          movementEnd: actualMovementEnd,
          sourceCenter: sourceCenterActual,
          targetCenter: targetCenterActual,
          movementStartPoint: movementStartPointActual,
          movementEndPoint: movementEndPointActual,
          geometryVisibleClip: visibleClipActual,
          geometryVisibleSegment: visibleSegmentActual,
          geometryObserved: !!sourceStart && !!actualGeometry,
          payloadSourceAfter,
          payloadTargetAfter,
          endpointRetargeted: actualSource.row !== scenario.source.row
            || actualSource.col !== scenario.source.col
            || actualTarget.row !== scenario.target.row
            || actualTarget.col !== scenario.target.col
            || payloadSourceAfter.row !== scenario.source.row
            || payloadSourceAfter.col !== scenario.source.col
            || payloadTargetAfter.row !== scenario.target.row
            || payloadTargetAfter.col !== scenario.target.col,
          boardViewport: visibleClipActual || boardViewport,
          paintedHaloOwner: diagnosticRect(actualGeometry?.paintedHaloClip) || paintedHaloOwner,
          // Never substitute expected geometry for observed pixels. Missing
          // paint must fail closed in the evaluator.
          paintedBoundsUnion,
          expectedClippedPaintedBounds,
          pathIntersectsViewport: actualPathIntersectsViewport,
          // The independent expectation comes from actual endpoint geometry
          // and the active backend viewport. A fixed logical row/column is not
          // necessarily offscreen: DOM compatibility may fit the whole sparse
          // topology while Pixi materializes a smaller camera window.
          expectedPathIntersectsViewport: pathIntersectsViewport,
          scrolled: beforeScroll.left !== afterScroll.left || beforeScroll.top !== afterScroll.top,
          scrollBefore: beforeScroll,
          scrollAfter: afterScroll,
          frameCount: Math.max(1, frameCount),
          elapsedMs,
          expectedDurationMs,
          canonicalEventsBefore,
          canonicalEventsAfter: stableJson(events),
          semanticTrajectoryTrace: trace,
          expectedSemanticTrajectoryTrace: expectedTrace,
          trajectoryStartedDelta: sourceStart ? 1 : 0,
          trajectoryCompletedDelta: sourceSettle?.detail?.status === 'completed' ? 1 : 0,
          trajectoryFailedDelta: sourceSettle?.detail?.status === 'failed' ? 1 : 0,
          offscreenNoObjectDelta: sourceStart?.detail?.noObjectReason ? 1 : (
            afterCounters.offscreenNoObject - beforeCounters.offscreenNoObject
          ),
          activeObjectObserved,
          maxTrajectoryOverlayNodeCount,
          clipInstalled,
          backingWithinLimit: input.backend === 'dom' || (
            afterResources.canvasBackingWidth <= backingMaxWidth
            && afterResources.canvasBackingHeight <= backingMaxHeight
          ),
          materializationStable: beforeResources.activeViewCount === afterResources.activeViewCount
            && beforeResources.ephemeralVoidCount === afterResources.ephemeralVoidCount,
          resourcesBefore: beforeResources,
          resourcesAfter: afterResources,
          initialVisualDigest,
          finalVisualDigest,
          soundCallCount,
          logEntryDelta: document.querySelectorAll('#log .logEntry, #log .log-entry').length - logBefore,
          remainingOverlayNodeCount: document.querySelectorAll(overlaySelector).length,
          activeAbortTriggered,
          error: sampleError ? String(sampleError.message || sampleError) : null
        };
      };

      const normalFixture = {
        rows: 8,
        cols: 8,
        shape: 'rectangle',
        expansionCells: [],
        baseStones: [
          { row: 1, col: 1, owner: 1 }, { row: 1, col: 2, owner: -1 },
          { row: 2, col: 2, owner: 1 }, { row: 3, col: 3, owner: 1 },
          { row: 3, col: 4, owner: -1 }, { row: 4, col: 4, owner: 1 },
          { row: 5, col: 5, owner: -1 }, { row: 6, col: 6, owner: -1 }
        ]
      };
      const expandedFixture = {
        rows: 8,
        cols: 8,
        shape: 'rectangle',
        expansionCells: [
          { row: -6, col: 3, side: 'top', owner: 1 },
          { row: -5, col: 4, side: 'top', owner: -1 },
          { row: 3, col: -6, side: 'left', owner: 1 },
          { row: 4, col: -5, side: 'left', owner: -1 },
          { row: 3, col: 12, side: 'right', owner: 1 },
          { row: 4, col: 13, side: 'right', owner: -1 },
          { row: 12, col: 3, side: 'bottom', owner: 1 },
          { row: 13, col: 4, side: 'bottom', owner: -1 }
        ],
        baseStones: normalFixture.baseStones
      };
      const shrunkFixture = {
        rows: 6,
        cols: 6,
        shape: 'rectangle',
        expansionCells: [],
        baseStones: [
          { row: 1, col: 1, owner: 1 }, { row: 4, col: 4, owner: -1 }
        ]
      };

      const samples: any[] = [];
      await applyFixture(normalFixture);
      const normalScenario = {
        fixture: 'normal', source: { row: 2, col: 2 }, target: { row: 5, col: 5 },
        expectedPathIntersectsViewport: true
      };
      for (const definition of input.definitions) samples.push(await runSample(definition, normalScenario));

      await applyFixture(expandedFixture);
      await centerBaseViewport();
      const expandedScenario = {
        fixture: 'scrolled-expanded', source: { row: 3, col: -6 }, target: { row: 4, col: 13 },
        expectedPathIntersectsViewport: true, scrollByCells: { left: 1, top: 1 }
      };
      for (const definition of input.definitions) {
        await centerBaseViewport();
        samples.push(await runSample(definition, expandedScenario));
      }

      await centerBaseViewport();
      const geometryDefinition = input.definitions.find((definition: any) => definition.profileKey === 'sniperShot');
      const geometryScenarios = [
        {
          fixture: 'source-offscreen-target-onscreen', source: { row: 3, col: -6 }, target: { row: 3, col: 3 },
          expectedPathIntersectsViewport: true
        },
        {
          fixture: 'source-onscreen-target-offscreen', source: { row: 4, col: 4 }, target: { row: 4, col: 13 },
          expectedPathIntersectsViewport: true
        },
        {
          fixture: 'offscreen-path-crossing', source: { row: 3, col: -6 }, target: { row: 4, col: 13 },
          expectedPathIntersectsViewport: true
        },
        {
          fixture: 'fully-offscreen-nonintersecting', source: { row: -6, col: 3 }, target: { row: -5, col: 4 },
          expectedPathIntersectsViewport: false
        },
        {
          fixture: 'negative-coordinate', source: { row: -6, col: 3 }, target: { row: 3, col: 3 },
          expectedPathIntersectsViewport: true
        }
      ];
      for (const scenario of geometryScenarios) {
        await centerBaseViewport();
        samples.push(await runSample(geometryDefinition, scenario));
      }

      await applyFixture(shrunkFixture);
      samples.push(await runSample(geometryDefinition, {
        fixture: 'shrunk', source: { row: 1, col: 1 }, target: { row: 4, col: 4 },
        expectedPathIntersectsViewport: true
      }));

      let lifecycle: any = null;
      if (input.runLifecycleStress) {
        try {
          await applyFixture(normalFixture);
          const lifecycleMetrics: any[] = [];
          const lifecycleScenario = {
            fixture: 'lifecycle', source: { row: 3, col: 3 }, target: { row: 3, col: 4 },
            expectedPathIntersectsViewport: true
          };
          let activeAbortSettled = false;
          let abortSnapshot: any = null;
          for (let iteration = 0; iteration < 50; iteration += 1) {
            const abortActive = iteration === 49;
            const result = await runSample(geometryDefinition, lifecycleScenario, { abortActive });
            if (result.error) throw new Error(result.error);
            lifecycleMetrics.push(result.resourcesAfter);
            if (abortActive) {
              abortSnapshot = { ...result.resourcesAfter };
              activeAbortSettled = result.activeAbortTriggered === true
                && number(abortSnapshot.activeSourceTrajectoryCount) === 0
                && number(abortSnapshot.activeSourceTrajectoryTextureLeaseCount) === 0
                && abortSnapshot.tickerRunning !== true
                && abortSnapshot.timelineTickerRunning !== true
                && abortSnapshot.timelineTickerSubscribed !== true;
            }
          }
          let resetSnapshot: any = null;
          let resetApplied = false;
          if (typeof renderer.resetBoardVisualRenderSession === 'function') {
            renderer.resetBoardVisualRenderSession();
            await withTimeout(Promise.resolve(root.renderBoard()), 'post-abort reset render');
            await waitIdle();
            resetSnapshot = { ...readResources() };
            resetApplied = true;
          }
          const stoneSkin = resolveModule('StoneSkinRuntimeModule', 'ui/stone-skin/runtime');
          let skinSwitchSettled = false;
          let skinSnapshot: any = null;
          if (stoneSkin && typeof stoneSkin.applyStoneSkin === 'function') {
            stoneSkin.applyStoneSkin(root, 'jade-rim');
            await withTimeout(Promise.resolve(root.renderBoard()), 'jade-rim skin render');
            await waitIdle();
            stoneSkin.applyStoneSkin(root, 'o-stone');
            await withTimeout(Promise.resolve(root.renderBoard()), 'o-stone skin render');
            await waitIdle();
            skinSnapshot = { ...readResources() };
            skinSwitchSettled = true;
          }
          const controller = renderer.getBoardVisualController();
          const checkpoint = controller?.getSettledFrame?.();
          let sameModelApplySettled = false;
          let sameModelSnapshot: any = null;
          if (checkpoint && typeof controller.submitFrame === 'function') {
            const frame = Object.freeze({ ...checkpoint, frameToken: `${checkpoint.frameToken}:trajectory-same-model` });
            sameModelApplySettled = controller.submitFrame(frame) === true;
            await waitIdle();
            sameModelApplySettled = sameModelApplySettled
              && controller.getSettledFrame?.()?.frameToken === frame.frameToken;
            sameModelSnapshot = { ...readResources() };
          }
          const steady = lifecycleMetrics.slice(5);
          const grows = (read: (entry: any) => number) => steady.length > 1
            && steady.slice(1).some((entry) => read(entry) > read(steady[0]));
          lifecycle = {
            iterations: 50,
            activeLeak: lifecycleMetrics.some((entry) => number(entry.activeSourceTrajectoryCount) !== 0),
            textureLeaseLeak: lifecycleMetrics.some((entry) => number(entry.activeSourceTrajectoryTextureLeaseCount) !== 0),
            overlayLeak: document.querySelectorAll(overlaySelector).length !== 0,
            createdViewGrowthAfterWarmup: input.backend === 'pixi'
              && grows((entry) => number(entry.createdSourceTrajectoryViewCount)),
            textureLeaseGrowthAfterWarmup: grows((entry) => number(entry.textureLeaseCount)),
            backingGrowthAfterWarmup: grows((entry) => number(entry.canvasBackingWidth))
              || grows((entry) => number(entry.canvasBackingHeight)),
            tickerLeak: lifecycleMetrics.some((entry) => entry.tickerRunning === true
              || entry.timelineTickerRunning === true || entry.timelineTickerSubscribed === true),
            resetApplied,
            sameModelApplySettled,
            skinSwitchSettled,
            activeAbortSettled,
            resourceSnapshots: lifecycleMetrics.map((entry) => ({ ...entry })),
            operationSnapshots: {
              abort: abortSnapshot,
              reset: resetSnapshot,
              skin: skinSnapshot,
              sameModel: sameModelSnapshot
            },
            error: null
          };
        } catch (error) {
          lifecycle = {
            iterations: 50,
            activeLeak: true,
            textureLeaseLeak: true,
            overlayLeak: document.querySelectorAll(overlaySelector).length !== 0,
            createdViewGrowthAfterWarmup: true,
            textureLeaseGrowthAfterWarmup: true,
            backingGrowthAfterWarmup: true,
            tickerLeak: true,
            resetApplied: false,
            sameModelApplySettled: false,
            skinSwitchSettled: false,
            activeAbortSettled: false,
            resourceSnapshots: [],
            operationSnapshots: { abort: null, reset: null, skin: null, sameModel: null },
            error: String((error as any)?.message || error)
          };
        }
      }
      return { samples, lifecycle };
    }, {
      backend,
      lane,
      engine,
      viewport: viewport.name,
      dpr: viewport.dpr,
      definitions: PROFILE_DEFINITIONS,
      runLifecycleStress,
      timeoutMs: 12000
    })
  });
  const result = smoke.afterReadyResult && typeof smoke.afterReadyResult === 'object'
    ? smoke.afterReadyResult as any
    : {};
  return Object.freeze({
    lane,
    engine,
    viewport: viewport.name,
    dpr: viewport.dpr,
    smokeOk: smoke.evaluation.ok,
    smokeErrors: Object.freeze(smoke.evaluation.errors.slice()),
    samples: Object.freeze(Array.isArray(result.samples) ? result.samples.slice() : []),
    lifecycle: result.lifecycle || null
  });
}

export async function runBoardSourceTrajectoryBrowserCheck(options?: {
  readonly rootDir?: string;
  readonly backend?: BoardSourceTrajectoryBrowserBackend;
  readonly baseline?: boolean;
  readonly engine?: BoardSourceTrajectoryBrowserEngine;
  readonly engines?: readonly BoardSourceTrajectoryBrowserEngine[];
  readonly lanes?: readonly BoardSourceTrajectoryBrowserLane[];
}): Promise<Readonly<{
  report: BoardSourceTrajectoryBrowserReport;
  evaluation: BoardSourceTrajectoryBrowserEvaluation;
}>> {
  const rootDir = options?.rootDir || process.cwd();
  const backend = options?.backend || 'pixi';
  const engines = options?.engine
    ? Object.freeze([options.engine])
    : options?.engines?.length
      ? Object.freeze(Array.from(options.engines))
      : BOARD_SOURCE_TRAJECTORY_BROWSER_ENGINES;
  const lanes = options?.lanes?.length ? options.lanes : BOARD_SOURCE_TRAJECTORY_BROWSER_LANES;
  const captures = [];
  let lifecycleAssigned = false;
  for (const engine of engines) {
    for (const lane of lanes) {
      for (const viewport of BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS) {
        const runLifecycleStress = !lifecycleAssigned;
        captures.push(await captureViewport(rootDir, backend, lane, engine, viewport, runLifecycleStress));
        lifecycleAssigned = true;
      }
    }
  }
  const report: BoardSourceTrajectoryBrowserReport = Object.freeze({
    backend,
    baseline: options?.baseline === true,
    engine: engines.length === 1 ? engines[0] : 'aggregate',
    requiredEngines: engines,
    selectedEngines: engines,
    requiredLanes: Object.freeze(Array.from(lanes)),
    captures: Object.freeze(captures)
  });
  return Object.freeze({ report, evaluation: evaluateBoardSourceTrajectoryBrowserReport(report) });
}

if (require.main === module) {
  const backend = backendFromArgs(process.argv.slice(2));
  const engines = enginesFromArgs(process.argv.slice(2));
  const lanes = lanesFromArgs(process.argv.slice(2));
  const baseline = process.argv.includes('--baseline');
  const summaryOnly = process.argv.includes('--summary');
  runBoardSourceTrajectoryBrowserCheck({ backend, engines, lanes, baseline }).then(({ report, evaluation }) => {
    console.log(JSON.stringify(summaryOnly ? {
      backend: report.backend,
      engine: report.engine,
      captures: report.captures.length,
      samples: report.captures.reduce((sum, capture) => sum + capture.samples.length, 0),
      lifecycleIterations: report.captures.reduce((maximum, capture) => (
        Math.max(maximum, capture.lifecycle?.iterations || 0)
      ), 0),
      evaluation
    } : { report, evaluation }, null, 2));
    if (!evaluation.ok) process.exitCode = 1;
  }).catch((error) => {
    console.error(`[board-source-trajectory-browser-check] failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
