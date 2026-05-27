describe('special-effects breeding UI boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    global.BLACK = 1;
    global.WHITE = -1;
    global.cardState = {};
    global.gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    global.LOG_MESSAGES = {
      breedingSpawnedImmediate: jest.fn(() => 'spawned immediate')
    };
    global.getPlayerName = jest.fn(() => '黒');
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitCardStateChange = jest.fn();
  });

  afterEach(() => {
    const breeding = require('../game/special-effects/breeding.js');
    if (breeding && typeof breeding.setUIImpl === 'function') {
      breeding.setUIImpl({});
    }
    delete global.BLACK;
    delete global.WHITE;
    delete global.cardState;
    delete global.gameState;
    delete global.LOG_MESSAGES;
    delete global.getPlayerName;
    delete global.emitLogAdded;
    delete global.emitBoardUpdate;
    delete global.emitGameStateChange;
    delete global.emitCardStateChange;
    delete global.PlaybackEngine;
  });

  test('turn-start processing ignores global PlaybackEngine and uses injected fade hook', async () => {
    const animateFadeOutAt = jest.fn(() => Promise.resolve());
    global.PlaybackEngine = {
      playPresentationEvents: jest.fn()
    };

    const breeding = require('../game/special-effects/breeding.js');
    breeding.setUIImpl({
      animateFadeOutAt,
      emitBoardUpdate: global.emitBoardUpdate,
      emitGameStateChange: global.emitGameStateChange,
      emitCardStateChange: global.emitCardStateChange,
      emitLogAdded: global.emitLogAdded,
      getPlayerName: global.getPlayerName
    });

    await breeding.processBreedingEffectsAtTurnStart(global.BLACK, [
      { type: 'breeding_destroyed_start', details: [{ row: 3, col: 4 }] }
    ]);

    expect(global.PlaybackEngine.playPresentationEvents).not.toHaveBeenCalled();
    expect(animateFadeOutAt).toHaveBeenCalledWith(3, 4);
    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(global.emitGameStateChange).toHaveBeenCalled();
  });
});
