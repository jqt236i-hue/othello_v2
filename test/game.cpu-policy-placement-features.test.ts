import { createCpuPolicyPlacementFeatures } from '../game/ai/cpu-policy-placement-features';

const BOARD_SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = -1;

function makeBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

function edgeRunSummary(overrides: Partial<Record<string, number>> = {}) {
  return {
    totalLines: 0,
    maxLineLength: 0,
    totalOwnedCells: 0,
    chainStrength: 0,
    longestRun: 0,
    longestRunShare: 0,
    completeLineCount: 0,
    segmentCount: 0,
    loneDiscCount: 0,
    ...overrides,
  };
}

describe('cpu policy placement features', () => {
  test('detects corner donation and opponent next-turn corner from shallow reply search', () => {
    const board = makeBoard();
    const afterOwn = makeBoard();
    const afterOpponent = makeBoard();
    const move = { row: 1, col: 1, flips: [] };
    const opponentCorner = { row: 0, col: 0, flips: [] };
    const ownReplies = [
      { row: 2, col: 3, flips: [] },
      { row: 3, col: 2, flips: [] },
      { row: 4, col: 5, flips: [] },
    ];

    const features = createCpuPolicyPlacementFeatures({
      applyMoveToBoard: (source, candidate, player) => {
        if (source === board && candidate === move && player === BLACK) return afterOwn;
        if (source === afterOwn && candidate === opponentCorner && player === WHITE) return afterOpponent;
        return source;
      },
      getLegalMovesBasic: (source, player) => {
        if (source === afterOwn && player === WHITE) return [opponentCorner];
        if (source === afterOwn && player === BLACK) return ownReplies;
        return [];
      },
      countCornerMovesFor: (source, player) => (source === afterOwn && player === WHITE ? 1 : 0),
      countBoardDiscsForPlayer: () => ({ own: 8, opp: 8, empty: 48 }),
      countAnchoredEdgeDiscsFromCorners: () => 0,
      summarizeEdgeRunsFor: () => edgeRunSummary(),
    }).evaluatePlacementCandidate(move, { board, playerValue: BLACK });

    expect(features.seat).toBe('x');
    expect(features.isXSquare).toBe(true);
    expect(features.cornerDonation).toBe(true);
    expect(features.opponentNextCorner).toBe(true);
    expect(features.opponentCornerReplyCount).toBe(1);
    expect(features.badLowMobilityRisk).toBe(false);
  });

  test('rewards edge moves that extend a corner-anchored safe edge', () => {
    const board = makeBoard();
    const afterOwn = makeBoard();
    const move = { row: 0, col: 2, flips: [] };

    const features = createCpuPolicyPlacementFeatures({
      applyMoveToBoard: (source, candidate, player) => (
        source === board && candidate === move && player === BLACK ? afterOwn : source
      ),
      getLegalMovesBasic: () => [],
      countCornerMovesFor: () => 0,
      countBoardDiscsForPlayer: () => ({ own: 12, opp: 10, empty: 42 }),
      countAnchoredEdgeDiscsFromCorners: (source, player) => {
        if (player !== BLACK) return 0;
        return source === afterOwn ? 4 : 1;
      },
      summarizeEdgeRunsFor: (source, player) => {
        if (player !== BLACK) return edgeRunSummary();
        return source === afterOwn
          ? edgeRunSummary({ longestRun: 4, chainStrength: 4, totalOwnedCells: 4, segmentCount: 1 })
          : edgeRunSummary({ longestRun: 1, chainStrength: 1, totalOwnedCells: 1, segmentCount: 1 });
      },
    }).evaluatePlacementCandidate(move, { board, playerValue: BLACK });

    expect(features.seat).toBe('edge');
    expect(features.extendsOwnSafeEdge).toBe(true);
    expect(features.ownAnchoredEdgeDelta).toBe(3);
    expect(features.ownSafeEdgeRunDelta).toBe(3);
    expect(features.createsOwnEdgeGap).toBe(false);
  });

  test('detects allowing opponent continuous edge formation in the next reply', () => {
    const board = makeBoard();
    const afterOwn = makeBoard();
    const afterOpponent = makeBoard();
    const move = { row: 3, col: 3, flips: [] };
    const opponentEdgeMove = { row: 0, col: 4, flips: [] };

    const features = createCpuPolicyPlacementFeatures({
      applyMoveToBoard: (source, candidate, player) => {
        if (source === board && candidate === move && player === BLACK) return afterOwn;
        if (source === afterOwn && candidate === opponentEdgeMove && player === WHITE) return afterOpponent;
        return source;
      },
      getLegalMovesBasic: (source, player) => (source === afterOwn && player === WHITE ? [opponentEdgeMove] : []),
      countCornerMovesFor: () => 0,
      countBoardDiscsForPlayer: () => ({ own: 16, opp: 16, empty: 32 }),
      countAnchoredEdgeDiscsFromCorners: (source, player) => {
        if (player !== WHITE) return 0;
        return source === afterOpponent ? 5 : 2;
      },
      summarizeEdgeRunsFor: (source, player) => {
        if (player !== WHITE) return edgeRunSummary();
        return source === afterOpponent
          ? edgeRunSummary({ longestRun: 5, chainStrength: 5, totalOwnedCells: 5, segmentCount: 1 })
          : edgeRunSummary({ longestRun: 2, chainStrength: 2, totalOwnedCells: 2, segmentCount: 1 });
      },
    }).evaluatePlacementCandidate(move, { board, playerValue: BLACK });

    expect(features.allowsOpponentSafeEdgeRun).toBe(true);
    expect(features.opponentSafeEdgeRunAllowedCount).toBe(1);
    expect(features.opponentSafeEdgeRunDelta).toBe(3);
  });

  test('marks own edge gaps and opponent edge cuts as separate explainable features', () => {
    const board = makeBoard();
    const afterOwn = makeBoard();
    const move = { row: 0, col: 4, flips: [{ row: 0, col: 3 }] };

    const features = createCpuPolicyPlacementFeatures({
      applyMoveToBoard: (source, candidate, player) => (
        source === board && candidate === move && player === BLACK ? afterOwn : source
      ),
      getLegalMovesBasic: () => [],
      countCornerMovesFor: () => 0,
      countBoardDiscsForPlayer: () => ({ own: 18, opp: 12, empty: 34 }),
      countAnchoredEdgeDiscsFromCorners: () => 0,
      summarizeEdgeRunsFor: (source, player) => {
        if (player === BLACK) {
          return source === afterOwn
            ? edgeRunSummary({ longestRun: 2, chainStrength: 2, totalOwnedCells: 4, segmentCount: 2, loneDiscCount: 1 })
            : edgeRunSummary({ longestRun: 2, chainStrength: 2, totalOwnedCells: 2, segmentCount: 1, loneDiscCount: 0 });
        }
        return source === afterOwn
          ? edgeRunSummary({ longestRun: 3, chainStrength: 3, totalOwnedCells: 3, segmentCount: 1 })
          : edgeRunSummary({ longestRun: 5, chainStrength: 5, totalOwnedCells: 5, segmentCount: 1 });
      },
    }).evaluatePlacementCandidate(move, { board, playerValue: BLACK });

    expect(features.createsOwnEdgeGap).toBe(true);
    expect(features.ownEdgeGapDelta).toBeGreaterThan(0);
    expect(features.breaksOpponentEdgeRun).toBe(true);
    expect(features.opponentSafeEdgeRunDelta).toBeLessThan(0);
  });

  test('does not treat low mobility as bad when the move has a corner or safe-edge escape', () => {
    const board = makeBoard();
    const afterOwn = makeBoard();
    const cornerEscape = { row: 0, col: 0, flips: [] };
    const move = { row: 0, col: 1, flips: [] };

    const features = createCpuPolicyPlacementFeatures({
      applyMoveToBoard: (source, candidate, player) => (
        source === board && candidate === move && player === BLACK ? afterOwn : source
      ),
      getLegalMovesBasic: (source, player) => (source === afterOwn && player === BLACK ? [cornerEscape] : []),
      countCornerMovesFor: (source, player) => (source === afterOwn && player === BLACK ? 1 : 0),
      countBoardDiscsForPlayer: () => ({ own: 3, opp: 20, empty: 41 }),
      countAnchoredEdgeDiscsFromCorners: (source, player) => {
        if (player !== BLACK) return 0;
        return source === afterOwn ? 2 : 0;
      },
      summarizeEdgeRunsFor: (source, player) => {
        if (player !== BLACK) return edgeRunSummary();
        return source === afterOwn
          ? edgeRunSummary({ longestRun: 2, chainStrength: 2, totalOwnedCells: 2, segmentCount: 1 })
          : edgeRunSummary();
      },
    }).evaluatePlacementCandidate(move, { board, playerValue: BLACK });

    expect(features.lowMobilityRisk).toBe(true);
    expect(features.extendsOwnSafeEdge).toBe(true);
    expect(features.hasCornerEscape).toBe(true);
    expect(features.badLowMobilityRisk).toBe(false);
  });
});
