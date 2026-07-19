import * as fs from 'fs';
import * as path from 'path';
import {
  BOARD_SOURCE_TRAJECTORY_BROWSER_LANES,
  BOARD_SOURCE_TRAJECTORY_BROWSER_ENGINES,
  BOARD_SOURCE_TRAJECTORY_BROWSER_PROFILE_KEYS,
  BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS,
  evaluateBoardSourceTrajectoryBrowserReport,
  type BoardSourceTrajectoryBrowserBackend,
  type BoardSourceTrajectoryBrowserReport,
  type BoardSourceTrajectoryBrowserSample,
  type BoardSourceTrajectoryResourceSnapshot
} from '../scripts/board-source-trajectory-browser-check';

const boardViewport = Object.freeze({
  left: 100, top: 100, right: 500, bottom: 500, width: 400, height: 400
});
const paintedHaloOwner = Object.freeze({
  left: 0, top: 0, right: 600, bottom: 600, width: 600, height: 600
});
const visiblePaint = Object.freeze({
  left: 120, top: 120, right: 480, bottom: 480, width: 360, height: 360
});

function resources(backend: BoardSourceTrajectoryBrowserBackend): BoardSourceTrajectoryResourceSnapshot {
  return Object.freeze({
    canvasCount: backend === 'pixi' ? 1 : 0,
    contextCount: backend === 'pixi' ? 1 : 0,
    domCellCount: backend === 'dom' ? 64 : 0,
    activeViewCount: backend === 'pixi' ? 64 : 64,
    ephemeralVoidCount: 0,
    activeSourceTrajectoryCount: 0,
    activeSourceTrajectoryTextureLeaseCount: 0,
    createdSourceTrajectoryViewCount: backend === 'pixi' ? 1 : 0,
    pooledSourceTrajectoryCount: backend === 'pixi' ? 1 : 0,
    textureLeaseCount: backend === 'pixi' ? 3 : 0,
    canvasBackingWidth: backend === 'pixi' ? 1200 : 0,
    canvasBackingHeight: backend === 'pixi' ? 1200 : 0,
    tickerRunning: false,
    timelineTickerRunning: false,
    timelineTickerSubscribed: false
  });
}

function sample(
  backend: BoardSourceTrajectoryBrowserBackend,
  profileKey: string,
  fixture: string,
  overrides: Partial<BoardSourceTrajectoryBrowserSample> = {}
): BoardSourceTrajectoryBrowserSample {
  const direction = profileKey === 'robotVacuumSuck' ? 'target-to-source' : 'source-to-target';
  const logicalSource = Object.freeze({ row: 1, col: 1 });
  const logicalTarget = Object.freeze({ row: 6, col: 6 });
  const sourceCenter = Object.freeze({ x: 150, y: 150 });
  const targetCenter = Object.freeze({ x: 450, y: 450 });
  const intersects = fixture !== 'fully-offscreen-nonintersecting';
  const identity = `${profileKey}:1,1->6,6`;
  const trace = Object.freeze([
    `trajectory:start:${identity}`,
    'impact:start:6,6',
    `trajectory:settle:${identity}`,
    'target:commit:6,6'
  ]);
  const resourceSnapshot = resources(backend);
  return Object.freeze({
    profileKey,
    primitive: profileKey === 'zombieBite' ? 'bite' : 'beam',
    fixture,
    lane: 'classic',
    engine: 'chromium',
    viewport: 'fixture',
    dpr: 1,
    direction,
    logicalSource,
    logicalTarget,
    movementStart: direction === 'source-to-target' ? logicalSource : logicalTarget,
    movementEnd: direction === 'source-to-target' ? logicalTarget : logicalSource,
    sourceCenter,
    targetCenter,
    movementStartPoint: direction === 'source-to-target' ? sourceCenter : targetCenter,
    movementEndPoint: direction === 'source-to-target' ? targetCenter : sourceCenter,
    geometryVisibleClip: boardViewport,
    geometryVisibleSegment: intersects ? Object.freeze({ start: sourceCenter, end: targetCenter }) : null,
    geometryObserved: true,
    payloadSourceAfter: logicalSource,
    payloadTargetAfter: logicalTarget,
    endpointRetargeted: false,
    boardViewport,
    paintedHaloOwner,
    paintedBoundsUnion: backend === 'dom' && intersects ? visiblePaint : null,
    expectedClippedPaintedBounds: intersects ? visiblePaint : null,
    pathIntersectsViewport: intersects,
    expectedPathIntersectsViewport: intersects,
    scrolled: fixture === 'scrolled-expanded',
    scrollBefore: Object.freeze({ left: 0, top: 0 }),
    scrollAfter: Object.freeze({
      left: fixture === 'scrolled-expanded' ? 40 : 0,
      top: fixture === 'scrolled-expanded' ? 40 : 0
    }),
    frameCount: 12,
    elapsedMs: 300,
    expectedDurationMs: 400,
    canonicalEventsBefore: '{"type":"destroy"}',
    canonicalEventsAfter: '{"type":"destroy"}',
    semanticTrajectoryTrace: trace,
    expectedSemanticTrajectoryTrace: trace,
    trajectoryStartedDelta: 1,
    trajectoryCompletedDelta: 1,
    trajectoryFailedDelta: 0,
    offscreenNoObjectDelta: backend === 'pixi' && !intersects ? 1 : 0,
    activeObjectObserved: intersects,
    maxTrajectoryOverlayNodeCount: backend === 'dom' && intersects ? 4 : 0,
    clipInstalled: intersects,
    backingWithinLimit: true,
    materializationStable: true,
    resourcesBefore: resourceSnapshot,
    resourcesAfter: resourceSnapshot,
    initialVisualDigest: 'visual-digest',
    finalVisualDigest: 'visual-digest',
    soundCallCount: 0,
    logEntryDelta: 0,
    remainingOverlayNodeCount: 0,
    error: null,
    ...overrides
  });
}

