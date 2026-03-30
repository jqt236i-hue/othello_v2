const path = require('path');

const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));

const EXPECTED_QUICK_TEXT = '直前の相手ターンで破壊された自分の通常石をすべてランダムな空きマスへ配置する';
const EXPECTED_DETAIL_TEXT = '直前の相手ターンで破壊された自分の通常石をすべてランダムな空きマスへ配置する。\n対象0枚の時は使用不可。\n特殊石は対象外。';
const CARD_DEF = Object.freeze({
  type: 'SALVATION_WILL',
  desc: '直前の相手ターンで破壊された自分の通常石をすべてランダムな空きマスへ配置する。対象0枚の時は使用不可。特殊石は対象外。'
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
