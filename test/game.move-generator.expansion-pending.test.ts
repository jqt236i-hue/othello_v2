import * as Core from '../game/logic/core.js';
const CardLogic = require('../game/logic/cards.js');
function createStates(rows = 8, cols = rows) {
  const cardState = CardLogic.createCardState({ shuffle: (arr) => arr, random: () => 0.5 });
  const gameState = {
    board: Array.from({ length: rows }, () => Array(cols).fill(Core.EMPTY)),
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

  test.each(['FREE_PLACEMENT', 'LAST_RESORT'])('%s includes top expansion cells in move generation', (pendingType) => {
    const { cardState, gameState } = createStates();
    global.cardState = cardState;
    global.gameState = gameState;

    const MoveGenerator = require('../game/move-generator.js');
    const moves = MoveGenerator.generateMovesForPlayer(Core.BLACK, {
      type: pendingType,
      stage: 'awaitPlace',
      placementsRemaining: pendingType === 'LAST_RESORT' ? 3 : undefined
    }, [], []);

    expect(moves).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: 0, effectUsed: pendingType, player: Core.BLACK })
    ]));
  });

  test.each(['FREE_PLACEMENT', 'LAST_RESORT'])('%s includes right expansion cells on 10x10 in move generation', (pendingType) => {
    const { cardState, gameState } = createStates(10, 10);
    global.cardState = cardState;
    global.gameState = gameState;
    gameState.boardExpansion = {
      active: true,
      side: 'right',
      row: 0,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: false },
      cells: [{ side: 'right', row: 0, col: 10, owner: Core.EMPTY }]
    };

    const MoveGenerator = require('../game/move-generator.js');
    const moves = MoveGenerator.generateMovesForPlayer(Core.BLACK, {
      type: pendingType,
      stage: 'awaitPlace',
      placementsRemaining: pendingType === 'LAST_RESORT' ? 3 : undefined
    }, [], []);

    expect(moves).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: 10, effectUsed: pendingType, player: Core.BLACK })
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

    const MoveGenerator = require('../game/move-generator.js');
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

  test('SWAP_WITH_ENEMY includes occupied right expansion cells on 10x10 and evaluates swap flips from them', () => {
    const { cardState, gameState } = createStates(10, 10);
    global.cardState = cardState;
    global.gameState = gameState;

    gameState.boardExpansion = {
      active: true,
      side: 'right',
      row: 0,
      owner: Core.WHITE,
      usedByPlayer: { black: true, white: false },
      cells: [{ side: 'right', row: 0, col: 10, owner: Core.WHITE }]
    };
    gameState.board[0][9] = Core.BLACK;
    gameState.board[1][9] = Core.WHITE;
    gameState.board[2][8] = Core.WHITE;
    gameState.board[2][7] = Core.BLACK;

    const MoveGenerator = require('../game/move-generator.js');
    const moves = MoveGenerator.generateSwapMoves(Core.BLACK, [], [], []);

    expect(moves).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 0,
        col: 10,
        effectUsed: 'SWAP_WITH_ENEMY',
        player: Core.BLACK
      })
    ]));
  });

  test('SWAP_WITH_ENEMY still excludes special or bomb markers on regular and expansion cells', () => {
    const { cardState, gameState } = createStates();
    global.cardState = cardState;
    global.gameState = gameState;

    gameState.board[0][0] = Core.WHITE;
    gameState.board[1][0] = Core.BLACK;
    gameState.boardExpansion.cells[0].owner = Core.WHITE;
    gameState.boardExpansion.owner = Core.WHITE;
    cardState.markers = [
      { id: 'special-regular', kind: 'specialStone', row: 0, col: 0, owner: 'white', data: { type: 'GUARD' } },
      { id: 'bomb-expansion', kind: 'bomb', row: -1, col: 0, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb' } }
    ];

    const MoveGenerator = require('../game/move-generator.js');
    const moves = MoveGenerator.generateSwapMoves(Core.BLACK, [], [], []);

    expect(moves).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: 0, effectUsed: 'SWAP_WITH_ENEMY' })
    ]));
    expect(moves).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: 0, effectUsed: 'SWAP_WITH_ENEMY' })
    ]));
  });

  test.each(['CAPTURE_WILL', 'CLONE_WILL'])(
    '%s blocks normal move generation while target selection is pending',
    (pendingType) => {
      const { cardState, gameState } = createStates();
      global.cardState = cardState;
      global.gameState = gameState;

      gameState.board[3][1] = Core.WHITE;
      gameState.board[3][2] = Core.BLACK;

      const MoveGenerator = require('../game/move-generator.js');
      const moves = MoveGenerator.generateMovesForPlayer(Core.BLACK, {
        type: pendingType,
        stage: 'selectTarget',
        cardId: `${String(pendingType).toLowerCase()}_01`
      }, [], []);

      expect(moves).toEqual([]);
    }
  );
});
