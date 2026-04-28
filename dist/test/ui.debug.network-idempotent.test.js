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
                if (typeof cb === 'function')
                    cb();
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
//# sourceMappingURL=ui.debug.network-idempotent.test.js.map