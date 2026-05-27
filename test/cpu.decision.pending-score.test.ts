const { createCpuDecisionPendingScore } = require('../game/cpu-decision-pending-score');

function createBoard(fill = 0) {
  return Array.from({ length: 8 }, () => Array(8).fill(fill));
}

function cellKey(row, col) {
  return `${row},${col}`;
}

function createScorer(overrides = {}) {
  const board = overrides.board || createBoard();
  const markerProfiles = overrides.markerProfiles || {};
  const timedProfiles = overrides.timedProfiles || {};
  const markers = overrides.markers || [];
  const cpuLevel = Number.isFinite(overrides.cpuLevel) ? overrides.cpuLevel : 6;

  return createCpuDecisionPendingScore({
    getCurrentCpuBoard: () => board,
    resolvePlayerValue: (playerKey) => (playerKey === 'black' ? 1 : -1),
    getBoardCellValueSafe: (source, row, col) => (
      Array.isArray(source) && Array.isArray(source[row]) && col >= 0 && col < source[row].length
        ? source[row][col]
        : null
    ),
    isCornerCell: (row, col, source = board) => {
      const maxRow = Array.isArray(source) ? source.length - 1 : 7;
      const maxCol = Array.isArray(source && source[row]) ? source[row].length - 1 : 7;
      return (row === 0 || row === maxRow) && (col === 0 || col === maxCol);
    },
    isEdgeCell: (row, col, source = board) => {
      const maxRow = Array.isArray(source) ? source.length - 1 : 7;
      const maxCol = Array.isArray(source && source[row]) ? source[row].length - 1 : 7;
      return row === 0 || row === maxRow || col === 0 || col === maxCol;
    },
    countAdjacentCellsByValue: (source, row, col, value) => {
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nextRow = row + dr;
          const nextCol = col + dc;
          if (Array.isArray(source[nextRow]) && source[nextRow][nextCol] === value) count++;
        }
      }
      return count;
    },
    getBoardBonusValueAt: (row, col) => (overrides.bonusByCell && overrides.bonusByCell[cellKey(row, col)]) || 0,
    getMarkerProfileAt: (_playerKey, row, col) => markerProfiles[cellKey(row, col)] || {
      ownSpecialScore: 0,
      oppSpecialScore: 0,
      ownBombCount: 0,
      oppBombCount: 0
    },
    getTimedMarkerProfileAt: (_playerKey, row, col) => timedProfiles[cellKey(row, col)] || null,
    scoreSeatStrategicValue: (_playerKey, row, col) => (overrides.seatByCell && overrides.seatByCell[cellKey(row, col)]) || 0,
    countBoardStatsForPlayer: () => ({ discDiff: Number(overrides.discDiff) || 0 }),
    getCornerProximity: () => null,
    getCpuSmartnessLevel: () => cpuLevel,
    getCardState: () => ({ markers, charge: { black: 0, white: 0 } }),
    getCpuPolicyCore: () => overrides.cpuPolicyCore || null,
    buildMovePlanContext: () => ({}),
    simulatePendingPlacementBoard: (source, playerValue, target) => {
      const next = source.map((row) => row.slice());
      next[target.row][target.col] = playerValue;
      return next;
    },
    getStrongWindLandingProfile: () => null,
    getForcedCornerLaneBonus: () => 0,
    getForcedCornerLaneAntiPatternPenalty: () => 0,
    isCloneSplitEligibleSource: overrides.isCloneSplitEligibleSource || (() => true)
  });
}

describe('cpu decision pending score module', () => {
  test('DESTROY_ONE_STONE prefers opponent corner over opponent inner stone', () => {
    const board = createBoard();
    board[0][0] = -1;
    board[3][3] = -1;
    const scorer = createScorer({ board });

    const cornerScore = scorer.scorePendingTargetByType('black', 'DESTROY_ONE_STONE', { row: 0, col: 0 }, null);
    const innerScore = scorer.scorePendingTargetByType('black', 'DESTROY_ONE_STONE', { row: 3, col: 3 }, null);

    expect(cornerScore).toBeGreaterThan(innerScore);
  });

  test('FREE_PLACEMENT ranks corner above edge and edge above inner placement', () => {
    const scorer = createScorer({ board: createBoard() });

    const cornerScore = scorer.scorePendingTargetByType('black', 'FREE_PLACEMENT', { row: 0, col: 0, flips: [] }, null);
    const edgeScore = scorer.scorePendingTargetByType('black', 'FREE_PLACEMENT', { row: 0, col: 3, flips: [] }, null);
    const innerScore = scorer.scorePendingTargetByType('black', 'FREE_PLACEMENT', { row: 3, col: 3, flips: [] }, null);

    expect(cornerScore).toBeGreaterThan(edgeScore);
    expect(edgeScore).toBeGreaterThan(innerScore);
  });

  test('GUARD_WILL rejects non-own targets and penalizes already-stable corners', () => {
    const board = createBoard();
    board[0][0] = 1;
    board[0][1] = 1;
    board[3][3] = -1;
    const scorer = createScorer({ board });

    const cornerScore = scorer.scorePendingTargetByType('black', 'GUARD_WILL', { row: 0, col: 0 }, null);
    const edgeScore = scorer.scorePendingTargetByType('black', 'GUARD_WILL', { row: 0, col: 1 }, null);
    const opponentScore = scorer.scorePendingTargetByType('black', 'GUARD_WILL', { row: 3, col: 3 }, null);

    expect(edgeScore).toBeGreaterThan(cornerScore);
    expect(opponentScore).toBe(-2800);
  });

  test('CLONE_WILL keeps level 6 split-eligibility gate behavior', () => {
    const board = createBoard();
    board[3][3] = 1;
    const scorer = createScorer({
      board,
      cpuLevel: 6,
      isCloneSplitEligibleSource: () => false
    });

    expect(scorer.scorePendingTargetByType('black', 'CLONE_WILL', { row: 3, col: 3 }, null)).toBe(-8000);
  });
});
