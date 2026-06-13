import * as AdapterModule from '../ui/network/game-contract-adapter';

describe('NetworkGameContractAdapter', () => {
  test('resolves card type through injected CardLogic', () => {
    const adapter = AdapterModule.createNetworkGameContractAdapter({
      cardLogicModule: {
        getCardDef: jest.fn((cardId: string) => (
          cardId === 'guard_01' ? { id: 'guard_01', type: 'GUARD_WILL' } : null
        ))
      },
      pendingCoordinatorModule: null,
      pendingSelectionContractModule: null
    });

    expect(adapter.resolveCardTypeForId('guard_01')).toBe('GUARD_WILL');
    expect(adapter.resolveCardTypeForId('missing')).toBeNull();
  });

  test('delegates pending contract queries to PendingCoordinator first', () => {
    const pendingCoordinator = {
      getPendingSelectionContract: jest.fn(() => ({ deferNetworkPublish: true })),
      shouldDeferNetworkPublishForPendingType: jest.fn(() => true),
      getPendingEffectType: jest.fn(() => 'GUARD_WILL'),
      syncPendingSelectionActionCache: jest.fn(() => ({ cleared: ['white'], retained: ['black'] })),
      applyPendingSelectionCardContext: jest.fn((params: any) => params)
    };
    const adapter = AdapterModule.createNetworkGameContractAdapter({
      cardLogicModule: null,
      pendingCoordinatorModule: pendingCoordinator,
      pendingSelectionContractModule: null
    });

    expect(adapter.getPendingSelectionContract('GUARD_WILL')).toEqual({ deferNetworkPublish: true });
    expect(adapter.shouldDeferNetworkPublishForPendingType('GUARD_WILL')).toBe(true);
    expect(adapter.getPendingEffectType({ pendingEffectByPlayer: { black: { type: 'GUARD_WILL' } } }, 'black')).toBe('GUARD_WILL');
    expect(adapter.syncPendingSelectionActionCache({ black: null })).toEqual({ cleared: ['white'], retained: ['black'] });
    expect(adapter.applyPendingSelectionCardContext({ pendingSelectionState: { type: 'GUARD_WILL' } }, 'black')).toEqual({
      pendingSelectionState: { type: 'GUARD_WILL' }
    });
  });

  test('fails closed when dependencies are absent', () => {
    const adapter = AdapterModule.createNetworkGameContractAdapter({
      cardLogicModule: null,
      pendingCoordinatorModule: null,
      pendingSelectionContractModule: null
    });

    expect(adapter.resolveCardTypeForId('guard_01')).toBeNull();
    expect(adapter.getPendingSelectionContract('GUARD_WILL')).toBeNull();
    expect(adapter.shouldDeferNetworkPublishForPendingType('GUARD_WILL')).toBe(false);
    expect(adapter.getPendingEffectType({}, 'black')).toBeNull();
    expect(adapter.syncPendingSelectionActionCache({ black: null })).toEqual({ cleared: [], retained: [] });
  });
});
