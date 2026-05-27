const { createSelfplayDecisionContext } = require('../src/engine/selfplay-decision-context.js');

describe('selfplay decision context module', () => {
    test('getLegalMovesForAction switches between legal and free-placement moves and filters invalid entries', () => {
        const context = createSelfplayDecisionContext({
            Core: {
                getFreePlacementMoves: jest.fn(() => ([{ row: 1, col: 2 }, { row: 'x', col: 0 }])),
                getLegalMoves: jest.fn(() => ([{ row: 3, col: 4 }, null]))
            },
            CardLogic: {
                getPendingEffectType: jest.fn((_cardState, playerKey) => playerKey === 'black' ? 'FREE' : null),
                isFreePlacementPendingType: jest.fn((type) => type === 'FREE'),
                getUsableCardIds: jest.fn()
            },
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            getSafeCardContext: jest.fn(() => ({ safe: true }))
        });

        expect(context.getLegalMovesForAction({}, {}, 'black')).toEqual([{ row: 1, col: 2 }]);
        expect(context.getLegalMovesForAction({}, {}, 'white')).toEqual([{ row: 3, col: 4 }]);
    });

    test('getDirectUsableCardIds normalizes, trims, and dedupes ids', () => {
        const context = createSelfplayDecisionContext({
            CardLogic: {
                getUsableCardIds: () => [' a ', 'b', 'a', '', null]
            }
        });

        expect(context.getDirectUsableCardIds({}, {}, 'black')).toEqual(['a', 'b']);
    });

    test('buildCardDecisionContext preserves legal metrics, special counts, and derived flags', () => {
        const context = createSelfplayDecisionContext({
            CardLogic: {
                getUsableCardIds: () => ['alpha'],
                getPendingEffectType: () => null,
                isFreePlacementPendingType: () => false
            },
            CpuPolicyCore: {
                computeLegalMoveMetrics: jest.fn(() => ({
                    maxLegalFlips: 4,
                    avgLegalFlips: 2,
                    maxLegalGain: 7,
                    maxLegalBoardBonus: 3
                }))
            },
            toPlayerValue: (playerKey) => playerKey === 'black' ? 1 : -1,
            getSafeCardContext: () => ({ safe: true }),
            readSelfplayPendingEffect: jest.fn(() => null),
            buildCornerPlanState: jest.fn(() => ({
                ownCorners: 1,
                oppCorners: 2,
                ownEdges: 3,
                oppEdges: 4,
                hasCornerMoveNow: true,
                hasEdgeMoveNow: false,
                cornerEmergency: true,
                cornerHoldMode: false,
                recoveryCostGap: 6,
                highBonusMoveAvailable: true
            })),
            getBoardBonusAtCell: (_cardState, row, col) => row + col,
            countDiscsByValue: () => -3,
            countEmpties: () => 12
        });

        const out = context.buildCardDecisionContext(
            { board: Array.from({ length: 8 }, () => Array(8).fill(0)) },
            {
                hasDestroyedCardThisTurnByPlayer: { black: true },
                charge: { black: 5, white: 2 },
                hands: { black: ['alpha', 'beta'], white: ['omega'] },
                markers: [
                    { kind: 'specialStone', owner: 'black', data: { type: 'GUARD' } },
                    { kind: 'specialStone', owner: 'black', data: { type: 'WORK' } },
                    { kind: 'specialStone', owner: 'white', data: { type: 'GUARD' } },
                    { kind: 'specialStone', owner: 'white', data: { type: 'METEOR_HOLE' } }
                ]
            },
            'black',
            0,
            [{ row: 2, col: 3 }],
            ['alpha']
        );

        expect(out).toEqual(expect.objectContaining({
            level: 6,
            playerValue: 1,
            legalMovesCount: 0,
            discDiff: -3,
            empties: 12,
            ownCharge: 5,
            oppCharge: 2,
            oppHandSize: 1,
            handSize: 2,
            handCardIds: ['alpha', 'beta'],
            hasDestroyedCardThisTurn: true,
            forceUseCard: true,
            ownCorners: 1,
            oppCorners: 2,
            ownEdges: 3,
            oppEdges: 4,
            cornerEmergency: true,
            recoveryCostGap: 6,
            highBonusMoveAvailable: true,
            maxLegalFlips: 4,
            avgLegalFlips: 2,
            maxLegalGain: 7,
            maxLegalBoardBonus: 3,
            ownSpecialCount: 2,
            oppSpecialCount: 1,
            ownGuardCount: 1,
            oppGuardCount: 1,
            usableCardIds: ['alpha']
        }));
    });
});
