import * as Adapter from '../game/turn/pipeline_ui_adapter.js';

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

  test('formats outer expansion coordinates in normal logs', () => {
    const events = [{ type: 'destroy_selected', destroyed: true, target: { row: -1, col: -1 } }];
    const out = Adapter.mapEffectLogsFromPipeline(events, [], 'black');
    expect(out).toEqual(['黒: 破壊の意志で左上外を破壊']);
  });

  test('formats regenerated destroy_selected as revival log', () => {
    const events = [{ type: 'destroy_selected', regenerated: true, target: { row: 4, col: 4 } }];
    const out = Adapter.mapEffectLogsFromPipeline(events, [], 'black');
    expect(out).toEqual(['黒: 破壊の意志: E5 は復活した']);
  });

  test('uses shared special stone labels for status tick logs', () => {
    const out = Adapter.mapEffectLogsFromPipeline([], [
      { type: 'STATUS_TICK', row: 1, col: 2, meta: { special: 'TIME_STOP', timer: 4 } }
    ], 'black');
    expect(out).toEqual(['黒: 時間停石: C2 の残り 4']);
  });

  test('maps salvation resolution to player-facing effect log', () => {
    const out = Adapter.mapEffectLogsFromPipeline([
      { type: 'salvation_will_resolved', player: 'black', spawnedCount: 2, flippedCount: 3 }
    ], [], 'black');
    expect(out).toEqual(['黒: 救済の意志: 破壊石2個を通常石として救済、3枚を反転']);
  });

  test('maps equality resolution to player-facing effect log', () => {
    const out = Adapter.mapEffectLogsFromPipeline([
      { type: 'equality_will_resolved', player: 'black', stolenAmount: 10 }
    ], [], 'black');
    expect(out).toEqual(['黒: 平等の意志: 布石を10奪取']);
  });

  test('maps reinforcement resolution to player-facing effect log', () => {
    const out = Adapter.mapEffectLogsFromPipeline([
      { type: 'reinforcement_will_resolved', player: 'black', spawnedCount: 1, flippedCount: 2 }
    ], [], 'black');
    expect(out).toEqual(['黒: 増援の意志: 通常石1個を配置、2枚を反転']);
  });

  test('maps support troops resolution to player-facing effect log', () => {
    const out = Adapter.mapEffectLogsFromPipeline([
      { type: 'support_troops_will_resolved', player: 'black', spawnedCount: 3, flippedCount: 4 }
    ], [], 'black');
    expect(out).toEqual(['黒: 援軍の意志: 通常石3個を配置、4枚を反転']);
  });
});
