const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter gluttonous phase mapping', () => {
  test('GLUTTONOUS_WILL の捕食破壊と移動は同一フェーズにまとまる', () => {
    const pres = [
      {
        type: 'DESTROY',
        row: 3,
        col: 4,
        cause: 'GLUTTONOUS_WILL',
        reason: 'gluttonous_eat',
        actionId: 'a1'
      },
      {
        type: 'MOVE',
        prevRow: 3,
        prevCol: 3,
        row: 3,
        col: 4,
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'GLUTTONOUS_WILL',
        reason: 'gluttonous_eat_move',
        actionId: 'a1'
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array.from({ length: 8 }, () => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('destroy');
    expect(out[1].type).toBe('move');
    expect(out[0].phase).toBe(out[1].phase);
  });
});
