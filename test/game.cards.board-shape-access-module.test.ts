const { createCardBoardShapeAccess } = require('../game/logic/cards-internal/board-shape-access');

function createBoard(rows = 4, cols = 4, fill = 0) {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

function createAccess(overrides = {}) {
  const gameState = overrides.gameState || { board: createBoard() };
  const expansionCells = overrides.expansionCells || [];
  const markers = overrides.markers || [];
  return {
    gameState,
    access: createCardBoardShapeAccess({
      emptyValue: 0,
      blackValue: 1,
      whiteValue: -1,
      resolveCardBoardConfig: (state) => ({
        rows: state.board.length,
        cols: state.board[0].length
      }),
      getExpansionDescriptorsForCard: () => expansionCells,
      isMainBoardCellForCard: (row, col, state) => (
        Array.isArray(state.board[row]) && col >= 0 && col < state.board[row].length
      ),
      getCellValueForCard: (state, row, col) => (
        Array.isArray(state.board[row]) && col >= 0 && col < state.board[row].length
          ? state.board[row][col]
          : 0
      ),
      getBlockingMarkers: () => markers.filter((m) => m.kind === 'specialStone' && m.data && m.data.type === 'BLOCKADE'),
      findSpecialMarkerAt: (_cardState, row, col, type) => markers.find((m) => (
        m.kind === 'specialStone' &&
        m.row === row &&
        m.col === col &&
        m.data &&
        m.data.type === type
      )) || null,
      resolveDeterministicRandomIndex: () => 0
    })
  };
}

describe('cards board shape access module', () => {
  test('hasBoardShapeCellForCard includes expansion cells and excludes meteor holes', () => {
    const { access, gameState } = createAccess({
      expansionCells: [{ row: -1, col: 0 }],
      markers: [{ kind: 'specialStone', row: 0, col: 0, data: { type: 'METEOR_HOLE' } }]
    });

    expect(access.hasBoardShapeCellForCard({}, gameState, -1, 0)).toBe(true);
    expect(access.hasBoardShapeCellForCard({}, gameState, 0, 0)).toBe(false);
    expect(access.hasBoardShapeCellForCard({}, gameState, 0, 1)).toBe(true);
  });

  test('isBlockedCell only blocks cells that exist in the board shape', () => {
    const { access, gameState } = createAccess({
      markers: [{ kind: 'specialStone', row: 0, col: 1, data: { type: 'BLOCKADE' } }]
    });

    expect(access.isBlockedCell({}, 0, 1, gameState)).toBe(true);
    expect(access.isBlockedCell({}, 9, 9, gameState)).toBe(false);
  });

  test('countOccupiedCornersForPlayer counts dynamic shape corners', () => {
    const gameState = { board: createBoard(3, 3) };
    gameState.board[0][0] = 1;
    gameState.board[0][2] = -1;
    gameState.board[2][0] = 1;
    const { access } = createAccess({ gameState });

    expect(access.countOccupiedCornersForPlayer({}, gameState, 'black')).toBe(2);
    expect(access.countOpponentOccupiedCornersForPlayer({}, gameState, 'black')).toBe(1);
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
});
