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
const cpuHandler = require(path.resolve(__dirname, '..', 'game', 'cpu-turn-handler.js'));
function waitTick() {
    return new Promise((resolve) => setImmediate(resolve));
}
describe('cpu turn handler network guard', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        cpuHandler.setTimers({
            waitMs: () => Promise.resolve()
        });
        global.MATCH_MODE = 'network';
        global.cardState = {
            hasUsedCardThisTurnByPlayer: { white: false, black: false },
            pendingEffectByPlayer: { white: null, black: null },
            hands: { white: [], black: [] }
        };
        global.gameState = { currentPlayer: 'white', turnNumber: 12 };
        global.BLACK = 1;
        global.WHITE = -1;
        global.isCardAnimating = false;
        global.isProcessing = false;
        global.isGameOver = jest.fn(() => false);
        global.isDebugLogAvailable = () => false;
        global.generateMovesForPlayer = jest.fn(() => [{ row: 2, col: 3, flips: [] }]);
        global.selectCpuMoveWithPolicy = jest.fn(() => ({ row: 2, col: 3, flips: [] }));
        global.playHandAnimation = jest.fn((player, row, col, cb) => cb());
        global.executeMove = jest.fn();
        global.cpuMaybeUseCardWithPolicy = jest.fn(() => {
            global.cardState.hasUsedCardThisTurnByPlayer.white = true;
            return true;
        });
    });
    afterEach(() => {
        cpuHandler.setTimers(null);
        delete global.MATCH_MODE;
        delete global.cardState;
        delete global.gameState;
        delete global.BLACK;
        delete global.WHITE;
        delete global.isCardAnimating;
        delete global.isProcessing;
        delete global.isGameOver;
        delete global.isDebugLogAvailable;
        delete global.generateMovesForPlayer;
        delete global.selectCpuMoveWithPolicy;
        delete global.playHandAnimation;
        delete global.executeMove;
        delete global.cpuMaybeUseCardWithPolicy;
    });
    test('runCpuTurn does not mutate state in network mode', async () => {
        await cpuHandler.runCpuTurn('white');
        expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
        expect(global.executeMove).not.toHaveBeenCalled();
        expect(global.cardState.hasUsedCardThisTurnByPlayer.white).toBe(false);
        expect(global.isProcessing).toBe(false);
    });
    test('scheduled processCpuTurn retry also stays inert in network mode', async () => {
        global.isProcessing = true;
        cpuHandler.processCpuTurn();
        await waitTick();
        await waitTick();
        expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
        expect(global.executeMove).not.toHaveBeenCalled();
        expect(global.cardState.hasUsedCardThisTurnByPlayer.white).toBe(false);
    });
});
//# sourceMappingURL=cpu.turn-handler.network-guard.test.js.map