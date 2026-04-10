const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const CardExpansion = require('../game/logic/cards/expansion');
const CardSelectors = require('../game/logic/cards/selectors');
const SharedBoardUtils = require('../shared/shared-board-utils');

function createPrng() {
  return {
    shuffle: (arr) => arr,
    random: () => 0.5
  };
}

function sortMoveKeys(moves) {
  return (Array.isArray(moves) ? moves : [])
    .map((move) => `${move.row},${move.col}`)
    .sort();
}

describe('custom board config foundations', () => {
  test('7x7 game state uses a centered opening ring with an empty middle and matching card ids', () => {
    const gameState = Core.createGameState({ rows: 7, cols: 7 });
    const cardState = CardLogic.createCardState(createPrng(), { boardConfig: { rows: 7, cols: 7 } });

    expect(gameState.board).toHaveLength(7);
    expect(gameState.board[0]).toHaveLength(7);
    expect(gameState.boardConfig).toMatchObject({
      rows: 7,
      cols: 7,
      standard8x8: false
    });

    expect(gameState.board[2][2]).toBe(Core.WHITE);
    expect(gameState.board[2][3]).toBe(Core.BLACK);
    expect(gameState.board[2][4]).toBe(Core.WHITE);
    expect(gameState.board[3][2]).toBe(Core.BLACK);
    expect(gameState.board[3][3]).toBe(Core.EMPTY);
    expect(gameState.board[3][4]).toBe(Core.BLACK);
    expect(gameState.board[4][2]).toBe(Core.WHITE);
    expect(gameState.board[4][3]).toBe(Core.BLACK);
    expect(gameState.board[4][4]).toBe(Core.WHITE);
    expect(gameState.board.flat().filter((cell) => cell === Core.BLACK)).toHaveLength(4);
    expect(gameState.board.flat().filter((cell) => cell === Core.WHITE)).toHaveLength(4);
    expect(sortMoveKeys(Core.getLegalMoves(gameState, Core.BLACK, {}))).toEqual([
      '1,2',
      '1,4',
      '2,1',
      '2,5',
      '4,1',
      '4,5',
      '5,2',
      '5,4'
    ]);

    expect(cardState.stoneIdMap[2][2]).toBe('s1');
    expect(cardState.stoneIdMap[2][3]).toBe('s2');
    expect(cardState.stoneIdMap[2][4]).toBe('s3');
    expect(cardState.stoneIdMap[3][2]).toBe('s4');
    expect(cardState.stoneIdMap[3][3]).toBeNull();
    expect(cardState.stoneIdMap[3][4]).toBe('s5');
    expect(cardState.stoneIdMap[4][2]).toBe('s6');
    expect(cardState.stoneIdMap[4][3]).toBe('s7');
    expect(cardState.stoneIdMap[4][4]).toBe('s8');
    expect(cardState._nextStoneId).toBe(9);
    expect(Object.keys(cardState.boardBonusByCell)).toHaveLength(22);
  });

  test('card state builds rectangular stoneIdMap and scaled number cells', () => {
    const squareBonusMap = CardExpansion.buildInitialBoardBonusMap(createPrng(), { rows: 8, cols: 8 });
    const smallBonusMap = CardExpansion.buildInitialBoardBonusMap(createPrng(), { rows: 4, cols: 4 });
    const rectBonusMap = CardExpansion.buildInitialBoardBonusMap(createPrng(), { rows: 8, cols: 9 });
    const cardState = CardLogic.createCardState(createPrng(), { boardConfig: { rows: 8, cols: 9 } });

    expect(Object.keys(squareBonusMap)).toHaveLength(40);
    expect(Object.keys(smallBonusMap)).toHaveLength(3);
    expect(Object.keys(rectBonusMap)).toHaveLength(46);

    expect(cardState.boardConfig).toMatchObject({
      rows: 8,
      cols: 9,
      standard8x8: false
    });
    expect(cardState.stoneIdMap).toHaveLength(8);
    expect(cardState.stoneIdMap[0]).toHaveLength(9);
    expect(cardState.stoneIdMap[3][3]).toBe('s1');
    expect(cardState.stoneIdMap[3][4]).toBe('s2');
    expect(cardState.stoneIdMap[4][3]).toBe('s3');
    expect(cardState.stoneIdMap[4][4]).toBe('s4');
  });

  test('expansion helpers honor custom board edges and corners', () => {
    const gameState = Core.createGameState({ rows: 4, cols: 4 });
    const cardState = CardLogic.createCardState(createPrng(), { boardConfig: { rows: 4, cols: 4 } });

    const expansionTargets = CardSelectors.getBoardExpansionTargets(cardState, gameState, 'black');
    expect(expansionTargets).toHaveLength(8);
    expect(expansionTargets).toEqual(expect.arrayContaining([
      { row: 0, col: 0, side: 'left' },
      { row: 3, col: 3, side: 'right' }
    ]));

    const godCorners = CardExpansion.getBoardExpansionGodCornerDescriptorsForCard(gameState);
    expect(godCorners).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 3,
        col: 3,
        cells: expect.arrayContaining([
          { row: 3, col: 4 },
          { row: 4, col: 4 },
          { row: 4, col: 3 }
        ])
      })
    ]));

    const teleportDestinations = CardSelectors.getCellTeleportDestinations(cardState, gameState);
    expect(teleportDestinations).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: -1, side: 'left' }),
      expect.objectContaining({ row: 0, col: 4, side: 'right' }),
      expect.objectContaining({ row: 4, col: 3, side: 'bottom' })
    ]));
  });

  test('custom right-edge expansion cell can materialize on 8x9 board', () => {
    const gameState = Core.createGameState({ rows: 8, cols: 9 });

    const applied = CardExpansion.ensureExpansionCellForCard(gameState, 5, 9, Core.EMPTY);

    expect(applied).toBe(true);
    expect(CardExpansion.getExpansionDescriptorsForCard(gameState)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 5,
        col: 9,
        side: 'right',
        owner: Core.EMPTY
      })
    ]));
    expect(gameState.boardExpansion).toMatchObject({
      active: true,
      side: 'right',
      row: 5,
      owner: Core.EMPTY
    });
  });

  test('board config clamps above-limit requests to 10x10 and accepts full 10x10 boards', () => {
    expect(SharedBoardUtils.buildBoardConfig(11, 12)).toMatchObject({
      rows: 10,
      cols: 10,
      standard8x8: false
    });

    const gameState = Core.createGameState({ rows: 10, cols: 10 });

    expect(gameState.board).toHaveLength(10);
    expect(gameState.board[0]).toHaveLength(10);
    expect(gameState.boardConfig).toMatchObject({
      rows: 10,
      cols: 10,
      standard8x8: false
    });
    expect(gameState.board[4][4]).toBe(Core.WHITE);
    expect(gameState.board[4][5]).toBe(Core.BLACK);
    expect(gameState.board[5][4]).toBe(Core.BLACK);
    expect(gameState.board[5][5]).toBe(Core.WHITE);
  });

  test('shared board geometry helpers ignore missing sources and compare snapshot-like configs', () => {
    const previous = { roomBoardConfig: { rows: 7, cols: 9 } };
    const next = { board: SharedBoardUtils.createEmptyBoard({ rows: 8, cols: 8 }) };

    expect(SharedBoardUtils.maybeResolveBoardConfig(null)).toBeNull();
    expect(SharedBoardUtils.readBoardGeometry(previous)).toEqual({ rows: 7, cols: 9 });
    expect(SharedBoardUtils.compareBoardGeometry(previous, next)).toEqual({
      previous: { rows: 7, cols: 9 },
      next: { rows: 8, cols: 8 },
      changed: true
    });
  });
});
