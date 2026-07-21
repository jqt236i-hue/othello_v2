const { createCpuDecisionCardRisk } = require('../game/cpu-decision-card-risk');

function createCardRisk(overrides = {}) {
  const board = overrides.board || Array.from({ length: 8 }, () => Array(8).fill(0));
  return createCpuDecisionCardRisk({
    getCpuPolicyCore: overrides.getCpuPolicyCore || (() => ({
      scoreCardUseDecision: () => ({ score: 16, minUseScore: 12, shouldUse: true }),
      chooseMoveByLookahead: () => ({ row: 0, col: 0, flips: [{ row: 0, col: 1 }] })
    })),
    getCardLogic: overrides.getCardLogic || (() => ({
      getCardCost: () => 6,
      getCardDef: () => ({ type: 'TREASURE_BOX' })
    })),
    getCardState: () => ({
      boardBonusByCell: { '0,0': 2 },
      boardBonusConsumedByCell: {}
    }),
    buildCardUseDecisionContext: () => overrides.context || ({
      forceUseCard: false,
      cornerEmergency: false,
      discDiff: 2,
      handSize: 5,
      ownCharge: 40,
      legalMovesCount: 2,
      lowDiscEmergency: false,
      whiteLv6Mode: true,
      hasCornerMoveNow: false,
      highBonusMoveAvailable: false
    }),
    getCurrentCpuBoard: () => board,
    isPlayableBoard: () => true,
    buildLv6LookaheadOptions: () => ({
      depth: 5,
      maxBranch: 6,
      nodeBudget: 350000,
      maxTimeMs: 900,
      endgameSolveEmpties: 18,
      endgameDepth: 14,
      endgameNodeBudget: 1500000,
      endgameMaxTimeMs: 1600
    }),
    resolveLv6LookaheadTimeCaps: () => ({
      quiescenceMoveCapMs: 900,
      quiescenceEndgameMinMs: 300,
      quiescenceEndgameCapMs: 1600
    }),
    createLookaheadMetaLogger: () => jest.fn(),
    getBoardBonusValueAt: (row, col) => (row === 0 && col === 0 ? 2 : 0),
    isCornerCell: (row, col) => (row === 0 || row === 7) && (col === 0 || col === 7),
    isEdgeCell: (row, col) => row === 0 || row === 7 || col === 0 || col === 7,
    applyMoveByFlipsForCpu: () => board,
    hasCornerMoveOnBoardForPlayer: overrides.hasCornerMoveOnBoardForPlayer || (() => false),
    resolveCardType: (_cardId, cardDef) => (cardDef && cardDef.type) || 'METEOR_WILL'
  });
}

