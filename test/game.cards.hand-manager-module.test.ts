describe('CardHandManager module', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('commitDraw and destroyHandCard keep hand state consistent', () => {
    const CardHandManager = require('../game/logic/cards-internal/hand-manager.js');
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
    const CardHandManager = require('../game/logic/cards-internal/hand-manager.js');
    const defsById = {
      ribo_card: { id: 'ribo_card', type: 'RIBO_WILL', cost: 0, name: 'Ribo' },
      last_card: { id: 'last_card', type: 'LAST_RESORT', cost: 0, name: 'Last' },
      destroy_card: { id: 'destroy_card', type: 'DESTROY_ONE_STONE', cost: 0, name: 'Destroy' },
      living_card: { id: 'living_card', type: 'LIVING_WILL', cost: 0, name: 'Living' }
    };
    const selectorsModule = {
      getDestroyTargets: jest.fn(() => []),
      getLivingWillTargets: jest.fn(() => [])
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
      hands: { black: ['ribo_card', 'last_card', 'destroy_card', 'living_card'], white: [] },
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

    selectorsModule.getLivingWillTargets.mockReturnValue([{ row: 4, col: 4 }]);

    expect(CardHandManager.getUsableCardIds(cardState, gameState, 'black', context)).toEqual(['ribo_card', 'destroy_card', 'living_card']);
  });

  test('getUsableCardIds follows final usage prechecks for target, offer, and turn gated cards', () => {
    const CardHandManager = require('../game/logic/cards-internal/hand-manager.js');
    const defsById = {
      observer_card: { id: 'observer_card', type: 'OBSERVER_WILL', cost: 0, name: 'Observer' },
      capture_card: { id: 'capture_card', type: 'CAPTURE_WILL', cost: 0, name: 'Capture' },
      reverse_card: { id: 'reverse_card', type: 'REVERSE_WILL', cost: 0, name: 'Reverse' },
      heaven_card: { id: 'heaven_card', type: 'HEAVEN_BLESSING', cost: 0, name: 'Heaven' },
      condemn_card: { id: 'condemn_card', type: 'CONDEMN_WILL', cost: 0, name: 'Condemn' },
      loss_card: { id: 'loss_card', type: 'LOSS_WILL', cost: 0, name: 'Loss' },
      normal_card: { id: 'normal_card', type: 'NORMAL_CARD', cost: 0, name: 'Normal' }
    };
    const context = {
      constants: {
        MAX_HAND_SIZE: 10,
        RIBO_WILL_UNLOCK_TURN_INDEX: 19
      },
      modules: {
        CardDefsModule: {
          getCardDef: (cardId) => defsById[cardId] || null,
          getCardType: (cardId) => (defsById[cardId] ? defsById[cardId].type : null)
        },
        CardCostsModule: {
          getCardCost: () => 0
        }
      },
      helpers: {
        getCaptureWillTargets: jest.fn(() => []),
        getReverseWillTargets: jest.fn(() => []),
        buildHeavenBlessingOffers: jest.fn(() => []),
        buildObserverWillOffers: jest.fn(() => []),
        buildCondemnOffers: jest.fn(() => []),
        getLossWillRemovableCount: jest.fn(() => 0)
      }
    };
    const cardState = {
      hands: {
        black: ['observer_card', 'capture_card', 'reverse_card', 'heaven_card', 'condemn_card', 'loss_card'],
        white: ['observer_card']
      },
      charge: { black: 10, white: 0 },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      turnIndex: 10
    };
    const gameState = {
      board: Array(64).fill(null),
      turnNumber: 10
    };

    expect(CardHandManager.getUsableCardIds(cardState, gameState, 'black', context)).toEqual([]);

    context.helpers.getCaptureWillTargets.mockReturnValue([{ row: 0, col: 0 }]);
    context.helpers.getReverseWillTargets.mockReturnValue([{ row: 1, col: 1 }]);
    context.helpers.buildHeavenBlessingOffers.mockReturnValue([{ cardId: 'normal_card' }]);
    context.helpers.buildObserverWillOffers.mockReturnValue([{ cardId: 'normal_card' }]);
    context.helpers.buildCondemnOffers.mockReturnValue([{ cardId: 'normal_card' }]);
    context.helpers.getLossWillRemovableCount.mockReturnValue(1);
    cardState.hands.white = ['normal_card'];
    cardState.turnIndex = 18;
    gameState.turnNumber = 18;

    expect(CardHandManager.getUsableCardIds(cardState, gameState, 'black', context)).toEqual([
      'observer_card',
      'capture_card',
      'reverse_card',
      'heaven_card',
      'condemn_card',
      'loss_card'
    ]);
  });

  test('copy ids keep reveal ledger stable across destroy, redraw, and discard restore', () => {
    const CardHandManager = require('../game/logic/cards-internal/hand-manager.js');
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

  test('TIME_STOP_GOD stays in hand when drawn', () => {
    const CardHandManager = require('../game/logic/cards-internal/hand-manager.js');
    const cardId = 'time_stop_god_01';
    const context = {
      constants: {
        MAX_HAND_SIZE: 5,
        RIBO_WILL_UNLOCK_TURN_INDEX: 19
      },
      modules: {
        CardDefsModule: {
          getCardDef: (id) => ({ id, type: id === cardId ? 'TIME_STOP_GOD' : 'GENERIC', cost: 0, name: id }),
          getCardType: (id) => (id === cardId ? 'TIME_STOP_GOD' : 'GENERIC')
        },
        CardCostsModule: {
          getCardCost: () => 0
        }
      },
      helpers: {}
    };
    const cardState = {
      hands: { black: [], white: [] },
      decks: { black: [cardId], white: [] },
      discard: [],
      charge: { black: 0, white: 0 },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      turnIndex: 0
    };

    expect(CardHandManager.commitDraw(cardState, 'black', null, context)).toBe(cardId);
    expect(cardState.hands.black).toEqual([cardId]);
    expect(cardState.discard).toEqual([]);
    expect(CardHandManager.getHandCopyIds(cardState, 'black')).toHaveLength(1);
  });
});
