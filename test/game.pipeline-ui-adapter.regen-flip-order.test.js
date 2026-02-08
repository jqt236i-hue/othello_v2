const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter regen flip ordering', () => {
  test('maps regen back flip to a later phase than the preceding normal flip on same cell', () => {
    const pres = [
      { type: 'CHANGE', row: 2, col: 2, ownerBefore: 'black', ownerAfter: 'white', cause: 'SYSTEM', reason: 'standard_flip', meta: { special: 'REGEN' } },
      { type: 'CHANGE', row: 2, col: 2, ownerBefore: 'white', ownerAfter: 'black', cause: 'REGEN', reason: 'regen_triggered', meta: { special: 'REGEN' } }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('flip');
    expect(out[1].type).toBe('flip');
    expect(out[1].phase).toBeGreaterThan(out[0].phase);
    expect(out[0].targets[0]).toMatchObject({ cause: 'SYSTEM', reason: 'standard_flip' });
    expect(out[1].targets[0]).toMatchObject({ cause: 'REGEN', reason: 'regen_triggered' });
    expect(out[0].targets[0].after.special).toBe(null);
    expect(out[1].targets[0].after.special).toBe(null);
  });
});
