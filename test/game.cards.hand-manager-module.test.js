describe('CardHandManager module', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('commitDraw and destroyHandCard keep hand state consistent', () => {
    const CardHandManager = require('../game/logic/cards-internal/hand-manager');
    const cardState = {
      hands: { black: [], white: [] },
      decks: { black: ['card_a', 'card_b'], white: [] },
      discard: [],
      charge: { black: 0, white: 0 },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: {},
      turnIndex: 0
    };
    const context = {
      constants: {
        MAX_HAND_SIZE: 1,
        RIBO_WILL_UNLOCK_TURN_INDEX: 19
      },
      modules: {
        CardDefsModule: {
          getCardDef: (cardId) => ({ id: cardId, type: 'GENERIC', cost: 0, name: cardId }),
          getCardType: () => 'GENERIC'
        },
        CardCostsModule: {
          getCardCost: () => 0
        }
      },
      helpers: {}
    };

    expect(CardHandManager.commitDraw(cardState, 'black', null, context)).toBe('card_b');
    expect(cardState.hands.black).toEqual(['card_b']);
    expect(CardHandManager.commitDraw(cardState, 'black', null, context)).toBeNull();

    const result = CardHandManager.destroyHandCard(cardState, 'black', 'card_b', null, context);
    expect(result).toMatchObject({ applied: true, destroyedCardId: 'card_b' });
    expect(cardState.hands.black).toEqual([]);
    expect(cardState.discard).toEqual(['card_b']);
    expect(cardState.hasDestroyedCardThisTurnByPlayer.black).toBe(true);
    expect(cardState.hasDestroyedCardThisTurnByPlayer.white).toBe(false);
  });

  test('getUsableCardIds respects unlock turn and target availability', () => {
    const CardHandManager = require('../game/logic/cards-internal/hand-manager');
    const defsById = {
      ribo_card: { id: 'ribo_card', type: 'RIBO_WILL', cost: 0, name: 'Ribo' },
      last_card: { id: 'last_card', type: 'LAST_RESORT', cost: 0, name: 'Last' },
      destroy_card: { id: 'destroy_card', type: 'DESTROY_ONE_STONE', cost: 0, name: 'Destroy' }
    };
    const selectorsModule = {
      getDestroyTargets: jest.fn(() => [])
    };
    const context = {
      constants: {
        MAX_HAND_SIZE: 5,
        RIBO_WILL_UNLOCK_TURN_INDEX: 19
      },
      modules: {
        CardDefsModule: {
          getCardDef: (cardId) => defsById[cardId] || null,
          getCardType: (cardId) => (defsById[cardId] ? defsById[cardId].type : null)
        },
        CardCostsModule: {
          getCardCost: () => 0
        },
        CardSelectorsModule: selectorsModule
      },
      helpers: {
        hasStandardLegalMoveForPlayer: jest.fn(() => false),
        canUseLastResortForPlayer: jest.fn(() => true),
        countOpponentOccupiedCornersForPlayer: jest.fn(() => 0),
        getOccupiedBoardShapeCellsForCard: jest.fn(() => [])
      }
    };
    const cardState = {
      hands: { black: ['ribo_card', 'last_card', 'destroy_card'], white: [] },
      charge: { black: 0, white: 0 },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      turnIndex: 18
    };
    const gameState = { board: [] };

    expect(CardHandManager.getUsableCardIds(cardState, gameState, 'black', context)).toEqual(['last_card']);

    cardState.turnIndex = 19;
    context.helpers.hasStandardLegalMoveForPlayer = jest.fn(() => true);
    context.helpers.canUseLastResortForPlayer = jest.fn(() => false);
    selectorsModule.getDestroyTargets.mockReturnValue([{ row: 2, col: 3 }]);

    expect(CardHandManager.getUsableCardIds(cardState, gameState, 'black', context)).toEqual(['ribo_card', 'destroy_card']);
  });

  test('copy ids keep reveal ledger stable across destroy, redraw, and discard restore', () => {
    const CardHandManager = require('../game/logic/cards-internal/hand-manager');
    const context = {
      constants: {
        MAX_HAND_SIZE: 5,
        RIBO_WILL_UNLOCK_TURN_INDEX: 19
      },
      modules: {
        CardDefsModule: {
          getCardDef: (cardId) => ({ id: cardId, type: 'GENERIC', cost: 0, name: cardId }),
          getCardType: () => 'GENERIC'
        },
        CardCostsModule: {
          getCardCost: () => 0
        }
      },
      helpers: {}
    };
    const cardState = {
      hands: { black: [], white: ['card_a', 'card_b'] },
      decks: { black: [], white: ['card_a'] },
      discard: [],
      charge: { black: 0, white: 0 },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: {},
      turnIndex: 0
    };

    CardHandManager.ensureCardCopyState(cardState, context);
    const initialCopyIds = CardHandManager.getHandCopyIds(cardState, 'white', context);
    expect(initialCopyIds).toHaveLength(2);
    expect(initialCopyIds[0]).not.toBe(initialCopyIds[1]);

    expect(CardHandManager.revealCurrentHandToViewer(cardState, 'black', 'white', context)).toEqual(initialCopyIds);
    expect(CardHandManager.isCardCopyIdRevealedToViewer(cardState, 'black', initialCopyIds[0], context)).toBe(true);
    expect(CardHandManager.isCardCopyIdRevealedToViewer(cardState, 'black', initialCopyIds[1], context)).toBe(true);

    const destroyed = CardHandManager.destroyHandCard(cardState, 'white', 'card_a', null, context);
    expect(destroyed.destroyedCardCopyId).toBe(initialCopyIds[0]);
    expect(CardHandManager.commitDraw(cardState, 'white', null, context)).toBe('card_a');

    const currentCopyIds = CardHandManager.getHandCopyIds(cardState, 'white', context);
    expect(currentCopyIds).toHaveLength(2);
    expect(currentCopyIds[1]).not.toBe(initialCopyIds[0]);
    expect(CardHandManager.isCardCopyIdRevealedToViewer(cardState, 'black', currentCopyIds[1], context)).toBe(false);

    const restored = CardHandManager.moveDiscardCardToHandByCardId(cardState, 'white', 'card_a', context, { ignoreHandLimit: true });
    expect(restored.cardCopyId).toBe(initialCopyIds[0]);
    expect(CardHandManager.isCardCopyIdRevealedToViewer(cardState, 'black', restored.cardCopyId, context)).toBe(true);
  });
});
