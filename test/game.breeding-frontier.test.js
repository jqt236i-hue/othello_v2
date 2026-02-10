const CardLogic = require('../game/logic/cards');

describe('BREEDING_WILL frontier propagation', () => {
  function makeState() {
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };
    return { cardState, gameState };
  }

  function placeBreedingAnchor(cardState, gameState, row, col) {
    gameState.board[row][col] = 1;
    cardState.markers.push({
      id: 101,
      kind: 'specialStone',
      row,
      col,
      owner: 'black',
      data: { type: 'BREEDING', remainingOwnerTurns: 3 }
    });
  }

  test('propagates from previously spawned stones on next owner turn', () => {
    const { cardState, gameState } = makeState();
    const prng = { random: () => 0.5 };
    placeBreedingAnchor(cardState, gameState, 3, 3);

    const immediate = CardLogic.processBreedingEffectsAtAnchor(cardState, gameState, 'black', 3, 3, prng);
    expect(immediate.spawned).toHaveLength(1);
    expect(immediate.spawned[0]).toMatchObject({ row: 3, col: 4 });
    expect((cardState.breedingSproutByOwner.black || []).length).toBe(1);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    const startRes = CardLogic.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, prng);

    expect(startRes.spawned).toHaveLength(1);
    expect(startRes.spawned[0]).toMatchObject({ row: 3, col: 5 });
    expect((cardState.breedingSproutByOwner.black || []).length).toBe(1);
    expect(gameState.board[3][5]).toBe(1);
  });

  test('resets origin to anchor when previous spawned stones are flipped/lost', () => {
    const { cardState, gameState } = makeState();
    const prng = { random: () => 0.5 };
    placeBreedingAnchor(cardState, gameState, 3, 3);
    CardLogic.processBreedingEffectsAtAnchor(cardState, gameState, 'black', 3, 3, prng);

    // Break frontier and block all anchor neighbors so this turn cannot spawn.
    gameState.board[2][2] = 1;
    gameState.board[2][3] = 1;
    gameState.board[2][4] = 1;
    gameState.board[3][2] = 1;
    gameState.board[4][2] = 1;
    gameState.board[4][3] = 1;
    gameState.board[4][4] = 1;
    gameState.board[3][4] = -1;

    CardLogic.onTurnStart(cardState, 'black', gameState);
    const noSpawnTurn = CardLogic.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, prng);
    expect(noSpawnTurn.spawned).toHaveLength(0);
    expect(cardState.breedingFrontierByAnchorId['101']).toEqual([]);

    // Next owner turn: frontier is empty, so anchor-based spawning should resume.
    gameState.board[2][2] = 0;
    CardLogic.onTurnStart(cardState, 'black', gameState);
    const resumed = CardLogic.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, prng);
    expect(resumed.spawned).toHaveLength(1);
    expect(resumed.spawned[0]).toMatchObject({ row: 2, col: 2 });
  });

  test('clears one-turn sprout tags at owner turn start even without anchors', () => {
    const { cardState, gameState } = makeState();
    cardState.breedingSproutByOwner.black = [{ row: 1, col: 1 }];

    CardLogic.onTurnStart(cardState, 'black', gameState);

    expect(cardState.breedingSproutByOwner.black).toEqual([]);
  });
});
