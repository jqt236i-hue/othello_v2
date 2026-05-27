const Core = require('../game/logic/core.js');
const CardLogic = require('../game/logic/cards.js');
const SharedBoardUtils = require('../shared/shared-board-utils.js');
const OthelloCore = require('../shared/othello-core.js');
const PendingCoordinator = require('../game/turn/pending-coordinator.js');
const { createSelfplayBoardPrimitives } = require('../src/engine/selfplay-board-primitives.js');

describe('selfplay board primitives module', () => {
    const primitives = createSelfplayBoardPrimitives({
        Core,
        CardLogic,
        SharedBoardUtils,
        OthelloCore,
        PendingCoordinator
    });

    test('canonicalizeBoard keeps the same boardKey across rotations', () => {
        const board = [
            [Core.BLACK, 0, 0],
            [0, Core.WHITE, 0],
            [0, 0, 0]
        ];
        const rotated = [
            [0, 0, Core.BLACK],
            [0, Core.WHITE, 0],
            [0, 0, 0]
        ];

        expect(primitives.encodeBoard(board)).toBe('B../.W./...');
        expect(primitives.canonicalizeBoard(board).boardKey).toBe(primitives.canonicalizeBoard(rotated).boardKey);
    });

    test('resolveForcedPlacementCandidates preserves corner then edge preference', () => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        const moves = [
            { row: 0, col: 0, flips: [] },
            { row: 0, col: 3, flips: [] },
            { row: 3, col: 3, flips: [] }
        ];

        expect(primitives.resolveForcedPlacementCandidates(moves, {}, board)).toEqual({
            category: 'corner',
            moves: [moves[0]]
        });
        expect(primitives.resolveForcedPlacementCandidates(moves.slice(1), { forceCornerEdgePlacement: true }, board)).toEqual({
            category: 'edge',
            moves: [moves[1]]
        });
        expect(primitives.resolveForcedPlacementCandidates(moves.slice(1), { forceCornerEdgePlacement: false }, board)).toEqual({
            category: null,
            moves: moves.slice(1)
        });
    });

    test('getSelfplayBoard and pending fallback stay headless-safe', () => {
        const gameState = {
            board: Array.from({ length: 8 }, () => Array(8).fill(0)),
            boardExpansion: {
                active: true,
                side: 'right',
                row: 0,
                owner: 0,
                usedByPlayer: { black: false, white: false },
                cells: [{ side: 'right', row: 0, col: 8, owner: Core.BLACK }]
            }
        };
        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'CHAIN_WILL', stage: 'selectTarget' },
                white: null
            }
        };

        const board = primitives.getSelfplayBoard(gameState, cardState);

        expect(SharedBoardUtils.getCellValue(board, 0, 8)).toBe(Core.BLACK);
        expect(primitives.readSelfplayPendingEffect(cardState, 'black')).toEqual({
            type: 'CHAIN_WILL',
            stage: 'selectTarget'
        });
    });
});
