const { createCardBoardShapeAccess } = require('../game/logic/cards-internal/board-shape-access');
const SharedBoardUtils = require('../shared/shared-board-utils');

function createBoard(rows = 4, cols = 4, fill = 0) {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

function createAccess(overrides: any = {}) {
  const gameState = overrides.gameState || {
    board: createBoard(),
    boardExpansion: {
      cells: (overrides.expansionCells || []).map((cell: any) => ({ ...cell }))
    }
  };
  const cardState = overrides.cardState || {
    markers: (overrides.markers || []).map((marker: any) => ({ ...marker }))
  };
  const createBoardContextForCard = (stateCard: any, stateGame: any) =>
    SharedBoardUtils.createBoardContext(stateGame, stateCard);
  const createBoardViewForCard = (stateCard: any, stateGame: any) => {
    const context = createBoardContextForCard(stateCard, stateGame);
    return SharedBoardUtils.createBoardView(context.gameState, {
      cardState: context.cardState,
      strict: false
    });
  };
  return {
    gameState,
    cardState,
    access: createCardBoardShapeAccess({
      emptyValue: 0,
      blackValue: 1,
      whiteValue: -1,
      createBoardContextForCard,
      createBoardViewForCard,
      getEffectiveCornerCellsForCard: (stateCard: any, stateGame: any) =>
        SharedBoardUtils.getEffectiveCornerCells(createBoardContextForCard(stateCard, stateGame)),
      toBoardCellKey: SharedBoardUtils.toBoardCellKey,
      getBlockingMarkers: (stateCard: any) => (stateCard.markers || []).filter((marker: any) => (
        marker.kind === 'specialStone' &&
        marker.data &&
        marker.data.type === 'BLOCKADE'
      )),
      resolveDeterministicRandomIndex: () => 0
    })
  };
}

describe('cards board shape access module', () => {
  test('uses canonical topology for expansions and meteor holes', () => {
    const { access, gameState, cardState } = createAccess({
      expansionCells: [
        { side: 'top', row: -1, col: 0, owner: 1 },
        { side: 'right', row: 0, col: 4, owner: 0 }
      ],
      markers: [
        { kind: 'specialStone', row: 0, col: 0, data: { type: 'METEOR_HOLE' } },
        { kind: 'specialStone', row: 0, col: 4, data: { type: 'METEOR_HOLE' } }
      ]
    });

    expect(access.hasBoardShapeCellForCard(cardState, gameState, -1, 0)).toBe(true);
    expect(access.hasBoardShapeCellForCard(cardState, gameState, 0, 0)).toBe(false);
    expect(access.hasBoardShapeCellForCard(cardState, gameState, 0, 4)).toBe(false);
    expect(access.hasMeteorHoleAtForCard(cardState, gameState, 0, 4)).toBe(true);
    expect(access.getCurrentBoardShapeCellsForCard(cardState, gameState)).toContainEqual({ row: -1, col: 0 });
    expect(access.getCurrentBoardShapeCellsForCard(cardState, gameState)).not.toContainEqual({ row: 0, col: 0 });
    expect(access.getOccupiedBoardShapeCellsForCard(cardState, gameState)).toContainEqual({ row: -1, col: 0 });
    expect(access.getEmptyBoardShapeCellsForCard(cardState, gameState)).not.toContainEqual({ row: 0, col: 4 });
  });

  test('isBlockedCell only blocks playable cells', () => {
    const { access, gameState, cardState } = createAccess({
      markers: [
        { kind: 'specialStone', row: 0, col: 1, data: { type: 'BLOCKADE' } },
        { kind: 'specialStone', row: 0, col: 2, data: { type: 'BLOCKADE' } },
        { kind: 'specialStone', row: 0, col: 2, data: { type: 'METEOR_HOLE' } }
      ]
    });

    expect(access.isBlockedCell(cardState, 0, 1, gameState)).toBe(true);
    expect(access.isBlockedCell(cardState, 0, 2, gameState)).toBe(true);
    expect(access.isBlockedCell(cardState, 9, 9, gameState)).toBe(false);
  });

  test('countOccupiedCornersForPlayer delegates effective corners to the board kernel', () => {
    const gameState = { board: createBoard(4, 4) };
    gameState.board[0][0] = 1;
    gameState.board[0][3] = -1;
    gameState.board[3][0] = 1;
    const { access, cardState } = createAccess({ gameState });

    expect(access.countOccupiedCornersForPlayer(cardState, gameState, 'black')).toBe(2);
    expect(access.countOpponentOccupiedCornersForPlayer(cardState, gameState, 'black')).toBe(1);
  });

  test('moveCoexistingSpecialMarkers does not move board-overlay markers', () => {
    const anchor = { kind: 'specialStone', row: 1, col: 1, data: { type: 'HYPERACTIVE' } };
    const movable = { kind: 'specialStone', row: 1, col: 1, data: { type: 'GUARD' } };
    const blockade = { kind: 'specialStone', row: 1, col: 1, data: { type: 'BLOCKADE' } };
    const cardState = { markers: [anchor, movable, blockade] };
    const { access } = createAccess();

    access.moveCoexistingSpecialMarkers(cardState, anchor, 1, 1, 2, 2);

    expect(anchor).toMatchObject({ row: 1, col: 1 });
    expect(movable).toMatchObject({ row: 2, col: 2 });
    expect(blockade).toMatchObject({ row: 1, col: 1 });
  });

  test('collectCloneSpawnCellsForCard returns nearest canonical empty cells', () => {
    const gameState = { board: createBoard(6, 6, 1) };
    gameState.board[3][3] = 1;
    gameState.board[0][0] = 0;
    gameState.board[5][5] = 0;
    const { access, cardState } = createAccess({ gameState });

    expect(access.collectCloneSpawnCellsForCard(cardState, gameState, 3, 3)).toEqual([{ row: 5, col: 5 }]);
  });

  test('fails fast when BoardContext dependencies are missing', () => {
    expect(() => createCardBoardShapeAccess({
      emptyValue: 0,
      blackValue: 1,
      whiteValue: -1
    })).toThrow('BoardContext/BoardView APIs are required');
  });
});
