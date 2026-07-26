import type {
  CpuPolicyBoard,
  CpuPolicyCardDefinitionResolver,
  CpuPolicyCardCostResolver,
  CpuPolicyLegalMoveMetrics,
  CpuPolicyLookaheadSearchMeta,
  CpuPolicyCardSelection,
  CpuPolicyCoreApi,
  CpuPolicyMove
} from '../game/ai/cpu-policy-core-types';

const core: CpuPolicyCoreApi = require('../game/ai/cpu-policy-core');

describe('cpu-policy-core public contract types', () => {
  test('exposes typed card and move policy helpers', () => {
    const getCardCost: CpuPolicyCardCostResolver = (cardId) => (cardId === 'expensive' ? 8 : 1);
    const getCardDef: CpuPolicyCardDefinitionResolver = (cardId) => ({
      id: cardId,
      type: cardId === 'guard' ? 'GUARD_WILL' : 'FREE_PLACEMENT'
    });

    const selectedCard: CpuPolicyCardSelection | null = core.chooseHighestCostCard(
      ['cheap', 'expensive'],
      getCardCost,
      getCardDef
    );
    expect(selectedCard && selectedCard.cardId).toBe('expensive');

    const selectedMove: CpuPolicyMove | null = core.chooseMove(
      [
        { row: 2, col: 3, flips: [[2, 4]] },
        { row: 4, col: 5, flips: [] }
      ],
      1,
      { random: () => 0 }
    );
    expect(selectedMove && typeof selectedMove.row).toBe('number');
  });

  test('rejects function RNG because runtime consumes rng.random', () => {
    const selectedMove: CpuPolicyMove | null = core.chooseMove(
      [
        { row: 2, col: 3, flips: [] },
        { row: 4, col: 5, flips: [] }
      ],
      1,
      { random: () => 0.99 }
    );
    expect(selectedMove && selectedMove.row).toBe(4);
  });

  test('exposes typed legal move metrics and lookahead options', () => {
    const board: CpuPolicyBoard = [
      [1, -1, 0],
      [0, 1, -1],
      [0, 0, 0]
    ];
    const moves: CpuPolicyMove[] = [
      { row: 0, col: 2, flips: [{ row: 0, col: 1 }] },
      { row: 2, col: 0, flips: [] }
    ];
    const metrics: CpuPolicyLegalMoveMetrics = core.computeLegalMoveMetrics(
      moves,
      (row, col) => (row === 2 && col === 0 ? 3 : 0)
    );
    const metaSnapshots: CpuPolicyLookaheadSearchMeta[] = [];
    const lookaheadMove = core.chooseMoveByLookahead(moves, {
      board,
      playerValue: 1,
      level: 6,
      depth: 1,
      nodeBudget: 50,
      scoreMove: (move) => move.row,
      onSearchMeta: (meta) => {
        metaSnapshots.push(meta);
      }
    });
    const heuristicScore: number = core.scoreMoveHeuristic(moves[0], 6, board);

    expect(metrics.maxLegalFlips).toBe(1);
    expect(metrics.maxLegalBoardBonus).toBe(3);
    expect(lookaheadMove && typeof lookaheadMove.col).toBe('number');
    expect(metaSnapshots[0] && typeof metaSnapshots[0].depth).toBe('number');
    expect(typeof heuristicScore).toBe('number');
  });

  test('applies canonical tuple flips without mutating the source board', () => {
    const board: CpuPolicyBoard = [
      [1, -1, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];

    const next = core.applyMoveToBoard(
      board,
      { row: 0, col: 2, flips: [[0, 1]] },
      1,
    );

    expect(next[0]).toEqual([1, 1, 1]);
    expect(board[0]).toEqual([1, -1, 0]);
  });
});
