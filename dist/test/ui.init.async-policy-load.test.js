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
const jsdom_1 = require("jsdom");
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}
function flushMicrotasks() {
    return new Promise((resolve) => setImmediate(resolve));
}
describe('initializeUI async policy loading', () => {
    beforeEach(() => {
        jest.resetModules();
        const dom = new jsdom_1.JSDOM('<!doctype html><html><body></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        global.CpuPolicy = { loadPolicyForLevel: jest.fn() };
        global.loadCpuPolicy = jest.fn();
        global.resetGame = jest.fn();
    });
    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.CpuPolicy;
        delete global.loadCpuPolicy;
        delete global.initPolicyOnnxModel;
        delete global.initPolicyTableModel;
        delete global.resetGame;
    });
    test('resetGame waits for ONNX and policy-table initialization', async () => {
        const onnxLoad = deferred();
        const tableLoad = deferred();
        global.initPolicyOnnxModel = jest.fn(() => onnxLoad.promise);
        global.initPolicyTableModel = jest.fn(() => tableLoad.promise);
        const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
        jest.doMock(bootstrapPath, () => ({
            installGameDI: jest.fn()
        }), { virtual: false });
        import * as initModule from '../ui/handlers/init.js';
        const initPromise = initModule.initializeUI();
        expect(global.__uiInitialized).toBe(false);
        expect(global.initPolicyOnnxModel).toHaveBeenCalledTimes(1);
        expect(global.initPolicyTableModel).not.toHaveBeenCalled();
        expect(global.resetGame).not.toHaveBeenCalled();
        onnxLoad.resolve();
        await flushMicrotasks();
        expect(global.initPolicyTableModel).toHaveBeenCalledTimes(1);
        expect(global.resetGame).not.toHaveBeenCalled();
        expect(global.__uiInitialized).toBe(false);
        tableLoad.resolve();
        await initPromise;
        expect(global.resetGame).toHaveBeenCalledTimes(1);
        expect(global.__uiInitialized).toBe(true);
    });
});
//# sourceMappingURL=ui.init.async-policy-load.test.js.map