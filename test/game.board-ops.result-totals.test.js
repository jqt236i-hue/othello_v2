const CardLogic = require('../game/logic/cards');
const Core = require('../game/logic/core');
const BoardOps = require('../game/logic/board_ops');

function createPrng() {
  return {
    shuffle: (arr) => arr,
    random: () => 0.5
  };
}

describe('BoardOps result totals', () => {
  test('changeAtで総反転枚数を加算する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();

    gameState.board[3][3] = Core.WHITE;

    const changed = BoardOps.changeAt(cardState, gameState, 3, 3, 'black', 'SYSTEM', 'standard_flip');

    expect(changed && changed.changed).toBe(true);
    expect(cardState.totalFlipCountByPlayer.black).toBe(1);
    expect(cardState.totalFlipCountByPlayer.white).toBe(0);
  });

  test('角の奪取時に角取得数を加算する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();

    gameState.board[0][0] = Core.WHITE;

    BoardOps.changeAt(cardState, gameState, 0, 0, 'black', 'SYSTEM', 'standard_flip');
    expect(cardState.cornerCaptureCountByPlayer.black).toBe(1);
    expect(cardState.cornerCaptureCountByPlayer.white).toBe(0);

    BoardOps.changeAt(cardState, gameState, 0, 0, 'white', 'SYSTEM', 'standard_flip');
    expect(cardState.cornerCaptureCountByPlayer.black).toBe(1);
    expect(cardState.cornerCaptureCountByPlayer.white).toBe(1);
    expect(cardState.totalFlipCountByPlayer.black).toBe(1);
    expect(cardState.totalFlipCountByPlayer.white).toBe(1);
  });
});
