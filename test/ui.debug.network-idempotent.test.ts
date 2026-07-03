import * as path from 'path';

describe('ui debug network enable idempotency', () => {
  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.addLog;
    delete global.fillDebugHand;
    delete global.renderCardUI;
  });

  test('setDebugModeEnabled(true) does not refill hand twice when network debug is already enabled', () => {
    const globalsStore = {
      DEBUG_MODE_ALLOWED: false,
      DEBUG_UNLIMITED_USAGE: false,
      DEBUG_HUMAN_VS_HUMAN: false,
      MATCH_MODE: 'network',
      disableAutoMode: jest.fn(),
      ensureDebugActionsLoaded: (cb) => {
        if (typeof cb === 'function') cb();
      }
    };

    global.window = globalsStore;
    global.document = {
      documentElement: { classList: { toggle: jest.fn() } },
      body: { classList: { toggle: jest.fn() } },
      getElementById: jest.fn(() => null)
    };
    global.addLog = jest.fn();
    global.fillDebugHand = jest.fn();
    global.renderCardUI = jest.fn();

    jest.isolateModules(() => {
      jest.resetModules();
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (payload) => Object.assign(globalsStore, payload || {}),
        getRegisteredUIGlobals: () => globalsStore
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));

      expect(typeof globalsStore.setNetworkDebugModeAccess).toBe('function');
      expect(typeof globalsStore.setDebugModeEnabled).toBe('function');

      globalsStore.setNetworkDebugModeAccess({
        networkMode: true,
        roomDebugEnabled: true
      });

      expect(globalsStore.setDebugModeEnabled(true)).toBe(true);
      expect(globalsStore.setDebugModeEnabled(true)).toBe(true);
    });

    expect(global.fillDebugHand).toHaveBeenCalledTimes(1);
    expect(globalsStore.DEBUG_UNLIMITED_USAGE).toBe(true);
    expect(globalsStore.DEBUG_HUMAN_VS_HUMAN).toBe(false);
    expect(global.addLog).not.toHaveBeenCalledWith('🎮 人間vs人間モード: ON （黒白両方操作可能、手札は黒のみ使用）');
  });

  test('setDebugModeEnabled(true) in a normal network room enables local debug only', () => {
    const globalsStore = {
      DEBUG_MODE_ALLOWED: false,
      DEBUG_UNLIMITED_USAGE: false,
      DEBUG_HUMAN_VS_HUMAN: false,
      NETWORK_LOCAL_DEBUG_MODE: false,
      MATCH_MODE: 'network',
      disableAutoMode: jest.fn(),
      ensureDebugActionsLoaded: (cb) => {
        if (typeof cb === 'function') cb();
      }
    };

    global.window = globalsStore;
    global.document = {
      documentElement: { classList: { toggle: jest.fn() } },
      body: { classList: { toggle: jest.fn() } },
      getElementById: jest.fn(() => null)
    };
    global.addLog = jest.fn();
    global.fillDebugHand = jest.fn();
    global.renderCardUI = jest.fn();

    jest.isolateModules(() => {
      jest.resetModules();
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (payload) => Object.assign(globalsStore, payload || {}),
        getRegisteredUIGlobals: () => globalsStore
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));

      expect(typeof globalsStore.setNetworkDebugModeAccess).toBe('function');
      expect(typeof globalsStore.setDebugModeEnabled).toBe('function');

      globalsStore.setNetworkDebugModeAccess({
        networkMode: true,
        roomDebugEnabled: false
      });

      expect(globalsStore.setDebugModeEnabled(true)).toBe(true);
      expect(globalsStore.NETWORK_LOCAL_DEBUG_MODE).toBe(true);
      expect(globalsStore.DEBUG_UNLIMITED_USAGE).toBe(false);
      expect(globalsStore.DEBUG_HUMAN_VS_HUMAN).toBe(false);
      expect(global.fillDebugHand).not.toHaveBeenCalled();

      globalsStore.setNetworkDebugModeAccess({
        networkMode: false,
        roomDebugEnabled: false
      });
    });

    expect(globalsStore.NETWORK_LOCAL_DEBUG_MODE).toBe(false);
  });
});
