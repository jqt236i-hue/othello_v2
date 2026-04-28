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
//# sourceMappingURL=ui.debug.disable-reset.test.js.map