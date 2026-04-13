const path = require('path');

const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));

const EXPECTED_QUICK_TEXT = '次の相手のターンを自分が操作できる。';
const EXPECTED_DETAIL_TEXT = '次の相手ターン1回だけ操作権を得る。\n相手の手札を見て、カード使用や石配置まで行える。\n配置可能マスが無ければ通常のパスとして終了する。\n発動中に再び使っても重ならず、その回の制御だけで終わる。';
const CARD_DEF = Object.freeze({
  type: 'FATE_WILL',
  desc: '次の相手のターンを自分が操作できる。'
});

describe('FATE_WILL help surfaces', () => {
  test('CardInteractionEffects exposes non-truncated quick/detail text for FATE_WILL', () => {
    expect(CardInteractionEffects.quickCardEffectByType.FATE_WILL).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.detailCardEffectByType.FATE_WILL).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(CARD_DEF)).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.getDetailCardEffect(CARD_DEF)).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(CARD_DEF)).not.toContain('...');
  });
});
