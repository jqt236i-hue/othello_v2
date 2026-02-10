function makeState(CardLogic, Shared) {
  const cardState = CardLogic.createCardState({ shuffle: (arr) => arr });
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState };
}

function placeStones(gameState, entries) {
  for (const [row, col, value] of entries) {
    gameState.board[row][col] = value;
  }
}

module.exports = {
  makeState,
  placeStones
};

