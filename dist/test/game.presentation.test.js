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
describe('game/logic/presentation', () => {
    const modPath = path.resolve(__dirname, '..', 'game', 'logic', 'presentation.js');
    beforeEach(() => {
        // Clear module cache to ensure fresh require in each test
        delete require.cache[require.resolve(modPath)];
        // Clear any global PresentationHelper / BoardOps
        try {
            delete global.PresentationHelper;
        }
        catch (e) { }
        try {
            delete global.BoardOps;
        }
        catch (e) { }
    });
    test('registers PresentationHelper on globalThis and forwards to BoardOps if present', () => {
        // provide a fake BoardOps on global
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        const pres = require(modPath);
        expect(typeof pres.emitPresentationEvent).toBe('function');
        // ensure global registration happened
        const registeredHelper = globalThis.PresentationHelper || global.PresentationHelper;
        expect(registeredHelper).toBeDefined();
        expect(typeof registeredHelper.emitPresentationEvent).toBe('function');
        const cardState = { foo: 'bar' };
        const ev = { type: 'TEST_EVENT' };
        const res = pres.emitPresentationEvent(cardState, ev);
        expect(res).toBe(true);
        expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(cardState, ev);
    });
    test('returns false and does not throw when BoardOps missing', () => {
        // No BoardOps provided
        if (typeof global.BoardOps !== 'undefined')
            delete global.BoardOps;
        const pres = require(modPath);
        const res = pres.emitPresentationEvent({}, { type: 'NOOP' });
        expect(res).toBe(false);
    });
});
//# sourceMappingURL=game.presentation.test.js.map