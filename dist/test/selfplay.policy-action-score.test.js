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
describe('selfplay policy action score', () => {
    test('returns numeric score for use_card action on v2 model', () => {
        const board = [
            [1, 0],
            [0, -1]
        ];
        const canonical = runtime.canonicalizeBoard(board);
        const stateKey = runtime.makeStateKey('black', canonical.boardKey, null, 2);
        const model = {
            schemaVersion: 'policy_table.v2',
            states: {
                [stateKey]: {
                    bestAction: 'use_card:udg',
                    actions: {
                        'use_card:udg': { visits: 9, avgOutcome: 0.6 }
                    }
                }
            }
        };
        const score = runner.getPolicyActionScoreByKey({ policyTableModel: model }, {
            gameState: { board },
            cardState: {},
            playerKey: 'black',
            pendingType: null,
            legalMovesCount: 2
        }, 'use_card:udg');
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThan(1000);
    });
    test('returns null when action is missing', () => {
        const board = [[0]];
        const score = runner.getPolicyActionScoreByKey({ policyTableModel: { schemaVersion: 'policy_table.v2', states: {} } }, {
            gameState: { board },
            cardState: {},
            playerKey: 'white',
            pendingType: null,
            legalMovesCount: 1
        }, 'use_card:missing');
        expect(score).toBeNull();
    });
    test('getPolicyActionScoreByKey can use abstract state fallback for card action', () => {
        const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
        board[3][3] = 1;
        board[3][4] = -1;
        board[4][3] = -1;
        board[4][4] = 1;
        const model = {
            schemaVersion: 'policy_table.v2',
            states: {},
            abstractStates: {
                'white|-|opening|mob:2|disc:0|corner:0': {
                    bestAction: 'use_card:udg',
                    actions: {
                        'use_card:udg': { visits: 10, avgOutcome: 0.7 }
                    }
                }
            }
        };
        const score = runner.getPolicyActionScoreByKey({ policyTableModel: model }, {
            gameState: { board },
            cardState: {},
            playerKey: 'white',
            pendingType: null,
            legalMovesCount: 2
        }, 'use_card:udg');
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThan(1000);
    });
});
//# sourceMappingURL=selfplay.policy-action-score.test.js.map