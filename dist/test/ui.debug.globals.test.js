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
            global.window.DEBUG_MODE_ALLOWED = false;
            // stub global helpers used by debug handler
            global.addLog = jest.fn();
            global.disableAutoMode = jest.fn();
            global.ensureDebugActionsLoaded = (cb) => cb && cb();
            global.fillDebugHand = jest.fn();
            global.renderCardUI = jest.fn();
            setup(debugBtn, humanBtn, visualBtn);
            // initial sync should call registerUIGlobals once
            expect(calls.length).toBeGreaterThanOrEqual(1);
            expect(debugBtn.style.display).not.toBe('none');
            expect(debugBtn.getAttribute('aria-pressed')).toBe('false');
            expect(visualBtn.style.display).toBe('none');
            // simulate clicking debug button to toggle ON
            btns['debug']();
            // after click, registerUIGlobals should have been called with DEBUG_UNLIMITED_USAGE true
            const anyTrue = calls.some(p => p.DEBUG_UNLIMITED_USAGE === true || (p.__uiImpl && p.__uiImpl.DEBUG_UNLIMITED_USAGE === true));
            expect(anyTrue).toBeTruthy();
            const debugAllowedEnabled = calls.some(p => p.DEBUG_MODE_ALLOWED === true);
            expect(debugAllowedEnabled).toBeTruthy();
            expect(global.window.DEBUG_MODE_ALLOWED).toBe(true);
            expect(debugBtn.getAttribute('aria-pressed')).toBe('true');
        });
    });
});
//# sourceMappingURL=ui.debug.globals.test.js.map