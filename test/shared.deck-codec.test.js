const SharedConstants = require('../shared-constants');
const DeckSpecHelpers = require('../shared/deck-spec');
const DeckCodecModule = require('../shared/deck-codec');

function buildCustomDeckIds() {
  const enabledIds = (SharedConstants.CARD_DEFS || [])
    .filter((card) => card && card.enabled !== false && card.id)
    .map((card) => card.id)
    .slice(0, 10);

  if (enabledIds.length !== 10) {
    throw new Error('expected at least 10 enabled cards for custom deck test');
  }

  return enabledIds.flatMap((cardId) => [cardId, cardId, cardId]);
}

describe('shared deck codec', () => {
  test('30-card custom deck encodes and decodes canonically', () => {
    const deckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(buildCustomDeckIds());
    const deckCode = DeckCodecModule.encodeDeckSpec(deckSpec);
    const decoded = DeckCodecModule.decodeDeckCode(deckCode);

    expect(typeof deckCode).toBe('string');
    expect(deckCode.startsWith('D1C')).toBe(true);
    expect(decoded).toEqual(deckSpec);
    expect(DeckSpecHelpers.expandDeckSpec(decoded)).toHaveLength(30);
  });

  test('safeDecodeDeckCode rejects malformed deck codes', () => {
    const result = DeckCodecModule.safeDecodeDeckCode('not-a-deck-code');

    expect(result.ok).toBe(false);
    expect(result.deckSpec).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe('DECK_CODE_INVALID');
  });
});