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
          ? [{ path: 'assets/images/special-stones/Time_bomb.png' }]
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
});
