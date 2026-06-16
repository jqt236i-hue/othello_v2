import * as mod from '../game/cpu-turn-handler.js';

function resolveGlobalRuntimeFunction(name: string) {
  const candidate = (global as any)[name];
  return typeof candidate === 'function' ? candidate : null;
}

function resolveGlobalRuntimeValue(name: string) {
  return Object.prototype.hasOwnProperty.call(global, name)
    ? (global as any)[name]
    : undefined;
}

describe('cpu-turn-handler helpers', () => {
  afterEach(() => {
    // restore timers
    mod.setTimers(null);
    if (typeof mod.setCpuTurnTimerService === 'function') {
      mod.setCpuTurnTimerService(null);
    }
    if (typeof mod.setCpuUIImpl === 'function') {
      mod.setCpuUIImpl({});
    }
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

  test('scheduleRetry uses injected TimerService when timers are absent', () => {
    mod.setTimers(null);
    const cb = jest.fn();
    const callbacks: Array<() => void> = [];
    const timerService = {
      setTimeout: jest.fn((callback: () => void, delay: number) => {
        callbacks.push(callback);
        return { delay };
      })
    };
    mod.setCpuTurnTimerService(timerService);

    mod.scheduleRetry(cb, 20);
    expect(timerService.setTimeout).toHaveBeenCalledWith(expect.any(Function), 20);
    callbacks.forEach(callback => callback());
    expect(cb).toHaveBeenCalled();
  });

  test('getPendingTypeHandlers returns handlers that invoke CPU selection helpers', async () => {
    let invoked = false;
    // stub the selector
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' } }
    };
    global.cpuSelectDestroyWithPolicy = async (playerKey) => { invoked = true; };
    mod.setCpuUIImpl({
      resolveRuntimeFunction: resolveGlobalRuntimeFunction,
      resolveRuntimeValue: resolveGlobalRuntimeValue
    });
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
    mod.setCpuUIImpl({
      resolveRuntimeFunction: resolveGlobalRuntimeFunction,
      resolveRuntimeValue: resolveGlobalRuntimeValue
    });

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
    mod.setCpuUIImpl({
      readProcessing: () => global.PlaybackStateManager.getProcessing(),
      readAnimationBusy: () => (
        global.PlaybackStateManager.getCardAnimating()
        || global.PlaybackStateManager.getPlaybackActive()
      )
    });
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
    mod.setCpuUIImpl({
      resolveRuntimeFunction: resolveGlobalRuntimeFunction,
      resolveRuntimeValue: resolveGlobalRuntimeValue,
      readProcessing: () => global.PlaybackStateManager.getProcessing(),
      readAnimationBusy: () => (
        global.PlaybackStateManager.getCardAnimating()
        || global.PlaybackStateManager.getPlaybackActive()
      )
    });

    await mod.processCpuTurn();

    expect(global.PlaybackStateManager.getProcessing).toHaveBeenCalled();
    expect(waitMs).toHaveBeenCalledTimes(1);
  });

  test('runCpuTurn aborts black auto turn when runtime state has advanced to white', async () => {
    global.BLACK = 1;
    global.WHITE = -1;
    const staleGlobalState = {
      currentPlayer: global.BLACK,
      turnNumber: 12,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    const runtimeState = {
      currentPlayer: global.WHITE,
      turnNumber: 13,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.cpuSmartness = { black: 1, white: 6 };
    global.isCardAnimating = false;
    global.isProcessing = false;
    global.isGameOver = jest.fn(() => false);
    global.gameState = staleGlobalState;
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      hands: { black: [], white: [] },
      charge: { black: 0, white: 0 }
    };
    global.generateMovesForPlayer = jest.fn(() => [{ row: 1, col: 2, flips: [] }]);
    global.executeMove = jest.fn();

    mod.setCpuUIImpl({
      resolveRuntimeFunction: resolveGlobalRuntimeFunction,
      resolveRuntimeValue: (name: string) => {
        if (name === 'gameState') return runtimeState;
        return resolveGlobalRuntimeValue(name);
      },
      resolveExecuteMove: () => global.executeMove
    });

    await mod.runCpuTurn('black', { autoMode: true });

    expect(global.executeMove).not.toHaveBeenCalled();
    expect(global.isProcessing).toBe(false);
  });
});
