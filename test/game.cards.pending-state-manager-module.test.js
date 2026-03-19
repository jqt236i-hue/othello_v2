const PendingStateManager = require('../game/logic/cards-internal/pending-state-manager');

describe('CardPendingStateManager', () => {
  test('requiresTargetSelection distinguishes pending selector cards', () => {
    expect(PendingStateManager.requiresTargetSelection('DESTROY_ONE_STONE')).toBe(true);
    expect(PendingStateManager.requiresTargetSelection('BOARD_EXPANSION_GOD')).toBe(true);
    expect(PendingStateManager.requiresTargetSelection('DOUBLE_CHAIN_WILL')).toBe(false);
    expect(PendingStateManager.requiresTargetSelection('')).toBe(false);
  });

  test('createPendingEffectState seeds selection metadata by card type', () => {
    expect(PendingStateManager.createPendingEffectState({
      cardType: 'SACRIFICE_WILL',
      cardId: 'sacrifice_01'
    })).toEqual(expect.objectContaining({
      type: 'SACRIFICE_WILL',
      cardId: 'sacrifice_01',
      stage: 'selectTarget',
      selectedCount: 0,
      maxSelections: 3
    }));

    expect(PendingStateManager.createPendingEffectState({
      cardType: 'BOARD_EXPANSION_GOD',
      cardId: 'expansion_god_01'
    })).toEqual(expect.objectContaining({
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      selectedCount: 0,
      maxSelections: 2,
      selectedTargets: []
    }));

    expect(PendingStateManager.createPendingEffectState({
      cardType: 'LAST_RESORT',
      cardId: 'last_resort_01',
      needsSelection: false
    })).toEqual(expect.objectContaining({
      type: 'LAST_RESORT',
      stage: null,
      placementsRemaining: 2
    }));
  });

  test('cancelPendingSelection refunds and restores the card for cancellable pending cards', () => {
    const cardState = {
      pendingEffectByPlayer: {
        black: { type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget' },
        white: null
      },
      hands: { black: [], white: [] },
      discard: ['destroy_01'],
      charge: { black: 0, white: 0 },
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      cardUseCountByPlayer: { black: 1, white: 0 }
    };

    const res = PendingStateManager.cancelPendingSelection(cardState, 'black', null, {
      helpers: {
        getCardDef: () => ({ id: 'destroy_01', cost: 4 }),
        addChargeValue: (state, playerKey, amount) => {
          state.charge[playerKey] += amount;
        }
      }
    });

    expect(res).toEqual({ canceled: true, cardId: 'destroy_01' });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.hands.black).toContain('destroy_01');
    expect(cardState.discard).not.toContain('destroy_01');
    expect(cardState.charge.black).toBe(4);
    expect(cardState.hasUsedCardThisTurnByPlayer.black).toBe(false);
    expect(cardState.cardUseCountByPlayer.black).toBe(0);
  });

  test('cancelPendingSelection finishes sacrifice without refund after a prior selection', () => {
    const cardState = {
      pendingEffectByPlayer: {
        black: { type: 'SACRIFICE_WILL', cardId: 'sacrifice_01', stage: 'selectTarget', selectedCount: 1 },
        white: null
      },
      hands: { black: [], white: [] },
      discard: ['sacrifice_01'],
      charge: { black: 5, white: 0 },
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      cardUseCountByPlayer: { black: 1, white: 0 }
    };

    const res = PendingStateManager.cancelPendingSelection(cardState, 'black', null, {
      helpers: {
        getCardDef: () => ({ id: 'sacrifice_01', cost: 5 }),
        addChargeValue: jest.fn()
      }
    });

    expect(res).toEqual({ canceled: true, cardId: 'sacrifice_01', finished: true });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.hands.black).toEqual([]);
    expect(cardState.discard).toEqual(['sacrifice_01']);
    expect(cardState.charge.black).toBe(5);
    expect(cardState.cardUseCountByPlayer.black).toBe(1);
  });
});
