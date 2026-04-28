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
const CpuLv6LookaheadProfile = require(path.resolve(__dirname, '..', 'game', 'ai', 'cpu-lv6-lookahead-profile.js'));
const cpuLv6SharedProfile = require(path.resolve(__dirname, '..', 'constants', 'cpu-lv6-shared-profile.js'));
function makeBoard(fillValue = 0) {
    return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => fillValue));
}
function makeDenseBoard() {
    const board = makeBoard(1);
    let empties = 16;
    for (let row = 0; row < 8 && empties > 0; row += 1) {
        for (let col = 0; col < 8 && empties > 0; col += 1) {
            board[row][col] = 0;
            empties -= 1;
        }
    }
    return board;
}
function makeMidBoard() {
    const board = makeBoard(0);
    let filled = 32;
    for (let row = 0; row < 8 && filled > 0; row += 1) {
        for (let col = 0; col < 8 && filled > 0; col += 1) {
            board[row][col] = ((row + col) % 2 === 0) ? 1 : -1;
            filled -= 1;
        }
    }
    return board;
}
describe('cpu lv6 lookahead profile', () => {
    test('browser ui opening options stay lightweight for Lv6', () => {
        const options = CpuLv6LookaheadProfile.buildLv6LookaheadOptions(6, makeBoard(), 8, 'white', 'ui');
        expect(options.depth).toBe(4);
        expect(options.maxBranch).toBe(6);
        expect(options.maxTimeMs).toBeLessThanOrEqual(1250);
        expect(options.endgameSolveEmpties).toBe(16);
        expect(options.endgameDepth).toBe(12);
        expect(options.endgameMaxTimeMs).toBeLessThanOrEqual(1800);
    });
    test('browser ui midgame options deepen corner and edge lookahead for Lv6', () => {
        const options = CpuLv6LookaheadProfile.buildLv6LookaheadOptions(6, makeMidBoard(), 7, 'white', 'ui');
        expect(options.depth).toBe(6);
        expect(options.maxBranch).toBe(7);
        expect(options.maxTimeMs).toBeLessThanOrEqual(1250);
        expect(options.endgameSolveEmpties).toBe(16);
        expect(options.endgameDepth).toBe(12);
        expect(options.endgameMaxTimeMs).toBeLessThanOrEqual(1800);
    });
    test('browser ui dense-board options stay deeper without going full long-think mode', () => {
        const options = CpuLv6LookaheadProfile.buildLv6LookaheadOptions(6, makeDenseBoard(), 6, 'white', 'ui');
        expect(options.depth).toBe(7);
        expect(options.maxBranch).toBe(6);
        expect(options.maxTimeMs).toBeLessThanOrEqual(1250);
        expect(options.endgameSolveEmpties).toBe(20);
        expect(options.endgameDepth).toBe(16);
        expect(options.endgameMaxTimeMs).toBeLessThanOrEqual(1800);
    });
    test('teacher lookahead accepts runtime depth and beam overrides without changing teacher caps', () => {
        const options = CpuLv6LookaheadProfile.buildLv6LookaheadOptions(6, makeMidBoard(), 7, 'black', 'teacher', {
            tacticalDepthOpening: 4,
            tacticalDepthMid: 5,
            tacticalDepthEnd: 6,
            tacticalBeamWidth: 4
        });
        expect(options.depth).toBe(5);
        expect(options.maxBranch).toBe(4);
        expect(options.maxTimeMs).toBeLessThanOrEqual(80);
        expect(options.endgameMaxTimeMs).toBeLessThanOrEqual(160);
    });
    test('shared lookahead weights resolve from the shared browser profile', () => {
        expect(CpuLv6LookaheadProfile.resolveLv6LookaheadWeights()).toEqual(cpuLv6SharedProfile.browser.lookaheadWeights);
    });
});
//# sourceMappingURL=game.cpu-lv6-lookahead-profile.test.js.map