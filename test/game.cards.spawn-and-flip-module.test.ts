const { spawnAndFlipBatch } = require('../game/logic/cards-internal/spawn-and-flip');

function createBoard(rows = 8, cols = 8, fill = 0) {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

describe('cards spawn-and-flip module', () => {
  test('registers runtime global for browser-loaded consumers', () => {
    expect(globalThis.CardSpawnAndFlip).toBeTruthy();
    expect(globalThis.CardSpawnAndFlip.spawnAndFlipBatch).toBe(spawnAndFlipBatch);
  });

  test('preserves spawn bookkeeping and dedupes flipped output inside a spawn block', () => {
    const cardState = {
      markers: [
        { kind: 'specialStone', row: 4, col: 4, data: { type: 'TIME_BOMB', category: 'bomb' } }
      ]
    };
    const gameState = { board: createBoard() };
    const runSpawnBlock = jest.fn((_cardState, _gameState, fn) => fn());
    const spawnAt = jest.fn(() => ({ spawned: true, stoneId: 'spawn-1' }));
    const changeAt = jest.fn(() => ({ changed: true }));
    const clearHyperactiveAtPositions = jest.fn();

    const result = spawnAndFlipBatch(
      cardState,
      gameState,
      'black',
      1,
      [{ row: 2, col: 2 }],
      'REINFORCEMENT_WILL',
      'reinforcement_will_spawn',
      { row: null, col: null },
      {
        BoardOps: {
          spawnAt,
          changeAt,
          runSpawnBlock
        },
        getCardContext: () => ({ protectedStones: [] }),
        getFlipsWithContext: () => [[4, 4], [4, 4], [5, 5]],
        clearHyperactiveAtPositions,
        changeCause: 'REINFORCEMENT_WILL',
        changeReason: 'reinforcement_will_flip'
      }
    );

    expect(runSpawnBlock).toHaveBeenCalledWith(cardState, gameState, expect.any(Function), {
      cause: 'REINFORCEMENT_WILL',
      reason: 'reinforcement_will_spawn',
      owner: 'black'
    });
    expect(spawnAt).toHaveBeenCalledWith(cardState, gameState, 2, 2, 'black', 'REINFORCEMENT_WILL', 'reinforcement_will_spawn');
    expect(changeAt).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      spawned: [{ row: 2, col: 2, anchorRow: null, anchorCol: null, stoneId: 'spawn-1' }],
      flipped: [{ row: 4, col: 4 }, { row: 5, col: 5 }]
    });
    expect(clearHyperactiveAtPositions).toHaveBeenCalledWith(cardState, [{ row: 4, col: 4 }, { row: 5, col: 5 }]);
    expect(cardState.markers).toEqual([]);
  });

  test('does not report spawned or apply generated flips when BoardOps rejects spawn', () => {
    const cardState = { markers: [] };
    const gameState = { board: createBoard() };
    const spawnAt = jest.fn(() => ({ spawned: false, reason: 'blocked_destination' }));
    const changeAt = jest.fn(() => ({ changed: true }));

    const result = spawnAndFlipBatch(
      cardState,
      gameState,
      'black',
      1,
      [{ row: 2, col: 2 }],
      'BREEDING',
      'breeding_spawned',
      { row: 3, col: 3 },
      {
        BoardOps: { spawnAt, changeAt },
        getCardContext: () => ({ protectedStones: [] }),
        getFlipsWithContext: () => [[2, 3]]
      }
    );

    expect(result).toEqual({ spawned: [], flipped: [] });
    expect(spawnAt).toHaveBeenCalledTimes(1);
    expect(changeAt).not.toHaveBeenCalled();
  });

  test('falls back to direct board writes when BoardOps is absent', () => {
    const gameState = { board: createBoard(4, 4) };

    const result = spawnAndFlipBatch(
      {},
      gameState,
      'white',
      -1,
      [{ row: 1, col: 1 }],
      'BREEDING',
      'breeding_spawned',
      { row: 0, col: 0 },
      {
        getCardContext: () => ({ protectedStones: [] }),
        getFlipsWithContext: () => [[1, 2]]
      }
    );

    expect(result).toEqual({
      spawned: [{ row: 1, col: 1, anchorRow: 0, anchorCol: 0, stoneId: undefined }],
      flipped: [{ row: 1, col: 2 }]
    });
    expect(gameState.board[1][1]).toBe(-1);
    expect(gameState.board[1][2]).toBe(-1);
  });

  test('falls back to expansion-cell writes when target lives outside the main board', () => {
    const gameState = {
      board: createBoard(4, 4),
      boardExpansion: {
        active: false,
        side: null,
        row: null,
        owner: 0,
        cells: [{ side: 'top', row: -1, col: 0, owner: 0 }]
      }
    };

    const result = spawnAndFlipBatch(
      {},
      gameState,
      'black',
      1,
      [{ row: -1, col: 0 }],
      'BREEDING',
      'breeding_spawned',
      { row: 0, col: 0 },
      {
        getCardContext: () => ({ protectedStones: [] }),
        getFlipsWithContext: () => []
      }
    );

    expect(result).toEqual({
      spawned: [{ row: -1, col: 0, anchorRow: 0, anchorCol: 0, stoneId: undefined }],
      flipped: []
    });
    expect(gameState.boardExpansion.cells[0]).toEqual({ side: 'top', row: -1, col: 0, owner: 1 });
  });
});
