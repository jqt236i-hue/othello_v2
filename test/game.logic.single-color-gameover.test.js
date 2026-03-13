const Core = require('../game/logic/core');

function fillBoard(state, value) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      state.board[row][col] = value;
    }
  }
}

describe('Core.isGameOver single-color termination', () => {
  test('初期状態は終局ではない', () => {
    const state = Core.createGameState();
    expect(Core.isGameOver(state)).toBe(false);
  });

  test('盤面が単色なら空きマスが残っていても終局になる', () => {
    const state = Core.createGameState();
    fillBoard(state, Core.EMPTY);
    state.board[0][0] = Core.BLACK;
    state.board[2][3] = Core.BLACK;
    state.consecutivePasses = 0;

    expect(Core.isGameOver(state)).toBe(true);
  });

  test('石が0枚同士の空盤は単色終局として扱わない', () => {
    const state = Core.createGameState();
    fillBoard(state, Core.EMPTY);
    state.consecutivePasses = 0;

    expect(Core.isGameOver(state)).toBe(false);
  });

  test('拡張マスを含めて単色なら終局になる', () => {
    const state = Core.createGameState();
    fillBoard(state, Core.EMPTY);
    state.boardExpansion.active = true;
    state.boardExpansion.side = 'right';
    state.boardExpansion.row = 4;
    state.boardExpansion.owner = Core.WHITE;
    state.consecutivePasses = 0;

    expect(Core.isGameOver(state)).toBe(true);
  });
});