function validReport(backend: BoardSourceTrajectoryBrowserBackend = 'pixi'): BoardSourceTrajectoryBrowserReport {
  let first = true;
  const geometryFixtures = [
    'source-offscreen-target-onscreen',
    'source-onscreen-target-offscreen',
    'offscreen-path-crossing',
    'fully-offscreen-nonintersecting',
    'negative-coordinate',
    'shrunk'
  ];
  return Object.freeze({
    backend,
    baseline: false,
    engine: 'aggregate',
    requiredEngines: BOARD_SOURCE_TRAJECTORY_BROWSER_ENGINES,
    selectedEngines: BOARD_SOURCE_TRAJECTORY_BROWSER_ENGINES,
    requiredLanes: BOARD_SOURCE_TRAJECTORY_BROWSER_LANES,
    captures: Object.freeze(BOARD_SOURCE_TRAJECTORY_BROWSER_ENGINES.flatMap((engine) => (
      BOARD_SOURCE_TRAJECTORY_BROWSER_LANES.flatMap((lane) => (
        BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS.map((viewport) => {
        const includeExtras = first;
        first = false;
        return Object.freeze({
          lane,
          engine,
          viewport: viewport.name,
          dpr: viewport.dpr,
          smokeOk: true,
          smokeErrors: Object.freeze([]),
          samples: Object.freeze([
            ...BOARD_SOURCE_TRAJECTORY_BROWSER_PROFILE_KEYS.flatMap((profileKey) => [
              sample(backend, profileKey, 'normal', { engine, lane, viewport: viewport.name, dpr: viewport.dpr }),
              sample(backend, profileKey, 'scrolled-expanded', { engine, lane, viewport: viewport.name, dpr: viewport.dpr })
            ]),
            ...(includeExtras ? geometryFixtures.map((fixture) => sample(backend, 'sniperShot', fixture, {
              lane,
              engine,
              viewport: viewport.name,
              dpr: viewport.dpr
            })) : [])
          ]),
          lifecycle: includeExtras ? Object.freeze({
            iterations: 50,
            activeLeak: false,
            textureLeaseLeak: false,
            overlayLeak: false,
            createdViewGrowthAfterWarmup: false,
            textureLeaseGrowthAfterWarmup: false,
            backingGrowthAfterWarmup: false,
            tickerLeak: false,
            resetApplied: true,
            sameModelApplySettled: true,
            skinSwitchSettled: true,
            activeAbortSettled: true,
            resourceSnapshots: Object.freeze(Array.from({ length: 50 }, () => resources(backend))),
            operationSnapshots: Object.freeze({
              abort: resources(backend),
              reset: resources(backend),
              skin: resources(backend),
              sameModel: resources(backend)
            }),
            error: null
          }) : null
        });
        })
      ))
    )))
  });
}

