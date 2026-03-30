const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter SALVATION_WILL sound cues', () => {
  test('adds breeding_spawn once per Salvation Will spawn phase', () => {
    const base = [
      {
        type: 'spawn',
        phase: 4,
        targets: [{ r: 3, col: 2, cause: 'SALVATION_WILL', reason: 'salvation_spawn' }]
      },
      {
        type: 'spawn',
        phase: 5,
        targets: [{ r: 3, col: 3, cause: 'SALVATION_WILL', reason: 'salvation_spawn' }]
      },
      {
        type: 'spawn',
        phase: 6,
        targets: [{ r: 3, col: 4, cause: 'SALVATION_WILL', reason: 'salvation_spawn' }]
      }
    ];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const breedingCues = out
      .filter((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'breeding_spawn')
      .map((ev) => ({ phase: ev.phase, sourceType: ev.meta && ev.meta.sourceType }));

    expect(breedingCues).toEqual([
      { phase: 4, sourceType: 'salvation_spawn' },
      { phase: 5, sourceType: 'salvation_spawn' },
      { phase: 6, sourceType: 'salvation_spawn' }
    ]);
  });
});
