const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter sniper metadata', () => {
  test('DESTROY の source メタデータを playback target に引き継ぐ', () => {
    const pres = [
      {
        type: 'DESTROY',
        row: 4,
        col: 4,
        stoneId: 's-1',
        ownerBefore: 'white',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        meta: {
          sourceRow: 2,
          sourceCol: 2,
          projectileOwner: 'black',
          projectileStone: 'normal'
        }
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array.from({ length: 8 }, () => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('destroy');
    expect(out[0].targets[0]).toMatchObject({
      r: 4,
      col: 4,
      cause: 'SNIPER_WILL',
      reason: 'sniper_shot',
      sourceRow: 2,
      sourceCol: 2,
      projectileOwner: 'black',
      projectileStone: 'normal'
    });
    expect(out[0].targets[0].meta).toMatchObject({
      sourceRow: 2,
      sourceCol: 2,
      projectileOwner: 'black',
      projectileStone: 'normal'
    });
  });
});
