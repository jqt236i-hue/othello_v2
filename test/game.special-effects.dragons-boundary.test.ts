describe('special-effects dragons UI boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    global.BLACK = 1;
    global.WHITE = -1;
    global.cardState = {
      markers: [
        { kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'DRAGON' } }
      ]
    };
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.gameState.board[2][3] = global.BLACK;
    global.MarkersAdapter = {
      getSpecialMarkers: jest.fn((state) => state.markers)
    };
    global.LOG_MESSAGES = {
      dragonConverted: jest.fn(() => 'dragon converted')
    };
    global.getPlayerName = jest.fn(() => '黒');
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitCardStateChange = jest.fn();
  });

  afterEach(() => {
    const dragons = require('../game/special-effects/dragons.js');
    if (dragons && typeof dragons.setUIImpl === 'function') {
      dragons.setUIImpl({});
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
    delete global.emitCardStateChange;
    delete global.PlaybackEngine;
    delete global.PresentationHelper;
  });

  test('turn-start processing ignores global PlaybackEngine and uses injected visual hooks', async () => {
    const setDiscColorAt = jest.fn();
    const removeBombOverlayAt = jest.fn();
    const animateFadeOutAt = jest.fn(() => Promise.resolve());
    global.PlaybackEngine = {
      playPresentationEvents: jest.fn()
    };

    const dragons = require('../game/special-effects/dragons.js');
    dragons.setUIImpl({
      setDiscColorAt,
      removeBombOverlayAt,
      animateFadeOutAt,
      getAnimationTiming: () => 0
    });

    await dragons.processUltimateReverseDragonsAtTurnStart(global.BLACK, [
      { type: 'dragon_converted_start', details: [{ row: 2, col: 3 }] },
      { type: 'dragon_destroyed_anchor_start', details: [{ row: 3, col: 3 }] }
    ]);

    expect(global.PlaybackEngine.playPresentationEvents).not.toHaveBeenCalled();
    expect(removeBombOverlayAt).toHaveBeenCalledWith(2, 3);
    expect(setDiscColorAt).toHaveBeenCalledWith(2, 3, global.WHITE);
    expect(setDiscColorAt).toHaveBeenCalledWith(2, 3, global.BLACK);
    expect(animateFadeOutAt).toHaveBeenCalledWith(3, 3, {
      createGhost: true,
      color: global.BLACK,
      effectKey: 'ultimateDragon'
    });
    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(global.emitGameStateChange).toHaveBeenCalled();
  });

  test('playback path ignores global PresentationHelper and uses injected presentation hook', async () => {
    const emitPresentationEvent = jest.fn();
    const globalPresentationHelper = { emitPresentationEvent: jest.fn() };
    global.gameState.board[2][3] = global.BLACK;

    const dragons = require('../game/special-effects/dragons.js');
    global.PresentationHelper = globalPresentationHelper;
    dragons.setUIImpl({
      playPresentationEvents: jest.fn(),
      emitPresentationEvent
    });

    await dragons.processUltimateReverseDragonsAtTurnStart(global.BLACK, [
      { type: 'regen_triggered_start', details: [{ row: 2, col: 3 }] }
    ]);

    expect(globalPresentationHelper.emitPresentationEvent).not.toHaveBeenCalled();
    expect(emitPresentationEvent).toHaveBeenCalledWith({
      type: 'CROSSFADE_STONE',
      row: 2,
      col: 3,
      effectKey: 'regenStone',
      owner: global.BLACK,
      newColor: global.BLACK,
      durationMs: 600,
      autoFadeOut: true,
      fadeWholeStone: true
    });
    expect(global.emitBoardUpdate).toHaveBeenCalled();
  });
});
