const path = require('path');

const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));

const EXPECTED_QUICK_TEXT = '使用した直後の相手ターン1回、コントローラーがそのターンを代理操作する';
const EXPECTED_DETAIL_TEXT = '使用した直後の相手ターン1回だけ、使用者（コントローラー）が操作権を得る。\ngameState.currentPlayer は変更せず、ターンの所有者は相手のまま維持される。\nコントローラーは相手の手札を閲覧・使用・破壊でき、盤面への石配置操作も行う。\nターン中のペンディング選択（対象マスの指定など）はコントローラーが入力する。\n配置可能マスが存在しない場合はターン所有者の通常パスと同じ扱いで自動終了する。\nタイムアウトが発生した場合はターン所有者の通常タイムアウトと同じ扱いで処理される。\n発動中は双方の画面に「運命の意志発動中」のバナーを常時表示する。\nスタック・ネスト：発動中に手札の運命の意志を使用しても制御は重ならず無効扱いとする（カードは消費される）。\nネット対戦では、コントローラーの操作入力をserver-authoritativeに送信し、server側でターン所有者のターン進行として処理する。';
const CARD_DEF = Object.freeze({
  type: 'FATE_WILL',
  desc: '使用した直後の相手ターン1回だけ、使用者（コントローラー）がそのターンを代理操作する。ターンの所有者は相手のまま。コントローラーは相手の手札を閲覧・使用・破壊でき、盤面への石配置操作も行う。ターン中のペンディング選択はコントローラーが入力する。発動中は双方の画面に『運命の意志発動中』のバナーを常時表示する。'
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
