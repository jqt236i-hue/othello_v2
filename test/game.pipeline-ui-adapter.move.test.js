const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter move mapping', () => {
  test('maps MOVE presentation event using col keys for from/to', () => {
    const pres = [{ type: 'MOVE', prevRow: 2, prevCol: 3, row: 4, col: 5, stoneId: 's10' }];
    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('move');
    expect(out[0].targets[0]).toMatchObject({
      from: { r: 2, col: 3 },
      to: { r: 4, col: 5 },
      stoneId: 's10'
    });
    expect(typeof out[0].targets[0].from.col).toBe('number');
    expect(typeof out[0].targets[0].to.col).toBe('number');
  });
});
