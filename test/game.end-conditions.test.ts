import * as Core from '../game/logic/core.js';

function makeBoard(rows = 8, cols = 8, fill = Core.EMPTY) {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

function makeState(board: number[][], overrides: Record<string, unknown> = {}) {
  return {
    board,
    currentPlayer: Core.WHITE,
    consecutivePasses: 0,
    turnNumber: 12,
    roundNumber: 1,
    roundCompletionByPlayer: { black: false, white: false },
    pendingRoundBonus: null,
    boardExpansion: {
      active: false,
      side: null,
      row: null,
      owner: Core.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: []
    },
    ...overrides
  };
}

describe('Core end conditions', () => {
  test('does not end only because white has zero stones while empty cells remain', () => {
    const board = makeBoard();
    board[0][0] = Core.BLACK;
    board[0][1] = Core.BLACK;
    const state = makeState(board);

    expect(Core.countDiscs(state)).toEqual({ black: 2, white: 0 });
    expect(Core.isGameOver(state)).toBe(false);
  });

  test('still ends after two consecutive passes even when empty cells remain', () => {
    const board = makeBoard();
    board[0][0] = Core.BLACK;
    const state = makeState(board, { consecutivePasses: 2 });

    expect(Core.isGameOver(state)).toBe(true);
  });

  test('applyPass treats missing consecutivePasses as zero before incrementing', () => {
    const board = makeBoard();
    board[0][0] = Core.BLACK;
    const state = makeState(board);
    delete (state as any).consecutivePasses;

    const nextState = Core.applyPass(state);

    expect(nextState.consecutivePasses).toBe(1);
  });

  test('still ends when the board is full', () => {
    const board = makeBoard(8, 8, Core.BLACK);
    const state = makeState(board);

    expect(Core.countDiscs(state)).toEqual({ black: 64, white: 0 });
    expect(Core.isGameOver(state)).toBe(true);
  });

  test('counts occupied expansion cells but does not use mono-color count as an instant end', () => {
    const board = makeBoard();
    board[0][0] = Core.BLACK;
    const state = makeState(board, {
      boardExpansion: {
        active: true,
        side: 'right',
        row: 0,
        col: 8,
        owner: Core.BLACK,
        usedByPlayer: { black: true, white: false },
        cells: [{ side: 'right', row: 0, col: 8, owner: Core.BLACK }]
      }
    });

    expect(Core.countDiscs(state)).toEqual({ black: 2, white: 0 });
    expect(Core.isGameOver(state)).toBe(false);
  });
});
