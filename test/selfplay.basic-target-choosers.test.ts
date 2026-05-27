const { createSelfplayBasicTargetChoosers } = require('../src/engine/selfplay-basic-target-choosers.js');

describe('selfplay basic target choosers module', () => {
    function createChoice(targets, ownerByCell, evalByCell) {
        return createSelfplayBasicTargetChoosers({
            CardLogic: {
                getSelectableTargets: () => targets
            },
            choosePendingTargetByScore: (items, scoreTarget) => {
                let best = null;
                let bestScore = Number.NEGATIVE_INFINITY;
                for (const item of items) {
                    const score = Number(scoreTarget(item));
                    if (score > bestScore || (score === bestScore && (!best || item.row < best.row || (item.row === best.row && item.col < best.col)))) {
                        best = item;
                        bestScore = score;
                    }
                }
                return best;
            },
            evaluatePositionValue: (row, col) => Number(evalByCell[`${row},${col}`] || 0),
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            getCellOwnerValueForSelfplay: (_gameState, row, col) => ownerByCell[`${row},${col}`] ?? 0
        });
    }

    test('chooseSwapTarget and choosePositionSwapTarget follow position score order', () => {
        const targets = [{ row: 0, col: 1 }, { row: 2, col: 2 }, { row: 1, col: 1 }];
        const choice = createChoice(
            targets,
            {},
            { '0,1': 5, '2,2': 12, '1,1': 8 }
        );
        const rng = { random: () => 0 };

        expect(choice.chooseSwapTarget({}, {}, 'black', rng)).toEqual({ row: 2, col: 2 });
        expect(choice.choosePositionSwapTarget({}, {}, 'black', rng)).toEqual({ row: 2, col: 2 });
    });

    test('chooseDestroyTarget strongly prefers enemy occupants over own stones', () => {
        const targets = [{ row: 0, col: 0 }, { row: 3, col: 3 }, { row: 1, col: 2 }];
        const choice = createChoice(
            targets,
            { '0,0': 1, '3,3': -1, '1,2': 0 },
            { '0,0': 100, '3,3': 10, '1,2': 50 }
        );
        const rng = { random: () => 0 };

        expect(choice.chooseDestroyTarget({}, {}, 'black', rng)).toEqual({ row: 3, col: 3 });
    });
});
