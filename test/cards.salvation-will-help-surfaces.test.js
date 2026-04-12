const path = require('path');

const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));

const EXPECTED_QUICK_TEXT = '直前の相手ターンで破壊された全ての石を自分の通常石としてランダムな空きマスへ配置して通常反転する';
const EXPECTED_DETAIL_TEXT = '直前の相手ターンで破壊された全ての石を自分の通常石としてランダムな空きマスへ配置する。\n対象0枚の時は使用不可。\n対象は自分・相手、通常石・特殊石を問わない。\n各復活石は、そのマスを起点に通常の挟み反転を行う。';
const CARD_DEF = Object.freeze({
  type: 'SALVATION_WILL',
  desc: '直前の相手ターンで破壊された全ての石を自分の通常石としてランダムな空きマスへ配置する。対象0枚の時は使用不可。対象は自分・相手、通常石・特殊石を問わない。各復活石は、そのマスを起点に通常の挟み反転を行う。'
});

describe('SALVATION_WILL help surfaces', () => {
  test('CardInteractionEffects exposes non-truncated quick/detail text for SALVATION_WILL', () => {
    expect(CardInteractionEffects.quickCardEffectByType.SALVATION_WILL).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.detailCardEffectByType.SALVATION_WILL).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(CARD_DEF)).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.getDetailCardEffect(CARD_DEF)).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(CARD_DEF)).not.toContain('...');
  });
});
