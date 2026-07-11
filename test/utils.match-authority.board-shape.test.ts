const MatchAuthority = require('../utils/match-authority');

describe('match authority board shape', () => {
  test('normalizes and resolves circle room configuration without losing shape', () => {
    const normalized = MatchAuthority.normalizeRoomBoardConfig({
      rows: 8,
      cols: 9,
      shape: 'circle',
    });

    expect(normalized).toMatchObject({
      rows: 10,
      cols: 10,
      shape: 'circle',
      standard8x8: false,
    });
    expect(MatchAuthority.resolveRoomBoardConfig({ roomBoardConfig: normalized }))
      .toMatchObject({ rows: 10, cols: 10, shape: 'circle', standard8x8: false });
  });

  test('keeps shape-less room configuration backward compatible', () => {
    expect(MatchAuthority.normalizeRoomBoardConfig({ rows: 8, cols: 8 }))
      .toMatchObject({ rows: 8, cols: 8, shape: 'rectangle', standard8x8: true });
  });
});
