import * as path from 'path';

const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
const catalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));

const FORBIDDEN_DETAIL_TOKENS = /(UI|画面|バナー|server|currentPlayer|gameState|slot|window|pending|ペンディング|タイムアウト|ネット対戦|コントローラー|DOM|アニメ|remainingOwnerTurns)/;

function buildComparisonKey(text) {
  return String(text || '')
    .trim()
    .replace(/[\s\u3000]/g, '')
    .replace(/[。\.、,，:：;；!！?？'"“”‘’\-ー／/（）()\[\]{}「」『』【】<>《》・]/g, '')
    .toLowerCase();
}

describe('card detail copy audit', () => {
  test('every catalog card exposes explicit supplementary detail text', () => {
    for (const card of catalog.cards) {
      expect(Object.prototype.hasOwnProperty.call(CardInteractionEffects.detailCardEffectByType, card.type)).toBe(true);

      const resolved = CardInteractionEffects.resolveCardDescriptionTexts({
        id: card.id,
        type: card.type,
        name: card.name_ja,
        desc: card.desc_ja
      });

      const quickText = String(resolved.quickText || '').trim();
      const distinctDetailText = String(resolved.distinctDetailText || '').trim();

      expect(distinctDetailText).toBeTruthy();
      expect(buildComparisonKey(distinctDetailText)).not.toBe(buildComparisonKey(quickText));
      expect(distinctDetailText).not.toMatch(FORBIDDEN_DETAIL_TOKENS);
    }
  });
});
