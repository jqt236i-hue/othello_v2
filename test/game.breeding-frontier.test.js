const CardLogic = require('../game/logic/cards');
const BREEDING_OWNER_TURNS = 5;

describe('BREEDING_WILL frontier propagation', () => {
  function makeState(rows = 8, cols = rows) {
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: rows }, () => Array(cols).fill(0)),
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
      data: { type: 'BREEDING', remainingOwnerTurns: BREEDING_OWNER_TURNS }
    });
  }

  test('places breeding marker with five owner turns', () => {
    const { cardState, gameState } = makeState();
    cardState.pendingEffectByPlayer.black = { type: 'BREEDING_WILL', stage: 'awaitPlace' };
    gameState.board[3][3] = 1;

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);

    expect(effects.breedingPlaced).toBe(true);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 3,
        col: 3,
        owner: 'black',
        data: expect.objectContaining({ type: 'BREEDING', remainingOwnerTurns: BREEDING_OWNER_TURNS })
      })
    ]));
  });

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

  test('does not spawn breeding stone onto blockade cell', () => {
    const { cardState, gameState } = makeState();
    const prng = { random: () => 0.0 };
    placeBreedingAnchor(cardState, gameState, 3, 3);

    // Keep only one empty neighbor (2,2), and block it.
    gameState.board[2][3] = 1;
    gameState.board[2][4] = 1;
    gameState.board[3][2] = 1;
    gameState.board[3][4] = 1;
    gameState.board[4][2] = 1;
    gameState.board[4][3] = 1;
    gameState.board[4][4] = 1;
    cardState.markers.push({
      id: 202,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
    });

    const immediate = CardLogic.processBreedingEffectsAtAnchor(cardState, gameState, 'black', 3, 3, prng);
    expect(immediate.spawned).toHaveLength(0);
    expect(gameState.board[2][2]).toBe(0);

    CardLogic.onTurnStart(cardState, 'black', gameState);
    const startRes = CardLogic.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, prng);
    expect(startRes.spawned).toHaveLength(0);
    expect(gameState.board[2][2]).toBe(0);
  });

  test('expansion breeding anchor can spawn into adjacent main-board cell', () => {
    const { cardState, gameState } = makeState();
    const prng = { random: () => 0.0 };
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: 0,
      usedByPlayer: { black: false, white: false },
      cells: [{ side: 'left', row: 3, col: -1, owner: 1 }]
    };
    gameState.board[2][0] = -1;
    gameState.board[4][0] = -1;
    cardState.markers.push({
      id: 301,
      kind: 'specialStone',
      row: 3,
      col: -1,
      owner: 'black',
      data: { type: 'BREEDING', remainingOwnerTurns: BREEDING_OWNER_TURNS }
    });

    const immediate = CardLogic.processBreedingEffectsAtAnchor(cardState, gameState, 'black', 3, -1, prng);

    expect(immediate.spawned).toHaveLength(1);
    expect(immediate.spawned[0]).toMatchObject({ row: 3, col: 0, anchorRow: 3, anchorCol: -1 });
    expect(gameState.board[3][0]).toBe(1);
  });

  test('10x10 right expansion breeding anchor can spawn into adjacent main-board cell', () => {
    const { cardState, gameState } = makeState(10, 10);
    const prng = { random: () => 0.0 };
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: 0,
      usedByPlayer: { black: false, white: false },
      cells: [{ side: 'right', row: 3, col: 10, owner: 1 }]
    };
    gameState.board[2][9] = -1;
    gameState.board[4][9] = -1;
    cardState.markers.push({
      id: 302,
      kind: 'specialStone',
      row: 3,
      col: 10,
      owner: 'black',
      data: { type: 'BREEDING', remainingOwnerTurns: BREEDING_OWNER_TURNS }
    });

    const immediate = CardLogic.processBreedingEffectsAtAnchor(cardState, gameState, 'black', 3, 10, prng);

    expect(immediate.spawned).toHaveLength(1);
    expect(immediate.spawned[0]).toMatchObject({ row: 3, col: 9, anchorRow: 3, anchorCol: 10 });
    expect(gameState.board[3][9]).toBe(1);
  });
});
