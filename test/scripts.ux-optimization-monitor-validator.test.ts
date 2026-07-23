import {
  UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST,
  UX_OPTIMIZATION_IDS,
  UX_OPTIMIZATION_REPORT_SCHEMA_VERSION,
  UX_OPTIMIZATION_SCENARIO_CAPTURES,
  UX_OPTIMIZATION_SCENARIO_DIGEST,
  UX_OPTIMIZATION_SCENARIOS
} from '../scripts/perf/ux-optimization-monitor-contract';
import {
  findForbiddenReportPaths,
  validateUxOptimizationReport
} from '../scripts/perf/validate-ux-optimization-monitor';

function validReport(): Record<string, any> {
  return {
    schemaVersion: UX_OPTIMIZATION_REPORT_SCHEMA_VERSION,
    profile: 'quick',
    identity: {
      candidateCommit: 'a'.repeat(40),
      dirty: true,
      dirtyPaths: ['M scripts/example.ts'],
      browserArtifactSha256: 'b'.repeat(64),
      fixtureDigest: 'c'.repeat(64),
      scenarioDigest: UX_OPTIMIZATION_SCENARIO_DIGEST,
      capturePolicyDigest: UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST,
      environment: {
        browserVersion: 'Chromium 1',
        os: 'win32',
        viewport: { width: 1366, height: 900 },
        dpr: 1
      }
    },
    pendingOptimizationIds: [],
    scenarios: UX_OPTIMIZATION_SCENARIO_CAPTURES.map((definition) => {
      const firstSpecial = definition.id === 'board.first-special';
      const fallback = definition.id.startsWith('fallback.');
      const lockToggle = definition.id === 'board.lock-toggle';
      const opponentTurn = definition.id === 'playback.opponent-actions';
      const boot = definition.id.startsWith('boot.');
      const help = definition.id.startsWith('help.');
      return {
        id: definition.id,
        lane: definition.lane,
        backend: definition.backend,
        cacheProfile: definition.cacheProfile,
        captureStatus: 'complete',
        phases: [
          { name: 'navigation', atMs: 0 },
          { name: 'feature-ready:fixture', atMs: 2 }
        ],
        resources: firstSpecial || fallback
          ? [
            { path: 'assets/images/special-stones/Time_bomb.png' },
            ...(fallback ? [{ path: 'styles-board-dom-compat.css' }] : [])
          ]
          : [{ path: 'assets/images/ui/example.png' }],
        errors: [],
        metrics: firstSpecial
          ? {
            backend: 'pixi',
            singleWriter: true,
            accepted: true,
            framePreparedBeforeSettlement: true,
            settledSpecialFrame: true,
            neededSpecialAssetIds: ['TIME_BOMB'],
            specialResponseCount: 1
          }
          : fallback
            ? {
              backend: 'dom',
              singleWriter: true,
              fallbackStyled: true,
              specialResponseCount: 1,
              domCompatStylesheetResponseCount: 1,
              domCompatStylesheetLinkCount: 1,
              domCompatStylesheetLoaded: true,
              domCompatStylesheetReadyAt: 4,
              domBackendMountedAt: 5,
              domCompatStylesheetAtSlot: true,
              ...(definition.id === 'fallback.explicit-dom'
                ? {
                  stylesheetFailurePreventedMount: true,
                  stylesheetFailureSurfaced: true,
                  stylesheetFailureUiInitialized: false
                }
                : {}),
              ...(definition.id === 'fallback.context-loss' ? { lossPrevented: true } : {})
            }
            : lockToggle
              ? {
                backend: 'pixi',
                lockAccepted: true,
                unlockAccepted: true,
                lockDelta: {
                  updatedCellViews: 0,
                  updatedStoneViews: 0,
                  updatedHintViews: 64,
                  hintPaintCount: 0,
                  hintInputSyncCount: 64
                },
                unlockDelta: {
                  updatedCellViews: 0,
                  updatedStoneViews: 0,
                  updatedHintViews: 64,
                  hintPaintCount: 0,
                  hintInputSyncCount: 64
                },
                lockedCommandCount: 0,
                unlockCommandCount: 1,
                staleInputStateCount: 0
              }
              : opponentTurn
                ? {
                  backend: 'pixi',
                  settledOpponentTurn: true,
                  longTaskSupported: true,
                  longTaskCount: 0,
                  rafSampleCount: 60,
                  rafP95Ms: 16.7,
                  rafStall50msCount: 0,
                  tickerIdle: true
                }
                : boot
                  ? {
                    imageConstructorAssignments: [],
                    logicalImageSrcMutations: [],
                    initialHelpImageSrcCount: 0,
                    initialHelpImageDimensionsReserved: true,
                    domCompatStylesheetLinkCount: 0,
                    domCompatStylesheetSlotCount: 1
                  }
                  : help
                    ? {
                      backend: 'pixi',
                      uiInitialized: true,
                      initialSrcCount: 0,
                      dimensionsReserved: true,
                      panelOpen: true,
                      guideComplete: true,
                      protectionComplete: true,
                      guideFrameVisible: true,
                      protectionFrameVisible: true,
                      guideDimensions: { width: 1920, height: 1080 },
                      protectionDimensions: { width: 1600, height: 1080 },
                      focusWithinPanel: true,
                      helpRequestsBeforeFirstFrame: 0,
                      helpResourcePathCount: 2,
                      helpEncodedBodyBytes: 325_100,
                      clsDelta: 0,
                      firstOpenLatencyMs: 20,
                      helpResponsePathsAfterOpen: ['guide.png', 'protection.png'],
                      helpResourceEntriesBeforeOpen: definition.id === 'help.after-idle' ? 2 : 0,
                      helpResponsePathsBeforeOpen: definition.id === 'help.after-idle'
                        ? ['guide.png', 'protection.png']
                        : [],
                      pendingIdleCallbackCount: definition.id === 'help.before-idle' ? 1 : 0,
                      boardIdleAtMs: 10,
                      idlePrefetchAtMs: 11,
                      earliestHelpResourceStartMs: 12,
                      additionalHelpTransferSizeAfterOpen: 0
                    }
                    : {}
      };
    })
  };
}

