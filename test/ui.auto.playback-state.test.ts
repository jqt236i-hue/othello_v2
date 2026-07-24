import * as path from 'path';
import { JSDOM } from 'jsdom';

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
    global.WHITE = -1;
    global.gameState = { currentPlayer: 1, turnNumber: 3 };
    global.cardState = { presentationEvents: [], _presentationEventsPersist: [] };
    global.isProcessing = false;
    global.isCardAnimating = false;
    global.processAutoBlackTurn = jest.fn();
    global.addLog = jest.fn();
    global.window.addLog = global.addLog;

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
    delete global.WHITE;
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

  test('does not stop auto mode while CPU processing keeps the same turn active', () => {
    playbackStateMock.getPlaybackActive.mockReturnValue(false);
    playbackStateMock.getCardAnimating.mockReturnValue(false);
    global.window.isProcessing = true;
    global.isProcessing = true;

    const autoModule = require('../ui/handlers/auto.js');
    const button = document.getElementById('autoToggleBtn');
    autoModule.setupAutoToggle(button);

    button.click();
    jest.advanceTimersByTime(800 * 60);

    expect(global.window.AUTO_MODE_ACTIVE).toBe(true);
    expect(global.addLog).not.toHaveBeenCalledWith('Auto mode stopped (safety limit reached)');
    expect(global.processAutoBlackTurn).not.toHaveBeenCalled();
  });

  test('does not count an opponent network turn as a local auto stall', () => {
    playbackStateMock.getPlaybackActive.mockReturnValue(false);
    playbackStateMock.getCardAnimating.mockReturnValue(false);
    global.gameState = { currentPlayer: -1, turnNumber: 12 };
    global.window.gameState = global.gameState;
    global.window.BLACK = 1;
    global.window.WHITE = -1;
    global.window.MatchMode = {
      isNetworkModeActive: jest.fn(() => true)
    };
    global.window.NetworkMatchClient = {
      getSeatKey: jest.fn(() => 'black')
    };
    global.window.NetworkAutoPlay = {
      tick: jest.fn().mockResolvedValue({ handled: true, reason: 'NOT_OWN_TURN' })
    };

    const autoModule = require('../ui/handlers/auto.js');
    const button = document.getElementById('autoToggleBtn');
    autoModule.setupAutoToggle(button);

    button.click();
    jest.advanceTimersByTime(800 * 60);

    expect(global.window.AUTO_MODE_ACTIVE).toBe(true);
    expect(button.textContent).toBe('AUTO: ON');
    expect(global.addLog).not.toHaveBeenCalledWith('Auto mode stopped (safety limit reached)');
  });

  test('does not apply local safety tick limits to a long-running network match', () => {
    playbackStateMock.getPlaybackActive.mockReturnValue(false);
    playbackStateMock.getCardAnimating.mockReturnValue(false);
    global.gameState = { currentPlayer: 1, turnNumber: 12 };
    global.window.gameState = global.gameState;
    global.window.BLACK = 1;
    global.window.WHITE = -1;
    global.window.MatchMode = {
      isNetworkModeActive: jest.fn(() => true)
    };
    const networkTick = jest.fn().mockResolvedValue({ handled: true, reason: 'BUSY' });
    global.window.NetworkAutoPlay = { tick: networkTick };

    const autoModule = require('../ui/handlers/auto.js');
    const button = document.getElementById('autoToggleBtn');
    autoModule.setupAutoToggle(button);

    button.click();
    jest.advanceTimersByTime(800 * 2100);

    expect(networkTick.mock.calls.length).toBeGreaterThan(2000);
    expect(global.window.AUTO_MODE_ACTIVE).toBe(true);
    expect(button.textContent).toBe('AUTO: ON');
    expect(global.addLog).not.toHaveBeenCalledWith('Auto mode stopped (safety limit reached)');
  });

  test('updates the button when the local stall safety limit stops auto mode', () => {
    playbackStateMock.getPlaybackActive.mockReturnValue(false);
    playbackStateMock.getCardAnimating.mockReturnValue(false);

    const autoModule = require('../ui/handlers/auto.js');
    const button = document.getElementById('autoToggleBtn');
    autoModule.setupAutoToggle(button);

    button.click();
    jest.advanceTimersByTime(800 * 60);

    expect(global.window.AUTO_MODE_ACTIVE).toBe(false);
    expect(button.textContent).toBe('AUTO: OFF');
    expect(global.addLog).toHaveBeenCalledWith('Auto mode stopped (safety limit reached)');
  });
});
