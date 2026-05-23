/**
 * @file test-endgame-solver.test.ts
 * @description Unit tests for endgame solver.
 */

import endgameSolverModule = require('../endgame-solver');

const { EndgameSolver } = endgameSolverModule;

const mockGameInterface = {
  isTerminal: (state: { moves: number; score?: number }) => ({
    isTerminal: state.moves <= 0,
    value: state.score || 0,
  }),
  listActions: (state: { moves: number }) => {
    if (state.moves <= 0) return [];
    return [
      { type: 'place', row: 0, col: 0 },
      { type: 'place', row: 0, col: 1 },
    ];
  },
  applyAction: (
    state: { moves: number; score?: number },
    cardState: unknown,
    _action: unknown,
    playerKey: string,
  ) => ({
    state: { moves: state.moves - 1, score: (state.score || 0) + 1 },
    cardState,
    nextPlayer: playerKey === 'black' ? 'white' : 'black',
  }),
  nextPlayer: (playerKey: string) => playerKey === 'black' ? 'white' : 'black',
  getDiscCounts: (state: { score?: number }) => ({ black: state.score || 0, white: 0 }),
  countFlips: () => 1,
};

describe('EndgameSolver', () => {
  test('can be instantiated', () => {
    const solver = new EndgameSolver();
    expect(solver).toBeDefined();
    expect(solver.maxDepth).toBe(20);
  });

  test('solves terminal position', () => {
    const solver = new EndgameSolver();
    const result = solver.solve(
      { moves: 0, score: 1 },
      null,
      'black',
      mockGameInterface,
    );
    expect(result.value).toBe(1);
    expect(result.bestAction).toBeNull();
  });

  test('finds best action in simple position', () => {
    const solver = new EndgameSolver();
    const result = solver.solve(
      { moves: 2, score: 0 },
      null,
      'black',
      mockGameInterface,
    );
    expect(result.bestAction).not.toBeNull();
    expect(result.value).toBeDefined();
  });

  test('uses transposition table', () => {
    const solver = new EndgameSolver();
    solver.solve(
      { moves: 2, score: 0 },
      null,
      'black',
      mockGameInterface,
    );
    expect(solver.transpositionTable.size).toBeGreaterThan(0);
  });

  test('counts nodes during search', () => {
    const solver = new EndgameSolver();
    solver.solve(
      { moves: 2, score: 0 },
      null,
      'black',
      mockGameInterface,
    );
    expect(solver.nodeCount).toBeGreaterThan(0);
  });
});
