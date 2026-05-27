import { createCardHandAccess } from '../game/logic/cards-internal/hand-access.js';

describe('card hand access module', () => {
  test('routes hand-manager and state-manager calls through the current context', () => {
    const getCardHandManagerContext = jest.fn(() => ({ token: 'ctx' }));
    const drawCard = jest.fn(() => 'drawn-card');
    const addToHand = jest.fn(() => ({ cardId: 'added' }));
    const removeFromHand = jest.fn(() => ({ cardId: 'removed' }));
    const dealInitialHands = jest.fn();
    const ensureCardCopyState = jest.fn();
    const getHandCopyIdAt = jest.fn(() => 11);
    const getHandCopyIds = jest.fn(() => [11, 12]);
    const isCardCopyIdRevealedToViewer = jest.fn(() => true);
    const revealCurrentHandToViewer = jest.fn(() => [11, 12]);
    const addCardToDiscard = jest.fn(() => ({ discardIndex: 0 }));
    const clearHandToDiscard = jest.fn(() => ({ destroyedCards: [] }));
    const moveDiscardCardToHandByCardId = jest.fn(() => ({ cardId: 'moved' }));
    const getCardDef = jest.fn(() => ({ id: 'card_a' }));
    const getCardType = jest.fn(() => 'TYPE_A');
    const getCardDisplayName = jest.fn(() => 'Card A');
    const getCardCodeName = jest.fn(() => 'card_a');
    const getCardCost = jest.fn(() => 7);
    const canUseCard = jest.fn(() => true);
    const ensureHandDestroyFlags = jest.fn(() => ({ black: false, white: false }));
    const destroyHandCard = jest.fn(() => ({ applied: true }));
    const getUsableCardIds = jest.fn(() => ['card_a']);
    const hasUsableCard = jest.fn(() => true);

    const access = createCardHandAccess({
      defaultPrng: { seed: 'default' },
      getCardHandManagerContext,
      CardStateManager: { drawCard, addToHand, removeFromHand },
      CardHandManagerModule: {
        dealInitialHands,
        ensureCardCopyState,
        getHandCopyIdAt,
        getHandCopyIds,
        isCardCopyIdRevealedToViewer,
        revealCurrentHandToViewer,
        addCardToDiscard,
        clearHandToDiscard,
        moveDiscardCardToHandByCardId,
        getCardDef,
        getCardType,
        getCardDisplayName,
        getCardCodeName,
        getCardCost,
        canUseCard,
        ensureHandDestroyFlags,
        destroyHandCard,
        getUsableCardIds,
        hasUsableCard
      }
    });

    access.dealInitialHands({ state: true }, null);
    expect(dealInitialHands).toHaveBeenCalledWith({ state: true }, { seed: 'default' }, { token: 'ctx' });

    expect(access.commitDraw({ state: true }, 'black', null)).toBe('drawn-card');
    expect(drawCard).toHaveBeenCalledWith({ state: true }, 'black', { seed: 'default' });

    access.addCardToHand({ state: true }, 'black', 'card_a', { insertIndex: 1 });
    expect(addToHand).toHaveBeenCalledWith({ state: true }, 'black', 'card_a', { insertIndex: 1 });

    access.removeHandCardAt({ state: true }, 'black', 0);
    expect(removeFromHand).toHaveBeenCalledWith({ state: true }, 'black', 0);

    expect(access.getHandCopyIdAt({}, 'black', 1)).toBe(11);
    expect(access.getHandCopyIds({}, 'black')).toEqual([11, 12]);
    expect(access.isCardCopyIdRevealedToViewer({}, 'white', 11)).toBe(true);
    expect(access.revealCurrentHandToViewer({}, 'white', 'black')).toEqual([11, 12]);
    expect(access.getCardDef('card_a')).toEqual({ id: 'card_a' });
    expect(access.getCardType('card_a')).toBe('TYPE_A');
    expect(access.getCardDisplayName('card_a')).toBe('Card A');
    expect(access.getCardCodeName('Card A')).toBe('card_a');
    expect(access.getCardCost('card_a')).toBe(7);
    expect(access.canUseCard({}, 'black', 'card_a', { skipCostAndTurnLimit: true })).toBe(true);
    expect(canUseCard).toHaveBeenCalledWith({}, 'black', 'card_a', { token: 'ctx' }, { skipCostAndTurnLimit: true });
    expect(access.ensureHandDestroyFlags({ state: true })).toEqual({ black: false, white: false });
    expect(access.destroyHandCard({}, 'black', 'card_a', { reason: 'test' })).toEqual({ applied: true });
    expect(destroyHandCard).toHaveBeenCalledWith({}, 'black', 'card_a', { reason: 'test' }, { token: 'ctx' });
    expect(access.getUsableCardIds({}, { board: [] }, 'black', { skipCostAndTurnLimit: true })).toEqual(['card_a']);
    expect(access.hasUsableCard({}, { board: [] }, 'black')).toBe(true);
    expect(getCardHandManagerContext).toHaveBeenCalled();
  });

  test('preserves existing missing-method errors', () => {
    const access = createCardHandAccess({
      getCardHandManagerContext: () => ({})
    });

    expect(() => access.commitDraw({}, 'black', null)).toThrow('[cards.js] CardStateManager.drawCard not available');
    expect(() => access.getCardType('card_a')).toThrow('[cards.js] CardHandManager.getCardType not available');
    expect(() => access.getUsableCardIds({}, {}, 'black')).toThrow('[cards.js] CardHandManager.getUsableCardIds not available');
  });
});
