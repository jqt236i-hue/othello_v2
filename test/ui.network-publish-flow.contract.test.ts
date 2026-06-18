describe('NetworkPublishFlowController contract', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('missing state collapses to PUBLISH_ERROR and emits a failure status', async () => {
    const publishFlowModule = require('../ui/network/publish-flow');
    const emitStatus = jest.fn();
    const controller = publishFlowModule.createNetworkPublishFlowController({
      getState: () => null,
      emitStatus
    });

    const result = await controller.publishSnapshot({});

    expect(result).toEqual({ ok: false, reason: 'PUBLISH_ERROR' });
    expect(emitStatus).toHaveBeenCalledWith(expect.stringContaining('ネット対戦: 通信失敗'), true);
  });

  test('accepted auto pass publish response shows auto pass notice after snapshot apply', async () => {
    const publishFlowModule = require('../ui/network/publish-flow');
    const state = {
      roomId: 'ABC',
      seatKey: 'black',
      seatToken: 'seat-token',
      stateVersion: 1,
      publishChain: Promise.resolve()
    };
    const showAutoPassNoticeFromPayload = jest.fn();
    const controller = publishFlowModule.createNetworkPublishFlowController({
      getState: () => state,
      isActive: () => true,
      normalizePlayerKey: (value: any) => (value === 'white' ? 'white' : 'black'),
      createOperationId: () => 'op_auto_pass',
      resolveNetworkPublishRequestModule: () => ({
        buildPublishRequest: () => ({
          commandPayload: { actor: 'black', params: {} },
          requestPayload: { actionType: 'pass' },
          queuedActionType: 'pass'
        })
      }),
      getCurrentPublishTurnIndex: () => 5,
      createTrackedPublish: () => ({ sequence: 1 }),
      publishRequestWithRetry: jest.fn(async () => ({
        ok: true,
        data: {
          ok: true,
          operationId: 'op_auto_pass',
          actionType: 'pass',
          stateVersion: 2,
          snapshot: { stateVersion: 2 },
          playbackEvents: [],
          autoPassNotice: {
            playerKey: 'black',
            reason: 'no_legal_moves_or_usable_cards'
          }
        }
      })),
      applySnapshotThroughCoordinator: jest.fn(() => true),
      buildShadowAwarePlaybackApplyOptions: jest.fn(() => ({
        playbackEvents: [],
        shadowPlaybackEvents: []
      })),
      getAppliedStateVersion: () => 1,
      getSnapshotStateVersion: (snapshot: any) => snapshot && snapshot.stateVersion,
      recordNetworkTelemetry: jest.fn(),
      emitPayloadEffectLogs: jest.fn(),
      showAutoPassNoticeFromPayload,
      pruneTrackedPublishes: jest.fn()
    });

    await expect(controller.publishSnapshot({ playerKey: 'black', actionType: 'pass' }))
      .resolves.toEqual({ ok: true });
    expect(showAutoPassNoticeFromPayload).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'pass',
      autoPassNotice: {
        playerKey: 'black',
        reason: 'no_legal_moves_or_usable_cards'
      }
    }));
  });
});
