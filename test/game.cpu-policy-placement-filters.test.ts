import {
  filterCloneSplitTargetsForLv6,
  filterLv6OpenCornerAdjacentMoves,
  isCloneSplitEligibleSource
} from '../game/ai/cpu-policy-placement-filters';

describe('cpu policy placement filters', () => {
  test('filters open-corner-adjacent moves while preserving fallback when all candidates are risky', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    const risky = { row: 1, col: 1 };
    const safe = { row: 3, col: 3 };
    const deps = {
      isCornerCell: (row: number, col: number) => (row === 0 || row === 7) && (col === 0 || col === 7),
      getCornerProximity: (row: number, col: number) => (
        row === 1 && col === 1 ? { corner: [0, 0] } : null
      ),
      getBoardCellValueSafe: (boardRef: number[][], row: number, col: number) => boardRef[row]?.[col]
    };

    expect(filterLv6OpenCornerAdjacentMoves([risky, safe], board, deps)).toEqual([safe]);
    expect(filterLv6OpenCornerAdjacentMoves([risky], board, deps)).toEqual([risky]);
  });

  test('detects clone split eligible source from owned occupied marker cells', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[2][2] = -1;
    const markerProfile = {
      ownSpecialScore: 0,
      oppSpecialScore: 180,
      ownBombCount: 0,
      oppBombCount: 0
    };

    const eligible = isCloneSplitEligibleSource('white', 2, 2, markerProfile, {
      getCurrentCpuBoard: () => board,
      resolvePlayerValue: (playerKey: string) => (playerKey === 'black' ? 1 : -1),
      getBoardCellValueSafe: (boardRef: number[][], row: number, col: number) => boardRef[row]?.[col],
      getMarkerProfileAt: () => ({ ownSpecialScore: 0, oppSpecialScore: 0, ownBombCount: 0, oppBombCount: 0 })
    });

    expect(eligible).toBe(true);
  });

  test('filters clone split targets at Lv6 card policy level and leaves lower levels unchanged', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[2][2] = -1;
    board[4][4] = -1;
    const targets = [{ row: 2, col: 2 }, { row: 4, col: 4 }];
    const baseDeps = {
      getCurrentCpuBoard: () => board,
      resolvePlayerValue: () => -1,
      getBoardCellValueSafe: (boardRef: number[][], row: number, col: number) => boardRef[row]?.[col],
      getMarkerProfileAt: (_playerKey: string, row: number, col: number) => ({
        ownSpecialScore: row === 2 && col === 2 ? 280 : 0,
        oppSpecialScore: 0,
        ownBombCount: 0,
        oppBombCount: 0
      })
    };

    expect(filterCloneSplitTargetsForLv6('white', targets, {
      ...baseDeps,
      resolveCpuCardPolicyLevelForPlayer: () => 6
    })).toEqual([{ row: 2, col: 2 }]);

    expect(filterCloneSplitTargetsForLv6('white', targets, {
      ...baseDeps,
      resolveCpuCardPolicyLevelForPlayer: () => 5
    })).toEqual(targets);
  });
});
