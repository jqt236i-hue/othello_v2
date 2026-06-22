const { createCpuDecisionCardContext } = require('../game/cpu-decision-card-context');

describe('cpu decision card context module', () => {
  test('buildCardUseDecisionContext assembles card, board, plan, and marker metrics', () => {
    const board = [
      [1, 0, 0, -1],
      [0, 1, -1, 0],
      [0, -1, 1, 0],
      [0, 0, 0, -1]
    ];
    const planState = {
      ownCorners: 1,
      oppCorners: 1,
      hasCornerMoveNow: true,
      hasEdgeMoveNow: true,
      cornerEmergency: false,
      cornerHoldMode: true,
      recoveryCostGap: 2,
      highBonusMoveAvailable: true
    };
    const moduleRef = createCpuDecisionCardContext({
      getGameState: () => ({ board }),
      getCardState: () => ({
        charge: { black: 10, white: 5 },
        hands: { black: ['a', 'b'], white: ['x'] },
        decks: { black: ['d1', 'd2'], white: [] },
        hasDestroyedCardThisTurnByPlayer: { black: true },
        markers: [
          { kind: 'specialStone', owner: 'black', row: 0, col: 0, data: { type: 'GUARD' } },
          { kind: 'specialStone', owner: 'white', row: 3, col: 3, data: { type: 'GUARD' } },
          { kind: 'specialStone', owner: 'black', row: 1, col: 1, data: { type: 'METEOR_HOLE' } },
          { kind: 'bomb', owner: 'black', row: 1, col: 1, data: { type: 'TIME_BOMB' } }
        ]
      }),
      resolvePlayerValue: (playerKey: any) => (playerKey === 'black' ? 1 : -1),
      getShapeAwareBoard: (sourceBoard: any) => sourceBoard,
      countBoardStatsForPlayer: () => ({ discDiff: -2, empties: 6 }),
      countEdgeControl: () => ({ ownEdges: 2, oppEdges: 1 }),
      buildCornerPlanState: () => planState,
      getBoardBonusValueAt: () => 3,
      getBoardCellValueSafe: (sourceBoard: any, row: any, col: any) => sourceBoard[row][col],
      getCpuPolicyCore: () => ({
        computeLegalMoveMetrics: () => ({
          maxLegalFlips: 4,
          avgLegalFlips: 2,
          maxLegalGain: 5,
          maxLegalBoardBonus: 3
        })
      })
    });

    const context = moduleRef.buildCardUseDecisionContext(
      'black',
      6,
      2,
      [{ row: 0, col: 1 }],
      ['a']
    );

    expect(context).toMatchObject({
      level: 6,
      whiteLv6Mode: false,
      playerValue: 1,
      legalMovesCount: 2,
      discDiff: -2,
      empties: 6,
      ownCharge: 10,
      oppCharge: 5,
      oppHandSize: 1,
      handSize: 2,
      handCardIds: ['a', 'b'],
      deckRemaining: 2,
      hasDestroyedCardThisTurn: true,
      forceUseCard: false,
      ownCorners: 1,
      oppCorners: 1,
      ownEdges: 2,
      oppEdges: 1,
      hasCornerMoveNow: true,
      hasEdgeMoveNow: true,
      cornerEmergency: false,
      cornerHoldMode: true,
      recoveryCostGap: 2,
      highBonusMoveAvailable: true,
      maxLegalFlips: 4,
      avgLegalFlips: 2,
      maxLegalGain: 5,
      maxLegalBoardBonus: 3,
      cloneSplitEligibleSourceCount: 2,
      ownSpecialCount: 1,
      oppSpecialCount: 1,
      ownGuardCount: 1,
      oppGuardCount: 1,
      usableCardIds: ['a'],
      cornerPlanState: planState
    });
  });

  test('buildCardUseDecisionContext counts BOARD_EXPANSION_GOD when one enemy corner target is legal', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[7][7] = 1;

    const moduleRef = createCpuDecisionCardContext({
      getGameState: () => ({ board }),
      getCardState: () => ({
        charge: { black: 0, white: 27 },
        hands: { black: [], white: ['board_expand_god_01'] },
        decks: { black: [], white: [] },
        markers: []
      }),
      getCardLogic: () => ({
        getBoardExpansionTargets: () => [],
        getBoardExpansionGodTargets: () => [
          { row: 0, col: 0 },
          { row: 7, col: 7 }
        ],
        getBoardExpansionGodRequiredSelectionCount: () => 2,
        getSwapTargets: () => []
      }),
      resolvePlayerValue: (playerKey: any) => (playerKey === 'white' ? -1 : 1),
      getShapeAwareBoard: (sourceBoard: any) => sourceBoard,
      countBoardStatsForPlayer: () => ({ discDiff: 0, empties: 63 }),
      countEdgeControl: () => ({ ownEdges: 0, oppEdges: 0 }),
      buildCornerPlanState: () => ({
        ownCorners: 0,
        oppCorners: 1,
        hasCornerMoveNow: false,
        hasEdgeMoveNow: false,
        cornerEmergency: true,
        cornerHoldMode: false,
        recoveryCostGap: 0,
        highBonusMoveAvailable: false
      }),
      getBoardBonusValueAt: () => 0,
      getBoardCellValueSafe: (sourceBoard: any, row: any, col: any) => sourceBoard[row][col],
      getCpuPolicyCore: () => null,
      isCornerCell: (row: any, col: any) => (
        (row === 0 && col === 0) ||
        (row === 0 && col === 7) ||
        (row === 7 && col === 0) ||
        (row === 7 && col === 7)
      )
    });

    const context = moduleRef.buildCardUseDecisionContext('white', 6, 1, [], ['board_expand_god_01']);

    expect(context.boardExpansionGodEnemyCornerTargetCount).toBe(1);
    expect(context.boardExpansionEnemyCornerTargetCount).toBe(1);
  });
});
