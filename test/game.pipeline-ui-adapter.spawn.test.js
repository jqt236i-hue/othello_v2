const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter spawn mapping', () => {
  test('maps SPAWN cause/reason to playback target for animation branching', () => {
    const pres = [{
      type: 'SPAWN',
      row: 3,
      col: 4,
      stoneId: 's12',
      ownerAfter: 'black',
      cause: 'BREEDING',
      reason: 'breeding_spawn_immediate',
      meta: {}
    }];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('spawn');
    expect(out[0].targets[0]).toMatchObject({
      r: 3,
      col: 4,
      stoneId: 's12',
      cause: 'BREEDING',
      reason: 'breeding_spawn_immediate'
    });
  });
});
