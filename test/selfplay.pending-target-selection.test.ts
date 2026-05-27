const { createSelfplayPendingTargetSelection } = require('../src/engine/selfplay-pending-target-selection.js');

describe('selfplay pending target selection module', () => {
    test('choosePendingTargetByScore uses deterministic row/col tie-break', () => {
        const selection = createSelfplayPendingTargetSelection();
        const targets = [
            { row: 3, col: 3 },
            { row: 1, col: 2 },
            { row: 1, col: 1 }
        ];

        const chosen = selection.choosePendingTargetByScore(targets, () => 10);

        expect(chosen).toEqual({ row: 1, col: 1 });
    });

    test('resolvePendingTargetList prefers named getter before generic selectable targets', () => {
        const selection = createSelfplayPendingTargetSelection({
            CardLogic: {
                getSpecificTargets: () => [{ row: 4, col: 4 }],
                getSelectableTargets: () => [{ row: 0, col: 0 }]
            }
        });

        const chosen = selection.resolvePendingTargetList({}, {}, 'black', ['missingGetter', 'getSpecificTargets']);

        expect(chosen).toEqual([{ row: 4, col: 4 }]);
    });

    test('chooseTargetBySimulation prefers simulated board score and falls back when simulation fails', () => {
        const selection = createSelfplayPendingTargetSelection({
            CardLogic: {
                getSelectableTargets: () => [{ row: 0, col: 1 }, { row: 2, col: 2 }],
                copyCardState: (cardState) => ({ ...cardState })
            },
            Core: {
                copyGameState: (gameState) => ({ ...gameState, board: (gameState.board || []).map((row) => row.slice()) })
            },
            deepClone: (value) => JSON.parse(JSON.stringify(value)),
            clonePrng: (rng) => ({ ...rng }),
            evaluateBoardForPlayer: (gameState) => Number(gameState.score || 0),
            evaluatePositionValue: (row, col) => row * 10 + col
        });

        const simulated = selection.chooseTargetBySimulation(
            { board: [[0]], score: 0 },
            { id: 'card' },
            'black',
            { seed: 1 },
            (_simCardState, simGameState, _playerKey, row, col) => {
                if (row === 0 && col === 1) {
                    simGameState.score = 40;
                    return { applied: true };
                }
                throw new Error('fallback');
            },
            (target) => target.row * 10 + target.col
        );

        expect(simulated).toEqual({ row: 0, col: 1 });
    });
});
