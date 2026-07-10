const SharedBoardUtils = require('../shared/shared-board-utils');

describe('shared board configuration contract', () => {
  test.each([
    ['missing input', undefined, undefined, { rows: 8, cols: 8 }],
    ['numeric dimensions', 6, 9, { rows: 6, cols: 9 }],
    ['ragged board array', [[0, 0, 0, 0], [0, 0, 0, 0, 0]], undefined, { rows: 4, cols: 5 }],
    ['direct dimensions', { rows: 7, cols: 6 }, undefined, { rows: 7, cols: 6 }],
    ['base bounds dimensions', { baseBounds: { minRow: 4, maxRow: 9, minCol: 2, maxCol: 8 } }, undefined, { rows: 6, cols: 7 }],
    ['outer bounds dimensions', { outerBounds: { minRow: -1, maxRow: 7, minCol: -1, maxCol: 10 } }, undefined, { rows: 7, cols: 10 }],
    ['nested boardConfig takes precedence', { rows: 9, cols: 9, boardConfig: { rows: 5, cols: 7 } }, undefined, { rows: 5, cols: 7 }]
  ])('%s resolves with the established priority order', (_name, value, maybeCols, expected) => {
    expect(SharedBoardUtils.resolveBoardConfig(value, maybeCols)).toMatchObject(expected);
  });

  test('source extraction distinguishes snapshots from unrelated objects', () => {
    expect(SharedBoardUtils.extractBoardConfigSource({ roomBoardConfig: { rows: 7, cols: 9 } })).toEqual({ rows: 7, cols: 9 });
    expect(SharedBoardUtils.maybeResolveBoardConfig({ roomBoardConfig: { rows: 7, cols: 9 } })).toMatchObject({ rows: 7, cols: 9 });
    expect(SharedBoardUtils.extractBoardConfigSource({ unrelated: true })).toBeNull();
    expect(SharedBoardUtils.maybeResolveBoardConfig({ unrelated: true })).toBeNull();
  });
});
