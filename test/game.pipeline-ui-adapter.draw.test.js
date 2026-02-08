const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter draw mapping', () => {
  test('maps DRAW_CARD presentation event to hand_add playback event', () => {
    const pres = [{ type: 'DRAW_CARD', player: 'black', cardId: 'x1', count: 1 }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('hand_add');
    expect(out[0].targets[0]).toMatchObject({ player: 'black', cardId: 'x1', count: 1 });
  });

  test('maps CARD_USED presentation event to card_use_animation playback event', () => {
    const pres = [{ type: 'CARD_USED', player: 'black', cardId: 'c1', meta: { owner: 'black', cost: 7, name: 'Test' } }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('card_use_animation');
    expect(out[0].targets[0]).toMatchObject({ player: 'black', owner: 'black', cardId: 'c1', cost: 7, name: 'Test' });
  });
});
