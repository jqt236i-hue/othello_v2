import * as path from 'path';

const cpuDecision = require(path.resolve(__dirname, '..', 'game', 'cpu-decision.js'));

describe('cpu-decision ONNX context', () => {
  beforeEach(() => {
    global.gameState = {
      board: [
        [0, 0, 0, -1],
        [0, 1, -1, 0],
        [0, -1, 1, 0],
        [1, 0, 0, -1]
      ]
    };
    global.cardState = {
      charge: { black: 7, white: 3 },
      deck: ['legacy-a', 'legacy-b', 'legacy-c'],
      decks: { black: ['own-a', 'own-b'], white: ['opp-a'] },
      initialDeckSizeByPlayer: { black: 12, white: 10 },
      boardBonusByCell: { '0,1': 4 },
      boardBonusConsumedByCell: {},
      hands: { black: ['fallback-card'], white: ['opp-card'] },
      pendingEffectByPlayer: { black: { type: 'DESTROY_ONE_STONE' } }
    };
    global.CardLogic = {
      getPendingEffectType: jest.fn(() => 'DESTROY_ONE_STONE')
    };
  });

  afterEach(() => {
    delete global.gameState;
    delete global.cardState;
    delete global.CardLogic;
  });

  test('buildOnnxContext preserves current live runtime fields', () => {
    const candidateMoves = [
      { row: 0, col: 0, flips: [{ row: 1, col: 1 }] },
      { row: 0, col: 1, flips: [] },
      { row: 'bad', col: 2 },
      null
    ];

    const context = cpuDecision.buildOnnxContext(
      'black',
      6,
      4,
      ['explicit-hand-card'],
      ['usable-card'],
      candidateMoves
    );

    expect(context).toMatchObject({
      playerKey: 'black',
      level: 6,
      board: global.gameState.board,
      pendingType: 'DESTROY_ONE_STONE',
      legalMovesCount: 4,
      ownCharge: 7,
      oppCharge: 3,
      deckCount: 3,
      ownDeckCount: 2,
      initialDeckSize: 12,
      boardBonusByCell: global.cardState.boardBonusByCell,
      boardBonusConsumedByCell: global.cardState.boardBonusConsumedByCell,
      handCardIds: ['explicit-hand-card'],
      usableCardIds: ['usable-card'],
      hasCornerMoveNow: true,
      hasEdgeMoveNow: true,
      maxLegalMoveBonus: 4,
      highBonusMoveAvailable: true
    });
    expect(context.candidateMoves).toEqual([
      { row: 0, col: 0, flips: [{ row: 1, col: 1 }] },
      { row: 0, col: 1, flips: [] }
    ]);
  });
});
