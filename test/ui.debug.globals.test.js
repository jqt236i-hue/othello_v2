const path = require('path');

describe('ui debug handler global registration', () => {
  test('registerUIGlobals is called with setupDebugControls when available', () => {
    // Mock the bootstrap module
    const registerCalls = [];
    jest.isolateModules(() => {
      jest.resetModules();
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => { registerCalls.push(obj); return obj; }
      }), { virtual: false });

      // Require the debug module - it should call registerUIGlobals at load
      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));
    });

    expect(registerCalls.length).toBeGreaterThanOrEqual(1);
    const last = registerCalls[registerCalls.length - 1];
    expect(typeof last.setupDebugControls).toBe('function');
  });

  test('setupDebugControls uses registerUIGlobals to sync flags on toggle', () => {
    const calls = [];
    // Mock registerUIGlobals to capture payload updates
    jest.isolateModules(() => {
      jest.resetModules();
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => { calls.push(obj); return obj; }
      }), { virtual: false });

      const debug = require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));
      // locate the registered setupDebugControls function from first call
      const reg = calls.find(c => c.setupDebugControls);
      const setup = reg.setupDebugControls;

      // Create fake buttons that capture click handlers
      const btns = {};
      const makeBtn = (id) => ({
        addEventListener: (ev, cb) => { btns[id] = cb; },
        style: {},
        textContent: ''
      });

      const debugBtn = makeBtn('debug');
      const humanBtn = makeBtn('human');
      const visualBtn = makeBtn('visual');

      // initialize with default flags false
      global.window = {};
      // stub global helpers used by debug handler
      global.addLog = jest.fn();
      global.disableAutoMode = jest.fn();
      global.ensureDebugActionsLoaded = (cb) => cb && cb();
      global.fillDebugHand = jest.fn();
      global.renderCardUI = jest.fn();

      setup(debugBtn, humanBtn, visualBtn);

      // initial sync should call registerUIGlobals once
      expect(calls.length).toBeGreaterThanOrEqual(1);

      // simulate clicking debug button to toggle ON
      btns['debug']();

      // after click, registerUIGlobals should have been called with DEBUG_UNLIMITED_USAGE true
      const anyTrue = calls.some(p => p.DEBUG_UNLIMITED_USAGE === true || (p.__uiImpl && p.__uiImpl.DEBUG_UNLIMITED_USAGE === true));
      expect(anyTrue).toBeTruthy();
    });
  });
});
