import { createControlCounts } from '../shared/board/control-counts';

const SharedBoardUtils = require('../shared/shared-board-utils');

describe('shared board control counts', () => {
  test('keeps corner and non-corner edge control counts fixture-equivalent', () => {
    const board = [[1, 1, 0, -1], [0, 0, 0, 0], [0, 0, 0, 0], [-1, 0, 1, 1]];
    const leaf = createControlCounts({
      getCellValue: SharedBoardUtils.getCellValue,
      getCornerCells: SharedBoardUtils.getCornerCells,
      collectBoardCoordinates: SharedBoardUtils.collectBoardCoordinates,
      isEdgeCell: SharedBoardUtils.isEdgeCell,
      isCornerCell: SharedBoardUtils.isCornerCell
    });

    expect(leaf.countCornerControl(board, 1)).toEqual({ ownCorners: 2, oppCorners: 2 });
    expect(leaf.countEdgeControl(board, 1)).toEqual({ ownEdges: 2, oppEdges: 0 });
    expect(leaf.countCornerControl(null, 1)).toEqual({ ownCorners: 0, oppCorners: 0 });
    expect(SharedBoardUtils.countCornerControl(board, 1)).toEqual(leaf.countCornerControl(board, 1));
    expect(SharedBoardUtils.countEdgeControl(board, 1)).toEqual(leaf.countEdgeControl(board, 1));
  });
});

describe('view-scoped control counts on state-backed boards', () => {
  const genericCounts = createControlCounts({
    getCellValue: SharedBoardUtils.getCellValue,
    getCornerCells: SharedBoardUtils.getCornerCells,
    collectBoardCoordinates: SharedBoardUtils.collectBoardCoordinates,
    isEdgeCell: SharedBoardUtils.isEdgeCell,
    isCornerCell: SharedBoardUtils.isCornerCell
  });

  function seeded(seed: number) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 0x100000000;
    };
  }

  function fill(rows: number, cols: number, seed: number) {
    const random = seeded(seed);
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => {
      const roll = random();
      return roll < 0.35 ? 1 : roll < 0.7 ? -1 : 0;
    }));
  }

  function boards() {
    const out: Array<{ name: string; board: unknown }> = [];
    for (let seed = 1; seed <= 6; seed++) {
      out.push({ name: `8x8-${seed}`, board: SharedBoardUtils.createBoardContext({ board: fill(8, 8, seed) }, { markers: [] }) });
    }
    out.push({
      name: 'holes-and-expansion',
      board: SharedBoardUtils.createBoardContext({
        board: fill(8, 8, 11),
        boardExpansion: { cells: [
          { side: 'left', row: 0, col: -1, owner: 1 },
          { side: 'left', row: 3, col: -1, owner: -1 },
          { side: 'right', row: 5, col: 8, owner: 0 }
        ] }
      }, { markers: [
        { kind: 'specialStone', row: 0, col: 1, owner: 'white', data: { type: 'METEOR_HOLE' } },
        { kind: 'specialStone', row: 4, col: 4, owner: 'black', data: { type: 'METEOR_HOLE' } }
      ] })
    });
    out.push({
      name: 'circle-10',
      board: SharedBoardUtils.createBoardContext({ board: fill(10, 10, 21), boardConfig: { rows: 10, cols: 10, shape: 'circle' } }, { markers: [] })
    });
    out.push({
      name: 'rect-6x9',
      board: SharedBoardUtils.createBoardContext({ board: fill(6, 9, 31), boardConfig: { rows: 6, cols: 9, shape: 'rectangle' } }, { markers: [] })
    });
    return out;
  }

  test('matches the generic helper path for every fixture, player and search projection', () => {
    for (const { name, board } of boards()) {
      expect(SharedBoardUtils.resolveReadOnlyBoardView(board)).not.toBeNull();
      for (const player of [1, -1]) {
        const expected = {
          corners: genericCounts.countCornerControl(board, player),
          edges: genericCounts.countEdgeControl(board, player)
        };
        expect({ name, player, corners: SharedBoardUtils.countCornerControl(board, player), edges: SharedBoardUtils.countEdgeControl(board, player) })
          .toEqual({ name, player, ...expected });
        const search = SharedBoardUtils.prepareBoardForSearch(board);
        expect(SharedBoardUtils.resolveReadOnlyBoardView(search)).toBeNull();
        expect({ name, player, corners: SharedBoardUtils.countCornerControl(search, player), edges: SharedBoardUtils.countEdgeControl(search, player) })
          .toEqual({ name, player, ...expected });
      }
    }
  });

  test('re-reads a same-reference board after an in-place change', () => {
    const board = SharedBoardUtils.createBoardContext({ board: fill(8, 8, 3) }, { markers: [] });
    const before = SharedBoardUtils.countEdgeControl(board, 1);
    const state = (board as any).gameState;
    for (let col = 1; col < 7; col++) state.board[0][col] = 1;
    const after = SharedBoardUtils.countEdgeControl(board, 1);
    expect(after).toEqual(genericCounts.countEdgeControl(board, 1));
    expect(after).not.toEqual(before);
  });
});
