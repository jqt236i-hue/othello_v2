const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter regen status-removed ordering', () => {
  test('maps regen-consumed STATUS_REMOVED to a later phase than preceding flips', () => {
    const pres = [
      { type: 'CHANGE', row: 3, col: 3, ownerBefore: 'white', ownerAfter: 'black', cause: 'REGEN', reason: 'regen_triggered', meta: {} },
      { type: 'STATUS_REMOVED', row: 3, col: 3, meta: { special: 'REGEN', reason: 'regen_consumed' } }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('flip');
    expect(out[1].type).toBe('status_removed');
    expect(out[1].phase).toBeGreaterThan(out[0].phase);
  });
});
