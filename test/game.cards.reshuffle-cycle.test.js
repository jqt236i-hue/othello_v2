const SharedConstants = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const DeckSpecHelpers = require('../shared/deck-spec');

describe('CardLogic commitDraw reshuffle cycle policy', () => {
  test('initial deck contains each enabled card id exactly once (no duplicates)', () => {
    const prng = { shuffle: jest.fn(), random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const enabledIds = (SharedConstants.CARD_DEFS || [])
      .filter((card) => card && card.enabled !== false && card.id)
      .map((card) => card.id);
    const expectedDeckSize = new Set(enabledIds).size;
    expect(cardState.initialDeckSize).toBe(expectedDeckSize);
    expect(cardState.decks.black).toHaveLength(expectedDeckSize);
    expect(cardState.decks.white).toHaveLength(expectedDeckSize);
    expect(new Set(cardState.decks.black).size).toBe(expectedDeckSize);
    expect(new Set(cardState.decks.white).size).toBe(expectedDeckSize);
  });

  test('does not reshuffle when deck is empty even if discard has cards', () => {
    const ids = (SharedConstants.CARD_DEFS || []).map(c => c.id);
    expect(ids.length).toBeGreaterThan(0);

    const prng = { shuffle: jest.fn(), random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    prng.shuffle.mockClear();
    cardState.decks.black = [];
    cardState.discard = ids.slice(0, 10);
    cardState.hands.black = [];

    const drawn = CardLogic.commitDraw(cardState, 'black', prng);

    expect(drawn).toBeNull();
    expect(cardState.decks.black).toHaveLength(0);
    expect(cardState.discard).toHaveLength(10);
    expect(prng.shuffle).not.toHaveBeenCalled();
  });

  test('normal draws from initial deck do not repeat card ids before deck is exhausted', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    cardState.hands.black = [];
    const seen = new Set();

    while (cardState.decks.black.length > 0) {
      const drawn = CardLogic.commitDraw(cardState, 'black', prng);
      expect(drawn).toBeTruthy();
      expect(seen.has(drawn)).toBe(false);
      seen.add(drawn);
      // keep drawing without hand-cap interference
      cardState.hands.black = [];
    }

    expect(seen.size).toBe(cardState.initialDeckSizeByPlayer.black);
  });

  test('custom initialDeckSpec initializes both players with the requested 30-card deck', () => {
    const enabledIds = (SharedConstants.CARD_DEFS || [])
      .filter((card) => card && card.enabled !== false && card.id)
      .map((card) => card.id)
      .slice(0, 10);

    expect(enabledIds).toHaveLength(10);

    const customDeckIds = enabledIds.flatMap((cardId) => [cardId, cardId, cardId]);
    const deckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(customDeckIds);
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng, { initialDeckSpec: deckSpec });

    expect(cardState.initialDeckSize).toBe(30);
    expect(cardState.initialDeckSizeByPlayer.black).toBe(30);
    expect(cardState.initialDeckSizeByPlayer.white).toBe(30);
    expect(cardState.decks.black).toHaveLength(30);
    expect(cardState.decks.white).toHaveLength(30);
    expect(cardState.decks.black).toEqual(customDeckIds);
    expect(cardState.decks.white).toEqual(customDeckIds);
    expect(cardState.decks.black.filter((cardId) => cardId === enabledIds[0])).toHaveLength(3);
    expect(cardState.decks.white.filter((cardId) => cardId === enabledIds[0])).toHaveLength(3);
  });
});
