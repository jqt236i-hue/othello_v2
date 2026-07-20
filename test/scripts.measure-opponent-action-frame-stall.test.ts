import {
  assertNoForbiddenReportKeys,
  attributeBrowserTimingEntry,
  buildFrameStallReport,
  evaluateBlockingPerformanceGate,
  intervalUnionDurationMs,
  nearestRankPercentile,
  SCENARIO_IDS
} from '../scripts/perf/measure-opponent-action-frame-stall';

function makeSample(scenarioId: string, durationMs = 20): any {
  return {
    schemaVersion: 'cpu_turn_frame_stall_sample.v1',
    scenarioId,
    metadata: {
      profile: 'desktop',
      iteration: 1,
      lane: 'vite',
      buildMode: 'vite-production',
      fixtureDigest: 'b'.repeat(64),
      browserArtifactSha256: 'a'.repeat(64),
      captureOrderIndex: SCENARIO_IDS.indexOf(scenarioId as any),
      fixtureOutcomeDigest: 'c'.repeat(64),
      orderedActionsVerified: true,
      cardEffectVerified: true,
      workerPathVerified: true,
      pixiPlaybackVerified: true
    },
    stageEntries: [{
      correlationId: 'cpu-1',
      runId: null,
      stage: 'handoff-delay',
      kind: 'wait',
      startMs: 1,
      endMs: 2,
      durationMs: 1,
      playerKey: 'white',
      level: null,
      outcome: 'continue'
    }, {
      correlationId: 'cpu-1',
      runId: 1,
      stage: 'card-context-base',
      kind: 'sync',
      startMs: 2,
      endMs: 2 + durationMs,
      durationMs,
      playerKey: 'white',
      level: 1,
      outcome: 'continue'
    }, {
      correlationId: 'cpu-1',
      runId: 1,
      stage: 'card-context-feature:mass-freeze',
      kind: 'sync',
      startMs: 4,
      endMs: 8,
      durationMs: 4,
      playerKey: 'white',
      level: 1,
      outcome: 'continue'
    }],
    longTasks: [{ entryType: 'longtask', startMs: 0, endMs: 12, durationMs: 12 }],
    longAnimationFrames: [],
    rafIntervalsMs: [16, 17],
    startedAtMs: 0,
    endedAtMs: 40,
    visibilityValid: true,
    focusValid: true,
    overflow: false,
    invalidEntryCount: 0,
    invalidReasons: [],
    clockDomain: { compatible: true, timeOrigin: 1 },
    capabilities: { raf: 'supported' }
  };
}

describe('opponent action frame-stall report helpers', () => {
  test('uses nearest-rank percentile and unions nested, overlapping, and adjacent intervals', () => {
    expect(nearestRankPercentile([1, 2, 3, 4, 5], 0.95)).toBe(5);
    expect(intervalUnionDurationMs([
      { startMs: 0, endMs: 5 },
      { startMs: 2, endMs: 4 },
      { startMs: 5, endMs: 9 },
      { startMs: 12, endMs: 13 }
    ])).toBe(10);
  });

  test('attributes only the actual half-open overlap and keeps the remainder unattributed', () => {
    const sample = makeSample(SCENARIO_IDS[0]);
    const attributed = attributeBrowserTimingEntry(
      { entryType: 'longtask', startMs: 0, endMs: 12, durationMs: 12 },
      sample.stageEntries
    ) as any;
    expect(attributed.appAttributedOverlapMs).toBe(10);
    expect(attributed.unattributedMs).toBe(2);
    expect(attributed.stageOverlapMs['card-context-feature:mass-freeze']).toBe(4);
    const touching = attributeBrowserTimingEntry(
      { entryType: 'longtask', startMs: 22, endMs: 30, durationMs: 8 },
      sample.stageEntries
    ) as any;
    expect(touching.appAttributed).toBe(false);
  });

  test('excludes invalid samples, enforces minimum count, and emits no private state keys', () => {
    const samplesByScenario = Object.fromEntries(SCENARIO_IDS.map((id) => [id, [makeSample(id)]]));
    const report = buildFrameStallReport(samplesByScenario, {
      profile: 'desktop',
      lane: 'vite',
      browserArtifactSha256: 'a'.repeat(64),
      fixtureDigest: 'b'.repeat(64),
      warmupIterations: 5,
      captureIterations: 1,
      buildMode: 'vite-production',
      captureOrder: SCENARIO_IDS,
      minimumValidSamples: 1,
      generatedAt: '2026-07-20T00:00:00.000Z'
    }) as any;
    expect(report.schemaVersion).toBe('cpu_turn_frame_stall_report.v1');
    expect(report.scenarios[SCENARIO_IDS[0]].syncInvocationMs.p95).toBe(20);
    expect(() => assertNoForbiddenReportKeys(report)).not.toThrow();
    expect(() => assertNoForbiddenReportKeys({ nested: { seatToken: 'secret' } })).toThrow(/forbidden report key/);

    samplesByScenario[SCENARIO_IDS[0]] = [{ ...makeSample(SCENARIO_IDS[0]), focusValid: false }];
    expect(() => buildFrameStallReport(samplesByScenario, {
      profile: 'desktop', lane: 'vite', browserArtifactSha256: 'a', fixtureDigest: 'b',
      warmupIterations: 5, captureIterations: 1, minimumValidSamples: 1,
      buildMode: 'vite-production', captureOrder: SCENARIO_IDS
    })).toThrow(/valid sample count/);
  });

  test('blocking gate uses sync metrics and ignores wait-only duration', () => {
    const makeReport = (syncP95: number, syncMax: number) => ({
      schemaVersion: 'cpu_turn_frame_stall_report.v1',
      capture: {
        profile: 'desktop',
        lane: 'vite',
        fixtureDigest: 'same',
        captureIterations: 20,
        buildMode: 'vite-production',
        captureOrder: SCENARIO_IDS,
        browserArtifactSha256: syncP95 >= 100 ? 'baseline-hash' : 'candidate-hash'
      },
      scenarios: Object.fromEntries(SCENARIO_IDS.slice(0, 3).map((id) => [id, {
        syncInvocationMs: { p95: syncP95, max: syncMax },
        syncStagesMs: { 'card-context-base': { p95: syncP95, max: syncMax } },
        waitInvocationMs: { p95: 1000, max: 2000 },
        maximumAppAttributedSyncSliceMs: syncMax,
        handoffCoverage: { complete: true },
        fixtureOutcomeDigest: 'same-outcome'
      }]))
    });
    expect(evaluateBlockingPerformanceGate(makeReport(100, 120), makeReport(25, 30)).ok).toBe(true);
    expect(evaluateBlockingPerformanceGate(makeReport(100, 120), makeReport(40, 50)).ok).toBe(false);
  });
});