describe('board source trajectory browser check evaluator', () => {
  test.each(['pixi', 'dom'] as const)(
    'accepts seven profiles, both lanes/viewports, geometry clipping, and lifecycle cleanup for %s',
    (backend) => {
      expect(evaluateBoardSourceTrajectoryBrowserReport(validReport(backend))).toEqual({
        ok: true,
        errors: []
      });
    }
  );

  test('fails closed for wrong-target records, reversed diagnostic geometry, and invisible Pixi effects', () => {
    const report = validReport('pixi');
    const captures = report.captures.map((capture, captureIndex) => Object.freeze({
      ...capture,
      samples: captureIndex === 0
        ? Object.freeze(capture.samples.map((candidate, sampleIndex) => sampleIndex === 0
          ? Object.freeze({
            ...candidate,
            endpointRetargeted: true,
            semanticTrajectoryTrace: Object.freeze([
              candidate.semanticTrajectoryTrace[0],
              'impact:start:5,5',
              candidate.semanticTrajectoryTrace[2],
              'target:commit:5,5'
            ]),
            movementStartPoint: candidate.movementEndPoint,
            movementEndPoint: candidate.movementStartPoint,
            activeObjectObserved: false,
            maxTrajectoryOverlayNodeCount: 1
          })
          : candidate))
        : capture.samples
    }));
    const evaluation = evaluateBoardSourceTrajectoryBrowserReport(Object.freeze({
      ...report,
      captures: Object.freeze(captures)
    }));
    expect(evaluation.ok).toBe(false);
    expect(evaluation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('logical source/target was retargeted'),
      expect.stringContaining('semantic trajectory order drifted'),
      expect.stringContaining('diagnostic movement geometry reversed or retargeted'),
      expect.stringContaining('never materialized an effect object'),
      expect.stringContaining('DOM/SVG trajectory overlay')
    ]));
  });

  test('fails closed for missing offscreen coverage and resource growth', () => {
    const report = validReport('dom');
    const captures = report.captures.map((capture, captureIndex) => Object.freeze({
      ...capture,
      samples: captureIndex === 0
        ? Object.freeze(capture.samples.filter((candidate) => candidate.fixture !== 'fully-offscreen-nonintersecting'))
        : capture.samples,
      lifecycle: capture.lifecycle ? Object.freeze({ ...capture.lifecycle, overlayLeak: true }) : null
    }));
    const evaluation = evaluateBoardSourceTrajectoryBrowserReport(Object.freeze({
      ...report,
      captures: Object.freeze(captures)
    }));
    expect(evaluation.ok).toBe(false);
    expect(evaluation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('fully-offscreen-nonintersecting: geometry coverage is missing'),
      expect.stringContaining('resources grew or remained active')
    ]));
  });

  test('uses original destroy/flip events through active backends and never expects synthetic global routes', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'board-source-trajectory-browser-check.ts'),
      'utf8'
    );
    expect(source).toContain('engine.play(events)');
    expect(source).toContain('getDiagnosticEntries');
    expect(source).toContain('sourceStart?.detail?.geometry');
    expect(source).toContain('engine.abortAndSync()');
    expect(source).toContain('expectedPathIntersectsViewport: pathIntersectsViewport');
    expect(source).toContain('finalVisualDigest !== initialVisualDigest');
    expect(source).not.toContain('paintedBoundsUnion || expectedClippedPaintedBounds');
    expect(source).not.toContain('trace.push(');
    expect(source).toContain('/index.classic.html');
    expect(source).toContain('/vite-dist/index.vite.html');
    expect(source).toContain('source-offscreen-target-onscreen');
    expect(source).toContain('fully-offscreen-nonintersecting');
    expect(source).toContain('iteration < 50');
    expect(source).not.toContain('GlobalBoardEffectPresenter');
    expect(source).not.toContain('destroy_source_animation');
    expect(source).not.toContain('zombie_bite_source_animation');
  });

  test('requires the full three-engine lane and viewport aggregate', () => {
    const report = validReport('pixi');
    const chromiumOnly = Object.freeze({
      ...report,
      engine: 'chromium' as const,
      selectedEngines: Object.freeze(['chromium'] as const),
      captures: Object.freeze(report.captures.filter((capture) => capture.engine === 'chromium'))
    });
    const evaluation = evaluateBoardSourceTrajectoryBrowserReport(chromiumOnly);
    expect(evaluation.ok).toBe(false);
    expect(evaluation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('firefox/classic/desktop-dpr1: required aggregate capture is missing'),
      expect.stringContaining('webkit/vite/mobile-dpr2: required aggregate capture is missing')
    ]));
  });

  test('allows an explicitly selected single-engine and single-lane smoke report', () => {
    const report = validReport('pixi');
    const selected = Object.freeze({
      ...report,
      engine: 'chromium' as const,
      requiredEngines: Object.freeze(['chromium'] as const),
      selectedEngines: Object.freeze(['chromium'] as const),
      requiredLanes: Object.freeze(['classic'] as const),
      captures: Object.freeze(report.captures.filter((capture) => (
        capture.engine === 'chromium' && capture.lane === 'classic'
      )))
    });
    expect(evaluateBoardSourceTrajectoryBrowserReport(selected)).toEqual({ ok: true, errors: [] });
  });

  test('fails closed instead of throwing when lifecycle snapshots are absent', () => {
    const report = validReport('dom');
    const captures = report.captures.map((capture) => Object.freeze({
      ...capture,
      lifecycle: capture.lifecycle ? Object.freeze({
        ...capture.lifecycle,
        resourceSnapshots: undefined,
        operationSnapshots: undefined
      }) : null
    }));
    expect(() => evaluateBoardSourceTrajectoryBrowserReport(Object.freeze({
      ...report,
      captures: Object.freeze(captures)
    }) as unknown as BoardSourceTrajectoryBrowserReport)).not.toThrow();
    expect(evaluateBoardSourceTrajectoryBrowserReport(Object.freeze({
      ...report,
      captures: Object.freeze(captures)
    }) as unknown as BoardSourceTrajectoryBrowserReport).ok).toBe(false);
  });
});
