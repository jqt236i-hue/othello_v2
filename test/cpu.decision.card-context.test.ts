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
      getCardLogic: () => ({
        getCardDef: (cardId: string) => ({ id: cardId, type: cardId === 'a' ? 'CLONE_WILL' : 'TREASURE_BOX' })
      }),
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
      ownBombCount: 1,
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
        getCardDef: (cardId: string) => ({ id: cardId, type: 'BOARD_EXPANSION_GOD' }),
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

  test('buildCardUseDecisionContext counts only high-value TEMPT_WILL targets', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[2][2] = 1;
    board[3][3] = 1;
    board[4][4] = 1;

    const moduleRef = createCpuDecisionCardContext({
      getGameState: () => ({ board }),
      getCardState: () => ({
        charge: { black: 0, white: 80 },
        hands: { black: [], white: ['tempt_01'] },
        decks: { black: [], white: [] },
        markers: [
          { kind: 'specialStone', owner: 'black', row: 2, col: 2, data: { type: 'TRAP', sourceCardId: 'trap_01' } },
          { kind: 'specialStone', owner: 'black', row: 3, col: 3, data: { type: 'PROTECTED', sourceCardId: 'hard_01' } },
          { kind: 'specialStone', owner: 'black', row: 4, col: 4, data: { type: 'PERMA_PROTECTED', sourceCardId: 'perma_01' } },
          { kind: 'specialStone', owner: 'black', row: 4, col: 4, data: { type: 'GUARD', sourceCardId: 'guard_01' } }
        ]
      }),
      getCardLogic: () => ({
        getCardDef: (cardId: string) => ({ id: cardId, type: cardId === 'tempt_01' ? 'TEMPT_WILL' : '' }),
        getBoardExpansionTargets: () => [],
        getBoardExpansionGodTargets: () => [],
        getSwapTargets: () => [],
        getTemptWillTargets: () => [
          { row: 2, col: 2 },
          { row: 3, col: 3 },
          { row: 4, col: 4 }
        ],
        getCardCost: (cardId: string) => ({ trap_01: 6, hard_01: 16, perma_01: 16, guard_01: 15 }[cardId] || 0)
      }),
      resolvePlayerValue: (playerKey: any) => (playerKey === 'white' ? -1 : 1),
      getShapeAwareBoard: (sourceBoard: any) => sourceBoard,
      countBoardStatsForPlayer: () => ({ discDiff: -8, empties: 61 }),
      countEdgeControl: () => ({ ownEdges: 0, oppEdges: 0 }),
      buildCornerPlanState: () => ({
        ownCorners: 0,
        oppCorners: 0,
        hasCornerMoveNow: false,
        hasEdgeMoveNow: false,
        cornerEmergency: false,
        cornerHoldMode: false,
        recoveryCostGap: 0,
        highBonusMoveAvailable: false
      }),
      getBoardBonusValueAt: () => 0,
      getBoardCellValueSafe: (sourceBoard: any, row: any, col: any) => sourceBoard[row][col],
      getCpuPolicyCore: () => null
    });

    const context = moduleRef.buildCardUseDecisionContext('white', 6, 1, [], ['tempt_01']);

    expect(context.temptHighValueTargetCount).toBe(1);
  });

  test('buildCardUseDecisionContext counts movement targets that displace or replace enemy corners', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[0][0] = 1;
    board[0][7] = 1;
    board[7][7] = 1;
    board[3][0] = -1;
    board[3][3] = -1;
    board[4][7] = -1;

    const moduleRef = createCpuDecisionCardContext({
      getGameState: () => ({ board }),
      getCardState: () => ({
        charge: { black: 0, white: 80 },
        hands: {
          black: [],
          white: [
            'buoyancy_01',
            'gravity_01',
            'super_buoyancy_01',
            'super_gravity_01',
            'super_attraction_01'
          ]
        },
        decks: { black: [], white: [] },
        markers: []
      }),
      getCardLogic: () => ({
        getCardDef: (cardId: string) => ({
          id: cardId,
          type: ({
            buoyancy_01: 'BUOYANCY_WILL',
            gravity_01: 'GRAVITY_WILL',
            super_buoyancy_01: 'SUPER_BUOYANCY_WILL',
            super_gravity_01: 'SUPER_GRAVITY_WILL',
            super_attraction_01: 'SUPER_ATTRACTION_WILL'
          } as Record<string, string>)[cardId]
        }),
        getBoardExpansionTargets: () => [],
        getBoardExpansionGodTargets: () => [],
        getSwapTargets: () => [],
        getBuoyancyTargets: () => [{ row: 7, col: 7 }],
        getGravityTargets: () => [{ row: 0, col: 7 }],
        getSuperBuoyancyTargets: () => [{ row: 3, col: 0 }],
        getSuperGravityTargets: () => [{ row: 4, col: 7 }],
        getSuperAttractionTargets: (_cs: any, _gs: any, _playerKey: any, pending: any) => {
          if (pending && pending.firstTarget && pending.firstTarget.row === 3 && pending.firstTarget.col === 3) {
            return [{ row: 0, col: 0 }];
          }
          return [{ row: 3, col: 3 }];
        }
      }),
      resolvePlayerValue: (playerKey: any) => (playerKey === 'white' ? -1 : 1),
      getShapeAwareBoard: (sourceBoard: any) => sourceBoard,
      countBoardStatsForPlayer: () => ({ discDiff: -8, empties: 58 }),
      countEdgeControl: () => ({ ownEdges: 2, oppEdges: 3 }),
      buildCornerPlanState: () => ({
        ownCorners: 0,
        oppCorners: 3,
        hasCornerMoveNow: false,
        hasEdgeMoveNow: true,
        cornerEmergency: true,
        cornerHoldMode: false,
        recoveryCostGap: 0,
        highBonusMoveAvailable: false
      }),
      getBoardBonusValueAt: () => 0,
      getBoardCellValueSafe: (sourceBoard: any, row: any, col: any) => {
        if (!sourceBoard || !sourceBoard[row]) return null;
        return sourceBoard[row][col];
      },
      getCpuPolicyCore: () => null,
      isCornerCell: (row: any, col: any) => (
        (row === 0 && col === 0) ||
        (row === 0 && col === 7) ||
        (row === 7 && col === 0) ||
        (row === 7 && col === 7)
      )
    });

    const context = moduleRef.buildCardUseDecisionContext('white', 6, 1, [], [
      'buoyancy_01',
      'gravity_01',
      'super_buoyancy_01',
      'super_gravity_01',
      'super_attraction_01'
    ]);

    expect(context.movementCornerSwingTargetCounts).toMatchObject({
      BUOYANCY_WILL: 1,
      GRAVITY_WILL: 1,
      SUPER_BUOYANCY_WILL: 1,
      SUPER_GRAVITY_WILL: 1,
      SUPER_ATTRACTION_WILL: 1
    });
    expect(context.movementCornerSwingTargetCount).toBe(1);
  });

  test('feature-demand runs only getters required by usable card types', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[3][3] = -1;
    const gameState = { board };
    const cardState = {
      charge: { black: 0, white: 99 },
      hands: { black: [], white: [] },
      decks: { black: [], white: [] },
      markers: [{ kind: 'specialStone', owner: 'white', row: 3, col: 3, data: { type: 'GUARD' } }]
    };
    const typesById: Record<string, string> = {
      expand: 'BOARD_EXPANSION_WILL',
      swap: 'SWAP_WITH_ENEMY',
      tempt: 'TEMPT_WILL',
      buoyancy: 'BUOYANCY_WILL',
      clone: 'CLONE_WILL',
      freeze: 'MASS_FREEZE_WILL'
    };
    const getters = {
      getBoardExpansionTargets: jest.fn(() => []),
      getBoardExpansionGodTargets: jest.fn(() => []),
      getSwapTargets: jest.fn(() => []),
      getTemptWillTargets: jest.fn(() => []),
      getBuoyancyTargets: jest.fn(() => []),
      getGravityTargets: jest.fn(() => []),
      getSuperBuoyancyTargets: jest.fn(() => []),
      getSuperGravityTargets: jest.fn(() => []),
      getSuperAttractionTargets: jest.fn(() => []),
      collectMassFreezeWillTargets: jest.fn(() => [])
    };
    const moduleRef = createCpuDecisionCardContext({
      getGameState: () => gameState,
      getCardState: () => cardState,
      getCardLogic: () => ({
        getCardDef: (cardId: string) => ({ id: cardId, type: typesById[cardId] }),
        ...getters
      }),
      resolvePlayerValue: () => -1,
      getShapeAwareBoard: (sourceBoard: any) => sourceBoard,
      countBoardStatsForPlayer: () => ({ discDiff: 0, empties: 64 }),
      countEdgeControl: () => ({ ownEdges: 0, oppEdges: 0 }),
      buildCornerPlanState: () => ({
        ownCorners: 0,
        oppCorners: 0,
        hasCornerMoveNow: false,
        hasEdgeMoveNow: false,
        cornerEmergency: false,
        cornerHoldMode: false,
        recoveryCostGap: 0,
        highBonusMoveAvailable: false
      }),
      getBoardBonusValueAt: () => 0,
      getBoardCellValueSafe: (sourceBoard: any, row: number, col: number) => sourceBoard[row][col],
      getCpuPolicyCore: () => null,
      isCornerCell: () => false
    });

    const cases = [
      ['expand', 'getBoardExpansionTargets'],
      ['swap', 'getSwapTargets'],
      ['tempt', 'getTemptWillTargets'],
      ['buoyancy', 'getBuoyancyTargets'],
      ['freeze', 'collectMassFreezeWillTargets']
    ] as const;
    for (const [cardId, expectedGetter] of cases) {
      Object.values(getters).forEach((getter) => getter.mockClear());
      moduleRef.buildCardUseDecisionContext('white', 6, 1, [], [cardId]);
      for (const [name, getter] of Object.entries(getters)) {
        expect(getter).toHaveBeenCalledTimes(name === expectedGetter ? 1 : 0);
      }
    }

    Object.values(getters).forEach((getter) => getter.mockClear());
    const cloneContext = moduleRef.buildCardUseDecisionContext('white', 6, 1, [], ['clone']);
    expect(cloneContext.cloneSplitEligibleSourceCount).toBe(1);
    expect(Object.values(getters).every((getter) => getter.mock.calls.length === 0)).toBe(true);

    const emptyContext = moduleRef.buildCardUseDecisionContext('white', 6, 1, [], []);
    expect(emptyContext).toMatchObject({
      boardExpansionEnemyCornerTargetCount: 0,
      swapEnemyNormalCornerTargetCount: 0,
      temptHighValueTargetCount: 0,
      cloneSplitEligibleSourceCount: 0,
      massFreezeOwnTargetCount: 0,
      massFreezeOpponentTargetCount: 0,
      movementCornerSwingTargetCounts: {
        BUOYANCY_WILL: 0,
        GRAVITY_WILL: 0,
        SUPER_BUOYANCY_WILL: 0,
        SUPER_GRAVITY_WILL: 0,
        SUPER_ATTRACTION_WILL: 0
      }
    });
  });

  test('reuses exact public selector evidence but never local-lane evidence', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[0][0] = 1;
    const gameState = { board };
    const cardState = {
      charge: { black: 0, white: 99 },
      hands: { black: [], white: ['expand'] },
      decks: { black: [], white: [] },
      markers: []
    };
    const getBoardExpansionTargets = jest.fn(() => [{ row: 7, col: 7 }]);
    const cardLogic = {
      getCardDef: () => ({ id: 'expand', type: 'BOARD_EXPANSION_WILL' }),
      getBoardExpansionTargets
    };
    const moduleRef = createCpuDecisionCardContext({
      getGameState: () => gameState,
      getCardState: () => cardState,
      getCardLogic: () => cardLogic,
      resolvePlayerValue: () => -1,
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
      getBoardCellValueSafe: (sourceBoard: any, row: number, col: number) => sourceBoard[row][col],
      getCpuPolicyCore: () => null,
      isCornerCell: (row: number, col: number) => (row === 0 || row === 7) && (col === 0 || col === 7)
    });
    const makeAnalysis = (lane: string) => ({
      usableCardIds: ['expand'],
      usableCardTypes: ['BOARD_EXPANSION_WILL'],
      usableSlots: [{ cardId: 'expand', cardType: 'BOARD_EXPANSION_WILL', handIndex: 0, cardCopyId: 41 }],
      selectorEvidence: {
        evidence: {
          lane,
          method: 'getBoardExpansionTargets',
          cardState,
          gameState,
          playerKey: 'white',
          cardId: 'expand',
          cardType: 'BOARD_EXPANSION_WILL',
          handIndex: 0,
          cardCopyId: 41,
          args: [cardState, gameState, 'white'],
          resolver: getBoardExpansionTargets,
          available: true,
          result: [{ row: 0, col: 0 }]
        }
      }
    });

    const fromPublicEvidence = moduleRef.buildCardUseDecisionContext('white', 6, 1, [], makeAnalysis('public'));
    expect(fromPublicEvidence.boardExpansionWillEnemyCornerTargetCount).toBe(1);
    expect(getBoardExpansionTargets).not.toHaveBeenCalled();

    const fromLocalEvidence = moduleRef.buildCardUseDecisionContext('white', 6, 1, [], makeAnalysis('local'));
    expect(fromLocalEvidence.boardExpansionWillEnemyCornerTargetCount).toBe(0);
    expect(getBoardExpansionTargets).toHaveBeenCalledTimes(1);
  });
});
