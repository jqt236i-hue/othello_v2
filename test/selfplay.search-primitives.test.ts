const { createSelfplaySearchPrimitives } = require('../src/engine/selfplay-search-primitives.js');

describe('selfplay search primitives module', () => {
    test('counting and applyMoveToBoard preserve board semantics', () => {
        const primitives = createSelfplaySearchPrimitives({
            evaluatePositionValue: () => 0,
            countCorners: () => 0
        });
        const board = [
            [0, -1, 0],
            [1, -1, 0],
            [0, 0, 1]
        ];
        const next = primitives.applyMoveToBoard(board, {
            row: 0,
            col: 0,
            flips: [{ row: 0, col: 1 }]
        }, 1);

        expect(primitives.countEmpties(board)).toBe(5);
        expect(primitives.isStandardBoard(board)).toBe(false);
        expect(primitives.countDiscDiffOnBoard(board, 1)).toBe(0);
        expect(board[0][0]).toBe(0);
        expect(next).toEqual([
            [1, 1, 0],
            [1, -1, 0],
            [0, 0, 1]
        ]);
    });

    test('sort/search helpers keep configured tactical caps and positive miss ratios', () => {
        const primitives = createSelfplaySearchPrimitives({
            evaluatePositionValue: (row, col) => (row === 0 && col === 0 ? 10 : 1),
            countCorners: () => 0
        });
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        const sorted = primitives.sortMovesForSearch([
            { row: 3, col: 3, flips: [] },
            { row: 0, col: 0, flips: [] },
            { row: 2, col: 2, flips: [{ row: 2, col: 3 }] }
        ], 2, board);

        expect(sorted).toEqual([
            { row: 0, col: 0, flips: [] },
            { row: 2, col: 2, flips: [{ row: 2, col: 3 }] }
        ]);
        expect(primitives.resolveTacticalSearchDepth({
            tacticalDepthOpening: 4,
            tacticalDepthMid: 6,
            tacticalDepthEnd: 12
        }, 8, { cornerEmergency: true })).toBe(11);
        expect(primitives.resolveTacticalBeamWidth({ tacticalBeamWidth: 30 }, 9)).toBe(16);
        expect(primitives.resolveTacticalMetricsCandidateLimit({}, 5)).toBe(3);
        expect(primitives.computePositiveOpportunityMissMetrics(100, 60)).toEqual({
            miss: 40,
            ratio: 0.4
        });
    });

    test('minimaxBoardSearch falls back to evaluation when no legal moves remain', () => {
        const primitives = createSelfplaySearchPrimitives({
            getLegalMovesBasic: () => [],
            evaluatePositionValue: () => 0,
            countCorners: (board, playerValue) => {
                const corners = [
                    [0, 0],
                    [0, board[0].length - 1],
                    [board.length - 1, 0],
                    [board.length - 1, board[0].length - 1]
                ];
                let own = 0;
                let opp = 0;
                for (const [row, col] of corners) {
                    const v = board[row][col];
                    if (v === playerValue) own += 1;
                    else if (v === -playerValue) opp += 1;
                }
                return own - opp;
            }
        });
        const board = [
            [1, 0],
            [0, -1]
        ];

        const terminal = primitives.evaluateBoardForSearch(board, 1);
        const searched = primitives.minimaxBoardSearch(board, 1, 1, 3, -Infinity, Infinity, 0, 4);

        expect(searched).toBe(terminal);
    });
});
