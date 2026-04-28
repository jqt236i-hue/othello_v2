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
  });
});
