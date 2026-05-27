import { createCpuPolicySearchKey } from '../game/ai/cpu-policy-search-key';

describe('cpu-policy search key module', () => {
  test('builds fallback keys from board cells and consumed bonus metadata', () => {
    const helpers = createCpuPolicySearchKey();
    const board = [
      [1, 0],
      [-1, 1]
    ] as any;

    expect(helpers.buildBoardSearchKey(board, 1, 4, false, {
      __bonusHash: 255,
      __bonusCount: 2
    } as any)).toBe('1:4:0:1021:73:2');
  });

  test('prefers SharedBoardUtils encoder when available', () => {
    const SharedBoardUtils = {
      encodeBoard: jest.fn(() => 'ENCODED')
    } as any;
    const helpers = createCpuPolicySearchKey({ SharedBoardUtils });
    const board = [[0]] as any;

    expect(helpers.buildBoardSearchKey(board, -1, 7, true, null)).toBe('2:7:1:ENCODED:0:0');
    expect(SharedBoardUtils.encodeBoard).toHaveBeenCalledWith(board);
  });
});
