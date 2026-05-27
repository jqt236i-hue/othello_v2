import { createCardDeckSetup } from '../game/logic/cards-internal/deck-setup.js';

describe('card deck setup module', () => {
  test('normalizes explicit deck ids and prefers player-specific overrides', () => {
    const helpers = createCardDeckSetup({
      enabledCardIdSet: new Set(['a', 'b', 'c', 'd'])
    });

    expect(helpers.resolveExplicitInitialDeckCardIds({
      initialDeckCardIds: ['a', 'b'],
      initialDeckCardIdsByPlayer: {
        black: [' c ', 'd']
      }
    }, 'black')).toEqual(['c', 'd']);

    expect(() => helpers.normalizeInitialDeckCardIds(['a', 'missing'])).toThrow('Invalid initial deck card id at index 1: missing');
  });

  test('expands shared and player-specific deck specs through DeckSpecHelpers', () => {
    const expandDeckSpec = jest.fn((spec: any) => [`expanded:${spec.id}`]);
    const helpers = createCardDeckSetup({
      DeckSpecHelpers: {
        expandDeckSpec
      },
      enabledCardIdSet: new Set(['a'])
    });

    expect(helpers.resolveExplicitInitialDeckCardIds({
      initialDeckSpec: { id: 'shared' }
    }, 'white')).toEqual(['expanded:shared']);

    expect(helpers.resolveExplicitInitialDeckCardIds({
      initialDeckSpec: { id: 'shared' },
      initialDeckSpecByPlayer: {
        black: { id: 'black-only' }
      }
    }, 'black')).toEqual(['expanded:black-only']);

    expect(expandDeckSpec).toHaveBeenCalledTimes(2);
  });

  test('reuses a single default generated deck only when both players are implicit', () => {
    const createDefaultDeck = jest
      .fn()
      .mockReturnValueOnce(['x', 'y', 'z'])
      .mockReturnValueOnce(['white-only']);
    const helpers = createCardDeckSetup({
      CardStateManager: {
        createDefaultDeck
      },
      enabledCardIdSet: new Set(['x', 'y', 'z', 'a'])
    });

    const shared = helpers.resolveInitialDeckCardIdsByPlayer({}, { seed: 1 });
    expect(shared).toEqual({
      black: ['x', 'y', 'z'],
      white: ['x', 'y', 'z']
    });
    expect(shared.black).not.toBe(shared.white);

    const mixed = helpers.resolveInitialDeckCardIdsByPlayer({
      initialDeckCardIdsByPlayer: {
        black: ['a']
      }
    }, { seed: 2 });
    expect(mixed).toEqual({
      black: ['a'],
      white: ['white-only']
    });
    expect(createDefaultDeck).toHaveBeenCalledTimes(2);
  });
});
