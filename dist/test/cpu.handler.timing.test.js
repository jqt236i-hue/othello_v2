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
/* eslint-env jest */
const path = __importStar(require("path"));
const cpuHandler = require(path.resolve(__dirname, '..', 'game', 'cpu-turn-handler.js'));
describe('cpu-turn-handler timers injection and retry', () => {
    test('processCpuTurn waits when animations are running and retries, then executes move', async () => {
        // Mock timers that allow manual resolution
        function createMockTimers() {
            const resolvers = [];
            return {
                waitMs: (ms) => new Promise(resolve => { resolvers.push(resolve); }),
                _pendingCount: () => resolvers.length,
                resolveNext: () => { const r = resolvers.shift(); if (r)
                    r(); },
                resolveAll: () => { while (resolvers.length) {
                    resolvers.shift()();
                } }
            };
        }
        const mockTimers = createMockTimers();
        // inject timers
        cpuHandler.setTimers(mockTimers);
        // Prepare environment
        global.WHITE = 'white';
        global.BLACK = 'black';
        global.isProcessing = false;
        global.isDebugLogAvailable = () => false;
        // Constants used by handler
        global.ANIMATION_RETRY_DELAY_MS = 80;
        global.ANIMATION_SETTLE_DELAY_MS = 100;
        global.gameState = { currentPlayer: 'white' };
        global.cardState = { hasUsedCardThisTurnByPlayer: { white: true }, pendingEffectByPlayer: { white: null } };
        // Provide minimal stubs for functions used by handler
        global.getActiveProtectionForPlayer = () => [];
        global.getFlipBlockers = () => [];
        global.generateMovesForPlayer = () => [{ row: 1, col: 2, flips: [] }];
        global.selectCpuMoveWithPolicy = (cand) => cand[0];
        // Mock computeCpuAction (not used by handler flow, but safe to have)
        global.computeCpuAction = jest.fn().mockReturnValue({ type: 'move', move: { row: 1, col: 2, flips: [] } });
        // Spy on executeMove to detect final execution
        global.executeMove = jest.fn();
        // playHandAnimation should call callback immediately for testing
        global.playHandAnimation = (color, row, col, cb) => { cb(); };
        // Start with animation running
        global.isCardAnimating = true;
        // Kick off CPU turn
        cpuHandler.processCpuTurn();
        // After first call, a retry should be scheduled via timers.waitMs
        expect(mockTimers._pendingCount()).toBeGreaterThanOrEqual(1);
        // Resolve first wait -> handler will retry and since isCardAnimating still true, another wait should be scheduled
        mockTimers.resolveNext();
        // allow microtasks to run
        await Promise.resolve();
        expect(mockTimers._pendingCount()).toBeGreaterThanOrEqual(1);
        // Now clear animation and resolve the next wait, which should allow move to be executed
        global.isCardAnimating = false;
        mockTimers.resolveNext();
        // allow async callbacks
        await Promise.resolve();
        // executeMove should have been called with the move
        expect(global.executeMove).toHaveBeenCalled();
        const callArgs = global.executeMove.mock.calls[0][0];
        expect(callArgs.row).toBe(1);
        expect(callArgs.col).toBe(2);
        // cleanup
        cpuHandler.setTimers(null);
    });
});
//# sourceMappingURL=cpu.handler.timing.test.js.map