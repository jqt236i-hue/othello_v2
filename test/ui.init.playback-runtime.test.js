const path = require('path');
const { JSDOM } = require('jsdom');

describe('initializeUI playback runtime delegation', () => {
  let dom;
  let playbackStateMock;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://example.com/?debug=1'
    });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.resetGame = jest.fn();
    global.watchdogPing = jest.fn();

    playbackStateMock = {
      syncLegacyWindowFlags: jest.fn(() => ({ isCardAnimating: false, isProcessing: false })),
      ensureDebugRuntime: jest.fn(() => ({ mirrorIntervalId: null, playbackWatchdogId: null }))
    };

    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn()
    }), { virtual: false });

    const playbackStatePath = path.resolve(__dirname, '..', 'ui', 'playback-state-manager.js');
    jest.doMock(playbackStatePath, () => playbackStateMock, { virtual: false });
  });

  afterEach(() => {
    try {
      if (global.window && global.window._watchdogIntervalId) {
        clearInterval(global.window._watchdogIntervalId);
        global.window._watchdogIntervalId = null;
      }
    } catch (e) { /* ignore */ }
    if (dom && dom.window) dom.window.close();
    delete global.window;
    delete global.document;
    delete global.location;
    delete global.resetGame;
    delete global.watchdogPing;
    jest.useRealTimers();
  });

  test('delegates debug playback runtime setup to PlaybackStateManager', async () => {
    const initModule = require('../ui/handlers/init.js');
    await initModule.initializeUI();

    expect(playbackStateMock.syncLegacyWindowFlags).toHaveBeenCalled();
    expect(playbackStateMock.ensureDebugRuntime).toHaveBeenCalledWith(expect.objectContaining({
      readCardAnimating: expect.any(Function),
      readProcessing: expect.any(Function),
      abortPlayback: expect.any(Function),
      getBoardElement: expect.any(Function)
    }));
    expect(global.window._uiMirrorIntervalId).toBeUndefined();
    expect(global.window._playbackWatchdogId).toBeUndefined();
    expect(global.window._watchdogIntervalId).toBeDefined();
  });
});
