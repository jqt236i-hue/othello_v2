const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter effect logs (anchor expiry/anchor destroyed)', () => {
  test('logs udg_expired_start and dragon_destroyed_anchor_start', () => {
    const rawEvents = [
      { type: 'udg_expired_start', details: [{ row: 0, col: 0 }, { row: 1, col: 1 }] },
      { type: 'dragon_destroyed_anchor_start', details: [{ row: 2, col: 2 }] }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '黒: 究極破壊神: 親石2個が消滅',
      '黒: 究極反転龍: 親石1個が消滅'
    ]);
  });

  test('logs udg_expired_immediate and dragon_destroyed_anchor_immediate', () => {
    const rawEvents = [
      { type: 'udg_expired_immediate', details: [{ row: 0, col: 0 }] },
      { type: 'dragon_destroyed_anchor_immediate', details: [{ row: 7, col: 7 }, { row: 6, col: 6 }] }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'white');

    expect(out).toEqual([
      '白: 究極破壊神: 親石1個が消滅',
      '白: 究極反転龍: 親石2個が消滅'
    ]);
  });


  test("logs dragon_converted_* as 反転 (not 変化)", () => {
    const rawEvents = [
      { type: "dragon_converted_start", details: [{ row: 0, col: 0 }] },
      { type: "dragon_converted_immediate", details: [{ row: 1, col: 1 }, { row: 2, col: 2 }] }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], "black");

    expect(out).toEqual([
      "黒: 究極反転龍: 1枚を反転",
      "黒: 究極反転龍: 2枚を反転"
    ]);
  });


  test('logs cross bomb explosion count in placement_effects', () => {
    const rawEvents = [
      { type: 'placement_effects', effects: { crossBombExploded: true, crossBombDestroyed: 3 } }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '黒: 十字爆弾: 3個を破壊'
    ]);
  });


  test('logs gold/silver as multiplier wording', () => {
    const rawEvents = [
      { type: 'placement_effects', effects: { silverStoneUsed: true, goldStoneUsed: true } }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '黒: 銀石: 獲得布石3倍',
      '黒: 金石: 獲得布石4倍'
    ]);
  });


  test('logs free placement wording', () => {
    const rawEvents = [
      { type: 'placement_effects', effects: { freePlacementUsed: true } }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '黒: 自由の意志:自由な空きマスに配置'
    ]);
  });
});
