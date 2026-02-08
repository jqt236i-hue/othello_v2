const SharedConstants = require('../shared-constants');
const CardLogic = require('../game/logic/cards');

describe('CardLogic commitDraw reshuffle cycle policy', () => {
  test('initial deck size is 30 with type-guarantee policy', () => {
    const prng = { shuffle: jest.fn(), random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    expect(cardState.initialDeckSize).toBe(30);
    expect(cardState.deck).toHaveLength(30);
  });

  test('does not reshuffle when deck is empty even if discard has cards', () => {
    const ids = (SharedConstants.CARD_DEFS || []).map(c => c.id);
    expect(ids.length).toBeGreaterThan(0);

    const prng = { shuffle: jest.fn(), random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    prng.shuffle.mockClear();
    cardState.deck = [];
    cardState.discard = ids.slice(0, 10);
    cardState.hands.black = [];

    const drawn = CardLogic.commitDraw(cardState, 'black', prng);

    expect(drawn).toBeNull();
    expect(cardState.deck).toHaveLength(0);
    expect(cardState.discard).toHaveLength(10);
    expect(prng.shuffle).not.toHaveBeenCalled();
  });
});
