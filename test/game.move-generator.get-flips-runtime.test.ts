import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';

describe('move-generator getFlips runtime wiring', () => {
  beforeEach(() => {
    jest.resetModules();
    global.BLACK = Core.BLACK;
    global.WHITE = Core.WHITE;
    global.EMPTY = Core.EMPTY;
    global.CoreLogic = Core;
    global.CardLogic = CardLogic;
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
      currentPlayer: Core.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };
    global.cardState = CardLogic.createCardState({ shuffle: (arr) => arr, random: () => 0.5 });
  });

  afterEach(() => {
    delete global.BLACK;
    delete global.WHITE;
    delete global.EMPTY;
    delete global.CoreLogic;
    delete global.CardLogic;
    delete global.gameState;
    delete global.cardState;
  });

  test('free-placement move generation resolves getFlips without legacy global injection', () => {
    const MoveGenerator = require('../game/move-generator.js');

    const moves = MoveGenerator.generateMovesForPlayer(Core.BLACK, {
      type: 'FREE_PLACEMENT',
      stage: null,
      cardId: 'free_01'
    }, [], []);

    expect(moves).toHaveLength(64);
    expect(moves[0]).toEqual(expect.objectContaining({
      row: 0,
      col: 0,
      effectUsed: 'FREE_PLACEMENT',
      player: Core.BLACK
    }));
  });
});
