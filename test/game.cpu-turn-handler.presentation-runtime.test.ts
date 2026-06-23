function createDeferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('game cpu turn handler presentation runtime', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    jest.unmock('../game/ai/cpu-commentary-runtime');
    delete global.BLACK;
    delete global.WHITE;
    delete global.DEBUG_HUMAN_VS_HUMAN;
    delete global.gameState;
    delete global.cardState;
    delete global.CardLogic;
    delete global.GamePresentationRuntime;
    delete global.cpuSmartness;
  });

  test('scheduleCpuTurn runs only when player and turn still match', () => {
    jest.useFakeTimers();
    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = { currentPlayer: -1, turnNumber: 12 };

    const { PresentationRuntime } = require('../game/cpu-turn-handler.js');
    const processCpuTurn = jest.fn();

    PresentationRuntime.scheduleCpuTurn(
      { delayMs: 0, expectedPlayerKey: 'white', expectedTurnNumber: 12 },
      { processCpuTurn }
    );
    jest.runOnlyPendingTimers();
    expect(processCpuTurn).toHaveBeenCalledTimes(1);

    processCpuTurn.mockClear();

    PresentationRuntime.scheduleCpuTurn(
      { delayMs: 0, expectedPlayerKey: 'white', expectedTurnNumber: 13 },
      { processCpuTurn }
    );
    jest.runOnlyPendingTimers();
    expect(processCpuTurn).not.toHaveBeenCalled();
  });

  test('requestEnemyCardCommentaryFromPlayback builds commentary context and formats log text', async () => {
    const requestCommentaryMock = jest.fn(async () => 'うるさいぞ！');
    jest.doMock('../game/ai/cpu-commentary-runtime', () => ({
      requestCommentary: requestCommentaryMock
    }));

    global.gameState = {
      turnNumber: 7,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.cpuSmartness = { white: 6 };
    global.gameState.board[3][3] = 1;
    global.gameState.board[3][4] = -1;

    const { PresentationRuntime } = require('../game/cpu-turn-handler.js');
    const entry = await PresentationRuntime.requestEnemyCardCommentaryFromPlayback([{
      type: 'card_use_animation',
      phase: 1,
      targets: [{ owner: ' BLACK ', cardId: 'swap_01', cost: 15, name: '交換の意志' }]
    }]);

    expect(requestCommentaryMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'card_used_by_enemy',
      playerKey: 'white',
      cardId: 'swap_01',
      level: 6
    }));
    expect(entry).toMatchObject({
      prefix: '白CPU',
      line: 'うるさいぞ！',
      text: '白CPU: うるさいぞ！'
    });
  });

  test('flushPendingPresentationEvents clears persisted duplicates when live events exist', () => {
    const { PresentationRuntime } = require('../game/cpu-turn-handler.js');
    const state = {
      _presentationEventsPersist: [{ type: 'STALE' }]
    };
    const liveEvents = [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }];

    const result = PresentationRuntime.flushPendingPresentationEvents(state, {
      flushLiveEvents: jest.fn(() => liveEvents)
    });

    expect(result).toEqual(liveEvents);
    expect(state._presentationEventsPersist).toEqual([]);
  });

  test('createBoardUpdateDrainController serializes overlapping drains', async () => {
    const { PresentationRuntime } = require('../game/cpu-turn-handler.js');
    const controller = PresentationRuntime.createBoardUpdateDrainController();
    const firstDrain = createDeferred();
    const secondDrainStarted = createDeferred();
    const runDrain = jest.fn()
      .mockImplementationOnce(() => firstDrain.promise)
      .mockImplementationOnce(() => {
        secondDrainStarted.resolve();
        return Promise.resolve();
      });

    const firstRequest = controller.requestDrain(runDrain);
    await Promise.resolve();
    expect(runDrain).toHaveBeenCalledTimes(1);

    const secondRequest = controller.requestDrain(runDrain);
    await Promise.resolve();
    expect(runDrain).toHaveBeenCalledTimes(1);

    firstDrain.resolve();
    await secondDrainStarted.promise;
    await Promise.all([firstRequest, secondRequest]);

    expect(runDrain).toHaveBeenCalledTimes(2);
  });
});
