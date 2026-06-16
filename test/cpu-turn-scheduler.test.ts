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
});
