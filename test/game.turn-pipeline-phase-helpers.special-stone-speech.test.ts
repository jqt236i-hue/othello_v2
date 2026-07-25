const speech = require('../game/turn/turn_pipeline_phase_helpers');

const SPECIAL_TYPES = [
  'PROTECTED', 'PERMA_PROTECTED', 'SNIPER', 'GHOST', 'SACRIFICE', 'AFTERIMAGE_WILL',
  'TIME_STOP', 'TIME_STOP_DEITY', 'REGEN', 'ZOMBIE', 'DRAGON', 'BREEDING',
  'PROLIFERATION', 'HYPERACTIVE', 'EXTREME_HYPERACTIVE', 'ESCAPE_HYPERACTIVE',
  'ROBOT_VACUUM', 'GLUTTONOUS', 'WILL_HUNTER_KING', 'WORK', 'STONE_SALVATION_GOD',
  'DESTROY_DRAGON', 'LIGHTNING', 'ULTIMATE_DESTROY_GOD', 'ULTIMATE_HYPERACTIVE', 'METEOR_GOD',
  'ULTIMATE_WORK_GOD'
];

const DURATION_TYPES = [
  'PROTECTED', 'SNIPER', 'GHOST', 'SACRIFICE', 'DRAGON', 'BREEDING', 'PROLIFERATION',
  'ROBOT_VACUUM', 'WILL_HUNTER_KING', 'WORK',
  'STONE_SALVATION_GOD', 'DESTROY_DRAGON', 'LIGHTNING', 'ULTIMATE_DESTROY_GOD',
  'ULTIMATE_HYPERACTIVE', 'METEOR_GOD'
];

const SPECIAL_SCENARIOS: Record<string, string[]> = {
  AFTERIMAGE_WILL: ['normal_revert'],
  HYPERACTIVE: ['normal_revert'],
  EXTREME_HYPERACTIVE: ['normal_revert'],
  ULTIMATE_HYPERACTIVE: ['normal_revert'],
  ROBOT_VACUUM: ['normal_revert'],
  PROLIFERATION: ['proliferation_triggered'],
  TIME_STOP: ['time_stop_triggered'],
  TIME_STOP_DEITY: ['time_stop_deity_triggered'],
  REGEN: ['regen_triggered'],
  ZOMBIE: ['zombie_infection', 'zombie_revived'],
  SACRIFICE: ['card_nullified'],
  GHOST: ['ghost_protected'],
  ESCAPE_HYPERACTIVE: ['escape_exploded'],
  WILL_HUNTER_KING: ['special_destroy_triggered']
  ,
  ULTIMATE_WORK_GOD: ['income', 'self_destruct']
};

describe('特殊石キャラクターボイス契約', () => {
  test('対象26種だけを収録し、顕現石と罠・爆弾を含めない', () => {
    expect(Object.keys(speech.SPECIAL_STONE_BUBBLE_SPEECH).sort()).toEqual([...SPECIAL_TYPES].sort());
    for (const excluded of ['THEORY_INCARNATION', 'BOARD_EXECUTOR', 'OBSERVER_WILL', 'TRAP', 'TIME_BOMB', 'CROSS_BOMB', 'X_BOMB']) {
      expect(speech.getSpecialStoneBubbleSpeech(excluded)).toBeNull();
    }
  });

  test('全石の共通シナリオと対象別シナリオが各5候補', () => {
    for (const type of SPECIAL_TYPES) {
      for (const scenario of ['destroy', 'living_will_restored']) {
        expect(speech.getSpecialStoneBubbleSpeechLines(type, scenario)).toHaveLength(5);
      }
      if (type !== 'ULTIMATE_WORK_GOD') {
        expect(speech.getSpecialStoneBubbleSpeechLines(type, 'place')).toHaveLength(5);
      }
    }
    for (const type of DURATION_TYPES) {
      expect(speech.getSpecialStoneBubbleSpeechLines(type, 'duration_end')).toHaveLength(5);
    }
    for (const [type, scenarios] of Object.entries(SPECIAL_SCENARIOS)) {
      for (const scenario of scenarios) {
        expect(speech.getSpecialStoneBubbleSpeechLines(type, scenario)).toHaveLength(5);
      }
    }
  });

  test('全文は非空・改行なし・34文字以下・完全一致重複なし', () => {
    const lines: string[] = [];
    for (const entry of Object.values(speech.SPECIAL_STONE_BUBBLE_SPEECH) as any[]) {
      for (const value of Object.values(entry)) {
        if (Array.isArray(value)) lines.push(...value);
        else if (value && typeof value === 'object') lines.push(...Object.values(value) as string[]);
      }
    }
    expect(lines.length).toBeGreaterThan(500);
    for (const line of lines) {
      expect(line.trim()).toBe(line);
      expect(line).not.toMatch(/[\r\n]/);
      expect(Array.from(line).length).toBeLessThanOrEqual(34);
    }
    expect(new Set(lines).size).toBe(lines.length);
    const restoredArrays = SPECIAL_TYPES.map((type) => speech.getSpecialStoneBubbleSpeechLines(type, 'living_will_restored'));
    expect(new Set(restoredArrays).size).toBe(SPECIAL_TYPES.length);
  });

  test('労働石収入は段階ごとの新しい固定文だけを返す', () => {
    expect(speech.resolveWorkIncomeLine(1, 1)).toBe('布石＋1、初給料や！');
    expect(speech.resolveWorkIncomeLine(16, 5)).toBe('布石＋16、家族にご馳走や！');
    expect(speech.resolveWorkIncomeLine(8, undefined)).toBe('布石＋8、今月は黒字や！');
    expect((speech.SPECIAL_STONE_BUBBLE_SPEECH.WORK as any).placeLines).toBeUndefined();
    expect((speech.SPECIAL_STONE_BUBBLE_SPEECH.WORK as any).lostLine).toBeUndefined();
  });

  test('究極労働神は配置時に話さず、収入・自壊・外部破壊で人格を切り替える', () => {
    expect(speech.getSpecialStoneBubbleSpeechLines('ULTIMATE_WORK_GOD', 'place')).toBeNull();
    expect(speech.getSpecialStoneBubbleSpeechLines('ULTIMATE_WORK_GOD', 'income')).toHaveLength(5);
    expect(speech.getSpecialStoneBubbleSpeechLines('ULTIMATE_WORK_GOD', 'self_destruct')).toHaveLength(5);
    expect(speech.getSpecialStoneBubbleSpeechLines('ULTIMATE_WORK_GOD', 'destroy')).toHaveLength(5);
  });

  test('代表的な口調と唯一の再採用文を保持する', () => {
    expect(speech.getSpecialStoneBubbleSpeechLines('PROTECTED', 'place')[0]).toContain('僕');
    expect(speech.getSpecialStoneBubbleSpeechLines('TIME_STOP_DEITY', 'place')[0]).toContain('我');
    expect(speech.getSpecialStoneBubbleSpeechLines('ROBOT_VACUUM', 'place')[0]).toContain('当機');
    expect(speech.getSpecialStoneBubbleSpeechLines('WORK', 'place')[0]).toContain('わい');
    expect(speech.getSpecialStoneBubbleSpeechLines('GLUTTONOUS', 'place')).toContain('いっぱい食べる俺が好き');
  });
});
