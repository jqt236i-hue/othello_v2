import * as adapter from '../game/turn/pipeline_ui_adapter.js';

describe('pipeline_ui_adapter draw mapping', () => {
  test('maps DRAW_CARD presentation event to hand_add playback event', () => {
    const pres = [{ type: 'DRAW_CARD', player: 'black', cardId: 'x1', count: 1 }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('hand_add');
    expect(out[0].targets[0]).toMatchObject({ player: 'black', cardId: 'x1', count: 1 });
  });

  test('maps HAND_ADD presentation event to hand_add playback event with reason metadata', () => {
    const pres = [{
      type: 'HAND_ADD',
      player: 'black',
      cardId: 'triple_01',
      count: 1,
      reason: 'generated_throw_chain',
      meta: { sourceType: 'DOUBLE_PLACE', generatedName: '三連投石' }
    }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('hand_add');
    expect(out[0].targets[0]).toMatchObject({
      player: 'black',
      cardId: 'triple_01',
      count: 1,
      reason: 'generated_throw_chain',
      sourceType: 'DOUBLE_PLACE',
      generatedName: '三連投石'
    });
  });

  test('maps capture_will HAND_ADD to capture_to_hand_animation playback event with source metadata', () => {
    const pres = [{
      type: 'HAND_ADD',
      player: 'black',
      cardId: 'guardian_god_01',
      count: 1,
      reason: 'capture_will',
      meta: {
        sourceType: 'GUARDIAN_GOD',
        sourceCardId: 'guardian_god_01',
        sourceName: '守護神',
        sourceSpecialType: 'GUARD',
        sourceRow: 4,
        sourceCol: 5,
        sourceOwner: 'white',
        insertIndex: 1
      }
    }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('capture_to_hand_animation');
    expect(out[0].targets[0]).toMatchObject({
      player: 'black',
      cardId: 'guardian_god_01',
      reason: 'capture_will',
      sourceType: 'GUARDIAN_GOD',
      sourceCardId: 'guardian_god_01',
      sourceName: '守護神',
      sourceSpecialType: 'GUARD',
      sourceRow: 4,
      sourceCol: 5,
      sourceOwner: 'white',
      insertIndex: 1
    });
    expect(out[0].targets[0].visualDescriptor).toEqual(expect.objectContaining({
      cardId: 'guardian_god_01'
    }));
  });

  test('keeps generated throw-chain hand_add after placement phases when card use and placement share one action', () => {
    const pres = [
      { type: 'CARD_USED', player: 'black', cardId: 'double_01', meta: { owner: 'black', cost: 24, name: '二連投石' } },
      {
        type: 'HAND_ADD',
        player: 'black',
        cardId: 'triple_01',
        count: 1,
        reason: 'generated_throw_chain',
        meta: { sourceType: 'DOUBLE_PLACE', generatedName: '三連投石' }
      },
      { type: 'CHANGE', row: 2, col: 3, ownerBefore: 'white', ownerAfter: 'black' }
    ];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    const flipEvent = out.find((ev) => ev && ev.type === 'flip');
    const handAddEvent = out.find((ev) => ev && ev.type === 'hand_add');

    expect(flipEvent).toBeTruthy();
    expect(handAddEvent).toBeTruthy();
    expect(handAddEvent.phase).toBeGreaterThan(flipEvent.phase);
  });

  test('runTurnWithAdapter defers generated throw-chain hand_add from use_card until the next placement playback', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    const turnPipeline = {
      applyTurnSafe: jest.fn()
        .mockReturnValueOnce({
          ok: true,
          cardState: { markers: [], turnIndex: 9 },
          gameState: { board },
          events: [],
          presentationEvents: [
            { type: 'CARD_USED', player: 'black', cardId: 'double_01', meta: { owner: 'black', cost: 24, name: '二連投石' } },
            {
              type: 'HAND_ADD',
              player: 'black',
              cardId: 'triple_01',
              count: 1,
              reason: 'generated_throw_chain',
              meta: { sourceType: 'DOUBLE_PLACE', generatedName: '三連投石' }
            }
          ]
        })
        .mockReturnValueOnce({
          ok: true,
          cardState: { markers: [], turnIndex: 9 },
          gameState: { board },
          events: [],
          presentationEvents: [
            { type: 'CHANGE', row: 2, col: 3, ownerBefore: 'white', ownerAfter: 'black' }
          ]
        })
    };

    const useResult = adapter.runTurnWithAdapter(
      { markers: [], turnIndex: 9 },
      { board },
      'black',
      { type: 'use_card', useCardId: 'double_01' },
      turnPipeline
    );

    expect(useResult.ok).toBe(true);
    expect(useResult.playbackEvents.map((ev) => ev.type)).toEqual(['card_use_animation', 'sound_effect']);
    expect(useResult.deferredGeneratedThrowChainHandAdd).toMatchObject({
      playerKey: 'black',
      count: 1,
      reason: 'generated_throw_chain'
    });

    const placeResult = adapter.runTurnWithAdapter(
      { markers: [], turnIndex: 9 },
      { board },
      'black',
      { type: 'place', row: 2, col: 3 },
      turnPipeline
    );

    const flipEvent = placeResult.playbackEvents.find((ev) => ev && ev.type === 'flip');
    const handAddEvent = placeResult.playbackEvents.find((ev) => ev && ev.type === 'hand_add');

    expect(flipEvent).toBeTruthy();
    expect(handAddEvent).toBeTruthy();
    expect(handAddEvent.phase).toBeGreaterThan(flipEvent.phase);
    expect(handAddEvent.targets[0]).toMatchObject({
      player: 'black',
      cardId: 'triple_01',
      reason: 'generated_throw_chain',
      sourceType: 'DOUBLE_PLACE',
      generatedName: '三連投石'
    });
  });

  test('maps CARD_USED presentation event to card_use_animation playback event', () => {
    const pres = [{ type: 'CARD_USED', player: 'black', cardId: 'c1', meta: { owner: 'black', cost: 7, name: 'Test' } }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('card_use_animation');
    expect(out[0].targets[0]).toMatchObject({
      player: 'black',
      owner: 'black',
      cardId: 'c1',
      cost: 7,
      name: 'Test',
      visualDescriptor: {
        cardId: 'c1',
        name: 'Test',
        cost: 7,
        costTier: 'red'
      }
    });
  });

  test('runTurnWithAdapter prepends place_hand_animation from raw place events', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    const turnPipeline = {
      applyTurnSafe: jest.fn(() => ({
        ok: true,
        cardState: { markers: [], turnIndex: 9 },
        gameState: { board },
        events: [{ type: 'place', row: 2, col: 3, player: 'white', actionId: 'place-1', turnIndex: 9 }],
        presentationEvents: []
      }))
    };

    const out = adapter.runTurnWithAdapter(
      { markers: [], turnIndex: 9 },
      { board },
      'white',
      { type: 'place', row: 2, col: 3 },
      turnPipeline
    );

    expect(out.ok).toBe(true);
    expect(out.playbackEvents).toHaveLength(1);
    expect(out.playbackEvents[0]).toMatchObject({
      type: 'place_hand_animation',
      phase: 0,
      rawType: 'place',
      actionId: 'place-1',
      turnIndex: 9
    });
    expect(out.playbackEvents[0].targets[0]).toMatchObject({ r: 2, col: 3, player: 'white', owner: 'white' });
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

  test('maps SPECIAL_STONE_BUBBLE presentation event to observer_bubble playback event', () => {
    const pres = [{
      type: 'SPECIAL_STONE_BUBBLE',
      special: 'STRONG_WILL',
      scenario: 'duration_end',
      player: 'white',
      row: 3,
      col: 1,
      text: '守りの膜が剥がれた、ここからは素だ。',
      meta: { owner: 'white', reason: 'duration_end' }
    }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('observer_bubble');
    expect(out[0].rawType).toBe('SPECIAL_STONE_BUBBLE');
    expect(out[0].targets[0]).toMatchObject({
      r: 3,
      col: 1,
      owner: 'white',
      gained: 0,
      text: '守りの膜が剥がれた、ここからは素だ。',
      special: 'STRONG_WILL',
      scenario: 'duration_end',
      reason: 'duration_end'
    });
  });

  test('keeps SPECIAL_STONE_BUBBLE on the delayed duration-end revert phase', () => {
    const pres = [
      {
        type: 'STATUS_REMOVED',
        row: 4,
        col: 4,
        player: 'black',
        meta: { special: 'STRONG_WILL', reason: 'duration_end', owner: 'black' }
      },
      {
        type: 'SPECIAL_STONE_BUBBLE',
        special: 'STRONG_WILL',
        scenario: 'duration_end',
        player: 'black',
        row: 4,
        col: 4,
        text: '守りの膜が剥がれた、ここからは素だ。',
        meta: { owner: 'black', reason: 'duration_end' }
      }
    ];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    const revertEv = out.find((ev) => ev && ev.type === 'status_removed');
    const bubbleEv = out.find((ev) => ev && ev.type === 'observer_bubble' && ev.rawType === 'SPECIAL_STONE_BUBBLE');

    expect(revertEv).toBeTruthy();
    expect(bubbleEv).toBeTruthy();
    expect(bubbleEv.phase).toBe(revertEv.phase);
  });

  test('maps CHARGE_BUBBLE presentation event to observer_bubble playback event with charge kind', () => {
    const pres = [{ type: 'CHARGE_BUBBLE', player: 'black', row: 4, col: 4, gained: 5, meta: { owner: 'black', sourceType: 'placement_flip_gain' } }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('observer_bubble');
    expect(out[0].targets[0]).toMatchObject({
      r: 4,
      col: 4,
      owner: 'black',
      gained: 5,
      bubbleKind: 'charge',
      sourceType: 'placement_flip_gain'
    });
  });

  test('maps ROUND_BONUS_BANNER presentation event to round_bonus_banner playback event', () => {
    const pres = [{ type: 'ROUND_BONUS_BANNER', roundNumber: 10, amount: 5, durationMs: 3000, text: 'BONUS ROUND +5' }];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('round_bonus_banner');
    expect(out[0].targets[0]).toMatchObject({
      roundNumber: 10,
      amount: 5,
      durationMs: 3000,
      text: 'BONUS ROUND +5'
    });
  });

  test('keeps CHARGE_BUBBLE in the same phase as the flip that generated it', () => {
    const pres = [
      { type: 'CHANGE', row: 2, col: 3, ownerBefore: 'white', ownerAfter: 'black' },
      { type: 'CHARGE_BUBBLE', player: 'black', row: 2, col: 2, gained: 1, meta: { owner: 'black', sourceType: 'placement_flip_gain' } }
    ];
    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board: Array(8).fill(null).map(() => Array(8).fill(0)) });

    const flipEvent = out.find((ev) => ev && ev.type === 'flip');
    const bubbleEvent = out.find((ev) => ev && ev.type === 'observer_bubble' && ev.targets && ev.targets[0] && ev.targets[0].bubbleKind === 'charge');

    expect(flipEvent).toBeTruthy();
    expect(bubbleEvent).toBeTruthy();
    expect(bubbleEvent.phase).toBe(flipEvent.phase);
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
