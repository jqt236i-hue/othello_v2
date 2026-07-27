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
    const gameState = { board, boardConfig, boardExpansion };
    const context = SharedBoardUtils.createBoardContext(gameState, cardState);
    return { gameState, cardState, context };
  }

  test('initial shape name only determines base keys', () => {
    const state = createCircleState();
    const topology = SharedBoardUtils.buildBoardTopology(state.context);

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
    const topology = SharedBoardUtils.buildBoardTopology(state.context);
    const sockets = SharedBoardUtils.getBoardExpansionEdgeSockets(state.context);

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
    const topology = SharedBoardUtils.buildBoardTopology(state.context);
    const sockets = SharedBoardUtils.getBoardExpansionEdgeSockets(state.context);

    expect(topology.existingKeys.has('0,3')).toBe(true);
    expect(topology.holeKeys.has('0,3')).toBe(true);
    expect(topology.playableKeys.has('0,3')).toBe(false);
    expect(topology.boundaryEdgesByKey.get('0,3')?.bottom).toBe('hole');
    expect(topology.boundaryEdgesByKey.get('1,3')?.top).toBe('hole');
    expect(sockets.some((socket: any) => socket.additions.some((cell: any) => cell.row === 0 && cell.col === 3))).toBe(false);
  });

  test('derives outer contours without materializing a global void key set', () => {
    const state = createCircleState();
    const topology = SharedBoardUtils.buildBoardTopology(state.context);

    expect(topology.boundaryEdgesByKey.get('0,3')).toMatchObject({
      top: 'outer',
      left: 'outer'
    });
    expect(topology).not.toHaveProperty('voidKeys');
    expect(topology.boundaryEdgesByKey.size).toBe(topology.existingKeys.size);
  });

  test('keeps every cached topology surface deeply immutable to callers', () => {
    const state = createCircleState(
      [{ row: -1, col: 3, side: 'top', owner: 0 }],
      [{
        kind: 'specialStone',
        row: 0,
        col: 3,
        data: { type: 'METEOR_HOLE' }
      }]
    );
    const topology: any = SharedBoardUtils.buildBoardTopology(state.context);
    const originalBaseCoordinate = { ...topology.baseCoordinates[0] };
    const originalRenderBounds = { ...topology.renderBounds };
    const originalEdge = {
      ...topology.boundaryEdgesByKey.get('-1,3')
    };

    expect(Object.isFrozen(topology)).toBe(true);
    for (const keys of [
      topology.baseKeys,
      topology.expansionKeys,
      topology.existingKeys,
      topology.playableKeys,
      topology.holeKeys
    ]) {
      expect(Object.isFrozen(keys)).toBe(true);
      expect(typeof keys.add).toBe('undefined');
      expect(typeof keys.delete).toBe('undefined');
      expect(typeof keys.clear).toBe('undefined');
    }
    for (const entries of [
      topology.expansionSideByKey,
      topology.boundaryEdgesByKey
    ]) {
      expect(Object.isFrozen(entries)).toBe(true);
      expect(typeof entries.set).toBe('undefined');
      expect(typeof entries.delete).toBe('undefined');
      expect(typeof entries.clear).toBe('undefined');
    }
    for (const coordinates of [
      topology.baseCoordinates,
      topology.expansionCoordinates,
      topology.existingCoordinates,
      topology.playableCoordinates,
      topology.holeCoordinates
    ]) {
      expect(Object.isFrozen(coordinates)).toBe(true);
      for (const coordinate of coordinates) {
        expect(Object.isFrozen(coordinate)).toBe(true);
      }
    }
    for (const bounds of [
      topology.contentBounds,
      topology.renderBounds,
      topology.candidateBounds
    ]) {
      expect(Object.isFrozen(bounds)).toBe(true);
    }
    for (const edges of topology.boundaryEdgesByKey.values()) {
      expect(Object.isFrozen(edges)).toBe(true);
    }

    expect(() => {
      topology.baseCoordinates[0].row = 999;
    }).toThrow();
    expect(() => {
      topology.renderBounds.minRow = -999;
    }).toThrow();
    expect(() => {
      topology.boundaryEdgesByKey.get('-1,3').top = 'none';
    }).toThrow();

    const cached = SharedBoardUtils.buildBoardTopology(state.context);
    expect(cached).toBe(topology);
    expect(cached.baseCoordinates[0]).toEqual(originalBaseCoordinate);
    expect(cached.renderBounds).toEqual(originalRenderBounds);
    expect(cached.boundaryEdgesByKey.get('-1,3')).toEqual(originalEdge);
    expect(cached.baseKeys.has('0,3')).toBe(true);
    expect(cached.expansionKeys.has('-1,3')).toBe(true);
    expect(cached.holeKeys.has('0,3')).toBe(true);
  });

  test('keeps explicit holes as sparse topology tombstones', () => {
    const state = createCircleState([], [{
        kind: 'specialStone',
        row: -3,
        col: 12,
        data: { type: 'METEOR_HOLE' }
      }]);
    const topology = SharedBoardUtils.buildBoardTopology(state.context);

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

  test('rejects absurd hole coordinates without clipping valid multi-ring holes', () => {
    const state = createCircleState([], [
      {
        kind: 'specialStone',
        row: -3,
        col: 12,
        data: { type: 'METEOR_HOLE' }
      },
      {
        kind: 'specialStone',
        row: 1_000_000_000,
        col: 1_000_000_000,
        data: { type: 'METEOR_HOLE' }
      }
    ]);

    const strictInspection = SharedBoardUtils.inspectBoardState(
      state.gameState,
      state.cardState,
      { strict: true }
    );
    expect(strictInspection.ok).toBe(false);
    expect(strictInspection.errors).toContain(
      'METEOR_HOLE coordinate 1000000000,1000000000 exceeds coordinate limit'
    );

    const nonStrictInspection = SharedBoardUtils.inspectBoardState(
      state.gameState,
      state.cardState,
      { strict: false }
    );
    expect(nonStrictInspection.ok).toBe(true);
    expect(nonStrictInspection.warnings).toContain(
      'METEOR_HOLE coordinate 1000000000,1000000000 exceeds coordinate limit and was ignored'
    );
    expect(nonStrictInspection.topology?.holeKeys.has('-3,12')).toBe(true);
    expect(
      nonStrictInspection.topology?.holeKeys.has('1000000000,1000000000')
    ).toBe(false);
    expect(nonStrictInspection.topology?.renderBounds).toMatchObject({
      minRow: -3,
      maxRow: 9,
      minCol: 0,
      maxCol: 12
    });
    expect(nonStrictInspection.topology?.candidateBounds).toEqual({
      minRow: -4,
      maxRow: 10,
      minCol: -1,
      maxCol: 13
    });

    const topology = SharedBoardUtils.buildBoardTopology(state.context);
    expect(topology.holeKeys.has('-3,12')).toBe(true);
    expect(topology.holeKeys.has('1000000000,1000000000')).toBe(false);
    expect(topology.renderRows).toBe(13);
    expect(topology.renderCols).toBe(13);
  });

  test('god sockets always add a connected 2x2 corner around their anchor', () => {
    const state = createCircleState();
    const sockets = SharedBoardUtils.getBoardExpansionCornerSockets(state.context);

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
