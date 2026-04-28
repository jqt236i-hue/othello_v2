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
const mod = __importStar(require("../game/cpu-turn-handler.js"));
describe('cpu-turn-handler helpers', () => {
    afterEach(() => {
        // restore timers
        mod.setTimers(null);
        if (typeof mod.resetCpuTurnHandlerState === 'function') {
            mod.resetCpuTurnHandlerState();
        }
        jest.useRealTimers();
        // cleanup any globals we set
        delete global.cpuSelectDestroyWithPolicy;
        delete global.BLACK;
        delete global.WHITE;
        delete global.cpuSmartness;
        delete global.gameState;
        delete global.cardState;
        delete global.isCardAnimating;
        delete global.isProcessing;
        delete global.isGameOver;
        delete global.PlaybackStateManager;
    });
    test('scheduleRetry uses timers.waitMs when available', async () => {
        let called = false;
        const timers = { waitMs: jest.fn(() => Promise.resolve()) };
        mod.setTimers(timers);
        mod.scheduleRetry(() => { called = true; }, 0);
        // wait for microtask queue to drain
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(timers.waitMs).toHaveBeenCalled();
        expect(called).toBe(true);
    });
    test('scheduleRetry falls back to setTimeout when timers absent', () => {
        mod.setTimers(null);
        jest.useFakeTimers();
        const cb = jest.fn();
        // Force require('./timers').waitMs to throw so shared helper falls back to setTimeout
        import * as timersModule from '../game/timers.js';
        const spy = jest.spyOn(timersModule, 'waitMs').mockImplementation(() => { throw new Error('no'); });
        mod.scheduleRetry(cb, 20);
        jest.advanceTimersByTime(20);
        expect(cb).toHaveBeenCalled();
        spy.mockRestore();
    });
    test('getPendingTypeHandlers returns handlers that invoke CPU selection helpers', async () => {
        let invoked = false;
        // stub the selector
        global.cpuSelectDestroyWithPolicy = async (playerKey) => { invoked = true; };
        const h = mod.getPendingTypeHandlers('white');
        expect(typeof h.DESTROY_ONE_STONE).toBe('function');
        await h.DESTROY_ONE_STONE();
        expect(invoked).toBe(true);
    });
    test('resetCpuTurnHandlerState clears stale scheduled retry latch', async () => {
        const waitMs = jest.fn(() => new Promise(() => { }));
        mod.setTimers({ waitMs });
        global.BLACK = 1;
        global.WHITE = -1;
        global.cpuSmartness = { black: 1, white: 6 };
        global.isCardAnimating = true;
        global.isProcessing = false;
        global.isGameOver = jest.fn(() => false);
        global.gameState = {
            currentPlayer: global.WHITE,
            turnNumber: 7,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        global.cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
            hands: { black: [], white: [] },
            charge: { black: 0, white: 0 }
        };
        await mod.processCpuTurn();
        expect(waitMs).toHaveBeenCalledTimes(1);
        mod.resetCpuTurnHandlerState();
        global.gameState = {
            currentPlayer: global.WHITE,
            turnNumber: 0,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        await mod.processCpuTurn();
        expect(waitMs).toHaveBeenCalledTimes(2);
    });
    test('processCpuTurn defers when PlaybackStateManager reports processing busy', async () => {
        const waitMs = jest.fn(() => new Promise(() => { }));
        mod.setTimers({ waitMs });
        global.BLACK = 1;
        global.WHITE = -1;
        global.cpuSmartness = { black: 1, white: 6 };
        global.isCardAnimating = false;
        global.isProcessing = false;
        global.isGameOver = jest.fn(() => false);
        global.PlaybackStateManager = {
            getProcessing: jest.fn(() => true),
            getCardAnimating: jest.fn(() => false),
            getPlaybackActive: jest.fn(() => false),
            setProcessing: jest.fn()
        };
        global.gameState = {
            currentPlayer: global.WHITE,
            turnNumber: 3,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        global.cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
            hands: { black: [], white: [] },
            charge: { black: 0, white: 0 }
        };
        await mod.processCpuTurn();
        expect(global.PlaybackStateManager.getProcessing).toHaveBeenCalled();
        expect(waitMs).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=cpu.turn-handler.retry.test.js.map