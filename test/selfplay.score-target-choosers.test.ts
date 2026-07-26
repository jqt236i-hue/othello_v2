const { createSelfplayScoreTargetChoosers } = require('../src/engine/selfplay-score-target-choosers.js');
const SharedBoardUtils = require('../shared/shared-board-utils.js');

function createTestBoardContext(gameState = {}, cardState = {}) {
    const source = Array.isArray(gameState.board) ? gameState.board : [];
    const rows = Math.max(4, source.length);
    const cols = Math.max(4, ...source.map((row) => Array.isArray(row) ? row.length : 0));
    const board = Array.from({ length: rows }, (_unused, row) =>
        Array.from({ length: cols }, (_unusedCell, col) =>
            Array.isArray(source[row]) ? (source[row][col] ?? 0) : 0
        )
    );
    return SharedBoardUtils.createBoardContext({
        ...gameState,
        board,
        boardConfig: { rows, cols, shape: 'rectangle' }
    }, cardState);
}

function getTestCellOwner(gameState, cardState, row, col) {
    return SharedBoardUtils.getCellValue(createTestBoardContext(gameState, cardState), row, col);
}

describe('selfplay score target choosers module', () => {
    test('corrosion dedupes targets and favors enemy markers on strong cells', () => {
        let capturedTargets = null;
        let capturedScoreFn = null;
        const chooser = createSelfplayScoreTargetChoosers({
            CardLogic: {
                getCorrosionTargets: () => ([
                    { row: 0, col: 0 },
                    { row: 0, col: 0 },
                    { row: 1, col: 1 }
                ])
            },
            SharedBoardUtils,
            choosePendingTargetByScore: (targets, scoreFn) => {
                capturedTargets = targets;
                capturedScoreFn = scoreFn;
                return targets[0];
            },
            evaluatePositionValue: (row, col) => row * 10 + col,
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            getCellOwnerValueForSelfplay: getTestCellOwner,
            getSelfplayBoard: createTestBoardContext,
            getBoardCellValue: SharedBoardUtils.getCellValue,
            isCorner: SharedBoardUtils.isCorner,
            isEdge: SharedBoardUtils.isEdge
        });

        const cardState = {
            markers: [
                { kind: 'specialStone', row: 0, col: 0, owner: 'white', data: { type: 'WORK', remainingOwnerTurns: 2 } },
                { kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'GUARD', remainingOwnerTurns: 1 } }
            ]
        };
        const gameState = { board: [[-1, 0], [0, 1]] };

        chooser.chooseCorrosionTarget(gameState, cardState, 'black', { random: () => 0 });

        expect(capturedTargets).toEqual([{ row: 0, col: 0 }, { row: 1, col: 1 }]);
        expect(capturedScoreFn({ row: 0, col: 0 })).toBe((0 * 0.15) + (2800 + 560) + 180 + 700);
        expect(capturedScoreFn({ row: 1, col: 1 })).toBeCloseTo((11 * 0.15) - (2400 + 280) - 160, 5);
    });

    test('tempt and capture share selectable-target scoring', () => {
        const calls = [];
        const chooser = createSelfplayScoreTargetChoosers({
            CardLogic: {
                getSelectableTargets: () => ([{ row: 2, col: 3 }])
            },
            SharedBoardUtils,
            choosePendingTargetByScore: (targets, scoreFn) => {
                calls.push({ targets, scoreFn });
                return targets[0];
            },
            evaluatePositionValue: (row, col) => row * 10 + col,
            getSelfplayBoard: createTestBoardContext,
            getBoardCellValue: SharedBoardUtils.getCellValue
        });

        const rng = { random: () => 0.5 };
        chooser.chooseTemptTarget({}, {}, 'black', rng);
        chooser.chooseCaptureTarget({}, {}, 'black', rng);

        expect(calls[0].targets).toEqual([{ row: 2, col: 3 }]);
        expect(calls[0].scoreFn({ row: 2, col: 3 })).toBeCloseTo(23.005, 5);
        expect(calls[1].scoreFn({ row: 2, col: 3 })).toBeCloseTo(23.005, 5);
    });

    test('time bomb scoring accounts for nearby enemy corners and disc pressure', () => {
        const chooser = createSelfplayScoreTargetChoosers({
            CardLogic: {
                getTimeBombTargets: () => ([{ row: 1, col: 1 }])
            },
            SharedBoardUtils,
            choosePendingTargetByScore: (targets, scoreFn) => scoreFn(targets[0]),
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            getSelfplayBoard: createTestBoardContext,
            getBoardCellValue: SharedBoardUtils.getCellValue,
            isCorner: SharedBoardUtils.isCorner,
            isEdge: SharedBoardUtils.isEdge,
            countDiscsByValue: () => -9
        });

        const gameState = {
            board: [
                [-1, -1, 0],
                [0, 0, 0],
                [0, 1, 0]
            ]
        };

        const score = chooser.chooseTimeBombTarget(gameState, {}, 'black', { random: () => 0 });
        expect(score).toBe((12 * 100) + (2 * 100) + 140 + 2400);
    });
});
