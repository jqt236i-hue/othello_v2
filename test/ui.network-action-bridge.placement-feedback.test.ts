describe('NetworkActionBridge placement feedback', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('starts feedback before publishing a placement and settles it from the publish result', async () => {
    const { createNetworkActionBridge } = require('../ui/network/action-bridge');
    const root: any = {
      TurnPipelineUIAdapter: {
        runTurnWithAdapter: jest.fn(() => ({ ok: true }))
      }
    };
    const queueCommandPublish = jest.fn(() => Promise.resolve({ ok: true, operationId: 'op-place' }));
    const beginPlacementFeedback = jest.fn(() => 'network-placement:1');
    const settlePlacementFeedback = jest.fn();
    const bridge = createNetworkActionBridge({
      root,
      isActive: () => true,
      queueCommandPublish,
      beginPlacementFeedback,
      settlePlacementFeedback
    });

    expect(bridge.install()).toBe(true);
    const action = { type: 'place', row: 2, col: 3 };
    const result = root.TurnPipelineUIAdapter.runTurnWithAdapter({}, {}, 'black', action, {});

    expect(result).toMatchObject({ ok: true, skippedLocalExecution: true });
    expect(beginPlacementFeedback).toHaveBeenCalledWith(action, 'black');
    expect(queueCommandPublish).toHaveBeenCalledWith('black', action, {
      actionType: 'place',
      placementFeedbackToken: 'network-placement:1'
    });
    await expect(result.publishPromise).resolves.toEqual({ ok: true, operationId: 'op-place' });
    await Promise.resolve();
    expect(settlePlacementFeedback).toHaveBeenCalledWith('network-placement:1', {
      ok: true,
      operationId: 'op-place'
    });
  });

  test('does not show the placement feedback for a pending card target selection', () => {
    const { createNetworkActionBridge } = require('../ui/network/action-bridge');
    const root: any = {
      TurnPipelineUIAdapter: {
        runTurnWithAdapter: jest.fn(() => ({ ok: true }))
      }
    };
    const queueCommandPublish = jest.fn(() => Promise.resolve({ ok: true }));
    const beginPlacementFeedback = jest.fn(() => 'network-placement:1');
    const bridge = createNetworkActionBridge({
      root,
      isActive: () => true,
      queueCommandPublish,
      beginPlacementFeedback,
      getPendingEffectType: () => 'FREE_PLACEMENT'
    });

    bridge.install();
    const action = { type: 'place', row: 2, col: 3 };
    root.TurnPipelineUIAdapter.runTurnWithAdapter({}, {}, 'black', action, {});

    expect(beginPlacementFeedback).not.toHaveBeenCalled();
    expect(queueCommandPublish).toHaveBeenCalledWith('black', action, {
      actionType: 'place',
      placementFeedbackToken: null
    });
  });
});
