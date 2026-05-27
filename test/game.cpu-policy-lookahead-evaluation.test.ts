import { createCpuPolicyLookaheadEvaluation } from '../game/ai/cpu-policy-lookahead-evaluation';

describe('cpu-policy lookahead evaluation module', () => {
  test('counts frontier discs with direct board traversal', () => {
    const helpers = createCpuPolicyLookaheadEvaluation({
      inBoard: (board: any, row: number, col: number) =>
        Array.isArray(board) && row >= 0 && row < board.length && Array.isArray(board[row]) && col >= 0 && col < board[row].length
    });
    const board = [
      [1, 0],
      [-1, 1]
    ] as any;

    expect(helpers.countFrontierDiscsFor(board, 1)).toBe(2);
    expect(helpers.countFrontierDiscsFor(board, -1)).toBe(1);
  });

  test('counts anchored edge discs from occupied corners', () => {
    const helpers = createCpuPolicyLookaheadEvaluation({
      inBoard: (board: any, row: number, col: number) =>
        Array.isArray(board) && row >= 0 && row < board.length && Array.isArray(board[row]) && col >= 0 && col < board[row].length,
      isEdge: (row: number, col: number, board: any) =>
        row === 0 || col === 0 || row === board.length - 1 || col === board[0].length - 1
    });
    const board = [
      [1, 1, 1],
      [0, 1, -1],
      [-1, -1, -1]
    ] as any;

    expect(helpers.countAnchoredEdgeDiscsFromCorners(board, 1)).toBe(3);
    expect(helpers.countAnchoredEdgeDiscsFromCorners(board, -1)).toBe(4);
  });

  test('evaluateBoardForLookahead composes injected metrics with current weights', () => {
    const helpers = createCpuPolicyLookaheadEvaluation({
      inBoard: (board: any, row: number, col: number) =>
        Array.isArray(board) && row >= 0 && row < board.length && Array.isArray(board[row]) && col >= 0 && col < board[row].length,
      isEdge: (row: number, col: number, board: any) =>
        row === 0 || col === 0 || row === board.length - 1 || col === board[0].length - 1,
      countBoardDiscsForPlayer: () => ({ own: 2, opp: 1, empties: 1 }),
      countCornersFor: (_board: any, playerValue: number) => (playerValue > 0 ? 2 : 1),
      countEdgesFor: () => 0,
      getLegalMovesBasic: (_board: any, playerValue: number) => (playerValue > 0 ? [{}, {}, {}] : [{}]),
      resolveForcedPassFeature: () => ({ signal: 1, score: 700 }),
      countCornerMovesFor: (_board: any, playerValue: number) => (playerValue > 0 ? 1 : 0),
      countXsAndCsFor: (_board: any, playerValue: number) => (playerValue > 0 ? { x: 1, c: 0 } : { x: 0, c: 1 }),
      resolveLookaheadParityFeature: () => ({ score: 100 })
    });
    const board = [
      [1, 0],
      [-1, 1]
    ] as any;

    expect(helpers.evaluateBoardForLookahead(board, 1)).toBe(6059);
  });

  test('evaluateTerminalBoardForLookahead uses million-scale terminal scoring', () => {
    const helpers = createCpuPolicyLookaheadEvaluation({
      countBoardDiscsForPlayer: (_board: any, playerValue: number) => (
        playerValue > 0 ? { own: 6, opp: 4, empties: 0 } : { own: 4, opp: 6, empties: 0 }
      )
    });

    expect(helpers.evaluateTerminalBoardForLookahead([] as any, 1)).toBe(1020000);
    expect(helpers.evaluateTerminalBoardForLookahead([] as any, -1)).toBe(-1020000);
  });
});
