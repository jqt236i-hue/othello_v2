const path = require('path');
const cpuDecision = require(path.resolve(__dirname, '..', 'game', 'cpu-decision.js'));

describe('cpu onnx deck context', () => {
  beforeEach(() => {
    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: -1
    };
    global.cardState = {
      deck: ['b0', 'b1', 'b2'],
      decks: {
        black: ['b0', 'b1', 'b2'],
        white: ['w0']
      },
      initialDeckSize: 3,
      initialDeckSizeByPlayer: {
        black: 3,
        white: 1
      },
      hands: { black: [], white: [] },
      charge: { black: 9, white: 4 },
      pendingEffectByPlayer: { black: null, white: null },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };
  });

  test('buildOnnxContext keeps legacy deckCount and adds per-player deck metrics', () => {
    const context = cpuDecision.buildOnnxContext(
      'white',
      6,
      2,
      [],
      null,
      [{ row: 2, col: 3 }, { row: 4, col: 5 }]
    );

    expect(context).toEqual(expect.objectContaining({
      deckCount: 3,
      ownDeckCount: 1,
      initialDeckSize: 1,
      ownCharge: 4,
      oppCharge: 9
    }));
  });
});
