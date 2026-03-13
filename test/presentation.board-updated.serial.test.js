function createDeferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('presentation handler boardUpdated draining', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    delete global.CardLogic;
    delete global.cardState;
    delete global.AnimationEngine;
    delete global.renderCardUI;
    delete global.gameState;
    delete global.GameEvents;
    delete global.BLACK;
    delete global.WHITE;
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

    jest.doMock('../ui/bootstrap', () => ({
      getRegisteredUIGlobals: () => ({ processCpuTurn })
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
});