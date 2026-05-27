const { createSelfplayScoreTargetChoosers } = require('../src/engine/selfplay-score-target-choosers.js');

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
            choosePendingTargetByScore: (targets, scoreFn) => {
                capturedTargets = targets;
                capturedScoreFn = scoreFn;
                return targets[0];
            },
            evaluatePositionValue: (row, col) => row * 10 + col,
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            getCellOwnerValueForSelfplay: (gameState, row, col) => gameState.board[row][col],
            isCorner: (row, col) => row === 0 && col === 0,
            isEdge: (row, col) => row === 0 || col === 0 || row === 7 || col === 7
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
            choosePendingTargetByScore: (targets, scoreFn) => {
                calls.push({ targets, scoreFn });
                return targets[0];
            },
            evaluatePositionValue: (row, col) => row * 10 + col
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
            choosePendingTargetByScore: (targets, scoreFn) => scoreFn(targets[0]),
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            isCorner: (row, col) => (row === 0 || row === 7) && (col === 0 || col === 7),
            isEdge: (row, col) => row === 0 || col === 0 || row === 7 || col === 7,
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
