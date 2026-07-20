export {};

describe('debug-only CPU turn performance harness', () => {
  const savedDescriptors: Record<string, PropertyDescriptor | undefined> = {};

  beforeEach(() => {
    jest.resetModules();
    for (const key of ['window', 'document', 'performance', 'PerformanceObserver', 'requestAnimationFrame']) {
      savedDescriptors[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    }
  });

  afterEach(() => {
    for (const [key, descriptor] of Object.entries(savedDescriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
    jest.restoreAllMocks();
  });

  function installEnvironment(search: string): any {
    const windowRef: any = { location: { search } };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: windowRef });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { visibilityState: 'visible', hasFocus: () => true }
    });
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: jest.fn(() => 1)
    });
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: {
        now: jest.fn(() => 100),
        timeOrigin: 1_700_000_000_000,
        mark: jest.fn(),
        measure: jest.fn(),
        clearMarks: jest.fn()
      }
    });
    class FakePerformanceObserver {
      static supportedEntryTypes: string[] = [];
      constructor(_callback: any) {}
      observe(): void {}
      takeRecords(): any[] { return []; }
      disconnect(): void {}
    }
    Object.defineProperty(globalThis, 'PerformanceObserver', {
      configurable: true,
      value: FakePerformanceObserver
    });
    return windowRef;
  }

  test('does not allocate a recorder or debug global when perf is off', () => {
    const windowRef = installEnvironment('');
    let moduleRef: any;
    jest.isolateModules(() => { moduleRef = require('../ui/perf-benchmarks'); });

    expect(moduleRef.isPerfBenchEnabled()).toBe(false);
    expect(moduleRef.getCpuTurnPerformanceRecorder()).toBeNull();
    expect(windowRef.__cpuTurnPerformance).toBeUndefined();
    expect((globalThis as any).requestAnimationFrame).not.toHaveBeenCalled();
  });

  test('keeps only allowlisted schema fields and rejects malformed stages', () => {
    const windowRef = installEnvironment('?perf=1');
    let moduleRef: any;
    jest.isolateModules(() => { moduleRef = require('../ui/perf-benchmarks'); });
    const harness = moduleRef.installCpuTurnPerformanceHarness();

    expect(harness.beginScenario('lv1-empty-or-unusable-hand-place-8x8', {
      profile: 'desktop',
      iteration: 1,
      seatToken: 'must-not-leak',
      privateHand: ['hard_01']
    })).toBe(true);
    harness.recordCpuTurnStage({
      correlationId: 'cpu-1',
      runId: 1,
      stage: 'move-candidates',
      kind: 'sync',
      startMs: 10,
      endMs: 15,
      durationMs: 5,
      playerKey: 'white',
      level: 1,
      outcome: 'continue',
      seatToken: 'must-not-leak'
    });
    harness.recordCpuTurnStage({
      correlationId: 'cpu-1',
      runId: 1,
      stage: 'unknown-stage',
      kind: 'sync',
      startMs: 10,
      endMs: 15,
      durationMs: 5,
      playerKey: 'white',
      level: 1,
      outcome: 'continue'
    });
    const snapshot = harness.endScenario();

    expect(snapshot.schemaVersion).toBe('cpu_turn_frame_stall_sample.v1');
    expect(snapshot.metadata).toEqual({ profile: 'desktop', iteration: 1 });
    expect(snapshot.stageEntries).toHaveLength(1);
    expect(JSON.stringify(snapshot)).not.toContain('must-not-leak');
    expect(windowRef.__cpuTurnPerformance).toBe(harness);
  });

  test('rejects scenario re-entry, unknown scenarios, and malformed handoff entries', () => {
    installEnvironment('?perf=1');
    let moduleRef: any;
    jest.isolateModules(() => { moduleRef = require('../ui/perf-benchmarks'); });
    const harness = moduleRef.installCpuTurnPerformanceHarness();

    expect(harness.beginScenario('unknown-scenario')).toBe(false);
    expect(harness.beginScenario('lv1-empty-or-unusable-hand-place-8x8')).toBe(true);
    expect(harness.beginScenario('lv1-usable-card-then-place-8x8')).toBe(false);
    harness.recordCpuTurnStage({
      correlationId: 'bad correlation',
      runId: null,
      stage: 'handoff-delay',
      kind: 'sync',
      startMs: 10,
      endMs: 11,
      durationMs: 1,
      playerKey: 'white',
      level: null,
      outcome: 'continue'
    });
    const snapshot = harness.endScenario();

    expect(snapshot.stageEntries).toHaveLength(0);
    expect(snapshot.invalidEntryCount).toBe(1);
    expect((snapshot.clockDomain as any).compatible).toBe(true);
  });
});
