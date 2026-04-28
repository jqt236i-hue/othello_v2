import * as adapter from '../game/turn/pipeline_ui_adapter.js';

describe('pipeline_ui_adapter effect logs (anchor expiry/anchor destroyed)', () => {
  test('logs udg_expired_start and dragon_destroyed_anchor_start', () => {
    const rawEvents = [
      { type: 'udg_expired_start', details: [{ row: 0, col: 0 }, { row: 1, col: 1 }] },
      { type: 'dragon_destroyed_anchor_start', details: [{ row: 2, col: 2 }] }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '黒: 究極破壊神: 親石2個が通常石に戻る',
      '黒: 究極反転龍: 親石1個が通常石に戻る'
    ]);
  });

  test('logs udg_expired_immediate and dragon_destroyed_anchor_immediate', () => {
    const rawEvents = [
      { type: 'udg_expired_immediate', details: [{ row: 0, col: 0 }] },
      { type: 'dragon_destroyed_anchor_immediate', details: [{ row: 7, col: 7 }, { row: 6, col: 6 }] }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'white');

    expect(out).toEqual([
      '白: 究極破壊神: 親石1個が通常石に戻る',
      '白: 究極反転龍: 親石2個が通常石に戻る'
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

  test('logs dragon_moved_start and udg_moved_start as 移動', () => {
    const rawEvents = [
      { type: 'dragon_moved_start', details: [{ from: { row: 4, col: 4 }, to: { row: 0, col: 0 } }] },
      { type: 'udg_moved_start', details: [{ from: { row: 3, col: 3 }, to: { row: 7, col: 7 } }, { from: { row: 1, col: 1 }, to: { row: 2, col: 2 } }] }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '黒: 究極反転龍: 1回移動',
      '黒: 究極破壊神: 2回移動'
    ]);
  });


  test('logs cross bomb explosion count in placement_effects', () => {
    const rawEvents = [
      { type: 'placement_effects', effects: { crossBombExploded: true, crossBombDestroyed: 3 } }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '黒: 十字爆弾: 3個を爆破'
    ]);
  });

  test('logs x bomb explosion count in placement_effects', () => {
    const rawEvents = [
      { type: 'placement_effects', effects: { xBombExploded: true, xBombDestroyed: 4 } }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'white');

    expect(out).toEqual([
      '白: クロス爆弾: 4個を爆破'
    ]);
  });

  test('normalizes actor seat keys from padded uppercase values', () => {
    const rawEvents = [
      { type: 'udg_expired_start', player: ' WHITE ', details: [{ row: 0, col: 0 }] }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '白: 究極破壊神: 親石1個が通常石に戻る'
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

  test('logs crystal zero-gain wording without implying a number-cell bonus was gained', () => {
    const rawEvents = [
      { type: 'placement_effects', effects: { crystalStoneUsed: true, crystalStoneGain: 0 } }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '黒: 水晶石: 数字マスなしで増加なし'
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

  test('logs robot vacuum movement/suction/placement wording', () => {
    const rawEvents = [
      { type: 'robot_vacuum_moved_start', details: [{ from: { row: 3, col: 3 }, to: { row: 3, col: 4 } }] },
      { type: 'robot_vacuum_sucked_start', details: [{ row: 3, col: 5 }, { row: 2, col: 5 }] },
      { type: 'robot_vacuum_expired_start', details: [{ row: 3, col: 3, reason: 'anchor_expired' }] },
      { type: 'placement_effects', effects: { robotVacuumPlaced: true, hyperactivePlaced: true } }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '黒: ロボット掃除機石: 1回移動',
      '黒: ロボット掃除機石: 2個を吸い込み',
      '黒: ロボット掃除機石: 1個が通常石に戻る',
      '黒: ロボット掃除機石を設置'
    ]);
  });

  test('logs observer trigger/expire/placement wording', () => {
    const rawEvents = [
      { type: 'observer_triggered_start', details: [{ row: 3, col: 3, owner: 'black', gained: 2 }, { row: 5, col: 5, owner: 'black', gained: 4 }] },
      { type: 'observer_expired_start', details: [{ row: 3, col: 3, reason: 'duration_end' }] },
      { type: 'placement_effects', effects: { observerPlaced: true } }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '黒: 盤理の観測者: 布石+6',
      '黒: 盤理の観測者: 親石1個が通常石に戻る',
      '黒: 盤理の観測者を設置'
    ]);
  });

  test('logs lightning destroy/expire/placement wording', () => {
    const rawEvents = [
      { type: 'lightning_destroyed_start', details: [{ row: 3, col: 3 }] },
      { type: 'lightning_expired_start', details: [{ row: 4, col: 4 }] },
      { type: 'placement_effects', effects: { lightningPlaced: true } }
    ];

    const out = adapter.mapEffectLogsFromPipeline(rawEvents, [], 'black');

    expect(out).toEqual([
      '黒: 落雷石: 1個を破壊',
      '黒: 落雷石: 親石1個が通常石に戻る',
      '黒: 落雷の意志: 落雷石を設置'
    ]);
  });
});
