import * as path from 'path';

const runner = require(path.resolve(__dirname, '..', 'src', 'engine', 'selfplay-runner.js'));
const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-table-runtime.js'));

describe('selfplay policy model behavior', () => {
    test('getPolicyActionScoreByKey returns numeric score for concrete v2 state', () => {
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

        const score = runner.getPolicyActionScoreByKey(
            { policyTableModel: model },
            {
                gameState: { board },
                cardState: {},
                playerKey: 'black',
                pendingType: null,
                legalMovesCount: 2
            },
            'use_card:udg'
        );

        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThan(1000);
    });

    test('getPolicyActionScoreByKey falls back to abstract state for card actions', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
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

        const score = runner.getPolicyActionScoreByKey(
            { policyTableModel: model },
            {
                gameState: { board },
                cardState: {},
                playerKey: 'white',
                pendingType: null,
                legalMovesCount: 2
            },
            'use_card:udg'
        );

        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThan(1000);
    });

    test('selectPlacementMove respects v2 policy action selection and tie-break parity', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        const canonical = runtime.canonicalizeBoard(board);
        const stateKey = runtime.makeStateKey('white', canonical.boardKey, null, 2);
        const candidates = [
            { row: 0, col: 0, flips: [] },
            { row: 3, col: 3, flips: [] }
        ];
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

        const selected = runner.selectPlacementMove(
            candidates,
            { random: () => 0 },
            {
                gameState: { board },
                cardState: {},
                playerKey: 'white',
                pendingType: null,
                legalMovesCount: candidates.length
            },
            {
                policyTableModel: model,
                enableTacticalLookahead: false
            }
        );

        expect(selected).toBe(candidates[0]);
    });
});
