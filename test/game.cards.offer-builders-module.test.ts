import { createOfferBuilders } from '../game/logic/cards-internal/offer-builders.js';

describe('card offer builders module', () => {
  test('buildHeavenBlessingSeedHint preserves player/turn/hand/charge fields', () => {
    const builders = createOfferBuilders();
    expect(builders.buildHeavenBlessingSeedHint({
      turnIndex: '7',
      hands: { black: ['a', 'b'] },
      charge: { black: 13 }
    }, 'black')).toBe('black|7|2|13');
    expect(builders.buildHeavenBlessingSeedHint({
      turnIndex: null,
      hands: { white: ['a'] },
      charge: { white: '9' }
    }, 'white')).toBe('white|0|1|0');
  });

  test('buildHeavenBlessingOffers excludes self, respects enabled flag, and is deterministic without prng', () => {
    const builders = createOfferBuilders({
      heavenBlessingOfferCount: 3,
      cardDefs: [
        { id: 'self', enabled: true },
        { id: 'a', enabled: true },
        { id: 'b', enabled: true },
        { id: 'c', enabled: true },
        { id: 'd', enabled: false }
      ]
    });

    const first = builders.buildHeavenBlessingOffers('self', null, 'hint');
    const second = builders.buildHeavenBlessingOffers('self', null, 'hint');
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first).not.toContain('self');
    expect(first).not.toContain('d');
    expect(new Set(first).size).toBe(first.length);
  });

  test('buildCondemnOffers maps opponent hand to stable handIndex/cardId tuples', () => {
    const builders = createOfferBuilders();
    expect(builders.buildCondemnOffers({
      hands: {
        black: ['k1'],
        white: ['w0', 'w1']
      }
    }, 'black')).toEqual([
      { handIndex: 0, cardId: 'w0' },
      { handIndex: 1, cardId: 'w1' }
    ]);
  });
});
