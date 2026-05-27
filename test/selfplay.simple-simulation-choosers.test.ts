const { createSelfplaySimpleSimulationChoosers } = require('../src/engine/selfplay-simple-simulation-choosers.js');

describe('selfplay simple simulation choosers module', () => {
    test('guard and blockade use expected fallback weights', () => {
        const calls = [];
        const choosers = createSelfplaySimpleSimulationChoosers({
            CardLogic: {
                applyGuardWill: jest.fn(),
                applyBlockadeWill: jest.fn()
            },
            chooseTargetBySimulation: (...args) => {
                calls.push(args);
                return { row: 1, col: 1 };
            },
            evaluatePositionValue: (row, col) => row * 100 + col
        });

        choosers.chooseGuardTarget({}, {}, 'black', {});
        choosers.chooseBlockadeTarget({}, {}, 'black', {});

        const guardFallback = calls[0][5];
        const blockadeFallback = calls[1][5];
        expect(guardFallback({ row: 2, col: 3 })).toBe((203) * 1.4);
        expect(blockadeFallback({ row: 2, col: 3 })).toBe((203) * 1.3);
    });

    test('living will and freeze pass their target getter names', () => {
        const targetGetterNames = [];
        const choosers = createSelfplaySimpleSimulationChoosers({
            CardLogic: {
                applyLivingWill: jest.fn(),
                applyFreezeWill: jest.fn()
            },
            chooseTargetBySimulation: (...args) => {
                targetGetterNames.push(args[7]);
                return null;
            },
            evaluatePositionValue: () => 0
        });

        choosers.chooseLivingWillTarget({}, {}, 'black', {});
        choosers.chooseFreezeTarget({}, {}, 'black', {});

        expect(targetGetterNames).toEqual(['getLivingWillTargets', 'getFreezeTargets']);
    });

    test('board expansion and shrink honor pending god variants', () => {
        const applyBoardExpansionGod = jest.fn(() => ({ applied: true }));
        const applyBoardExpansionWill = jest.fn(() => ({ applied: true }));
        const applyBoardShrinkGod = jest.fn(() => ({ applied: true }));
        const applyBoardShrinkWill = jest.fn(() => ({ applied: true }));
        const records = [];
        const choosers = createSelfplaySimpleSimulationChoosers({
            CardLogic: {
                applyBoardExpansionGod,
                applyBoardExpansionWill,
                applyBoardShrinkGod,
                applyBoardShrinkWill
            },
            chooseTargetBySimulation: (...args) => {
                records.push(args);
                return null;
            },
            evaluatePositionValue: () => 0,
            readSelfplayPendingEffect: (_cardState, playerKey) => {
                if (playerKey === 'black') return { type: 'BOARD_EXPANSION_GOD' };
                return { type: 'BOARD_SHRINK_GOD' };
            }
        });

        choosers.chooseBoardExpansionTarget({}, {}, 'black', {});
        choosers.chooseBoardShrinkTarget({}, {}, 'white', {});

        const expansionApply = records[0][4];
        const shrinkApply = records[1][4];
        expansionApply({}, {}, 'black', 0, 0);
        shrinkApply({}, {}, 'white', 0, 0);

        expect(applyBoardExpansionGod).toHaveBeenCalled();
        expect(applyBoardExpansionWill).not.toHaveBeenCalled();
        expect(applyBoardShrinkGod).toHaveBeenCalled();
        expect(applyBoardShrinkWill).not.toHaveBeenCalled();
        expect(records[1][7]).toBe('getBoardShrinkGodTargets');
    });

    test('seed fallback penalizes empty near-corner X and rewards edge placement', () => {
        const records = [];
        const choosers = createSelfplaySimpleSimulationChoosers({
            CardLogic: {
                applySeedWill: jest.fn()
            },
            chooseTargetBySimulation: (...args) => {
                records.push(args);
                return null;
            },
            evaluatePositionValue: (row, col) => row * 10 + col,
            getSelfplayBoard: () => Array.from({ length: 8 }, () => Array(8).fill(0)),
            getCornerProximity: (row, col) => {
                if (row === 1 && col === 1) return { kind: 'X', corner: [0, 0] };
                return null;
            },
            getBoardCellValue: () => 0,
            isEdge: (row, col) => row === 0 || col === 0 || row === 7 || col === 7
        });

        choosers.chooseSeedTarget({}, {}, 'black', {});
        const fallback = records[0][5];

        expect(fallback({ row: 1, col: 1 }, {})).toBeCloseTo((11 * 1.15) - 900, 5);
        expect(fallback({ row: 0, col: 3 }, {})).toBeCloseTo((3 * 1.15) + 180, 5);
        expect(fallback({ row: 3, col: 3 }, {})).toBeCloseTo((33 * 1.15) + 40, 5);
    });
});
