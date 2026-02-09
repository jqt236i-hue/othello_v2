const Adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter unknown presentation events', () => {
  test('does not map unknown presentation event into player-facing log playback event', () => {
    const out = Adapter.mapToPlaybackEvents(
      [{ type: 'PLAY_HAND_ANIMATION', row: 2, col: 3 }],
      {},
      {}
    );
    expect(out).toEqual([]);
  });
});
