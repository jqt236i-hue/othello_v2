const mod = require('../game/cpu-turn-handler');

describe('cpu-turn-handler helpers', () => {
  afterEach(() => {
    // restore timers
    mod.setTimers(null);
    if (typeof mod.resetCpuTurnHandlerState === 'function') {
      mod.resetCpuTurnHandlerState();
    }
    jest.useRealTimers();
    // cleanup any globals we set
    delete global.cpuSelectDestroyWithPolicy;
    delete global.BLACK;
    delete global.WHITE;
    delete global.cpuSmartness;
    delete global.gameState;
    delete global.cardState;
    delete global.isCardAnimating;
    delete global.isProcessing;
    delete global.isGameOver;
    delete global.PlaybackStateManager;
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

  test('resetCpuTurnHandlerState clears stale scheduled retry latch', async () => {
    const waitMs = jest.fn(() => new Promise(() => {}));
    mod.setTimers({ waitMs });

    global.BLACK = 1;
    global.WHITE = -1;
    global.cpuSmartness = { black: 1, white: 6 };
    global.isCardAnimating = true;
    global.isProcessing = false;
    global.isGameOver = jest.fn(() => false);
    global.gameState = {
      currentPlayer: global.WHITE,
      turnNumber: 7,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      hands: { black: [], white: [] },
      charge: { black: 0, white: 0 }
    };

    await mod.processCpuTurn();
    expect(waitMs).toHaveBeenCalledTimes(1);

    mod.resetCpuTurnHandlerState();
    global.gameState = {
      currentPlayer: global.WHITE,
      turnNumber: 0,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };

    await mod.processCpuTurn();
    expect(waitMs).toHaveBeenCalledTimes(2);
  });

  test('processCpuTurn defers when PlaybackStateManager reports processing busy', async () => {
    const waitMs = jest.fn(() => new Promise(() => {}));
    mod.setTimers({ waitMs });

    global.BLACK = 1;
    global.WHITE = -1;
    global.cpuSmartness = { black: 1, white: 6 };
    global.isCardAnimating = false;
    global.isProcessing = false;
    global.isGameOver = jest.fn(() => false);
    global.PlaybackStateManager = {
      getProcessing: jest.fn(() => true),
      getCardAnimating: jest.fn(() => false),
      getPlaybackActive: jest.fn(() => false),
      setProcessing: jest.fn()
    };
    global.gameState = {
      currentPlayer: global.WHITE,
      turnNumber: 3,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      hands: { black: [], white: [] },
      charge: { black: 0, white: 0 }
    };

    await mod.processCpuTurn();

    expect(global.PlaybackStateManager.getProcessing).toHaveBeenCalled();
    expect(waitMs).toHaveBeenCalledTimes(1);
  });
});
