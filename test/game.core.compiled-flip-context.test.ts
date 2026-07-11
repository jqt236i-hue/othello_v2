import * as Core from '../game/logic/core.js';

function emptyBoard(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(Core.EMPTY));
}

describe('compiled flip context', () => {
  test('matches array context results without mutating input arrays', () => {
    const state = Core.createGameState();
    state.board = emptyBoard(8, 8);
    state.board[3][1] = Core.WHITE;
    state.board[3][2] = Core.BLACK;
    state.board[4][1] = Core.WHITE;
    state.board[4][2] = Core.BLACK;
    const context = {
      protectedStones: [{ row: 4, col: 1 }],
      permaProtectedStones: [{ row: 6, col: 6 }],
      blockedCells: [{ row: 7, col: 7 }]
    };
    const original = JSON.parse(JSON.stringify(context));

    const uncompiled = Core.getFlipsWithContext(state, 3, 0, Core.BLACK, context);
    const compiled = Core.compileFlipContext(context);
    const compiledResult = Core.getFlipsWithContext(state, 3, 0, Core.BLACK, compiled);

    expect(compiledResult).toEqual(uncompiled);
    expect(compiledResult).toEqual([[3, 1]]);
    expect(context).toEqual(original);
    expect(compiled.source).toBe(context);
    expect(Core.compileFlipContext(compiled)).toBe(compiled);
  });

  test('keeps rectangular board and blocked endpoint behavior', () => {
    const state = Core.createGameState({ rows: 6, cols: 9 });
    state.board = emptyBoard(6, 9);
    state.board[2][1] = Core.WHITE;
    state.board[2][2] = Core.BLACK;

    expect(Core.getFlipsWithContext(state, 2, 0, Core.BLACK, Core.compileFlipContext({ blockedCells: [] }))).toEqual([[2, 1]]);
    expect(Core.getFlipsWithContext(state, 2, 0, Core.BLACK, Core.compileFlipContext({ blockedCells: [{ row: 2, col: 2 }] }))).toEqual([]);
  });

  test('keeps expansion cells and protected chains equivalent', () => {
    const state = Core.createGameState();
    state.board = emptyBoard(8, 8);
    state.board[3][0] = Core.WHITE;
    state.board[3][1] = Core.BLACK;
    state.boardExpansion = {
      active: true,
      side: 'left',
      row: 3,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: false }
    };

    expect(Core.getFlipsWithContext(state, 3, -1, Core.BLACK, Core.compileFlipContext({}))).toEqual([[3, 0]]);
    expect(Core.getFlipsWithContext(state, 3, -1, Core.BLACK, Core.compileFlipContext({ protectedStones: [{ row: 3, col: 0 }] }))).toEqual([]);
  });

  test('compiles exactly once and reuses the compiled object', () => {
    const counters = { flipContextCompiles: 0 };
    const context = { protectedStones: [{ row: 1, col: 1 }], perfCounters: counters };
    const compiled = Core.compileFlipContext(context);

    expect(counters.flipContextCompiles).toBe(1);
    Core.compileFlipContext(compiled);
    expect(counters.flipContextCompiles).toBe(1);
  });
});
