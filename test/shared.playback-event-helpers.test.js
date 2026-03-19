const helpers = require('../shared/playback-event-helpers');
const adapter = require('../game/turn/pipeline_ui_adapter');

describe('PlaybackEventHelpers', () => {
  test('maps raw place events into canonical place hand playback events', () => {
    const playbackEvents = helpers.mapRawPlaceEventsToPlayback([
      { type: 'place', row: 2, col: 3, player: 'white', actionId: 'place-1', turnIndex: 9 }
    ], {
      fallbackPlayerKey: 'black',
      fallbackTurnIndex: 7
    });

    expect(playbackEvents).toEqual([
      {
        type: 'place_hand_animation',
        phase: 0,
        rawType: 'place',
        actionId: 'place-1',
        turnIndex: 9,
        targets: [{ r: 2, col: 3, player: 'white', owner: 'white' }]
      }
    ]);
  });

  test('local adapter place playback stays aligned with shared helper contract', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    const rawEvents = [{ type: 'place', row: 2, col: 3, player: 'white', actionId: 'place-1', turnIndex: 9 }];
    const turnPipeline = {
      applyTurnSafe: jest.fn(() => ({
        ok: true,
        cardState: { markers: [], turnIndex: 9 },
        gameState: { board },
        events: rawEvents,
        presentationEvents: []
      }))
    };

    const expected = helpers.mapRawPlaceEventsToPlayback(rawEvents, {
      fallbackPlayerKey: 'white',
      fallbackTurnIndex: 9
    });
    const out = adapter.runTurnWithAdapter(
      { markers: [], turnIndex: 9 },
      { board },
      'white',
      { type: 'place', row: 2, col: 3 },
      turnPipeline
    );

    expect(out.ok).toBe(true);
    expect(out.playbackEvents).toEqual(expected);
  });

  test('appends independent playback bundles after the base phase range', () => {
    const out = helpers.appendPlaybackEventsAfter(
      [
        { type: 'flip', phase: 1, targets: [{ r: 4, col: 4 }] },
        { type: 'sound_effect', phase: 2, targets: [{ soundKey: 'card_use_button' }] }
      ],
      [
        { type: 'flip', phase: 1, targets: [{ r: 3, col: 3 }] },
        { type: 'sound_effect', phase: 1, targets: [{ soundKey: 'card_effect_flip' }] },
        { type: 'draw', phase: 2, targets: [{ player: 'white' }] }
      ]
    );

    expect(out).toEqual([
      { type: 'flip', phase: 1, targets: [{ r: 4, col: 4 }] },
      { type: 'sound_effect', phase: 2, targets: [{ soundKey: 'card_use_button' }] },
      { type: 'flip', phase: 3, targets: [{ r: 3, col: 3 }] },
      { type: 'sound_effect', phase: 3, targets: [{ soundKey: 'card_effect_flip' }] },
      { type: 'draw', phase: 4, targets: [{ player: 'white' }] }
    ]);
  });
});
