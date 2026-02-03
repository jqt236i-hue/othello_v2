const mod = require('../game/cpu-turn-handler');

describe('cpu-turn-handler helpers', () => {
  afterEach(() => {
    // restore timers
    mod.setTimers(null);
    jest.useRealTimers();
    // cleanup any globals we set
    delete global.cpuSelectDestroyWithPolicy;
  });

  test('scheduleRetry uses timers.waitMs when available', async () => {
    let called = false;
    const timers = { waitMs: jest.fn(() => Promise.resolve()) };
    mod.setTimers(timers);

    mod.scheduleRetry(() => { called = true; }, 0);
    // wait for microtask queue to drain
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(timers.waitMs).toHaveBeenCalled();
    expect(called).toBe(true);
  });

  test('scheduleRetry falls back to setTimeout when timers absent', () => {
    mod.setTimers(null);
    jest.useFakeTimers();
    const cb = jest.fn();
    // Force require('./timers').waitMs to throw so shared helper falls back to setTimeout
    const timersModule = require('../game/timers');
    const spy = jest.spyOn(timersModule, 'waitMs').mockImplementation(() => { throw new Error('no'); });

    mod.scheduleRetry(cb, 20);
    jest.advanceTimersByTime(20);
    expect(cb).toHaveBeenCalled();

    spy.mockRestore();
  });

  test('getPendingTypeHandlers returns handlers that invoke CPU selection helpers', async () => {
    let invoked = false;
    // stub the selector
    global.cpuSelectDestroyWithPolicy = async (playerKey) => { invoked = true; };
    const h = mod.getPendingTypeHandlers('white');
    expect(typeof h.DESTROY_ONE_STONE).toBe('function');
    await h.DESTROY_ONE_STONE();
    expect(invoked).toBe(true);
  });
});