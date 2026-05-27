import { createCpuPolicyBoardCounts } from '../game/ai/cpu-policy-board-counts';

describe('cpu-policy board counts module', () => {
  test('countBoardDiscsForPlayer counts own, opp, and empties on irregular boards', () => {
    const helpers = createCpuPolicyBoardCounts();
    const board = [
      [1, 0, -1],
      [0, 1],
      [-1, -1, 0]
    ] as any;

    expect(helpers.countBoardDiscsForPlayer(board, 1)).toEqual({
      own: 2,
      opp: 3,
      empties: 3
    });
  });

  test('countBoardDiscsForPlayer and countBoardEdgeDiscsForPlayer prefer SharedBoardUtils when available', () => {
    const SharedBoardUtils = {
      collectBoardCoordinates: jest.fn(() => [{ row: 0, col: 0 }, { row: 0, col: 1 }]),
      getCellValue: jest
        .fn()
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(0),
      countEdgeControl: jest.fn(() => ({ ownEdges: 4, oppEdges: 1 }))
    } as any;
    const helpers = createCpuPolicyBoardCounts({ SharedBoardUtils });
    const board = [[1, 0]] as any;

    expect(helpers.countBoardDiscsForPlayer(board, 1)).toEqual({ own: 1, opp: 0, empties: 1 });
    expect(helpers.countBoardEdgeDiscsForPlayer(board, 1)).toEqual({ ownEdges: 4, oppEdges: 1 });
  });

  test('countBoardEdgeDiscsForPlayer ignores corners while counting edge discs', () => {
    const helpers = createCpuPolicyBoardCounts();
    const board = [
      [1, 1, -1, -1],
      [1, 0, 0, -1],
      [1, 1, -1, -1]
    ] as any;

    expect(helpers.countBoardEdgeDiscsForPlayer(board, 1)).toEqual({
      ownEdges: 3,
      oppEdges: 3
    });
  });

  test('estimateOwnOppDiscs clamps totals and derives occupied split from disc diff', () => {
    const helpers = createCpuPolicyBoardCounts();

    expect(helpers.estimateOwnOppDiscs(4, 10, 20)).toEqual({
      own: 7,
      opp: 3,
      occupied: 10,
      totalCells: 20
    });
    expect(helpers.estimateOwnOppDiscs('bad', 99, 8)).toEqual({
      own: 0,
      opp: 0,
      occupied: 0,
      totalCells: 8
    });
  });
});
