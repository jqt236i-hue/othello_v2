const phaseHelpers = require('../game/turn/turn_pipeline_phase_helpers');

describe('turn_pipeline_phase_helpers special stone speech catalog', () => {
  test('preserves OBSERVER and WORK speech exactly', () => {
    expect(phaseHelpers.getSpecialStoneBubbleSpeech('OBSERVER')).toEqual({
      placeLines: [
        '今日も観測しますかっと',
        '盤理は観測するためにある',
        '観測最高！'
      ],
      lostLine: '盤理観測してる場合じゃなかったわ'
    });

    expect(phaseHelpers.getSpecialStoneBubbleSpeech('WORK')).toEqual({
      placeLines: [
        'ここで稼いで一発逆転や！',
        '布石いっぱい掘るでー！',
        'ワイには夢があるんや！',
        '一攫千金や！'
      ],
      lostLine: 'あああああああああああああ',
      incomeLinesByStep: {
        1: '布石＋1 初儲けや！',
        2: '布石＋2 もっと掘るでー！',
        3: '布石＋4 順調やな！',
        4: '布石＋8 ぼろ儲けや！',
        5: '布石＋16 これで家族が養える...！'
      }
    });
  });

  test('exposes required scenario keys and scenario-based lookup helpers', () => {
    expect(phaseHelpers.SPECIAL_STONE_BUBBLE_SCENARIO_KEYS).toEqual(expect.arrayContaining([
      'place',
      'destroy',
      'duration_end',
      'proliferation_triggered',
      'time_stop_triggered',
      'regen_triggered',
      'ghost_protected',
      'inherit_selected',
      'inherit_applied',
      'escape_exploded',
      'absolute_protected_promoted',
      'special_destroy_triggered'
    ]));

    const gluttonousPlaceLines = phaseHelpers.getSpecialStoneBubbleSpeechLines('GLUTTONOUS', 'place');
    expect(gluttonousPlaceLines).toHaveLength(5);
    expect(gluttonousPlaceLines).toContain('いっぱい食べる俺が好き');
    expect(phaseHelpers.pickSpecialStoneBubbleSpeechLine('GLUTTONOUS', 'place', { random: () => 0 })).toBe('いっぱい食べる俺が好き');

    const ghostProtectedLines = phaseHelpers.getSpecialStoneBubbleSpeech('GHOST', 'ghost_protected');
    expect(ghostProtectedLines).toHaveLength(5);
    expect(ghostProtectedLines[0]).toBe('当たってないよ。');
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('INHERITED_HYPERACTIVE', 'inherit_selected')).toHaveLength(5);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('INHERITED_HYPERACTIVE', 'inherit_applied')).toHaveLength(5);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('PROLIFERATION', 'proliferation_triggered')).toHaveLength(5);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('WILL_HUNTER_KING', 'special_destroy_triggered')).toHaveLength(5);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('ESCAPE_HYPERACTIVE', 'escape_exploded')).toHaveLength(5);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('ABSOLUTE_PROTECTED', 'absolute_protected_promoted')).toHaveLength(5);
  });

  test('keeps excluded stones and unsupported scenarios out of the catalog', () => {
    expect(phaseHelpers.getSpecialStoneBubbleSpeech('GOLD')).toBeNull();
    expect(phaseHelpers.getSpecialStoneBubbleSpeech('TRAP')).toBeNull();
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('GLUTTONOUS', 'duration_end')).toBeNull();
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('OBSERVER', 'duration_end')).toBeNull();
  });
});
