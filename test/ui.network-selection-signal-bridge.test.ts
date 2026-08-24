describe('network selection signal bridge', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('routes accepted publish settlement through the injected exact visual waiter', async () => {
    const exactWait = jest.fn(async (publishResult) => ({
      ok: true,
      visualSeq: publishResult.presentationCursor.visualSeq
    }));
    const client = {
      isActive: jest.fn(() => true),
      isSpectator: jest.fn(() => false),
      publishSnapshot: jest.fn()
    };
    const { createNetworkSelectionSignalBridge } = require('../ui/network/selection-signal-bridge');
    const bridge = createNetworkSelectionSignalBridge({
      root: {},
      client,
      waitForAuthoritativeVisualSettlement: exactWait
    });
    const publishResult = {
      ok: true,
      presentationCursor: { visualSeq: 6, stateVersion: 12 }
    };

    await expect(bridge.waitForAuthoritativeVisualSettlement(publishResult)).resolves.toEqual({
      ok: true,
      visualSeq: 6
    });
    expect(exactWait).toHaveBeenCalledWith(publishResult);
  });

  test('reports no exact waiter instead of pretending visual settlement succeeded', () => {
    const { createNetworkSelectionSignalBridge } = require('../ui/network/selection-signal-bridge');
    const bridge = createNetworkSelectionSignalBridge({
      root: {},
      client: {}
    });

    expect(bridge.waitForAuthoritativeVisualSettlement({
      ok: true,
      presentationCursor: { visualSeq: 7, stateVersion: 13 }
    })).toBeUndefined();
  });

  test.each([
    ['network-only', { actionType: 'pending_select', action: { type: 'pending_select' } }],
    ['deferred multi-stage', {
      actionType: 'pending_select',
      deferPublish: true,
      action: { type: 'pending_select', stage: 'selectSecondTarget', selectedTargets: [{ row: 2, col: 3 }] }
    }]
  ])('installed production bridge blocks %s pending publish after integrity failure', async (_label, meta) => {
    const { createCardRuntimeUnavailableError } = require('../game/logic/card-runtime-errors');
    const integrity = require('../ui/card-runtime-integrity');
    const selectionFlow = require('../game/card-effects/selection-flow');
    const { installNetworkSelectionSignalBridge } = require('../ui/network/selection-signal-bridge');
    const client = {
      isActive: jest.fn(() => true),
      isSpectator: jest.fn(() => false),
      publishSnapshot: jest.fn(() => Promise.resolve({ ok: true }))
    };

    expect(installNetworkSelectionSignalBridge({ selectionFlow, root: {}, client })).toBe(true);
    expect(integrity.latchCardRuntimeIntegrityFailure(
      createCardRuntimeUnavailableError('pending.effectResolver', 'pending'),
      { source: 'selection-bridge-test' }
    )).toBe(true);

    await expect(selectionFlow.publishPendingSelectionSnapshot(meta)).resolves.toEqual({
      ok: false,
      reason: 'RUNTIME_UNAVAILABLE'
    });
    expect(client.publishSnapshot).not.toHaveBeenCalled();
  });
});
