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

  test('maps HAND_CLEAR to hand_remove and keeps it before subsequent draws by phase', () => {
    const pres = [
      { type: 'HAND_CLEAR', player: 'black', count: 2, reason: 'rebuild_will' },
      { type: 'DRAW_CARD', player: 'black', cardId: 'x1', count: 1 },
      { type: 'DRAW_CARD', player: 'black', cardId: 'x2', count: 1 }
    ];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(out.map((ev) => ev.type)).toEqual(['hand_remove', 'hand_add', 'hand_add']);
    expect(out[0].targets[0]).toMatchObject({ player: 'black', count: 2, reason: 'rebuild_will' });
    expect(out[0].phase).toBeLessThan(out[1].phase);
    expect(out[1].phase).toBeLessThan(out[2].phase);
  });

  test('maps HAND_REMOVE to hand_remove with card metadata', () => {
    const pres = [{ type: 'HAND_REMOVE', player: 'white', count: 1, reason: 'condemn_will', cardId: 'hidden_card_1' }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('hand_remove');
    expect(out[0].targets[0]).toMatchObject({
      player: 'white',
      count: 1,
      reason: 'condemn_will',
      cardId: 'hidden_card_1'
    });
  });

  test('maps OBSERVER_TRIGGERED presentation event to observer_bubble playback event', () => {
    const pres = [{ type: 'OBSERVER_TRIGGERED', player: 'black', row: 4, col: 2, gained: 3, text: '布石+3 観測が捗る', meta: { owner: 'black' } }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('observer_bubble');
    expect(out[0].targets[0]).toMatchObject({ r: 4, col: 2, owner: 'black', gained: 3, text: '布石+3 観測が捗る' });
  });

  test('maps OBSERVER_BUBBLE presentation event to observer_bubble playback event', () => {
    const pres = [{ type: 'OBSERVER_BUBBLE', owner: 'white', row: 1, col: 6, gained: 0, text: '盤理観測してる場合じゃなかったわ' }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('observer_bubble');
    expect(out[0].targets[0]).toMatchObject({
      r: 1,
      col: 6,
      owner: 'white',
      gained: 0,
      text: '盤理観測してる場合じゃなかったわ'
    });
  });

  test('maps WORK_BUBBLE presentation event to observer_bubble playback event', () => {
    const pres = [{ type: 'WORK_BUBBLE', player: 'black', row: 5, col: 2, text: '出稼ぎ、行ってきます' }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('observer_bubble');
    expect(out[0].targets[0]).toMatchObject({ r: 5, col: 2, owner: 'black', text: '出稼ぎ、行ってきます' });
  });

  test('maps WORK_INCOME with anchor to log + observer_bubble playback events', () => {
    const pres = [{ type: 'WORK_INCOME', player: 'black', row: 2, col: 3, gained: 4, meta: { incomeStep: 3 } }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    const logEv = out.find((ev) => ev && ev.type === 'log' && ev.rawType === 'WORK_INCOME');
    const bubbleEv = out.find((ev) => ev && ev.type === 'observer_bubble' && ev.rawType === 'WORK_BUBBLE');

    expect(logEv).toBeTruthy();
    expect(bubbleEv).toBeTruthy();
    expect(bubbleEv.targets[0]).toMatchObject({ r: 2, col: 3, owner: 'black', gained: 4 });
    expect(bubbleEv.targets[0].text).toContain('布石＋4');
  });

  test('maps WORK_REMOVED with anchor_lost to observer_bubble playback event', () => {
    const pres = [{ type: 'WORK_REMOVED', player: 'white', row: 6, col: 1, reason: 'anchor_lost' }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    const bubbleEv = out.find((ev) => ev && ev.type === 'observer_bubble' && ev.rawType === 'WORK_BUBBLE');
    expect(bubbleEv).toBeTruthy();
    expect(bubbleEv.targets[0]).toMatchObject({ r: 6, col: 1, owner: 'white' });
    expect(bubbleEv.targets[0].text).toContain('あああああああああああああ');
  });

  test('does not map WORK_REMOVED with duration_end to observer_bubble playback event', () => {
    const pres = [{ type: 'WORK_REMOVED', player: 'white', row: 6, col: 1, reason: 'duration_end' }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    const bubbleEv = out.find((ev) => ev && ev.type === 'observer_bubble' && ev.rawType === 'WORK_BUBBLE');
    expect(bubbleEv).toBeUndefined();
  });
});
