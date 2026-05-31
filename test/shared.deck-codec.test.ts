describe('shared deck codec', () => {
  test('0枚デッキを encode / decode できる', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const DeckCodecModule = require('../shared/deck-codec.js');

    const deckSpec = DeckSpecHelpers.createDeckSpecFromCardIds([], { requireFullDeck: false });
    const deckCode = DeckCodecModule.encodeDeckSpec(deckSpec);

    expect(deckCode).toBe(`D1C${DeckSpecHelpers.getCatalogVersion()}:`);
    expect(DeckCodecModule.decodeDeckCode(deckCode)).toEqual(deckSpec);
  });

  test('partial custom deck を既定の normalize で受け入れる', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const firstCardId = DeckSpecHelpers.getEnabledCardDefs()[0].id;

    const deckSpec = DeckSpecHelpers.normalizeDeckSpec([firstCardId, firstCardId]);
    const summary = DeckSpecHelpers.summarizeDeckSpec(deckSpec);

    expect(summary.deckSize).toBe(2);
    expect(deckSpec.cards).toEqual([{ cardId: firstCardId, count: 2 }]);
  });
});
