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
});
