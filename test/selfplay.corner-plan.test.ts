const { createSelfplayCornerPlan } = require('../src/engine/selfplay-corner-plan.js');

describe('selfplay corner plan module', () => {
    const cornerPlan = createSelfplayCornerPlan({
        CardLogic: {
            getCardType: (cardId) => ({ rec: 'RECOVERY', hold: 'HOLD' }[cardId] || ''),
            getCardCost: (cardId) => ({ rec: 4, hold: 2 }[cardId] || 0)
        },
        fallbackCornerRecoveryCardTypes: new Set(['RECOVERY']),
        fallbackCornerHoldCardTypes: new Set(['HOLD']),
        getSelfplayBoard: (gameState) => gameState.board,
        toPlayerValue: (playerKey) => (playerKey === 'black' ? 1 : -1),
        isCorner: (row, col, board) => (row === 0 || row === board.length - 1) && (col === 0 || col === board[0].length - 1),
        isEdge: (row, col, board) => row === 0 || row === board.length - 1 || col === 0 || col === board[0].length - 1,
        countCornerControl: () => ({ ownCorners: 0, oppCorners: 1 }),
        countEdgeControl: () => ({ ownEdges: 3, oppEdges: 1 }),
        readSelfplayPendingEffect: () => ({ type: 'LAST_RESORT', placementsRemaining: 2 }),
        SharedBoardUtils: {
            summarizeEdgeRuns: (_board, playerValue) => playerValue === 1
                ? { chainStrength: 4, longestRun: 3, completeLineCount: 0, maxLineLength: 3 }
                : { chainStrength: 1, longestRun: 1, completeLineCount: 0, maxLineLength: 1 }
        }
    });

    test('buildCornerPlanState keeps emergency, readiness, and board bonus flags', () => {
        const gameState = {
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        const cardState = {
            hands: { black: ['rec', 'hold'], white: [] },
            charge: { black: 5, white: 0 },
            boardBonusByCell: { '2,3': 3, '0,0': 1 },
            boardBonusConsumedByCell: {}
        };
        const legalMoves = [{ row: 2, col: 3, flips: [] }, { row: 0, col: 0, flips: [] }];
        const plan = cornerPlan.buildCornerPlanState(gameState, cardState, 'black', legalMoves, ['rec', 'hold']);

        expect(plan).toEqual(expect.objectContaining({
            ownCorners: 0,
            oppCorners: 1,
            hasCornerMoveNow: true,
            hasEdgeMoveNow: false,
            cornerEmergency: true,
            cornerHoldMode: false,
            cornerSeekMode: true,
            recoveryReady: true,
            holdReady: true,
            recoveryCostGap: 0,
            maxBoardBonusOnLegalMoves: 3,
            highBonusMoveAvailable: true,
            ownEdgeChainStrength: 4,
            oppEdgeChainStrength: 1
        }));
    });

    test('buildMovePlanContext exposes pending state and reserve flags', () => {
        const gameState = {
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        const cardState = {
            hands: { black: ['rec'], white: [] },
            charge: { black: 1, white: 0 },
            boardBonusByCell: { '1,1': 2 },
            boardBonusConsumedByCell: { '1,1': true }
        };
        const context = cornerPlan.buildMovePlanContext(gameState, cardState, 'black', [{ row: 1, col: 1, flips: [] }], ['rec']);

        expect(context).toEqual(expect.objectContaining({
            level: 6,
            playerValue: 1,
            ownCharge: 1,
            pendingType: 'LAST_RESORT',
            pendingPlacementsRemaining: 2,
            reserveRecoveryCardReady: false,
            reserveRecoveryCardCostGap: 3,
            hasCornerHoldCardReady: false,
            preferEdgeRetention: false
        }));
        expect(context.cornerPlanState).toEqual(expect.objectContaining({
            recoveryReady: false,
            recoveryCostGap: 3,
            maxBoardBonusOnLegalMoves: 0
        }));
    });
});
