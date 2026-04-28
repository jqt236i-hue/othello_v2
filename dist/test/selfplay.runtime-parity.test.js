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
const runner = require(path.resolve(__dirname, '..', 'src', 'engine', 'selfplay-runner.js'));
const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-table-runtime.js'));
const SharedBoardUtils = require(path.resolve(__dirname, '..', 'shared', 'shared-board-utils.js'));
function transformCoord(row, col, size, t) {
    if (t === 0)
        return { row, col };
    if (t === 1)
        return { row: col, col: size - 1 - row };
    if (t === 2)
        return { row: size - 1 - row, col: size - 1 - col };
    if (t === 3)
        return { row: size - 1 - col, col: row };
    if (t === 4)
        return { row, col: size - 1 - col };
    if (t === 5)
        return { row: size - 1 - col, col: size - 1 - row };
    if (t === 6)
        return { row: size - 1 - row, col };
    if (t === 7)
        return { row: col, col: row };
    return { row, col };
}
describe('selfplay/runtime v2 parity', () => {
    beforeEach(() => {
        runtime.clearModel();
        runtime.configure({ enabled: true, minLevel: 4 });
    });
    test('headless and browser runtime choose same move for same v2 model', () => {
        const board = [
            [1, 0, 0],
            [0, -1, 0],
            [0, 0, 0]
        ];
        const candidates = [
            { row: 0, col: 1, flips: [{ row: 0, col: 0 }] },
            { row: 2, col: 2, flips: [{ row: 1, col: 1 }] }
        ];
        const canonical = runtime.canonicalizeBoard(board);
        const selectedRaw = candidates[1];
        const mapped = transformCoord(selectedRaw.row, selectedRaw.col, board.length, canonical.transformId);
        const bestAction = `place:${mapped.row}:${mapped.col}`;
        const stateKey = runtime.makeStateKey('white', canonical.boardKey, null, candidates.length);
        const model = {
            schemaVersion: 'policy_table.v2',
            states: {
                [stateKey]: {
                    bestAction,
                    actions: {
                        [bestAction]: { visits: 20, avgOutcome: 0.8 }
                    }
                }
            }
        };
        expect(runtime.setModel(model)).toBe(true);
        const runtimeSelected = runtime.chooseMove(candidates, {
            playerKey: 'white',
            level: 5,
            board,
            pendingType: null,
            legalMovesCount: candidates.length
        });
        const headlessSelected = runner.selectPlacementMove(candidates, { random: () => 0 }, {
            gameState: { board },
            cardState: {},
            playerKey: 'white',
            pendingType: null,
            legalMovesCount: candidates.length
        }, { policyTableModel: model });
        expect(runtimeSelected).toBe(candidates[1]);
        expect(headlessSelected).toBe(candidates[1]);
    });
    test('headless and browser runtime share the same heuristic tie-break for equal policy stats', () => {
        const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
        const canonical = runtime.canonicalizeBoard(board);
        const stateKey = runtime.makeStateKey('white', canonical.boardKey, null, 2);
        const model = {
            schemaVersion: 'policy_table.v2',
            states: {
                [stateKey]: {
                    bestAction: '',
                    actions: {
                        'place:0:0': { visits: 1, avgOutcome: 0 },
                        'place:3:3': { visits: 1, avgOutcome: 0 }
                    }
                }
            }
        };
        const candidates = [
            { row: 0, col: 0, flips: [] },
            { row: 3, col: 3, flips: [] }
        ];
        const runtimeSelected = runtime.chooseMoveFromModel(model, candidates, {
            playerKey: 'white',
            level: 6,
            board,
            pendingType: null,
            legalMovesCount: candidates.length
        });
        const headlessSelected = runner.selectPlacementMove(candidates, { random: () => 0 }, {
            gameState: { board },
            cardState: {},
            playerKey: 'white',
            pendingType: null,
            legalMovesCount: candidates.length
        }, {
            policyTableModel: model,
            enableTacticalLookahead: false
        });
        expect(runtimeSelected).toBe(candidates[0]);
        expect(headlessSelected).toBe(candidates[0]);
    });
    test('headless parity keeps raw 8x8 policy keys on shaped boards', () => {
        const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
        const rawCanonical = runtime.canonicalizeBoard(board);
        SharedBoardUtils.attachBoardShape(board, {
            boardExpansion: {
                cells: [{ row: 8, col: 0, owner: 'black' }]
            }
        });
        const candidates = [
            { row: 0, col: 0, flips: [] },
            { row: 3, col: 3, flips: [] }
        ];
        const stateKey = runtime.makeStateKey('white', rawCanonical.boardKey, null, candidates.length);
        const model = {
            schemaVersion: 'policy_table.v2',
            states: {
                [stateKey]: {
                    bestAction: 'place:0:0',
                    actions: {
                        'place:0:0': { visits: 12, avgOutcome: 0.6 }
                    }
                }
            }
        };
        const runtimeSelected = runtime.chooseMoveFromModel(model, candidates, {
            playerKey: 'white',
            level: 6,
            board,
            pendingType: null,
            legalMovesCount: candidates.length,
            preferRaw8x8Keys: true
        });
        const headlessSelected = runner.selectPlacementMove(candidates, { random: () => 0 }, {
            gameState: { board },
            cardState: {},
            playerKey: 'white',
            pendingType: null,
            legalMovesCount: candidates.length
        }, {
            policyTableModel: model,
            enableTacticalLookahead: false
        });
        expect(runtimeSelected).toBe(candidates[0]);
        expect(headlessSelected).toBe(candidates[0]);
    });
});
//# sourceMappingURL=selfplay.runtime-parity.test.js.map