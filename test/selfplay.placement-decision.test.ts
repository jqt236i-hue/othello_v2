const { createSelfplayPlacementDecision } = require('../src/engine/selfplay-placement-decision.js');

describe('selfplay placement decision module', () => {
    test('falls back to strict legal placement when preview legal moves are empty', () => {
        const decide = createSelfplayPlacementDecision({
            Core: {
                getLegalMoves: jest.fn(() => ([{ row: 4, col: 5 }]))
            },
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            getSafeCardContext: jest.fn(() => ({ safe: true })),
            scorePlacementCandidates: jest.fn(() => ({
                move: { row: 4, col: 5 },
                metrics: { kind: 'forced' }
            }))
        });

        const result = decide.decidePlacementAction({
            activeGameState: {},
            activeCardState: {},
            playerKey: 'black',
            pending: null,
            legalMoves: [],
            rng: {},
            options: {}
        });

        expect(result).toEqual({
            action: { type: 'place', row: 4, col: 5 },
            legalMoves: [{ row: 4, col: 5 }],
            placementMetrics: { kind: 'forced' }
        });
    });

    test('returns pass when no legal moves remain even after strict check', () => {
        const decide = createSelfplayPlacementDecision({
            Core: {
                getLegalMoves: jest.fn(() => ([]))
            },
            toPlayerValue: (playerKey) => playerKey,
            getSafeCardContext: jest.fn(),
            scorePlacementCandidates: jest.fn()
        });

        const result = decide.decidePlacementAction({
            activeGameState: {},
            activeCardState: {},
            playerKey: 'black',
            pending: null,
            legalMoves: [],
            rng: {},
            options: {}
        });

        expect(result).toEqual({
            action: { type: 'pass' },
            legalMoves: []
        });
    });

    test('scores normal legal moves and falls back to first move when scoring gives none', () => {
        const scorePlacementCandidates = jest
            .fn()
            .mockReturnValueOnce({ move: { row: 2, col: 2 }, metrics: { score: 1 } })
            .mockReturnValueOnce(null);
        const decide = createSelfplayPlacementDecision({
            Core: {
                getLegalMoves: jest.fn()
            },
            toPlayerValue: (playerKey) => playerKey,
            getSafeCardContext: jest.fn(),
            scorePlacementCandidates
        });

        const first = decide.decidePlacementAction({
            activeGameState: {},
            activeCardState: {},
            playerKey: 'black',
            pending: { type: 'TRAP_WILL' },
            legalMoves: [{ row: 1, col: 1 }, { row: 2, col: 2 }],
            rng: {},
            options: {}
        });
        const second = decide.decidePlacementAction({
            activeGameState: {},
            activeCardState: {},
            playerKey: 'black',
            pending: null,
            legalMoves: [{ row: 1, col: 1 }, { row: 2, col: 2 }],
            rng: {},
            options: {}
        });

        expect(first).toEqual({
            action: { type: 'place', row: 2, col: 2 },
            legalMoves: [{ row: 1, col: 1 }, { row: 2, col: 2 }],
            placementMetrics: { score: 1 }
        });
        expect(second).toEqual({
            action: { type: 'place', row: 1, col: 1 },
            legalMoves: [{ row: 1, col: 1 }, { row: 2, col: 2 }],
            placementMetrics: null
        });
    });
});
