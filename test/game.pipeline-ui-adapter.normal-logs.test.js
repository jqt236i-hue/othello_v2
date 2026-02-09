const Adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter normal logs', () => {
  test('maps place flips to player-facing normal log', () => {
    const events = [
      { type: 'place', player: 'black', row: 2, col: 3, flips: [[3, 3], [3, 4], [4, 4]] }
    ];
    const out = Adapter.mapNormalLogsFromPipeline(events, 'black');
    expect(out).toEqual(['黒が3枚反転！']);
  });

  test('does not log place when flip count is zero', () => {
    const events = [{ type: 'place', player: 'black', row: 2, col: 3, flips: [] }];
    const out = Adapter.mapNormalLogsFromPipeline(events, 'black');
    expect(out).toEqual([]);
  });
});
