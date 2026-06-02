import * as SharedConstants from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as DeckSpecHelpers from '../shared/deck-spec.js';
import * as SeededPRNG from '../game/schema/prng.js';

describe('CardLogic commitDraw reshuffle cycle policy', () => {
  test('default deck uses 30 unique enabled cards and shares contents while shuffling order per player', () => {
    const prng = SeededPRNG.createPRNG(7);
    const cardState = CardLogic.createCardState(prng);
    const enabledIds = (SharedConstants.CARD_DEFS || [])
      .filter((card) => card && card.enabled !== false && card.id)
      .map((card) => card.id);
    const enabledIdSet = new Set(enabledIds);
    const expectedDeckSize = DeckSpecHelpers.getDefaultDeckSize();

    expect(cardState.initialDeckSize).toBe(expectedDeckSize);
    expect(cardState.decks.black).toHaveLength(expectedDeckSize);
    expect(cardState.decks.white).toHaveLength(expectedDeckSize);
    expect(new Set(cardState.decks.black).size).toBe(expectedDeckSize);
    expect(new Set(cardState.decks.white).size).toBe(expectedDeckSize);
    expect(cardState.decks.black.every((cardId) => enabledIdSet.has(cardId))).toBe(true);
    expect(cardState.decks.white.every((cardId) => enabledIdSet.has(cardId))).toBe(true);
    expect(cardState.decks.black.slice().sort()).toEqual(cardState.decks.white.slice().sort());
    expect(cardState.decks.black).not.toEqual(cardState.decks.white);
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

  test('different seeds reroll the default deck contents', () => {
    const firstState = CardLogic.createCardState(SeededPRNG.createPRNG(7), {});
    const secondState = CardLogic.createCardState(SeededPRNG.createPRNG(8), {});

    expect(firstState.decks.black.slice().sort()).not.toEqual(secondState.decks.black.slice().sort());
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

  test('partial initialDeckSpec initializes both players with the requested deck size', () => {
    const enabledIds = (SharedConstants.CARD_DEFS || [])
      .filter((card) => card && card.enabled !== false && card.id)
      .map((card) => card.id)
      .slice(0, 4);

    expect(enabledIds).toHaveLength(4);

    const customDeckIds = enabledIds.concat(enabledIds[0]);
    const deckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(customDeckIds, { requireFullDeck: false });
    const expandedDeckIds = DeckSpecHelpers.expandDeckSpec(deckSpec, { requireFullDeck: false });
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng, { initialDeckSpec: deckSpec });

    expect(cardState.initialDeckSize).toBe(5);
    expect(cardState.initialDeckSizeByPlayer.black).toBe(5);
    expect(cardState.initialDeckSizeByPlayer.white).toBe(5);
    expect(cardState.decks.black).toEqual(expandedDeckIds);
    expect(cardState.decks.white).toEqual(expandedDeckIds);
  });

  test('initialDeckCardIdsByPlayer accepts duplicate-heavy custom decks', () => {
    const duplicateDeckIds = Array(15).fill('perma_01').concat(Array(15).fill('work_01'));
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng, {
      initialDeckCardIdsByPlayer: {
        black: duplicateDeckIds
      }
    });

    expect(cardState.initialDeckSize).toBe(30);
    expect(cardState.initialDeckSizeByPlayer.black).toBe(30);
    expect(cardState.decks.black).toEqual(duplicateDeckIds);
    expect(cardState.decks.black.filter((cardId) => cardId === 'perma_01')).toHaveLength(15);
    expect(cardState.decks.black.filter((cardId) => cardId === 'work_01')).toHaveLength(15);
    expect(cardState.decks.white).toHaveLength(cardState.initialDeckSizeByPlayer.white);
    expect(new Set(cardState.decks.white).size).toBe(cardState.initialDeckSizeByPlayer.white);
  });
});

