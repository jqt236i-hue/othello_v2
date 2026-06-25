import * as phaseHelpers from '../game/turn/turn_pipeline_phase_helpers.js';

describe('turn_pipeline_phase_helpers special stone speech catalog', () => {
  test('preserves WORK speech exactly', () => {
    expect(phaseHelpers.getSpecialStoneBubbleSpeech('WORK')).toEqual({
      placeLines: [
        'ここで稼いで一発逆転や！',
        '布石いっぱい掘るでー！',
        'ワイには夢があるんや！',
        '一攫千金や！'
      ],
      lostLine: 'あああああああああああああ',
      living_will_restored: [
        'まだ稼げる！ ここから巻き返しや！',
        '持ち直したで！ もうひと掘りや！',
        '危なかったわ、でもまだ働けるで！'
      ],
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
      'card_nullified',
      'ghost_protected',
      'inherit_selected',
      'inherit_applied',
      'escape_exploded',
      'special_destroy_triggered',
      'living_will_restored'
    ]));

    const gluttonousPlaceLines = phaseHelpers.getSpecialStoneBubbleSpeechLines('GLUTTONOUS', 'place');
    expect(gluttonousPlaceLines).toHaveLength(5);
    expect(gluttonousPlaceLines).toContain('いっぱい食べる俺が好き');
    expect(phaseHelpers.pickSpecialStoneBubbleSpeechLine('GLUTTONOUS', 'place', { random: () => 0 })).toBe('いっぱい食べる俺が好き');

    const ghostProtectedLines = phaseHelpers.getSpecialStoneBubbleSpeech('GHOST', 'ghost_protected');
    expect(ghostProtectedLines).toHaveLength(5);
    expect(ghostProtectedLines[0]).toBe('当たってないよ。');
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('ESCAPE_HYPERACTIVE', 'place')).toEqual([
      '近寄らないで！ 私、逃げるから！',
      '生き残るためなら何だってするよ！',
      '追われる前に走るのが一番だよ！',
      'ここから先は逃走劇だよ！',
      '捕まるわけにはいかないの！'
    ]);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('ESCAPE_HYPERACTIVE', 'destroy')).toEqual([
      '逃げ損ねるなんて、やっぱり悔しいよ…！',
      '囲まれると、さすがに怖いよ…！',
      '足場を奪われた時点で負けだったよ！',
      '追手が多すぎるってば！',
      '今回の逃走はここまでみたい…！'
    ]);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('ESCAPE_HYPERACTIVE', 'escape_exploded')).toEqual([
      '行き場がないなら、もう吹き飛ぶしかないよ！',
      '逃げ道なしなら、景気よく爆ぜるね！',
      '追い詰めたつもりでも、巻き添えだからね！',
      'もう無理！ 派手に散ってやるんだから！',
      '捕まるくらいなら盤ごと荒らしちゃうよ！'
    ]);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('PROLIFERATION', 'proliferation_triggered')).toHaveLength(5);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('WILL_HUNTER_KING', 'special_destroy_triggered')).toHaveLength(5);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('ESCAPE_HYPERACTIVE', 'escape_exploded')).toHaveLength(5);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('DRAGON', 'living_will_restored')).toHaveLength(5);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('DRAGON', 'living_will_restored')).toEqual([
      'まだ終わらない、ここから立て直す。',
      '一度沈んだくらいで、この未練は消えない。',
      '戻ってきた、もう一手ぶん働くよ。',
      '消えたつもりなら誤算だ、私はまだ盤にいる。',
      '生きる意志が残っていた、もう一度だけ立つ。'
    ]);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('PERMA_PROTECTED', 'place')).toEqual([
      '反転ごときでは崩れない。',
      'ここからずっと踏みとどまる。',
      '守り抜く、ただそれだけでいい。',
      '時間をかけても姿は変わらない。',
      '揺るがないまま盤に残る。'
    ]);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('AFTERIMAGE_WILL', 'place')).toEqual([
      '本物はひとつ、でも見切れるかな。',
      '先に見えるのは残像の方だ。',
      '追うほど手元がずれるよ。',
      '揺らいだ輪郭で惑わせる。',
      'まずは見失ってもらおうか。'
    ]);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('SACRIFICE', 'place')).toEqual([
      'この石が、次の意志を引き受ける。'
    ]);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('SACRIFICE', 'card_nullified')).toEqual([
      'その一手は、ここで断つ。'
    ]);
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('SACRIFICE', 'duration_end')).toEqual([
      '役目を待たず、意志は静かに尽きた。'
    ]);
  });

  test('keeps excluded stones and unsupported scenarios out of the catalog', () => {
    expect(phaseHelpers.getSpecialStoneBubbleSpeech('GOLD')).toBeNull();
    expect(phaseHelpers.getSpecialStoneBubbleSpeech('TRAP')).toBeNull();
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('GLUTTONOUS', 'duration_end')).toBeNull();
  });

  test('adds five basic trigger lines for newly speaking special stones', () => {
    const speakingStones = [
      'BREEDING',
      'ULTIMATE_DESTROY_GOD',
      'DESTROY_DRAGON',
      'SNIPER',
      'LIGHTNING',
      'HYPERACTIVE',
      'EXTREME_HYPERACTIVE',
      'ROBOT_VACUUM',
      'ULTIMATE_HYPERACTIVE',
      'STONE_SALVATION_GOD',
      'METEOR_GOD',
    ];

    for (const special of speakingStones) {
      expect(phaseHelpers.getSpecialStoneBubbleSpeechLines(special, 'place')).toHaveLength(5);
      expect(phaseHelpers.getSpecialStoneBubbleSpeechLines(special, 'destroy')).toHaveLength(5);
      expect(phaseHelpers.getSpecialStoneBubbleSpeechLines(special, 'duration_end')).toHaveLength(5);
    }

    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('STONE_SALVATION_GOD', 'place')).toContain('迷える石たちよ、私の光のもとへ。');
    expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('METEOR_GOD', 'place')).toContain('因果の穴を開ける、目を逸らすな。');
  });

  test('adds place and destroy lines for non-duration protection-style stones', () => {
    const speakingStones = [
      'PERMA_PROTECTED',
      'AFTERIMAGE_WILL',
    ];

    for (const special of speakingStones) {
      expect(phaseHelpers.getSpecialStoneBubbleSpeechLines(special, 'place')).toHaveLength(5);
      expect(phaseHelpers.getSpecialStoneBubbleSpeechLines(special, 'destroy')).toHaveLength(5);
      expect(phaseHelpers.getSpecialStoneBubbleSpeechLines(special, 'duration_end')).toBeNull();
    }
  });
});
