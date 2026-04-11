function createDeferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mockPresentationRuntime(overridesFactory) {
  jest.doMock('../game/cpu-turn-handler', () => {
    const actual = jest.requireActual('../game/cpu-turn-handler');
    const overrides = typeof overridesFactory === 'function'
      ? overridesFactory(actual)
      : (overridesFactory || {});
    return {
      ...actual,
      PresentationRuntime: {
        ...actual.PresentationRuntime,
        ...overrides
      }
    };
  });
}

describe('presentation handler boardUpdated draining', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    jest.unmock('../game/cpu-turn-handler');
    jest.unmock('../ui/stone-visuals');
    delete global.CardLogic;
    delete global.cardState;
    delete global.AnimationEngine;
    delete global.renderCardUI;
    delete global.gameState;
    delete global.GameEvents;
    delete global.GamePresentationRuntime;
    delete global.BLACK;
    delete global.WHITE;
    delete global.document;
    delete global.syncDiscVisualToCurrentState;
  });

  test('onBoardUpdated drains overlapping playback batches sequentially', async () => {
    const firstPlayback = createDeferred();
    const secondPlayback = createDeferred();
    const secondPlaybackStarted = createDeferred();

    global.GameEvents = { gameEvents: { on: jest.fn() } };
    global.cardState = { _presentationEventsPersist: [] };
    global.CardLogic = {
      flushPresentationEvents: jest
        .fn()
        .mockReturnValueOnce([{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }])
        .mockReturnValueOnce([{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] }])
        .mockReturnValue([])
    };
    global.AnimationEngine = {
      play: jest
        .fn()
        .mockReturnValueOnce(firstPlayback.promise)
        .mockImplementationOnce(() => {
          secondPlaybackStarted.resolve();
          return secondPlayback.promise;
        })
    };
    global.renderCardUI = jest.fn();

    const ph = require('../ui/presentation-handler');

    const firstDrain = ph.onBoardUpdated();
    await Promise.resolve();
    expect(global.AnimationEngine.play).toHaveBeenCalledTimes(1);

    const secondDrain = ph.onBoardUpdated();
    await Promise.resolve();
    expect(global.AnimationEngine.play).toHaveBeenCalledTimes(1);

    firstPlayback.resolve();
    await secondPlaybackStarted.promise;
    expect(global.AnimationEngine.play).toHaveBeenCalledTimes(2);

    secondPlayback.resolve();
    await firstDrain;
    await secondDrain;

    expect(global.CardLogic.flushPresentationEvents).toHaveBeenCalledTimes(2);
    expect(global.renderCardUI).toHaveBeenCalledTimes(2);
  });

  test('queued SCHEDULE_CPU_TURN runs after active playback completes', async () => {
    jest.useFakeTimers();

    const firstPlayback = createDeferred();
    const processCpuTurn = jest.fn();
    mockPresentationRuntime((actual) => ({
      scheduleCpuTurn: (ev) => actual.PresentationRuntime.scheduleCpuTurn(ev, { processCpuTurn })
    }));

    global.GameEvents = { gameEvents: { on: jest.fn() } };
    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = { currentPlayer: -1, turnNumber: 12 };
    global.cardState = { _presentationEventsPersist: [] };
    global.CardLogic = {
      flushPresentationEvents: jest
        .fn()
        .mockReturnValueOnce([{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }])
        .mockReturnValueOnce([{ type: 'SCHEDULE_CPU_TURN', delayMs: 0, expectedPlayerKey: 'white', expectedTurnNumber: 12 }])
        .mockReturnValue([])
    };
    global.AnimationEngine = {
      play: jest.fn().mockReturnValue(firstPlayback.promise)
    };
    global.renderCardUI = jest.fn();

    const ph = require('../ui/presentation-handler');

    const firstDrain = ph.onBoardUpdated();
    await Promise.resolve();
    ph.onBoardUpdated();
    await Promise.resolve();

    jest.runOnlyPendingTimers();
    expect(processCpuTurn).not.toHaveBeenCalled();

    firstPlayback.resolve();
    await firstDrain;

    jest.runOnlyPendingTimers();

    expect(processCpuTurn).toHaveBeenCalledTimes(1);
    expect(global.CardLogic.flushPresentationEvents).toHaveBeenCalledTimes(2);
  });

  test('onBoardUpdated does not flush CardLogic directly when presentation runtime is unavailable', async () => {
    jest.doMock('../game/cpu-turn-handler', () => ({}));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    global.GameEvents = { gameEvents: { on: jest.fn() } };
    global.cardState = { _presentationEventsPersist: [{ type: 'STALE' }] };
    global.CardLogic = {
      flushPresentationEvents: jest.fn(() => [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }])
    };
    global.AnimationEngine = { play: jest.fn() };
    global.renderCardUI = jest.fn();

    try {
      const ph = require('../ui/presentation-handler');
      await ph.onBoardUpdated();

      expect(global.CardLogic.flushPresentationEvents).not.toHaveBeenCalled();
      expect(global.AnimationEngine.play).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('[PresentationHandler] GamePresentationRuntime.flushPendingPresentationEvents not available');
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('suppressed shadow playback updates board timing without replaying animation', async () => {
    global.GameEvents = { gameEvents: { on: jest.fn() } };
    global.cardState = { _presentationEventsPersist: [] };
    global.CardLogic = {
      flushPresentationEvents: jest
        .fn()
        .mockReturnValueOnce([{
          type: 'PLAYBACK_EVENTS',
          events: [{ type: 'move', phase: 1, targets: [{ from: { r: 2, col: 2 }, to: { r: 2, col: 3 } }] }],
          meta: { source: 'self_snapshot_sync', suppressPlayback: true }
        }])
        .mockReturnValue([])
    };
    global.AnimationEngine = {
      play: jest.fn()
    };
    global.renderCardUI = jest.fn();

    const ph = require('../ui/presentation-handler');
    await ph.onBoardUpdated();

    expect(global.AnimationEngine.play).not.toHaveBeenCalled();
    expect(global.renderCardUI).toHaveBeenCalledTimes(1);
  });

  test('raw presentation batches are normalized before animation playback', async () => {
    global.GameEvents = { gameEvents: { on: jest.fn() } };
    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = { currentPlayer: 1, turnNumber: 12 };
    global.cardState = { _presentationEventsPersist: [] };
    global.CardLogic = {
      flushPresentationEvents: jest
        .fn()
        .mockReturnValueOnce([{
          type: 'PLAYBACK_EVENTS',
          events: [{ type: 'SPAWN', row: 3, col: 4, ownerAfter: 'black', cause: 'CLONE_WILL', reason: 'clone_spawn' }]
        }])
        .mockReturnValue([])
    };
    global.AnimationEngine = {
      play: jest.fn().mockResolvedValue(undefined)
    };
    global.renderCardUI = jest.fn();

    const ph = require('../ui/presentation-handler');
    await ph.onBoardUpdated();

    expect(global.AnimationEngine.play).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'spawn',
        targets: [expect.objectContaining({ r: 3, col: 4, ownerAfter: 'black' })]
      })
    ]);
  });

  test('CROSSFADE_STONE uses StoneVisuals sync instead of legacy playback-guarded global sync', async () => {
    const safeSync = jest.fn();
    const crossfadeSpy = jest.fn().mockResolvedValue(undefined);
    jest.doMock('../ui/stone-visuals', () => ({
      syncDiscVisualToCurrentState: safeSync,
      crossfadeStoneVisual: crossfadeSpy
    }));

    const disc = {};
    const cell = {
      querySelector: jest.fn(() => disc)
    };

    global.document = {
      querySelector: jest.fn(() => cell)
    };
    global.GameEvents = { gameEvents: { on: jest.fn() } };
    global.cardState = { _presentationEventsPersist: [] };
    global.CardLogic = {
      flushPresentationEvents: jest
        .fn()
        .mockReturnValueOnce([{
          type: 'CROSSFADE_STONE',
          row: 1,
          col: 2,
          effectKey: 'regenStone',
          owner: 1,
          newColor: 1,
          durationMs: 600,
          autoFadeOut: true,
          fadeWholeStone: true
        }])
        .mockReturnValue([])
    };
    global.AnimationEngine = {
      play: jest.fn()
    };
    global.renderCardUI = jest.fn();
    global.syncDiscVisualToCurrentState = jest.fn(() => {
      throw new Error('legacy sync should not be called');
    });

    const ph = require('../ui/presentation-handler');
    await ph.onBoardUpdated();

    expect(safeSync).toHaveBeenCalledWith(1, 2);
    expect(global.syncDiscVisualToCurrentState).not.toHaveBeenCalled();
    expect(crossfadeSpy).toHaveBeenCalledWith(disc, expect.objectContaining({
      effectKey: 'regenStone',
      owner: 1,
      newColor: 1,
      durationMs: 600,
      autoFadeOut: true,
      fadeWholeStone: true
    }));
  });
});
