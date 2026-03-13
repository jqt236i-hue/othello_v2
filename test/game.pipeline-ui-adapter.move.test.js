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

  test('maps CLONE_WILL SPAWN into clone move event from source cell', () => {
    const pres = [{
      type: 'SPAWN',
      row: 4,
      col: 4,
      stoneId: 's99',
      ownerAfter: 'black',
      cause: 'CLONE_WILL',
      reason: 'clone_spawn',
      meta: { fromRow: 3, fromCol: 3, cloneVisual: true }
    }];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('move');
    expect(out[0].targets[0]).toMatchObject({
      from: { r: 3, col: 3 },
      to: { r: 4, col: 4 },
      stoneId: 's99',
      clone: true
    });
  });

  test('maps SPLIT_WILL SPAWN into split move event from source cell', () => {
    const pres = [{
      type: 'SPAWN',
      row: 5,
      col: 4,
      stoneId: 's109',
      ownerAfter: 'black',
      cause: 'SPLIT_WILL',
      reason: 'split_spawn',
      meta: { fromRow: 4, fromCol: 4, cloneVisual: true }
    }];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('move');
    expect(out[0].targets[0]).toMatchObject({
      from: { r: 4, col: 4 },
      to: { r: 5, col: 4 },
      stoneId: 's109',
      clone: true
    });
  });
});
