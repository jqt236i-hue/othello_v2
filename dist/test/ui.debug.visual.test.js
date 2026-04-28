"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
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
//# sourceMappingURL=ui.debug.visual.test.js.map