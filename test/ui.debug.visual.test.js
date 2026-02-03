const path = require('path');

describe('ui debug visual test button', () => {
  beforeEach(() => {
    // Minimal DOM shims
    require('../tests/jest.setup');
    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;

    // Provide minimal game/card state
    global.gameState = { currentPlayer: BLACK, board: Array.from({ length: 8 }, () => Array(8).fill(EMPTY)) };
    global.cardState = { markers: [] };

    // Stub globals used by debug handler
    global.ensureDebugActionsLoaded = null;
  });

  test('visualTestBtn click calls DebugActions.applyVisualTestBoard and triggers render', () => {
    const registerCalls = [];
    jest.isolateModules(() => {
      jest.resetModules();
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => { registerCalls.push(obj); return obj; }
      }), { virtual: false });

      // Mock the debug-actions module so the handler's require fallback returns our spy
      const dbgMock = { applyVisualTestBoard: jest.fn() };
      jest.doMock(path.resolve(__dirname, '..', 'game', 'debug', 'debug-actions.js'), () => dbgMock, { virtual: false });

      // Provide a window global (some handlers read from window when UIBootstrap getter is absent)
      global.window = global;
      global.DEBUG_UNLIMITED_USAGE = true;
      // stub other global helpers used by handler
      global.addLog = jest.fn();
      global.disableAutoMode = jest.fn();
      global.fillDebugHand = jest.fn();
      global.renderCardUI = jest.fn();

      // Require the module inside isolateModules so it registers via our mock
      require(path.resolve(__dirname, '..', 'ui', 'handlers', 'debug.js'));

      const reg = registerCalls.find(c => c.setupDebugControls);
      expect(reg).toBeDefined();
      const setup = reg.setupDebugControls;

      const btns = {};
      function makeBtn(name) {
        return { addEventListener: (ev, cb) => { btns[name] = cb; }, style: {}, textContent: '' };
      }

      // Make a fake DebugActions with spy
      const dbg = { applyVisualTestBoard: jest.fn(() => true) };
      global.DebugActions = dbg;

      // Stub render/emit functions
      global.emitBoardUpdate = jest.fn();
      global.renderBoard = jest.fn();

      // Ensure debug seed is enabled so visual button is allowed
      global.DEBUG_UNLIMITED_USAGE = true;

      // Call setup and simulate click
      setup(makeBtn('debug'), makeBtn('human'), makeBtn('visual'));

      // Invoke visual button handler
      expect(typeof btns['visual']).toBe('function');
      btns['visual']();

      expect(dbg.applyVisualTestBoard).toHaveBeenCalledWith(global.gameState, global.cardState);
      // Either emitBoardUpdate or renderBoard should be called
      expect(global.emitBoardUpdate.mock.calls.length + global.renderBoard.mock.calls.length).toBeGreaterThan(0);
    });
  });
});
