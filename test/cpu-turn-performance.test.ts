export {};

const PerformanceModule = require('../game/cpu-turn-performance');

describe('cpu-turn-performance portable instrumentation', () => {
  test('records a normalized immutable sync interval without leaking callback failures', () => {
    const entries: any[] = [];
    const scope = PerformanceModule.createCpuTurnPerformanceScope({
      recorder: (entry: any) => entries.push(entry),
      correlationId: 'cpu-1',
      runId: 4,
      playerKey: 'white',
      level: 1,
      readNowMs: jest.fn()
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(25)
    });

    const result = PerformanceModule.measureCpuTurnSync(
      scope,
      'move-candidates',
      () => 'selected'
    );

    expect(result).toBe('selected');
    expect(entries).toEqual([{
      correlationId: 'cpu-1',
      runId: 4,
      stage: 'move-candidates',
      kind: 'sync',
      startMs: 10,
      endMs: 25,
      durationMs: 15,
      playerKey: 'white',
      level: 1,
      outcome: 'continue'
    }]);
    expect(Object.isFrozen(entries[0])).toBe(true);

    const throwingScope = PerformanceModule.createCpuTurnPerformanceScope({
      recorder: () => { throw new Error('debug recorder failed'); },
      correlationId: 'cpu-2',
      runId: 5,
      playerKey: 'black',
      level: 6,
      readNowMs: () => 30
    });
    expect(() => PerformanceModule.recordCpuTurnPerformanceInterval(
      throwingScope,
      'canonical-commit',
      'sync',
      20,
      30,
      'handled'
    )).not.toThrow();
  });

  test('keeps normal options identity when no correlation is present', () => {
    const options = { autoMode: false };
    expect(PerformanceModule.withCpuTurnPerformanceOptions(options, null)).toBe(options);
    expect(PerformanceModule.readCpuTurnPerformanceCorrelationId(options)).toBeNull();
  });
});
