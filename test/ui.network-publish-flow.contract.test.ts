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

  test('accepted publish response with presentationFrames suppresses legacy playbackEvents', async () => {
    const publishFlowModule = require('../ui/network/publish-flow');
    const state = {
      roomId: 'ABC',
      seatKey: 'black',
      seatToken: 'seat-token',
      stateVersion: 1,
      publishChain: Promise.resolve()
    };
    const applySnapshotThroughCoordinator = jest.fn(() => true);
    const enqueuePresentationFramesFromPayload = jest.fn();
    const responsePayload = {
      ok: true,
      operationId: 'op_visual',
      actionType: 'place',
      stateVersion: 2,
      presentationCursor: { visualSeq: 1, stateVersion: 2 },
      snapshot: { stateVersion: 2 },
      playbackEvents: [{ type: 'legacy_flip' }],
      presentationFrames: [
        {
          visualSeq: 1,
          stateVersionFrom: 1,
          stateVersionTo: 2,
          playbackEvents: [{ type: 'strict_flip' }],
          snapshotAfter: { stateVersion: 2 }
        }
      ]
    };
    const controller = publishFlowModule.createNetworkPublishFlowController({
      getState: () => state,
      isActive: () => true,
      normalizePlayerKey: (value: any) => (value === 'white' ? 'white' : 'black'),
      createOperationId: () => 'op_visual',
      resolveNetworkPublishRequestModule: () => ({
        buildPublishRequest: () => ({
          commandPayload: { actor: 'black', params: {} },
          requestPayload: { actionType: 'place' },
          queuedActionType: 'place'
        })
      }),
      getCurrentPublishTurnIndex: () => 5,
      createTrackedPublish: () => ({ sequence: 1 }),
      publishRequestWithRetry: jest.fn(async () => ({
        ok: true,
        data: responsePayload
      })),
      applySnapshotThroughCoordinator,
      buildShadowAwarePlaybackApplyOptions: jest.fn((events: any[]) => ({
        playbackEvents: events,
        shadowPlaybackEvents: []
      })),
      getAppliedStateVersion: () => 1,
      getSnapshotStateVersion: (snapshot: any) => snapshot && snapshot.stateVersion,
      recordNetworkTelemetry: jest.fn(),
      emitPayloadEffectLogs: jest.fn(),
      showAutoPassNoticeFromPayload: jest.fn(),
      pruneTrackedPublishes: jest.fn(),
      enqueuePresentationFramesFromPayload
    });

    await expect(controller.publishSnapshot({ playerKey: 'black', actionType: 'place' }))
      .resolves.toEqual({
        ok: true,
        operationId: 'op_visual',
        stateVersion: 2,
        presentationCursor: { visualSeq: 1, stateVersion: 2 },
        visualSeq: 1
      });

    expect(applySnapshotThroughCoordinator).toHaveBeenCalledWith(
      { stateVersion: 2 },
      expect.objectContaining({
        applyOptions: expect.objectContaining({
          playbackEvents: [],
          presentationFrames: responsePayload.presentationFrames,
          presentationFrameSource: 'publish_response'
        })
      })
    );
    expect(enqueuePresentationFramesFromPayload).not.toHaveBeenCalled();
  });

  test('accepted ack-only publish response is tracked without applying a snapshot', async () => {
    const publishFlowModule = require('../ui/network/publish-flow');
    const state = {
      roomId: 'ABC',
      seatKey: 'black',
      seatToken: 'seat-token',
      stateVersion: 1,
      publishChain: Promise.resolve()
    };
    const applySnapshotThroughCoordinator = jest.fn(() => true);
    const recordNetworkTelemetry = jest.fn();
    const markTrackedPublishResponse = jest.fn();
    const controller = publishFlowModule.createNetworkPublishFlowController({
      getState: () => state,
      isActive: () => true,
      normalizePlayerKey: (value: any) => (value === 'white' ? 'white' : 'black'),
      createOperationId: () => 'op_ack_only',
      resolveNetworkPublishRequestModule: () => ({
        buildPublishRequest: () => ({
          commandPayload: { actor: 'black', params: {} },
          requestPayload: { actionType: 'place' },
          queuedActionType: 'place'
        })
      }),
      getCurrentPublishTurnIndex: () => 5,
      createTrackedPublish: () => ({ sequence: 1 }),
      publishRequestWithRetry: jest.fn(async () => ({
        ok: true,
        data: {
          ok: true,
          operationId: 'op_ack_only',
          stateVersion: 2,
          presentationCursor: { visualSeq: 7, stateVersion: 2 },
          publishMeta: {
            kind: 'accepted',
            operationId: 'op_ack_only',
            actionType: 'place',
            receivedBaseVersion: 1,
            authoritativeStateVersion: 2
          }
        }
      })),
      applySnapshotThroughCoordinator,
      getAppliedStateVersion: () => 1,
      getSnapshotStateVersion: (snapshot: any) => snapshot && snapshot.stateVersion,
      recordNetworkTelemetry,
      markTrackedPublishResponse,
      emitPayloadEffectLogs: jest.fn(),
      showAutoPassNoticeFromPayload: jest.fn(),
      pruneTrackedPublishes: jest.fn()
    });

    await expect(controller.publishSnapshot({ playerKey: 'black', actionType: 'place' }))
      .resolves.toEqual({
        ok: true,
        operationId: 'op_ack_only',
        stateVersion: 2,
        presentationCursor: { visualSeq: 7, stateVersion: 2 },
        visualSeq: 7
      });

    expect(applySnapshotThroughCoordinator).not.toHaveBeenCalled();
    expect(markTrackedPublishResponse).toHaveBeenCalledWith(expect.objectContaining({ sequence: 1 }), 2);
    expect(recordNetworkTelemetry).toHaveBeenCalledWith('publish_ack_without_snapshot', {
      operationId: 'op_ack_only',
      responseStateVersion: 2,
      visualSeq: 7
    });
  });
});
