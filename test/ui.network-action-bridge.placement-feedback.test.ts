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

  test('blocks a later network board publish after the card runtime integrity latch is set', () => {
    const integrity = require('../ui/card-runtime-integrity');
    const { createCardRuntimeUnavailableError } = require('../game/logic/card-runtime-errors');
    const { createNetworkActionBridge } = require('../ui/network/action-bridge');
    const originalRunTurnWithAdapter = jest.fn(() => ({ ok: true }));
    const root: any = {
      TurnPipelineUIAdapter: { runTurnWithAdapter: originalRunTurnWithAdapter }
    };
    const queueCommandPublish = jest.fn(() => Promise.resolve({ ok: true }));
    const beginPlacementFeedback = jest.fn(() => 'network-placement:blocked');
    const bridge = createNetworkActionBridge({
      root,
      isActive: () => true,
      queueCommandPublish,
      beginPlacementFeedback
    });

    bridge.install();
    integrity.latchCardRuntimeIntegrityFailure(
      createCardRuntimeUnavailableError('targeting.targetResolver', 'targeting'),
      { source: 'network-action-bridge-test' }
    );
    const result = root.TurnPipelineUIAdapter.runTurnWithAdapter(
      {},
      {},
      'black',
      { type: 'place', row: 2, col: 3 },
      {}
    );

    expect(result).toEqual({
      ok: false,
      rejectedReason: 'RUNTIME_UNAVAILABLE',
      events: [],
      playbackEvents: []
    });
    expect(queueCommandPublish).not.toHaveBeenCalled();
    expect(beginPlacementFeedback).not.toHaveBeenCalled();
    expect(originalRunTurnWithAdapter).not.toHaveBeenCalled();
  });

  test.each(['resolve', 'reject'])(
    'silently clears placement feedback when integrity latches before publish %s',
    async (mode) => {
      const integrity = require('../ui/card-runtime-integrity');
      const { createCardRuntimeUnavailableError } = require('../game/logic/card-runtime-errors');
      const { createNetworkActionBridge } = require('../ui/network/action-bridge');
      let resolvePublish: (value: any) => void = () => undefined;
      let rejectPublish: (error: any) => void = () => undefined;
      const publishPromise = new Promise((resolve, reject) => {
        resolvePublish = resolve;
        rejectPublish = reject;
      });
      const root: any = {
        TurnPipelineUIAdapter: { runTurnWithAdapter: jest.fn(() => ({ ok: true })) }
      };
      const settlePlacementFeedback = jest.fn();
      const cancelPlacementFeedback = jest.fn();
      const bridge = createNetworkActionBridge({
        root,
        isActive: () => true,
        queueCommandPublish: () => publishPromise,
        beginPlacementFeedback: () => 'network-placement:race',
        settlePlacementFeedback,
        cancelPlacementFeedback
      });
      bridge.install();

      root.TurnPipelineUIAdapter.runTurnWithAdapter({}, {}, 'black', { type: 'place', row: 1, col: 2 }, {});
      integrity.latchCardRuntimeIntegrityFailure(
        createCardRuntimeUnavailableError('placement.feedback', 'presentation'),
        { source: 'placement-feedback-race' }
      );
      if (mode === 'resolve') resolvePublish({ ok: true });
      else rejectPublish(new Error('socket closed'));
      try { await publishPromise; } catch (_error) { /* expected rejection lane */ }
      await Promise.resolve();

      expect(settlePlacementFeedback).not.toHaveBeenCalled();
      expect(cancelPlacementFeedback).toHaveBeenCalledWith('network-placement:race');
    }
  );

  test('silently clears placement feedback for a raw runtime-unavailable publish result', async () => {
    const { createNetworkActionBridge } = require('../ui/network/action-bridge');
    const root: any = {
      TurnPipelineUIAdapter: { runTurnWithAdapter: jest.fn(() => ({ ok: true })) }
    };
    const settlePlacementFeedback = jest.fn();
    const cancelPlacementFeedback = jest.fn();
    const bridge = createNetworkActionBridge({
      root,
      isActive: () => true,
      queueCommandPublish: () => Promise.resolve({ ok: false, reason: 'RUNTIME_UNAVAILABLE' }),
      beginPlacementFeedback: () => 'network-placement:raw-runtime',
      settlePlacementFeedback,
      cancelPlacementFeedback
    });
    bridge.install();

    const result = root.TurnPipelineUIAdapter.runTurnWithAdapter(
      {}, {}, 'black', { type: 'place', row: 1, col: 2 }, {}
    );
    await result.publishPromise;
    await Promise.resolve();

    expect(settlePlacementFeedback).not.toHaveBeenCalled();
    expect(cancelPlacementFeedback).toHaveBeenCalledWith('network-placement:raw-runtime');
  });
});