describe('UX optimization monitor validator', () => {
  test('accepts a complete raw report and ignores a forged top-level verdict', () => {
    const report = validReport();
    report.verdict = 'fail';
    const result = validateUxOptimizationReport(report);
    expect(result.overallVerdict).toBe('pass');
    expect(result.checks.every((check) => check.verdict === 'pass')).toBe(true);
  });

  test('fails missing, duplicate and unknown scenarios', () => {
    const report = validReport();
    report.scenarios = [
      ...report.scenarios.slice(1),
      report.scenarios[1],
      { ...report.scenarios[1], id: 'unknown.scenario' }
    ];
    const result = validateUxOptimizationReport(report);
    const check = result.checks.find((entry) => entry.id === 'report.scenario-set');
    expect(check?.verdict).toBe('fail');
    expect(check?.reasons.join(' ')).toContain(
      'missing scenario capture: boot.pixi.cold:vite:pixi'
    );
    expect(check?.reasons.join(' ')).toContain(
      'duplicate scenario capture: boot.pixi.warm:vite:pixi'
    );
    expect(check?.reasons.join(' ')).toContain(
      'unknown scenario capture: unknown.scenario:vite:pixi'
    );
  });

  test('recursively rejects forbidden gameplay and authority keys', () => {
    const report = validReport();
    report.scenarios[0].metrics = {
      safe: true,
      nested: [{ seatToken: 'secret' }, { gameState: {} }]
    };
    expect(findForbiddenReportPaths(report)).toEqual([
      'scenarios[0].metrics.nested[0].seatToken',
      'scenarios[0].metrics.nested[1].gameState'
    ]);
    expect(validateUxOptimizationReport(report).overallVerdict).toBe('fail');
  });

  test('fails invalid identity, phases, paths and unexpected browser errors', () => {
    const report = validReport();
    report.identity.scenarioDigest = '0'.repeat(64);
    report.scenarios[0].phases[1].atMs = -1;
    report.scenarios[0].resources = [{ path: '/api/match/list' }];
    report.scenarios[0].errors = [{ kind: 'resource', path: 'styles-missing.css' }];
    const result = validateUxOptimizationReport(report);
    expect(result.overallVerdict).toBe('fail');
    expect(result.checks.find((entry) => entry.id === 'report.identity')?.verdict).toBe('fail');
    expect(
      result.checks.find((entry) => entry.id === 'scenario.boot.pixi.cold:vite:pixi')?.verdict
    ).toBe('fail');
  });

  test('allows one fixture-bound injected fault and nothing else', () => {
    const report = validReport();
    report.scenarios[0].expectedFault = {
      kind: 'resource',
      path: 'styles-feature-result.css'
    };
    report.scenarios[0].errors = [{
      kind: 'resource',
      path: 'styles-feature-result.css'
    }];
    expect(validateUxOptimizationReport(report).overallVerdict).toBe('pass');
    report.scenarios[0].errors.push({
      kind: 'console',
      path: 'unrelated'
    });
    expect(validateUxOptimizationReport(report).overallVerdict).toBe('fail');
  });

  test('allows the exact declared count for a multi-request injected fault', () => {
    const report = validReport();
    report.scenarios[0].expectedFault = {
      kind: 'console',
      path: 'document',
      count: 2
    };
    report.scenarios[0].errors = [
      { kind: 'console', path: 'document' },
      { kind: 'console', path: 'document' }
    ];
    expect(validateUxOptimizationReport(report).overallVerdict).toBe('pass');
    report.scenarios[0].errors.pop();
    expect(validateUxOptimizationReport(report).overallVerdict).toBe('fail');
  });

  test('pending optimizations remain failed but can form a valid explicit baseline', () => {
    const report = validReport();
    report.profile = 'baseline';
    report.pendingOptimizationIds = UX_OPTIMIZATION_IDS.slice();
    report.scenarios.forEach((scenario: Record<string, any>) => {
      scenario.captureStatus = 'pending-optimization';
    });
    const validation = validateUxOptimizationReport(report);
    expect(validation.overallVerdict).toBe('fail');
    expect(validation.baselineValid).toBe(true);
    expect(validation.candidateEligible).toBe(false);
  });

  test('passes a completed focused target while unrelated work remains pending', () => {
    const report = validReport();
    report.pendingOptimizationIds = UX_OPTIMIZATION_IDS.filter(
      (id) => id !== 'lock-only-hint-paint'
    );
    const relevantScenarioIds = new Set(
      UX_OPTIMIZATION_SCENARIOS
        .filter((scenario) => scenario.optimizationIds.includes('lock-only-hint-paint'))
        .map((scenario) => scenario.id)
    );
    report.scenarios.forEach((scenario: Record<string, any>) => {
      if (!relevantScenarioIds.has(scenario.id)) {
        scenario.captureStatus = 'pending-optimization';
      }
    });
    const validation = validateUxOptimizationReport(report, {
      targetOptimizationIds: ['lock-only-hint-paint']
    });
    expect(validation.overallVerdict).toBe('fail');
    expect(validation.focusedVerdict).toBe('pass');
    expect(validation.developmentValid).toBe(true);
  });

  test('fails lock paint, input leakage, stale input, and opponent-turn stalls', () => {
    const report = validReport();
    const lock = report.scenarios.find((scenario: any) => scenario.id === 'board.lock-toggle');
    const opponent = report.scenarios.find(
      (scenario: any) => scenario.id === 'playback.opponent-actions'
    );
    lock.metrics.lockDelta.hintPaintCount = 64;
    lock.metrics.lockedCommandCount = 1;
    lock.metrics.staleInputStateCount = 1;
    opponent.metrics.longTaskCount = 1;
    opponent.metrics.rafStall50msCount = 1;
    opponent.metrics.tickerIdle = false;

    const validation = validateUxOptimizationReport(report, {
      targetOptimizationIds: ['lock-only-hint-paint']
    });
    expect(validation.focusedVerdict).toBe('fail');
    expect(validation.checks.find(
      (check) => check.id === 'scenario.board.lock-toggle:vite:pixi'
    )?.reasons).toEqual(expect.arrayContaining([
      'lockDelta painted hint Graphics: 64',
      'locked command count was 1',
      'stale input state count was 1'
    ]));
    expect(validation.checks.find(
      (check) => check.id === 'scenario.playback.opponent-actions:vite:pixi'
    )?.verdict).toBe('fail');
  });

  test('does not classify a CSS-owned profile avatar as a Pixi board preload', () => {
    const report = validReport();
    const boot = report.scenarios.find((entry: any) => (
      entry.id === 'boot.pixi.cold' && entry.lane === 'vite'
    ));
    boot.resources = [{
      path: 'assets/images/special-stones/GHOST_WILL-black.png',
      initiatorType: 'css'
    }];
    boot.metrics.neededSpecialAssetIds = [];

    const result = validateUxOptimizationReport(report);
    const check = result.checks.find(
      (entry) => entry.id === 'scenario.boot.pixi.cold:vite:pixi'
    );
    expect(check?.verdict).toBe('pass');
  });

  test('fails duplicate logical boot images, detached preloads, and src mutations', () => {
    const report = validReport();
    const boot = report.scenarios.find((entry: any) => entry.id === 'boot.pixi.cold');
    boot.resources = [
      { path: 'vite-dist/assets/hero-HASHED.png' },
      { path: 'assets/images/hero/hero.png' },
      { path: 'vite-dist/assets/勇者の手-HASHED.png' },
      { path: 'assets/images/hand-skin/勇者の手.png' }
    ];
    boot.metrics.imageConstructorAssignments = ['assets/images/hero/hero.png'];
    boot.metrics.logicalImageSrcMutations = [{
      logicalPath: 'assets/images/hand-skin/勇者の手.png',
      sourcePath: 'assets/images/hand-skin/勇者の手.png'
    }];

    const result = validateUxOptimizationReport(report);
    const check = result.checks.find(
      (entry) => entry.id === 'scenario.boot.pixi.cold:vite:pixi'
    );
    expect(check?.verdict).toBe('fail');
    expect(check?.reasons).toEqual(expect.arrayContaining([
      'hero logical image requested 2 response bodies',
      'default-hand logical image requested 2 response bodies',
      'logical boot images used 1 detached Image preload(s)',
      'logical boot images mutated src 1 time(s)'
    ]));
  });

  test('fails help requests before first frame, layout shift, and idle-after body transfer', () => {
    const report = validReport();
    const afterIdle = report.scenarios.find((entry: any) => (
      entry.id === 'help.after-idle' && entry.lane === 'vite'
    ));
    afterIdle.metrics.helpRequestsBeforeFirstFrame = 1;
    afterIdle.metrics.clsDelta = 0.02;
    afterIdle.metrics.additionalHelpTransferSizeAfterOpen = 325_700;

    const result = validateUxOptimizationReport(report, {
      targetOptimizationIds: ['help-image-lazy-loading']
    });
    const check = result.checks.find(
      (entry) => entry.id === 'scenario.help.after-idle:vite:pixi'
    );
    expect(result.focusedVerdict).toBe('fail');
    expect(check?.reasons).toEqual(expect.arrayContaining([
      'help requests before first frame: 1',
      'help first-open CLS was 0.02',
      'idle-after open transferred 325700 extra bytes'
    ]));
  });

  test('fails eager DOM compatibility CSS and fallback mount-before-style regressions', () => {
    const report = validReport();
    const boot = report.scenarios.find((entry: any) => (
      entry.id === 'boot.pixi.cold' && entry.lane === 'vite'
    ));
    boot.resources.push({ path: 'styles-board-dom-compat.css' });
    boot.metrics.domCompatStylesheetLinkCount = 1;
    const fallback = report.scenarios.find((entry: any) => (
      entry.id === 'fallback.context-loss' && entry.lane === 'classic'
    ));
    fallback.metrics.domCompatStylesheetResponseCount = 2;
    fallback.metrics.domCompatStylesheetReadyAt = 8;
    fallback.metrics.domBackendMountedAt = 7;
    fallback.metrics.domCompatStylesheetAtSlot = false;
    const explicitDom = report.scenarios.find((entry: any) => (
      entry.id === 'fallback.explicit-dom' && entry.lane === 'vite'
    ));
    explicitDom.metrics.stylesheetFailurePreventedMount = false;
    explicitDom.metrics.stylesheetFailureSurfaced = false;
    explicitDom.metrics.stylesheetFailureUiInitialized = true;

    const result = validateUxOptimizationReport(report, {
      targetOptimizationIds: ['dom-compat-stylesheet-lazy-loading']
    });
    const bootCheck = result.checks.find(
      (entry) => entry.id === 'scenario.boot.pixi.cold:vite:pixi'
    );
    const fallbackCheck = result.checks.find(
      (entry) => entry.id === 'scenario.fallback.context-loss:classic:dom'
    );
    expect(result.focusedVerdict).toBe('fail');
    expect(bootCheck?.reasons).toEqual(expect.arrayContaining([
      'normal Pixi requested DOM compatibility CSS 1 time(s)',
      'normal Pixi mounted 1 DOM compatibility stylesheet link(s)'
    ]));
    expect(fallbackCheck?.reasons).toEqual(expect.arrayContaining([
      'DOM compatibility CSS response count was 2',
      'DOM compatibility stylesheet was not inserted at its fixed cascade slot',
      'DOM compatibility stylesheet/backend order was 8 > 7'
    ]));
    const explicitDomCheck = result.checks.find(
      (entry) => entry.id === 'scenario.fallback.explicit-dom:vite:dom'
    );
    expect(explicitDomCheck?.reasons).toEqual(expect.arrayContaining([
      'failed DOM compatibility CSS still allowed backend mount',
      'DOM compatibility CSS failure was not surfaced',
      'DOM compatibility CSS failure produced a success-shaped UI initialization'
    ]));
  });
});
