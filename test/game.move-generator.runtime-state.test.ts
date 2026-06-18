describe('move-generator runtime state lookup', () => {
  beforeEach(() => {
    jest.resetModules();
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).CardLogic = {
      getCardContext: () => ({
        protectedStones: [],
        permaProtectedStones: [],
        bombs: []
      })
    };
    (global as any).MarkersAdapter = {
      getBombMarkers: () => []
    };
    (global as any).cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null }
    };
  });

  afterEach(() => {
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).CardLogic;
    delete (global as any).MarkersAdapter;
    delete (global as any).gameState;
    delete (global as any).cardState;
  });

  test('findMoveForCellInState uses the explicit replaced snapshot for a network white turn', () => {
    const staleInitialState = {
      currentPlayer: 1,
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ]
    };
    (global as any).gameState = staleInitialState;
    const moveGenerator = require('../game/move-generator.js');

    const latestNetworkSnapshotState = {
      currentPlayer: -1,
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
      ]
    };

    expect(typeof moveGenerator.findMoveForCellInState).toBe('function');

    const move = moveGenerator.findMoveForCellInState(
      latestNetworkSnapshotState,
      (global as any).cardState,
      -1,
      2,
      2,
      null,
      [],
      []
    );

    expect(move).toEqual(expect.objectContaining({
      row: 2,
      col: 2,
      player: -1
    }));
    expect(move.flips).toEqual([[3, 3]]);
  });
});
