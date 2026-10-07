import * as path from 'path';

const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));

describe('CardInteractionEffects effect tags', () => {
  function getEffectTagLabels(cardType) {
    return CardInteractionEffects.resolveCardEffectTags({ type: cardType }).map((tag) => tag.label);
  }

  function getNumericTagLabels(cardType) {
    return CardInteractionEffects.resolveCardNumericTags({ type: cardType }).map((tag) => tag.label);
  }

  test('AFTERIMAGE_WILL returns special stone plus evasion tags with per-stone count labels', () => {
    expect(getEffectTagLabels('AFTERIMAGE_WILL')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '反転回避6回', '破壊回避6回']);
    expect(getNumericTagLabels('AFTERIMAGE_WILL')).toEqual(['反転回避6回', '破壊回避6回']);
  });

  test('ROBOT_VACUUM_WILL returns a special stone tag with duration tags', () => {
    expect(getEffectTagLabels('ROBOT_VACUUM_WILL')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '5ターン持続']);
    expect(getNumericTagLabels('ROBOT_VACUUM_WILL')).toEqual(['5ターン持続']);
  });

  test('delayed activation timing is exposed as a numeric tag', () => {
    expect(getEffectTagLabels('TIME_BOMB')).toEqual(['特殊石', '3ターン後に発動']);
    expect(getEffectTagLabels('TIME_STOP_GOD')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '5ターン後に発動']);
    expect(getEffectTagLabels('PERMA_PROTECT_NEXT_STONE')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '反転無効']);
    expect(getEffectTagLabels('SEED_WILL')).toEqual(['5ターン後に発動']);
    expect(getEffectTagLabels('POISON_WILL')).toEqual(['10ターン持続', '5ターン後に発動']);
    expect(getNumericTagLabels('TIME_BOMB')).toEqual(['3ターン後に発動']);
    expect(getNumericTagLabels('TIME_STOP_GOD')).toEqual(['5ターン後に発動']);
    expect(getNumericTagLabels('PERMA_PROTECT_NEXT_STONE')).toEqual([]);
    expect(getNumericTagLabels('SEED_WILL')).toEqual(['5ターン後に発動']);
    expect(getNumericTagLabels('GRASS_WILL')).toEqual(['10ターン持続']);
  });

  test('TRAP_WILL and RIBO_WILL do not invent numeric tags for opponent-turn or repayment wording', () => {
    expect(getNumericTagLabels('TRAP_WILL')).toEqual([]);
    expect(getNumericTagLabels('RIBO_WILL')).toEqual([]);
  });

  test('special stone tag audit follows the rulebook special-stone definition', () => {
    expect(getEffectTagLabels('TRAP_WILL')).toEqual(['特殊石']);
    expect(getEffectTagLabels('TIME_BOMB')).toEqual(['特殊石', '3ターン後に発動']);
    expect(getEffectTagLabels('TIME_STOP_GOD')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '5ターン後に発動']);
    expect(getEffectTagLabels('REGEN_WILL')).toEqual(['合法手が必要', '持ち石が必要', '特殊石']);
    expect(getEffectTagLabels('HYPERACTIVE_WILL')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '反転回避1回']);
    expect(getEffectTagLabels('ESCAPE_WILL')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '反転回避1回']);
    expect(getEffectTagLabels('WORK_WILL')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '5ターン持続']);
    expect(getEffectTagLabels('STONE_SALVATION_GOD')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '12ターン持続', '反転無効']);

    expect(getEffectTagLabels('GUARD_WILL')).toEqual(['完全保護', '3ターン持続']);
    expect(getEffectTagLabels('BLOCKADE_WILL')).toEqual(['3ターン持続']);
    expect(getEffectTagLabels('FREEZE_WILL')).toEqual(['5ターン持続']);
    expect(getEffectTagLabels('MASS_FREEZE_WILL')).toEqual(['5ターン持続']);
    expect(getEffectTagLabels('THEORY_INCARNATION')).toEqual(['合法手が必要', '持ち石が必要', '数字マス42獲得で使用可能', '不可侵', '3ターン持続']);
    expect(getEffectTagLabels('CHAOS_SUMMON')).toEqual(['特殊石']);
    expect(getEffectTagLabels('OBSERVER_WILL')).toEqual(['18手後使用可能', '不可侵', '5ターン持続']);
  });

  test('protection tag audit covers all cards that should expose 反転無効 or 完全保護', () => {
    expect(getEffectTagLabels('PROTECTED_NEXT_STONE')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '反転無効']);
    expect(getEffectTagLabels('PERMA_PROTECT_NEXT_STONE')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '反転無効']);
    expect(getEffectTagLabels('ANCHOR_WILL')).toEqual(['反転無効']);
    expect(getEffectTagLabels('ULTIMATE_REVERSE_DRAGON')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '8ターン持続', '反転無効']);
    expect(getEffectTagLabels('BREEDING_WILL')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '5ターン持続', '反転無効']);
    expect(getEffectTagLabels('GLUTTONOUS_WILL')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '反転無効']);
    expect(getEffectTagLabels('GUARD_WILL')).toEqual(['完全保護', '3ターン持続']);
    expect(getEffectTagLabels('GUARDIAN_GOD')).toEqual(['完全保護', '10ターン持続']);
    expect(getEffectTagLabels('ULTIMATE_DESTROY_GOD')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '6ターン持続', '反転無効']);
    expect(getEffectTagLabels('DESTROY_DRAGON_WILL')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '3ターン持続', '反転無効']);
    expect(getEffectTagLabels('LIGHTNING_WILL')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '6ターン持続', '反転無効']);
    expect(getEffectTagLabels('ULTIMATE_WORK_GOD')).toEqual(['合法手が必要', '持ち石が必要', '特殊石']);
    expect(getEffectTagLabels('METEOR_GOD')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '6ターン持続', '反転無効', '穴マス', '抹消']);
  });

  test('hole-cell tag audit covers cards that make permanent hole cells', () => {
    expect(getEffectTagLabels('CELL_TELEPORT_WILL')).toEqual(['穴マス']);
    expect(getEffectTagLabels('METEOR_WILL')).toEqual(['穴マス', '抹消']);
    expect(getEffectTagLabels('BOARD_SHRINK_WILL')).toEqual(['穴マス', '抹消']);
    expect(getEffectTagLabels('BOARD_SHRINK_GOD')).toEqual(['穴マス', '抹消']);
    expect(getEffectTagLabels('BOARD_EXECUTOR')).toEqual(['合法手が必要', '持ち石が必要', '特殊石3個以上で使用可能', '穴マス', '絶対執行', '不可侵', '4ターン持続']);
    expect(getEffectTagLabels('METEOR_GOD')).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '6ターン持続', '反転無効', '穴マス', '抹消']);
  });

  test('numeric tag resolver stays numeric-only even after protection tags are added', () => {
    expect(getNumericTagLabels('PROTECTED_NEXT_STONE')).toEqual([]);
    expect(getNumericTagLabels('ANCHOR_WILL')).toEqual([]);
    expect(getNumericTagLabels('THEORY_INCARNATION')).toEqual(['3ターン持続']);
    expect(getNumericTagLabels('CHAOS_SUMMON')).toEqual([]);
    expect(getNumericTagLabels('OBSERVER_WILL')).toEqual(['5ターン持続']);
    expect(getNumericTagLabels('BOARD_EXECUTOR')).toEqual(['4ターン持続']);
    expect(getNumericTagLabels('GUARD_WILL')).toEqual(['3ターン持続']);
    expect(getNumericTagLabels('DESTROY_DRAGON_WILL')).toEqual(['3ターン持続']);
  });

  test('resolveCardDescriptionTexts includes effectTags and numericTags alongside quick/detail text', () => {
    const resolved = CardInteractionEffects.resolveCardDescriptionTexts({
      type: 'DESTROY_DRAGON_WILL',
      desc: '次に置く石を破壊龍化する。'
    });

    expect(resolved.quickText).toContain('破壊龍化');
    expect(resolved.detailText).toContain('反転無効');
    expect(resolved.effectTags.map((tag) => tag.label)).toEqual(['合法手が必要', '持ち石が必要', '特殊石', '3ターン持続', '反転無効']);
    expect(resolved.numericTags.map((tag) => tag.label)).toEqual(['3ターン持続']);
  });
});
