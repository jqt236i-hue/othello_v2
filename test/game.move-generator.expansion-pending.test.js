const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');

function createStates() {
  const cardState = CardLogic.createCardState({ shuffle: (arr) => arr, random: () => 0.5 });
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
    currentPlayer: Core.BLACK,
    turnNumber: 1,
    consecutivePasses: 0,
    boardExpansion: {
      active: true,
      side: 'top',
      row: -1,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: false },
      cells: [{ side: 'top', row: -1, col: 0, owner: Core.EMPTY }]
    }
  };
  return { cardState, gameState };
}

describe('move-generator expansion pending regression', () => {
  beforeEach(() => {
    jest.resetModules();
    global.BLACK = Core.BLACK;
    global.WHITE = Core.WHITE;
    global.EMPTY = Core.EMPTY;
    global.CoreLogic = Core;
    global.CardLogic = CardLogic;
    global.getFlips = (state, row, col, player, protection, perma) => Core.getFlipsWithContext(state, row, col, player, {
      protectedStones: protection || [],
      permaProtectedStones: perma || []
    });
  });

  afterEach(() => {
    delete global.BLACK;
    delete global.WHITE;
    delete global.EMPTY;
    delete global.CoreLogic;
    delete global.CardLogic;
    delete global.getFlips;
    delete global.gameState;
    delete global.cardState;
  });

  test.each(['FREE_PLACEMENT', 'LAST_RESORT'])('%s includes top expansion cells in move generation', (pendingType) => {
    const { cardState, gameState } = createStates();
    global.cardState = cardState;
    global.gameState = gameState;

    const MoveGenerator = require('../game/move-generator');
    const moves = MoveGenerator.generateMovesForPlayer(Core.BLACK, {
      type: pendingType,
      stage: 'awaitPlace',
      placementsRemaining: pendingType === 'LAST_RESORT' ? 3 : undefined
    }, [], []);

    expect(moves).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: 0, effectUsed: pendingType, player: Core.BLACK })
    ]));
  });

  test('SWAP_WITH_ENEMY includes occupied top expansion cells and evaluates swap flips from them', () => {
    const { cardState, gameState } = createStates();
    global.cardState = cardState;
    global.gameState = gameState;

    gameState.boardExpansion.cells[0].owner = Core.WHITE;
    gameState.boardExpansion.owner = Core.WHITE;
    gameState.board[0][0] = Core.WHITE;
    gameState.board[1][0] = Core.BLACK;

    const MoveGenerator = require('../game/move-generator');
    const moves = MoveGenerator.generateSwapMoves(Core.BLACK, [], [], []);

    expect(moves).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: -1,
        col: 0,
        effectUsed: 'SWAP_WITH_ENEMY',
        player: Core.BLACK,
        flips: [[0, 0]]
      })
    ]));
  });
});
