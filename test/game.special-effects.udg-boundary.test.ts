describe('special-effects UDG UI boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    global.BLACK = 1;
    global.WHITE = -1;
    global.cardState = {
      markers: [
        { kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'ULTIMATE_DESTROY_GOD' } }
      ]
    };
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.MarkersAdapter = {
      getSpecialMarkers: jest.fn((state) => state.markers)
    };
    global.LOG_MESSAGES = {
      udgDestroyed: jest.fn(() => 'udg destroyed')
    };
    global.getPlayerName = jest.fn(() => '黒');
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
  });

  afterEach(() => {
    const udg = require('../game/special-effects/udg.js');
    if (udg && typeof udg.setUIImpl === 'function') {
      udg.setUIImpl({});
    }
    delete global.BLACK;
    delete global.WHITE;
    delete global.cardState;
    delete global.gameState;
    delete global.MarkersAdapter;
    delete global.LOG_MESSAGES;
    delete global.getPlayerName;
    delete global.emitLogAdded;
    delete global.emitBoardUpdate;
    delete global.emitGameStateChange;
    delete global.PlaybackEngine;
  });

  test('turn-start processing ignores global PlaybackEngine and uses injected fade hook', async () => {
    const animateFadeOutAt = jest.fn(() => Promise.resolve());
    global.PlaybackEngine = {
      playPresentationEvents: jest.fn()
    };

    const udg = require('../game/special-effects/udg.js');
    udg.setUIImpl({ animateFadeOutAt });

    await udg.processUltimateDestroyGodsAtTurnStart(global.BLACK, {
      destroyed: [{ row: 2, col: 3 }],
      expired: [{ row: 3, col: 3 }],
      anchors: []
    });

    expect(global.PlaybackEngine.playPresentationEvents).not.toHaveBeenCalled();
    expect(animateFadeOutAt).toHaveBeenCalledWith(2, 3, undefined);
    expect(animateFadeOutAt).toHaveBeenCalledWith(3, 3, {
      createGhost: true,
      color: global.BLACK,
      effectKey: 'ultimateDestroyGod'
    });
    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(global.emitGameStateChange).toHaveBeenCalled();
  });
});
