describe('turn-manager browser boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = { currentPlayer: 1 };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      presentationEvents: [],
      _presentationEventsPersist: []
    };
    global.isProcessing = false;
    global.isCardAnimating = true;
    global.VisualPlaybackActive = false;
    global.getActiveProtectionForPlayer = jest.fn(() => []);
    global.getFlipBlockers = jest.fn(() => []);
    global.findMoveForCell = jest.fn();
    global.executeMove = jest.fn();
    global.playHandAnimation = jest.fn();
    const turnManager = require('../game/turn-manager.js');
    turnManager.setUIImpl({
      getRuntimeRoot: () => global,
      readRuntimeValue: (key) => global[key],
      writeRuntimeValue: (key, value) => { global[key] = value; }
    });
  });

  afterEach(() => {
    const turnManager = require('../game/turn-manager.js');
    if (turnManager && typeof turnManager.replaceUIImpl === 'function') {
      turnManager.replaceUIImpl({});
    }
    delete global.BLACK;
    delete global.WHITE;
    delete global.gameState;
    delete global.cardState;
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.VisualPlaybackActive;
    delete global.getActiveProtectionForPlayer;
    delete global.getFlipBlockers;
    delete global.findMoveForCell;
    delete global.executeMove;
    delete global.playHandAnimation;
    delete global.window;
    delete global.__captureServerAuthoredCardUseBoardClick;
  });

  test('handleCellClick does not read server-authored click capture from window', () => {
    const windowCapture = jest.fn(() => true);
    global.window = {
      __captureServerAuthoredCardUseBoardClick: windowCapture
    };

    const turnManager = require('../game/turn-manager.js');
    turnManager.handleCellClick(2, 3);

    expect(windowCapture).not.toHaveBeenCalled();
    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test('handleCellClick still uses the runtime capture bridge', () => {
    global.__captureServerAuthoredCardUseBoardClick = jest.fn(() => true);

    const turnManager = require('../game/turn-manager.js');
    turnManager.handleCellClick(2, 3);

    expect(global.__captureServerAuthoredCardUseBoardClick).toHaveBeenCalledWith(2, 3, 'black');
    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });
});
