import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as CardExpansion from '../game/logic/cards/expansion.js';
import * as CardSelectors from '../game/logic/cards/selectors.js';
import * as CardTargets from '../game/logic/cards/targets.js';
import * as CardHyperactive from '../game/logic/cards/hyperactive.js';
import * as SelectorOrchestrator from '../game/logic/cards-internal/selector-orchestrator.js';
import * as SharedBoardUtils from '../shared/shared-board-utils.js';

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

  test('capture target helpers can read custom-board expansion cells', () => {
    const gameState = Core.createGameState({ rows: 4, cols: 4 });
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'bottom', row: 4, col: 2, owner: Core.WHITE }
      ]
    };
    const cardState = {
      markers: [
        { kind: 'specialStone', row: 4, col: 2, owner: 'white', data: { type: 'TIME_BOMB' } }
      ]
    };

    expect(CardTargets.getCaptureWillTargets(cardState, gameState, 'black')).toEqual([
      { row: 4, col: 2 }
    ]);
  });

  test('hyperactive anchor can move into a custom-board expansion cell', () => {
    const gameState = Core.createGameState({ rows: 4, cols: 4 });
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        gameState.board[row][col] = Core.WHITE;
      }
    }
    gameState.board[3][3] = Core.BLACK;
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'bottom', row: 4, col: 3, owner: Core.EMPTY }
      ]
    };
    const cardState = {
      markers: [
        {
          kind: 'specialStone',
          row: 3,
          col: 3,
          owner: 'black',
          data: { type: 'HYPERACTIVE', remainingOwnerTurns: 2 }
        }
      ]
    };

    const result = CardHyperactive.processHyperactiveMoveAtAnchor(
      cardState,
      gameState,
      'black',
      3,
      3,
      { random: () => 0 },
      {
        isBlockedCell: () => false,
        getFlipsWithContext: () => []
      }
    );

    expect(result.moved).toEqual([
      { from: { row: 3, col: 3 }, to: { row: 4, col: 3 }, specialType: 'HYPERACTIVE' }
    ]);
    expect(gameState.board[3][3]).toBe(Core.EMPTY);
    expect(gameState.boardExpansion.cells[0].owner).toBe(Core.BLACK);
    expect(cardState.markers[0]).toEqual(expect.objectContaining({ row: 4, col: 3 }));
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

  test('shared expansion descriptors preserve legacy active expansion when cells are empty', () => {
    const BoardOps = require('../game/logic/board_ops.js');
    const gameState = Core.createGameState({ rows: 8, cols: 9 });
    gameState.boardExpansion = {
      active: true,
      side: 'right',
      row: 2,
      owner: Core.WHITE,
      usedByPlayer: { black: true, white: true },
      cells: []
    };

    const expected = [
      { side: 'right', row: 2, col: 9, owner: Core.WHITE }
    ];

    expect(CardExpansion.getExpansionDescriptorsForCard(gameState)).toEqual(expected);
    expect(BoardOps.getExpansionDescriptors(gameState)).toEqual(expected);
    expect(SharedBoardUtils.collectExpansionDescriptors(gameState.boardExpansion, gameState)).toEqual(expected);
  });

  test('expansion descriptor helpers agree on legacy and cells normalization', () => {
    const BoardOps = require('../game/logic/board_ops.js');
    const gameState = Core.createGameState({ rows: 8, cols: 9 });
    gameState.boardExpansion = {
      active: true,
      side: 'right',
      row: 2,
      owner: Core.WHITE,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'top', row: -1, col: 0, owner: Core.WHITE },
        { side: 'right', row: 4, owner: Core.BLACK },
        { side: 'right', row: 4, col: 9, owner: Core.WHITE },
        { side: 'bottom', row: 8, col: 8, owner: 999 },
        { side: 'left', row: 1, col: -1, owner: Core.BLACK },
        { side: 'left', row: 1, col: -1, owner: Core.WHITE },
        { side: 'top', row: 0, col: 0, owner: Core.BLACK }
      ]
    };

    const expected = [
      { side: 'top', row: -1, col: 0, owner: Core.WHITE },
      { side: 'right', row: 4, col: 9, owner: Core.BLACK },
      { side: 'bottom', row: 8, col: 8, owner: Core.EMPTY },
      { side: 'left', row: 1, col: -1, owner: Core.BLACK }
    ];

    expect(SharedBoardUtils.collectExpansionDescriptors(gameState.boardExpansion, gameState)).toEqual(expected);
    expect(CardExpansion.getExpansionDescriptorsForCard(gameState)).toEqual(expected);
    expect(BoardOps.getExpansionDescriptors(gameState)).toEqual(expected);
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

  test('shared board-shape iterator and disc counter include expansion cells once', () => {
    const gameState = Core.createGameState({ rows: 4, cols: 4 });
    gameState.board = [
      [Core.BLACK, Core.EMPTY, Core.EMPTY, Core.EMPTY],
      [Core.EMPTY, Core.BLACK, Core.EMPTY, Core.EMPTY],
      [Core.EMPTY, Core.EMPTY, Core.WHITE, Core.EMPTY],
      [Core.EMPTY, Core.EMPTY, Core.EMPTY, Core.EMPTY]
    ];
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'bottom', row: 4, col: 2, owner: Core.WHITE }
      ]
    };

    const visited = [];
    SharedBoardUtils.forEachBoardShapeCell(gameState, (row, col, value, side) => {
      visited.push(`${row},${col}:${value}:${side || 'main'}`);
    });

    expect(visited).toHaveLength(17);
    expect(visited.filter((entry) => entry.startsWith('4,2:'))).toEqual(['4,2:-1:bottom']);
    expect(SharedBoardUtils.countDiscsByPlayer(gameState)).toEqual({ black: 2, white: 2 });
  });

  test('selector orchestrator destroy fallback respects custom board size and expansion cells', () => {
    const gameState = Core.createGameState({ rows: 4, cols: 4 });
    gameState.board = [
      [Core.BLACK, Core.EMPTY, Core.EMPTY, Core.EMPTY],
      [Core.EMPTY, Core.EMPTY, Core.EMPTY, Core.EMPTY],
      [Core.EMPTY, Core.EMPTY, Core.WHITE, Core.EMPTY],
      [Core.EMPTY, Core.EMPTY, Core.EMPTY, Core.EMPTY]
    ];
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'bottom', row: 4, col: 2, owner: Core.BLACK }
      ]
    };

    const targets = SelectorOrchestrator.getSelectableTargetsForPending({
      pending: { type: 'DESTROY_ONE_STONE' },
      gameState,
      cardState: {},
      playerKey: 'black',
      constants: { EMPTY: Core.EMPTY, BLACK: Core.BLACK, WHITE: Core.WHITE },
      helpers: {
        getExpansionDescriptorsForCard: (state) => SharedBoardUtils.collectExpansionDescriptors(state.boardExpansion, state)
      }
    });

    expect(sortMoveKeys(targets)).toEqual(['0,0', '2,2', '4,2']);
  });

  test('selector orchestrator unified config still reaches local-only selectors', () => {
    const getTemptWillTargets = jest.fn(() => [{ row: 1, col: 1 }]);

    const targets = SelectorOrchestrator.getSelectableTargetsForPending({
      pending: { type: 'TEMPT_WILL' },
      gameState: { board: [[Core.EMPTY]] },
      cardState: { markers: [] },
      playerKey: 'black',
      localSelectors: { getTemptWillTargets }
    });

    expect(targets).toEqual([{ row: 1, col: 1 }]);
    expect(getTemptWillTargets).toHaveBeenCalledWith(
      { markers: [] },
      { board: [[Core.EMPTY]] },
      'black'
    );
  });
});
