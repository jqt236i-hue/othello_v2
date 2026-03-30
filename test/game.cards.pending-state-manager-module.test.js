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
      placementsRemaining: 3
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

  test('exports shared pending selection contract helpers', () => {
    expect(PendingStateManager.resolvePendingSelectionContract('SELL_CARD_WILL')).toEqual(expect.objectContaining({
      kind: 'hand_overlay',
      turnOutcome: 'continue_turn',
      deferNetworkPublish: true
    }));
    expect(PendingStateManager.resolvePendingSelectionContract('CAPTURE_WILL')).toEqual(expect.objectContaining({
      kind: 'continue_turn',
      turnOutcome: 'continue_turn',
      deferNetworkPublish: true
    }));
    expect(PendingStateManager.shouldDeferNetworkPublishForPendingType('CAPTURE_WILL')).toBe(true);
    expect(PendingStateManager.shouldDeferNetworkPublishForPendingType('GUARD_WILL')).toBe(true);
    expect(PendingStateManager.shouldWaitForPlaybackIdleForPendingType('TEMPT_WILL')).toBe(true);
    expect(PendingStateManager.isSelectionOnlyEndTurnPendingType('TRAP_WILL')).toBe(true);
    expect(PendingStateManager.isSelectionOnlyEndTurnPendingType('GUARD_WILL')).toBe(false);
  });

  test('resolves shared pending selection dispatch keys for aliases and overlays', () => {
    expect(PendingStateManager.resolvePendingSelectionDispatchKey('GUARD_WILL')).toBe('guard');
    expect(PendingStateManager.resolvePendingSelectionDispatchKey('GUARDIAN_GOD')).toBe('guard');
    expect(PendingStateManager.resolvePendingSelectionDispatchKey('TELEPORT_WILL')).toBe('teleport');
    expect(PendingStateManager.resolvePendingSelectionDispatchKey('CELL_TELEPORT_WILL')).toBe('cell_teleport');
    expect(PendingStateManager.resolvePendingSelectionDispatchKey('BOARD_EXPANSION_GOD')).toBe('board_expansion');
    expect(PendingStateManager.resolvePendingSelectionDispatchKey('SELL_CARD_WILL')).toBe('sell_card');
    expect(PendingStateManager.resolvePendingSelectionDispatchKey('')).toBeNull();
  });

});
