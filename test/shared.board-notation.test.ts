import { createBoardNotation } from '../shared/board/notation';

const SharedBoardUtils = require('../shared/shared-board-utils');

describe('shared board notation', () => {
  const createLeaf = () => createBoardNotation({
    resolveBoardConfig: SharedBoardUtils.resolveBoardConfig
  });

  test('keeps board and padded-coordinate notation fixture-equivalent', () => {
    const leaf = createLeaf();
    const config = { rows: 7, cols: 9 };

    expect(leaf.formatPosTextJa(0, 0, config)).toBe('A1');
    expect(leaf.formatPosTextJa(-1, 0, config)).toBe('上外A');
    expect(leaf.formatPosTextJa(-1, -1, config)).toBe('左上外');
    expect(leaf.formatPosTextJa({ row: 6, col: 9 }, config)).toBe('右外7');
    expect(leaf.formatPosTextJa(Number.NaN, 0, config)).toBe('');
    expect(leaf.posToNotation(0, 0, config)).toBe('a1');
    expect(leaf.posToNotation(-1, 0, config)).toBe('top-a');
    expect(leaf.posToNotation(-1, -1, config)).toBe('top-left');
    expect(leaf.posToNotation({ row: 6, col: 9 }, config)).toBe('right7');
    expect(leaf.posToNotation(99, 99, config)).toBe('r99c99');

    expect(SharedBoardUtils.formatPosTextJa({ row: 6, col: 9 }, config))
      .toBe(leaf.formatPosTextJa({ row: 6, col: 9 }, config));
    expect(SharedBoardUtils.posToNotation({ row: 6, col: 9 }, config))
      .toBe(leaf.posToNotation({ row: 6, col: 9 }, config));
  });
});
