export {};

const SchedulerModule = require('../game/cpu-turn-scheduler.js');

describe('cpu-turn-scheduler', () => {
  test('scheduleRunCpuTurn does not keep a retry latch when no timer can be scheduled', () => {
    let timerService: any = null;
    const runCpuTurn = jest.fn();
    const scheduler = SchedulerModule.createCpuTurnScheduler({
      debugCpuTrace: jest.fn(),
      getAnimationRetryDelayMs: () => 0,
      getCurrentPlayerKeySafe: () => 'white',
      getCurrentTurnNumberSafe: () => 12,
      getTimerService: () => timerService,
      getTimers: () => null,
      runCpuTurn,
      shouldAbortCpuForHumanMode: () => false
    });

    scheduler.scheduleRunCpuTurn('white', { autoMode: false }, 0);

    const callbacks: Array<() => void> = [];
    timerService = {
      setTimeout: jest.fn((callback: () => void) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
      clearTimeout: jest.fn()
    };
    scheduler.scheduleRunCpuTurn('white', { autoMode: false }, 0);

    expect(timerService.setTimeout).toHaveBeenCalledTimes(1);
    callbacks.forEach((callback) => callback());
    expect(runCpuTurn).toHaveBeenCalledWith('white', { autoMode: false });
  });

  test('correlates timer wait with the scheduled CPU run only when a recorder is injected', () => {
    const callbacks: Array<() => void> = [];
    const entries: any[] = [];
    const runCpuTurn = jest.fn();
    let nowMs = 100;
    const scheduler = SchedulerModule.createCpuTurnScheduler({
      createCpuTurnPerformanceCorrelationId: () => 'cpu-handoff-1',
      debugCpuTrace: jest.fn(),
      getAnimationRetryDelayMs: () => 80,
      getCurrentPlayerKeySafe: () => 'white',
      getCurrentTurnNumberSafe: () => 12,
      getCpuTurnPerformanceRecorder: () => (entry: any) => entries.push(entry),
      getTimerService: () => ({
        setTimeout: (callback: () => void) => {
          callbacks.push(callback);
          return callbacks.length;
        },
        clearTimeout: jest.fn()
      }),
      getTimers: () => null,
      readNowMs: () => nowMs,
      runCpuTurn,
      shouldAbortCpuForHumanMode: () => false
    });

    scheduler.scheduleRunCpuTurn('white', { autoMode: false }, 80);
    nowMs = 180;
    callbacks[0]();

    expect(entries).toEqual([expect.objectContaining({
      correlationId: 'cpu-handoff-1',
      runId: null,
      stage: 'handoff-delay',
      kind: 'wait',
      startMs: 100,
      endMs: 180,
      durationMs: 80,
      outcome: 'continue'
    })]);
    expect(runCpuTurn).toHaveBeenCalledWith('white', expect.objectContaining({
      autoMode: false,
      __cpuTurnPerformanceCorrelationId: 'cpu-handoff-1'
    }));
  });

  test('releases the retry latch and records an error when waitMs rejects', async () => {
    const entries: any[] = [];
    const runCpuTurn = jest.fn();
    let waitAttempt = 0;
    const scheduler = SchedulerModule.createCpuTurnScheduler({
      createCpuTurnPerformanceCorrelationId: () => `cpu-reject-${waitAttempt + 1}`,
      debugCpuTrace: jest.fn(),
      getAnimationRetryDelayMs: () => 80,
      getCurrentPlayerKeySafe: () => 'white',
      getCurrentTurnNumberSafe: () => 12,
      getCpuTurnPerformanceRecorder: () => (entry: any) => entries.push(entry),
      getTimerService: () => null,
      getTimers: () => ({
        waitMs: () => {
          waitAttempt += 1;
          return Promise.reject(new Error('timer failed'));
        }
      }),
      readNowMs: () => 100 + waitAttempt,
      runCpuTurn,
      shouldAbortCpuForHumanMode: () => false
    });

    scheduler.scheduleRunCpuTurn('white', { autoMode: false }, 80);
    await Promise.resolve();
    await Promise.resolve();
    scheduler.scheduleRunCpuTurn('white', { autoMode: false }, 80);
    await Promise.resolve();
    await Promise.resolve();

    expect(waitAttempt).toBe(2);
    expect(runCpuTurn).not.toHaveBeenCalled();
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.outcome === 'error')).toBe(true);
  });

  test('clock and recorder failures never block the scheduled CPU callback', () => {
    const callbacks: Array<() => void> = [];
    const runCpuTurn = jest.fn();
    const scheduler = SchedulerModule.createCpuTurnScheduler({
      createCpuTurnPerformanceCorrelationId: () => 'cpu-safe-failure',
      debugCpuTrace: jest.fn(),
      getAnimationRetryDelayMs: () => 0,
      getCurrentPlayerKeySafe: () => 'white',
      getCurrentTurnNumberSafe: () => 12,
      getCpuTurnPerformanceRecorder: () => () => { throw new Error('recorder failed'); },
      getTimerService: () => ({
        setTimeout: (callback: () => void) => {
          callbacks.push(callback);
          return callbacks.length;
        },
        clearTimeout: jest.fn()
      }),
      getTimers: () => null,
      readNowMs: () => { throw new Error('clock failed'); },
      runCpuTurn,
      shouldAbortCpuForHumanMode: () => false
    });

    expect(() => scheduler.scheduleRunCpuTurn('white', { autoMode: false }, 0)).not.toThrow();
    expect(() => callbacks[0]()).not.toThrow();
    expect(runCpuTurn).toHaveBeenCalledTimes(1);
  });

  test('a reserved CPU callback becomes inert when runtime integrity latches before it fires', () => {
    const callbacks: Array<() => void> = [];
    const runCpuTurn = jest.fn();
    const setProcessing = jest.fn();
    let blocked = false;
    const scheduler = SchedulerModule.createCpuTurnScheduler({
      debugCpuTrace: jest.fn(),
      getAnimationRetryDelayMs: () => 0,
      getCurrentPlayerKeySafe: () => 'white',
      getCurrentTurnNumberSafe: () => 12,
      getTimerService: () => ({
        setTimeout: (callback: () => void) => {
          callbacks.push(callback);
          return callbacks.length;
        },
        clearTimeout: jest.fn()
      }),
      getTimers: () => null,
      isAborted: () => blocked,
      runCpuTurn,
      setProcessing,
      shouldAbortCpuForHumanMode: () => false
    });
    const generationBefore = scheduler.getCpuRetryGeneration();

    scheduler.scheduleRunCpuTurn('white', { autoMode: false }, 0);
    blocked = true;
    callbacks[0]();

    expect(runCpuTurn).not.toHaveBeenCalled();
    expect(setProcessing).toHaveBeenCalledWith(false);
    expect(scheduler.getCpuRetryGeneration()).toBeGreaterThan(generationBefore);
  });
});
