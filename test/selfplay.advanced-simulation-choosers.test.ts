const { createSelfplayAdvancedSimulationChoosers } = require('../src/engine/selfplay-advanced-simulation-choosers.js');

describe('selfplay advanced simulation choosers module', () => {
    test('strong wind fallback and adjustment preserve corner and destination weighting', () => {
        const calls = [];
        const choosers = createSelfplayAdvancedSimulationChoosers({
            CardLogic: {
                applyStrongWindWill: jest.fn()
            },
            chooseTargetBySimulation: (...args) => {
                calls.push(args);
                return null;
            },
            evaluatePositionValue: (row, col) => row * 100 + col,
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            getCellOwnerValueForSelfplay: (gameState, row, col) => gameState.board[row][col],
            isCorner: (row, col) => (row === 0 || row === 7) && (col === 0 || col === 7),
            isEdge: (row, col) => row === 0 || col === 0 || row === 7 || col === 7,
            getBoardBonusAtCell: (_cardState, row, col) => (row === 0 && col === 3) ? 2 : 0
        });

        choosers.chooseStrongWindTarget(
            { board: [[0, 0, -1, 0], [0, 1, 0, 0]] },
            {},
            'black',
            {}
        );

        const fallback = calls[0][5];
        const adjust = calls[0][6];
        expect(fallback({ row: 0, col: 2 }, { board: [[0, 0, -1, 0], [0, 1, 0, 0]] }, {}, 'black')).toBeCloseTo(2 * -1.2, 5);
        expect(fallback({ row: 1, col: 1 }, { board: [[0, 0, -1, 0], [0, 1, 0, 0]] }, {}, 'black')).toBeCloseTo(101 * -0.4, 5);
        expect(
            adjust(
                { row: 0, col: 0 },
                { to: { row: 0, col: 3 } },
                {},
                {},
                { board: [[-1, 0, 0, 0], [0, 1, 0, 0]] },
                {},
                'black'
            )
        ).toBe(7000 - 900 + 1600);
    });

    test('buoyancy and gravity share the same fallback and result bonus profile', () => {
        const calls = [];
        const choosers = createSelfplayAdvancedSimulationChoosers({
            CardLogic: {
                applySuperBuoyancyWill: jest.fn(),
                applySuperGravityWill: jest.fn()
            },
            chooseTargetBySimulation: (...args) => {
                calls.push(args);
                return null;
            },
            evaluatePositionValue: (row, col) => row * 10 + col,
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            getCellOwnerValueForSelfplay: (gameState, row, col) => gameState.board[row][col],
            isCorner: (row, col) => row === 0 && col === 0,
            isEdge: (row, col) => row === 0 || col === 0 || row === 7 || col === 7,
            getBoardBonusAtCell: (_cardState, row, col) => (row === 0 && col === 0) ? 1 : 0
        });

        choosers.chooseSuperBuoyancyTarget({ board: [[-1]] }, {}, 'black', {});
        choosers.chooseSuperGravityTarget({ board: [[-1]] }, {}, 'black', {});

        const buoyancyFallback = calls[0][5];
        const buoyancyAdjust = calls[0][6];
        const gravityFallback = calls[1][5];
        const gravityAdjust = calls[1][6];

        expect(buoyancyFallback({ row: 0, col: 0 }, { board: [[-1]] }, {}, 'black')).toBe(1200);
        expect(gravityFallback({ row: 0, col: 0 }, { board: [[-1]] }, {}, 'black')).toBe(1200);
        expect(buoyancyAdjust({}, { destroyedCount: 2, to: { row: 0, col: 0 } }, {}, {}, {}, {})).toBe(1040 + 5600 + 900);
        expect(gravityAdjust({}, { destroyedCount: 2, to: { row: 0, col: 0 } }, {}, {}, {}, {})).toBe(1040 + 5600 + 900);
    });

    test('meteor, trap, and clone keep their base multipliers', () => {
        const calls = [];
        const choosers = createSelfplayAdvancedSimulationChoosers({
            CardLogic: {
                applyMeteorWill: jest.fn(),
                applyTrapWill: jest.fn(),
                applyCloneWill: jest.fn()
            },
            chooseTargetBySimulation: (...args) => {
                calls.push(args);
                return null;
            },
            evaluatePositionValue: (row, col) => row * 10 + col
        });

        choosers.chooseMeteorTarget({}, {}, 'black', {});
        choosers.chooseTrapTarget({}, {}, 'black', {});
        choosers.chooseCloneTarget({}, {}, 'black', {});

        expect(calls[0][5]({ row: 2, col: 3 })).toBe(23 * 1.35);
        expect(calls[1][5]({ row: 2, col: 3 })).toBe(23 * 1.1);
        expect(calls[2][5]({ row: 2, col: 3 })).toBe(23 * 1.25);
    });

    test('hyperactive inherit, teleport, and cell teleport preserve adjustment heuristics', () => {
        const calls = [];
        const choosers = createSelfplayAdvancedSimulationChoosers({
            CardLogic: {
                applyHyperactiveInheritWill: jest.fn(),
                applyTeleportWill: jest.fn(),
                applyCellTeleportWill: jest.fn()
            },
            chooseTargetBySimulation: (...args) => {
                calls.push(args);
                return null;
            },
            evaluatePositionValue: (row, col) => row * 10 + col,
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            getCellOwnerValueForSelfplay: (gameState, row, col) => gameState.board[row][col],
            isCorner: (row, col) => row === 0 && col === 0,
            isEdge: (row, col) => row === 0 || col === 0 || row === 7 || col === 7,
            isXSquare: (row, col) => row === 1 && col === 1,
            getBoardBonusAtCell: (_cardState, row, col) => (row === 8 && col === 8) ? 2 : 0
        });

        choosers.chooseHyperactiveInheritTarget({ board: [[1, 0], [0, 1]] }, {}, 'black', {});
        choosers.chooseTeleportTarget({ board: [[0, -1]] }, {}, 'black', {});
        choosers.chooseCellTeleportTarget({ board: [[-1]] }, {}, 'black', {});

        expect(calls[0][6]({ row: 1, col: 1 }, {}, { board: [[0, 0], [0, 1]] }, {}, {}, {}, 'black')).toBe(-350);
        expect(calls[1][5]({ row: 0, col: 1 }, { board: [[0, -1]] }, {}, 'black')).toBeCloseTo((1 * 1.4) + 900, 5);
        expect(calls[2][6]({}, { to: { row: 8, col: 8 } }, {}, {}, {}, {})).toBe(1800 + 1600 + 1800);
    });

    test('extend life uses marker priority and owner-position bonuses', () => {
        const calls = [];
        const choosers = createSelfplayAdvancedSimulationChoosers({
            CardLogic: {
                applyExtendLifeWill: jest.fn()
            },
            chooseTargetBySimulation: (...args) => {
                calls.push(args);
                return null;
            },
            evaluatePositionValue: (row, col) => row * 10 + col,
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            getCellOwnerValueForSelfplay: (gameState, row, col) => gameState.board[row][col],
            isCorner: (row, col) => row === 0 && col === 0,
            isEdge: (row, col) => row === 0 || col === 0 || row === 7 || col === 7
        });

        const cardState = {
            markers: [
                { kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'WORK' } }
            ]
        };
        const sourceGameState = { board: [[1]] };

        choosers.chooseExtendLifeTarget(sourceGameState, cardState, 'black', {});
        const fallback = calls[0][5];
        const adjust = calls[0][6];

        expect(fallback({ row: 0, col: 0 })).toBe((0 * 0.6) + 3800);
        expect(adjust({ row: 0, col: 0 }, {}, {}, {}, sourceGameState, cardState, 'black')).toBe(3800 + 1600);
    });
});
