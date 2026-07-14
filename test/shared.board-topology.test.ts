const SharedBoardUtils = require('../shared/shared-board-utils');

describe('shared BoardTopology', () => {
  function createCircleState(expansionCells: any[] = [], markers: any[] = []) {
    const boardConfig = SharedBoardUtils.normalizeBoardConfig({
      rows: 10,
      cols: 10,
      shape: 'circle'
    });
    const board = SharedBoardUtils.createEmptyBoard(boardConfig);
    const boardExpansion = {
      cells: expansionCells,
      usedByPlayer: { black: false, white: false }
    };
    const cardState = { markers };
    SharedBoardUtils.attachBoardShape(board, { boardConfig, boardExpansion, cardState });
    return { board, boardConfig, boardExpansion, cardState };
  }

  test('initial shape name only determines base keys', () => {
    const state = createCircleState();
    const topology = SharedBoardUtils.buildBoardTopology(state, { cardState: state.cardState });

    expect(topology.baseKeys.size).toBe(80);
    expect(topology.expansionKeys.size).toBe(0);
    expect(topology.playableKeys.size).toBe(80);
    expect(topology.renderBounds).toEqual({ minRow: 0, maxRow: 9, minCol: 0, maxCol: 9 });
    expect(topology.candidateBounds).toEqual({ minRow: -1, maxRow: 10, minCol: -1, maxCol: 10 });
  });

  test('repeated expansion derives candidates from current topology beyond the initial halo', () => {
    const state = createCircleState([
      { row: -1, col: 3, side: 'top', owner: 0 },
      { row: -2, col: 3, side: 'top', owner: 0 }
    ]);
    const topology = SharedBoardUtils.buildBoardTopology(state, { cardState: state.cardState });
    const sockets = SharedBoardUtils.getBoardExpansionEdgeSockets(state.board, state);

    expect(topology.expansionKeys.has('-2,3')).toBe(true);
    expect(topology.renderBounds.minRow).toBe(-2);
    expect(topology.renderRowOffset).toBe(2);
    expect(topology.renderColOffset).toBe(0);
    expect(topology.renderRows).toBe(12);
    expect(topology.renderCols).toBe(10);
    expect(topology.candidateBounds.minRow).toBe(-3);
    expect(sockets.some((socket: any) => (
      socket.anchor.row === -2 &&
      socket.anchor.col === 3 &&
      socket.directionKey === 'up' &&
      socket.additions.some((cell: any) => cell.row === -3 && cell.col === 3)
    ))).toBe(true);
  });

  test('holes remain existing tombstones and cannot be expansion additions', () => {
    const markers = [{
      kind: 'specialStone',
      row: 0,
      col: 3,
      data: { type: 'METEOR_HOLE' }
    }];
    const state = createCircleState([], markers);
    const topology = SharedBoardUtils.buildBoardTopology(state, { cardState: state.cardState });
    const sockets = SharedBoardUtils.getBoardExpansionEdgeSockets(state.board, state);

    expect(topology.existingKeys.has('0,3')).toBe(true);
    expect(topology.holeKeys.has('0,3')).toBe(true);
    expect(topology.playableKeys.has('0,3')).toBe(false);
    expect(topology.boundaryEdgesByKey.get('0,3')?.bottom).toBe('hole');
    expect(topology.boundaryEdgesByKey.get('1,3')?.top).toBe('hole');
    expect(sockets.some((socket: any) => socket.additions.some((cell: any) => cell.row === 0 && cell.col === 3))).toBe(false);
  });

  test('derives outer contours without materializing a global void key set', () => {
    const state = createCircleState();
    const topology = SharedBoardUtils.buildBoardTopology(state, { cardState: state.cardState });

    expect(topology.boundaryEdgesByKey.get('0,3')).toMatchObject({
      top: 'outer',
      left: 'outer'
    });
    expect(topology).not.toHaveProperty('voidKeys');
    expect(topology.boundaryEdgesByKey.size).toBe(topology.existingKeys.size);
  });

  test('keeps explicit holes as sparse topology tombstones', () => {
    const state = createCircleState();
    state.cardState = {
      markers: [{
        kind: 'specialStone',
        row: -3,
        col: 12,
        data: { type: 'METEOR_HOLE' }
      }]
    };
    const topology = SharedBoardUtils.buildBoardTopology(state, { cardState: state.cardState });

    expect(topology.existingKeys.has('-3,12')).toBe(true);
    expect(topology.holeKeys.has('-3,12')).toBe(true);
    expect(topology.playableKeys.has('-3,12')).toBe(false);
    expect(topology.holeCoordinates).toContainEqual({ row: -3, col: 12 });
    expect(topology.renderBounds).toMatchObject({ minRow: -3, maxCol: 12 });
    expect(topology.renderRowOffset).toBe(3);
    expect(topology.boundaryEdgesByKey.get('-3,12')).toEqual({
      top: 'outer',
      right: 'outer',
      bottom: 'outer',
      left: 'outer'
    });
  });

  test('god sockets always add a connected 2x2 corner around their anchor', () => {
    const state = createCircleState();
    const sockets = SharedBoardUtils.getBoardExpansionCornerSockets(state.board, state);

    expect(sockets.length).toBeGreaterThan(0);
    for (const socket of sockets) {
      expect(socket.additions).toHaveLength(3);
      const expected = new Set([
        `${socket.anchor.row + socket.direction.row},${socket.anchor.col}`,
        `${socket.anchor.row},${socket.anchor.col + socket.direction.col}`,
        `${socket.anchor.row + socket.direction.row},${socket.anchor.col + socket.direction.col}`
      ]);
      expect(new Set(socket.additions.map((cell: any) => `${cell.row},${cell.col}`))).toEqual(expected);
    }
  });
});
