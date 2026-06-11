import * as path from 'path';

const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));

describe('CardInteractionEffects effect tags', () => {
  function getEffectTagLabels(cardType) {
    return CardInteractionEffects.resolveCardEffectTags({ type: cardType }).map((tag) => tag.label);
  }

  function getNumericTagLabels(cardType) {
    return CardInteractionEffects.resolveCardNumericTags({ type: cardType }).map((tag) => tag.label);
  }

  test('AFTERIMAGE_WILL returns flip and destroy evasion count tags', () => {
    expect(getEffectTagLabels('AFTERIMAGE_WILL')).toEqual(['反転回避3回', '破壊回避3回']);
  });

  test('ROBOT_VACUUM_WILL returns only its base duration tag', () => {
    expect(getEffectTagLabels('ROBOT_VACUUM_WILL')).toEqual(['5ターン持続']);
  });

  test('TIME_BOMB, TIME_STOP_GOD, PERMA_PROTECT_NEXT_STONE, and SEED_WILL use delayed activation tags', () => {
    expect(getNumericTagLabels('TIME_BOMB')).toEqual(['3ターン後に発動']);
    expect(getNumericTagLabels('TIME_STOP_GOD')).toEqual(['5ターン後に発動']);
    expect(getNumericTagLabels('PERMA_PROTECT_NEXT_STONE')).toEqual(['10ターン後に発動']);
    expect(getNumericTagLabels('SEED_WILL')).toEqual(['5ターン後に発動']);
  });

  test('TRAP_WILL and RIBO_WILL do not invent numeric tags for opponent-turn or repayment wording', () => {
    expect(getNumericTagLabels('TRAP_WILL')).toEqual([]);
    expect(getNumericTagLabels('RIBO_WILL')).toEqual([]);
  });

  test('protection tag audit covers all cards that should expose 反転保護 or 完全保護', () => {
    expect(getEffectTagLabels('PROTECTED_NEXT_STONE')).toEqual(['反転保護']);
    expect(getEffectTagLabels('PERMA_PROTECT_NEXT_STONE')).toEqual(['反転保護', '10ターン後に発動']);
    expect(getEffectTagLabels('ANCHOR_WILL')).toEqual(['反転保護']);
    expect(getEffectTagLabels('ULTIMATE_REVERSE_DRAGON')).toEqual(['反転保護', '8ターン持続']);
    expect(getEffectTagLabels('BREEDING_WILL')).toEqual(['反転保護', '5ターン持続']);
    expect(getEffectTagLabels('GLUTTONOUS_WILL')).toEqual(['反転保護']);
    expect(getEffectTagLabels('GUARD_WILL')).toEqual(['完全保護', '3ターン持続']);
    expect(getEffectTagLabels('GUARDIAN_GOD')).toEqual(['完全保護', '10ターン持続']);
    expect(getEffectTagLabels('ULTIMATE_DESTROY_GOD')).toEqual(['反転保護', '6ターン持続']);
    expect(getEffectTagLabels('DESTROY_DRAGON_WILL')).toEqual(['反転保護', '3ターン持続']);
    expect(getEffectTagLabels('LIGHTNING_WILL')).toEqual(['反転保護', '6ターン持続']);
    expect(getEffectTagLabels('METEOR_GOD')).toEqual(['反転保護', '6ターン持続']);
  });

  test('numeric tag resolver stays numeric-only even after protection tags are added', () => {
    expect(getNumericTagLabels('PROTECTED_NEXT_STONE')).toEqual([]);
    expect(getNumericTagLabels('ANCHOR_WILL')).toEqual([]);
    expect(getNumericTagLabels('GUARD_WILL')).toEqual(['3ターン持続']);
    expect(getNumericTagLabels('DESTROY_DRAGON_WILL')).toEqual(['3ターン持続']);
  });

  test('resolveCardDescriptionTexts includes effectTags and numericTags alongside quick/detail text', () => {
    const resolved = CardInteractionEffects.resolveCardDescriptionTexts({
      type: 'DESTROY_DRAGON_WILL',
      desc: '次に置く石を破壊龍化する。'
    });

    expect(resolved.quickText).toContain('破壊龍化');
    expect(resolved.detailText).toContain('反転保護');
    expect(resolved.effectTags.map((tag) => tag.label)).toEqual(['反転保護', '3ターン持続']);
    expect(resolved.numericTags.map((tag) => tag.label)).toEqual(['3ターン持続']);
  });
});
