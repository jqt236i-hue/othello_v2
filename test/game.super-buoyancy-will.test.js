const CardLogic = require('../game/logic/cards');
const Core = require('../game/logic/core');

describe('SUPER_BUOYANCY_WILL expansion regression', () => {
  test('can move an occupied expansion cell upward along an expansion column', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = Core.createGameState();

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: Core.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [
        { side: 'left', row: 1, col: -1, owner: Core.EMPTY },
        { side: 'left', row: 2, col: -1, owner: Core.EMPTY },
        { side: 'left', row: 3, col: -1, owner: Core.BLACK }
      ]
    };
    cardState.pendingEffectByPlayer.black = {
      type: 'SUPER_BUOYANCY_WILL',
      stage: 'selectTarget',
      cardId: 'super_buoyancy_expansion_01'
    };

    const targets = CardLogic.getSuperBuoyancyTargets(cardState, gameState);
    expect(targets).toEqual(expect.arrayContaining([{ row: 3, col: -1 }]));

    const res = CardLogic.applySuperBuoyancyWill(cardState, gameState, 'black', 3, -1);

    expect(res).toMatchObject({ applied: true, from: { row: 3, col: -1 }, to: { row: 1, col: -1 }, destroyedCount: 0, movedDistance: 2 });
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 3 && cell.col === -1).owner).toBe(Core.EMPTY);
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 1 && cell.col === -1).owner).toBe(Core.BLACK);
  });
});