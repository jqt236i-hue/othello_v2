import { createCpuPolicyLookaheadParity } from '../game/ai/cpu-policy-lookahead-parity';

describe('cpu-policy lookahead parity module', () => {
  test('collects odd and even empty regions on irregular boards', () => {
    const helpers = createCpuPolicyLookaheadParity();
    const board = [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 0]
    ] as any;

    expect(helpers.collectEmptyRegionParity(board)).toEqual({
      regionCount: 3,
      oddRegionCount: 2,
      evenRegionCount: 1,
      oddEmptyCount: 2,
      evenEmptyCount: 2,
      signal: 0,
      score: 0
    });
  });

  test('prefers SharedBoardUtils coordinate and cell access when available', () => {
    const SharedBoardUtils = {
      collectBoardCoordinates: jest.fn(() => [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }]),
      getCellValue: jest
        .fn()
        .mockImplementation((board: any, row: number, col: number) => (Array.isArray(board[row]) ? board[row][col] : null))
    } as any;
    const helpers = createCpuPolicyLookaheadParity({ SharedBoardUtils });
    const board = [
      [0, 1],
      [0, 1]
    ] as any;

    expect(helpers.collectEmptyRegionParity(board)).toEqual({
      regionCount: 1,
      oddRegionCount: 0,
      evenRegionCount: 1,
      oddEmptyCount: 0,
      evenEmptyCount: 2,
      signal: 0,
      score: 0
    });
    expect(SharedBoardUtils.collectBoardCoordinates).toHaveBeenCalledWith(board);
  });

  test('resolves parity feature only in small endgames', () => {
    const helpers = createCpuPolicyLookaheadParity();
    const board = [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 0]
    ] as any;

    expect(helpers.resolveLookaheadParityFeature(board, 21)).toEqual(expect.objectContaining({
      signal: 0,
      score: 0
    }));
    expect(helpers.resolveLookaheadParityFeature(board, 8)).toEqual(expect.objectContaining({
      signal: -1,
      score: -1050
    }));
  });

  test('resolveForcedPassFeature distinguishes forced pass states', () => {
    const helpers = createCpuPolicyLookaheadParity();

    expect(helpers.resolveForcedPassFeature(0, 2, 7)).toEqual({ signal: -1, score: -2400 });
    expect(helpers.resolveForcedPassFeature(3, 0, 18)).toEqual({ signal: 1, score: 980 });
    expect(helpers.resolveForcedPassFeature(0, 0, 18)).toEqual({ signal: 0, score: 0 });
  });
});