describe('cpu decision card risk module', () => {
  test('isCardChoiceAllowedByHighConfidence relaxes gate under Lv6 white pressure', () => {
    const cardRisk = createCardRisk();

    expect(cardRisk.isCardChoiceAllowedByHighConfidence('white', 6, 2, 'treasure_01', null)).toBe(true);
  });

  test('isCardChoiceAllowedByRisk follows scoreCardUseDecision shouldUse flag', () => {
    const cardRisk = createCardRisk({
      getCpuPolicyCore: () => ({
        scoreCardUseDecision: () => ({ score: -5, minUseScore: 12, shouldUse: false })
      })
    });

    expect(cardRisk.isCardChoiceAllowedByRisk('white', 6, 2, 'risky_01', {})).toBe(false);
  });

  test('buildCardQuiescenceSnapshot captures best-move shape and opponent corner result', () => {
    const cardRisk = createCardRisk({
      hasCornerMoveOnBoardForPlayer: () => true
    });

    const snapshot = cardRisk.buildCardQuiescenceSnapshot('white', 6, [{ row: 0, col: 0, flips: [] }], {
      playerValue: -1
    });

    expect(snapshot).toMatchObject({
      bestMove: { row: 0, col: 0 },
      bestMoveBonus: 2,
      bestMoveFlips: 1,
      bestMoveCorner: true,
      bestMoveEdge: false,
      oppCornerAfterBest: true
    });
  });

  test('shouldHoldCardByQuiescence holds high-variance card when quiet best move is strong', () => {
    const cardRisk = createCardRisk();

    const hold = cardRisk.shouldHoldCardByQuiescence(
      'white',
      6,
      'meteor_01',
      { type: 'METEOR_WILL' },
      {
        forceUseCard: false,
        cornerEmergency: false,
        discDiff: 2,
        handSize: 2,
        ownCharge: 12,
        legalMovesCount: 5
      },
      {
        bestMove: { row: 0, col: 0 },
        bestMoveCorner: true,
        bestMoveBonus: 2,
        bestMoveFlips: 1,
        bestMoveEdge: false,
        oppCornerAfterBest: false
      }
    );

    expect(hold).toBe(true);
  });

  test.each([
    ['forced use', { forceUseCard: true }],
    ['corner emergency', { cornerEmergency: true }],
    ['large deficit', { discDiff: -8 }],
    ['full hand', { handSize: 4 }],
    ['high charge', { ownCharge: 24 }],
    ['few legal moves', { legalMovesCount: 2 }]
  ])('skips quiescence search when %s makes every hold decision false', (_label, override) => {
    const cardRisk = createCardRisk();
    const context = Object.assign({
      forceUseCard: false,
      cornerEmergency: false,
      discDiff: 2,
      handSize: 2,
      ownCharge: 12,
      legalMovesCount: 5
    }, override);

    expect(cardRisk.shouldBuildCardQuiescenceSnapshot(6, [{ row: 0, col: 0 }], context)).toBe(false);
  });

  test('builds quiescence search when a hold decision can still be true', () => {
    const cardRisk = createCardRisk();

    expect(cardRisk.shouldBuildCardQuiescenceSnapshot(6, [{ row: 0, col: 0 }], {
      forceUseCard: false,
      cornerEmergency: false,
      discDiff: 2,
      handSize: 2,
      ownCharge: 12,
      legalMovesCount: 5
    })).toBe(true);
  });

  test('skips quiescence when no usable card type can consume the snapshot', () => {
    const cardRisk = createCardRisk();
    const context = {
      forceUseCard: false,
      cornerEmergency: false,
      discDiff: 2,
      handSize: 2,
      ownCharge: 12,
      legalMovesCount: 5
    };

    expect(cardRisk.shouldBuildCardQuiescenceSnapshot(
      6,
      [{ row: 0, col: 0 }],
      context,
      ['GOLD_STONE', 'TREASURE_BOX']
    )).toBe(false);
    expect(cardRisk.shouldBuildCardQuiescenceSnapshot(
      6,
      [{ row: 0, col: 0 }],
      context,
      ['TREASURE_BOX', 'METEOR_WILL']
    )).toBe(true);
  });

  test('prepares a bounded Worker request and rebuilds the snapshot from its best move', () => {
    const cardRisk = createCardRisk();
    const legalMoves = [{ row: 0, col: 0, flips: [{ row: 0, col: 1 }] }];
    const context = { playerValue: -1 };
    const request = cardRisk.prepareCardQuiescenceRequest('white', 6, legalMoves, context, {
      runId: 4,
      decisionEpoch: 7,
      stateVersion: 'local-turn:3',
      turnNumber: 3
    });

    expect(request).toMatchObject({
      requestId: 'card-quiescence:4:7',
      decisionEpoch: 7,
      stateVersion: 'local-turn:3',
      playerKey: 'white',
      level: 6,
      playerValue: -1,
      search: { depth: 5, maxBranch: 6 }
    });
    expect(cardRisk.buildCardQuiescenceSnapshotFromBestMove('white', context, legalMoves[0]))
      .toMatchObject({ bestMoveCorner: true, bestMoveBonus: 2, bestMoveFlips: 1 });
  });
});
