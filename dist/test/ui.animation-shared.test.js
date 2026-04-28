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
describe('ui/animation-shared', () => {
    beforeEach(() => {
        jest.resetModules();
        delete process.env.NOANIM;
        delete global.TimerRegistry;
        delete global.window;
    });
    test('isNoAnim respects process env NOANIM', () => {
        process.env.NOANIM = '1';
        const mod = require(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'));
        expect(typeof mod.isNoAnim === 'function').toBeTruthy();
        expect(mod.isNoAnim()).toBeTruthy();
    });
    test('isNoAnim respects window.DISABLE_ANIMATIONS', () => {
        global.window = { DISABLE_ANIMATIONS: true };
        const mod = require(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'));
        expect(mod.isNoAnim()).toBeTruthy();
    });
    test('getTimer returns TimerRegistry when present', () => {
        const fakeRegistry = { setTimeout: () => 1, clearTimeout: () => { }, clearAll: () => { }, pendingCount: () => 0 };
        global.TimerRegistry = fakeRegistry;
        const mod = require(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'));
        const t = mod.getTimer();
        expect(t).toBe(fakeRegistry);
    });
    test('triggerFlip toggles flip class and removeFlip removes it', () => {
        const mod = require(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'));
        // Create a lightweight fake element with classList and offsetHeight so tests run in node env
        const calls = { removed: [], added: [] };
        const div = {
            classList: {
                remove: (c) => calls.removed.push(c),
                add: (c) => calls.added.push(c),
                contains: (c) => calls.added.includes(c) && !calls.removed.includes(c)
            },
            offsetHeight: 0
        };
        // triggerFlip should remove then add 'flip' without throwing
        mod.triggerFlip(div);
        expect(calls.removed.includes('flip')).toBe(true);
        expect(calls.added.includes('flip')).toBe(true);
        // removeFlip should remove the class
        calls.removed = [];
        mod.removeFlip(div);
        expect(calls.removed.includes('flip')).toBe(true);
    });
});
//# sourceMappingURL=ui.animation-shared.test.js.map