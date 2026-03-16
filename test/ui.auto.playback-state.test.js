const path = require('path');
const { JSDOM } = require('jsdom');

describe('setupAutoToggle playback-state gating', () => {
  let dom;
  let playbackStateMock;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    dom = new JSDOM('<!doctype html><html><body><button id="autoToggleBtn">AUTO</button></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;

    global.BLACK = 1;
    global.gameState = { currentPlayer: 1, turnNumber: 3 };
    global.cardState = { presentationEvents: [], _presentationEventsPersist: [] };
    global.isProcessing = false;
    global.isCardAnimating = false;
    global.processAutoBlackTurn = jest.fn();
    global.addLog = jest.fn();

    global.window.isProcessing = false;
    global.window.isCardAnimating = false;
    global.window.VisualPlaybackActive = false;

    playbackStateMock = {
      getPlaybackActive: jest.fn(() => true),
      getCardAnimating: jest.fn(() => false)
    };

    const playbackStatePath = path.resolve(__dirname, '..', 'ui', 'playback-state-manager.js');
    jest.doMock(playbackStatePath, () => playbackStateMock, { virtual: false });

    const autoModulePath = path.resolve(__dirname, '..', 'game', 'auto.js');
    jest.doMock(autoModulePath, () => ({
      isEnabled: jest.fn(() => false),
      disable: jest.fn()
    }), { virtual: false });
  });

  afterEach(() => {
    try {
      if (global.window && typeof global.window.disableAutoMode === 'function') {
        global.window.disableAutoMode();
      }
    } catch (e) { /* ignore */ }
    if (dom && dom.window) dom.window.close();
    delete global.window;
    delete global.document;
    delete global.BLACK;
    delete global.gameState;
    delete global.cardState;
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.processAutoBlackTurn;
    delete global.addLog;
    jest.useRealTimers();
  });

  test('blocks auto turns when the playback manager reports active playback', () => {
    const autoModule = require('../ui/handlers/auto.js');
    const button = document.getElementById('autoToggleBtn');
    autoModule.setupAutoToggle(button);

    button.click();
    jest.advanceTimersByTime(800);

    expect(playbackStateMock.getPlaybackActive).toHaveBeenCalled();
    expect(global.window.VisualPlaybackActive).toBe(false);
    expect(global.window.isCardAnimating).toBe(false);
    expect(global.processAutoBlackTurn).not.toHaveBeenCalled();
  });
});
