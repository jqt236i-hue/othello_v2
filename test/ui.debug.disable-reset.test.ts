import * as path from 'path';

describe('ui debug disable reset behavior', () => {
  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.addLog;
    delete global.fillDebugHand;
    delete global.renderCardUI;
    delete global.resetGame;
    delete global.cardState;
  });

  function createDocumentStub() {
    return {
      documentElement: { classList: { toggle: jest.fn() } },
      body: { classList: { toggle: jest.fn() } },
      getElementById: jest.fn(() => null)
    };
  }

  test('setDebugModeEnabled(false) resets local game after debug hand mutated state', () => {
    const globalsStore = {
      DEBUG_MODE_ALLOWED: true,
      DEBUG_UNLIMITED_USAGE: true,
      DEBUG_HUMAN_VS_HUMAN: true,
      MATCH_MODE: 'cpu'
    };

    global.window = globalsStore;
    global.document = createDocumentStub();
    global.addLog = jest.fn();
    global.fillDebugHand = jest.fn();
    global.renderCardUI = jest.fn();
    global.resetGame = jest.fn();
    global.cardState = {
      debugHandFilled: true,
      debugNoDraw: true
    };

    jest.isolateModules(() => {
      jest.resetModules();
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (payload) => Object.assign(globalsStore, payload || {}),
        getRegisteredUIGlobals: () => globalsStore
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));
      expect(typeof globalsStore.setDebugModeEnabled).toBe('function');
      expect(globalsStore.setDebugModeEnabled(false)).toBe(true);
    });

    expect(global.resetGame).toHaveBeenCalledTimes(1);
    expect(global.cardState.debugHandFilled).toBe(false);
    expect(global.cardState.debugNoDraw).toBe(false);
    expect(global.renderCardUI).not.toHaveBeenCalled();
  });

  test('setDebugModeEnabled(false) does not reset network match even if debug hand flags exist', () => {
    const globalsStore = {
      DEBUG_MODE_ALLOWED: true,
      DEBUG_UNLIMITED_USAGE: true,
      DEBUG_HUMAN_VS_HUMAN: true,
      MATCH_MODE: 'network'
    };

    global.window = globalsStore;
    global.document = createDocumentStub();
    global.addLog = jest.fn();
    global.fillDebugHand = jest.fn();
    global.renderCardUI = jest.fn();
    global.resetGame = jest.fn();
    global.cardState = {
      debugHandFilled: true,
      debugNoDraw: true
    };

    jest.isolateModules(() => {
      jest.resetModules();
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (payload) => Object.assign(globalsStore, payload || {}),
        getRegisteredUIGlobals: () => globalsStore
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));
      expect(typeof globalsStore.setDebugModeEnabled).toBe('function');
      expect(globalsStore.setDebugModeEnabled(false)).toBe(true);
    });

    expect(global.resetGame).not.toHaveBeenCalled();
    expect(global.cardState.debugHandFilled).toBe(false);
    expect(global.cardState.debugNoDraw).toBe(false);
    expect(global.renderCardUI).toHaveBeenCalledTimes(1);
  });
});
