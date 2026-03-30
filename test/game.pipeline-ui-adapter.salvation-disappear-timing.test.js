const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter SALVATION_WILL disappear timing', () => {
  test('salvation_will_resolved defers the first spawn and breeding_spawn cue to card_use_animation disappear timing', () => {
    const base = [
      {
        type: 'card_use_animation',
        phase: 5,
        targets: [{ cardId: 'salvation_01', owner: 'black' }]
      },
      {
        type: 'spawn',
        phase: 5,
        targets: [{ r: 3, col: 2, cause: 'SALVATION_WILL', reason: 'salvation_spawn' }]
      },
      {
        type: 'spawn',
        phase: 6,
        targets: [{ r: 3, col: 3, cause: 'SALVATION_WILL', reason: 'salvation_spawn' }]
      },
      {
        type: 'spawn',
        phase: 7,
        targets: [{ r: 3, col: 4, cause: 'SALVATION_WILL', reason: 'salvation_spawn' }]
      }
    ];
    const raw = [{ type: 'salvation_will_resolved', player: 'black', spawnedCount: 3 }];
    const pres = [{ type: 'CARD_USED', player: 'black', cardId: 'salvation_01' }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw, pres);
    const cardUseEv = out.find((ev) => ev && ev.type === 'card_use_animation');
    const disappearEvents = cardUseEv && cardUseEv.targets && cardUseEv.targets[0]
      ? cardUseEv.targets[0].disappearPlaybackEvents
      : null;
    const topLevelSalvationSpawns = out.filter((ev) => ev && ev.type === 'spawn' && ev.targets && ev.targets[0] && ev.targets[0].cause === 'SALVATION_WILL');
    const topLevelSalvationCues = out.filter((ev) => (
      ev &&
      ev.type === 'sound_effect' &&
      ev.meta &&
      ev.meta.sourceType === 'salvation_spawn'
    ));

    expect(cardUseEv).toBeTruthy();
    expect(disappearEvents).toEqual([
      expect.objectContaining({
        type: 'spawn',
        targets: [expect.objectContaining({ cause: 'SALVATION_WILL', reason: 'salvation_spawn', r: 3, col: 2 })]
      }),
      expect.objectContaining({
        type: 'sound_effect',
        targets: [expect.objectContaining({ soundKey: 'breeding_spawn' })],
        meta: expect.objectContaining({ sourceType: 'salvation_spawn' })
      })
    ]);
    expect(topLevelSalvationSpawns.map((ev) => ev.phase)).toEqual([6, 7]);
    expect(topLevelSalvationCues.map((ev) => ev.phase)).toEqual([6, 7]);
  });
});
