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

  test('exposes the local feedback token to the UI observer without serializing it into the command payload', async () => {
    const publishFlowModule = require('../ui/network/publish-flow');
    const state = {
      roomId: 'ABC',
      seatKey: 'black',
      seatToken: 'seat-token',
      stateVersion: 1,
      publishChain: Promise.resolve()
    };
    const onPublishStarted = jest.fn();
    const publishRequestWithRetry = jest.fn(async () => ({
      ok: true,
      data: {
        ok: true,
        roomId: 'ABC',
        operationId: 'op-feedback',
        stateVersion: 2,
        snapshot: { stateVersion: 2 },
        playbackEvents: []
      }
    }));
    const controller = publishFlowModule.createNetworkPublishFlowController({
      getState: () => state,
      getSessionEpoch: () => 9,
      isActive: () => true,
      normalizePlayerKey: () => 'black',
      createOperationId: () => 'op-feedback',
      resolveNetworkPublishRequestModule: () => ({
        buildPublishRequest: () => ({
          commandPayload: { actor: 'black', params: { row: 2, col: 3 } },
          requestPayload: { actionType: 'place' },
          queuedActionType: 'place'
        })
      }),
      getCurrentPublishTurnIndex: () => 5,
      onPublishStarted,
      createTrackedPublish: () => ({ sequence: 1 }),
      publishRequestWithRetry,
      applySnapshotThroughCoordinator: jest.fn(() => true),
      buildShadowAwarePlaybackApplyOptions: jest.fn(() => ({ playbackEvents: [], shadowPlaybackEvents: [] })),
      getAppliedStateVersion: () => 1,
      getSnapshotStateVersion: (snapshot: any) => snapshot && snapshot.stateVersion,
      recordNetworkTelemetry: jest.fn(),
      emitPayloadEffectLogs: jest.fn(),
      showAutoPassNoticeFromPayload: jest.fn(),
      pruneTrackedPublishes: jest.fn()
    });

    await expect(controller.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      placementFeedbackToken: 'network-placement:1'
    })).resolves.toEqual({ ok: true });

    expect(onPublishStarted).toHaveBeenCalledWith(expect.objectContaining({
      placementFeedbackToken: 'network-placement:1',
      operationId: 'op-feedback',
      roomId: 'ABC',
      sessionEpoch: 9,
      actionType: 'place'
    }));
    expect(publishRequestWithRetry).toHaveBeenCalledWith(expect.not.objectContaining({
      placementFeedbackToken: expect.anything()
    }));
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
    const normalizeNetworkSnapshotEnvelope = jest.fn((input) => ({
      source: input.source,
      operationId: input.payload?.operationId ?? null,
      stateVersion: input.payload?.stateVersion ?? null,
      visualSeq: input.payload?.presentationCursor?.visualSeq ?? null,
      snapshot: input.payload?.snapshot ?? null,
      presentationFrames: input.payload?.presentationFrames ?? [],
      playbackEvents: input.payload?.playbackEvents ?? [],
      presentationCursor: input.payload?.presentationCursor ?? null,
      force: input.force === true,
      skipResultOverlay: input.skipResultOverlay === true,
      receivedAt: 1,
      trackedPublish: input.trackedPublish,
      applyOptions: input.applyOptions
    }));
    const submitNetworkSnapshotEnvelope = jest.fn(() => ({
      appliedSnapshot: true,
      enqueuedFrameCount: 1,
      requestedBoardRefresh: false
    }));
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
      enqueuePresentationFramesFromPayload,
      normalizeNetworkSnapshotEnvelope,
      submitNetworkSnapshotEnvelope
    });

    await expect(controller.publishSnapshot({ playerKey: 'black', actionType: 'place' }))
      .resolves.toEqual({
        ok: true,
        operationId: 'op_visual',
        stateVersion: 2,
        presentationCursor: { visualSeq: 1, stateVersion: 2 },
        visualSeq: 1
      });

    expect(normalizeNetworkSnapshotEnvelope).toHaveBeenCalledWith(expect.objectContaining({
      source: 'publish_response',
      payload: responsePayload,
      force: true,
      applyOptions: expect.objectContaining({
        playbackEvents: [],
        presentationFrames: responsePayload.presentationFrames,
        presentationFrameSource: 'publish_response'
      })
    }));
    expect(submitNetworkSnapshotEnvelope).toHaveBeenCalledWith(expect.objectContaining({
      source: 'publish_response',
      snapshot: { stateVersion: 2 },
      presentationFrames: responsePayload.presentationFrames,
      playbackEvents: responsePayload.playbackEvents
    }));
    expect(applySnapshotThroughCoordinator).not.toHaveBeenCalled();
    expect(normalizeNetworkSnapshotEnvelope.mock.calls[0][0]).toEqual(expect.objectContaining({
        applyOptions: expect.objectContaining({
          playbackEvents: [],
          presentationFrames: responsePayload.presentationFrames,
          presentationFrameSource: 'publish_response'
        })
    }));
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

  test('ignores a publish response that arrives after the network session changed', async () => {
    const publishFlowModule = require('../ui/network/publish-flow');
    const state = {
      active: true,
      roomId: 'ABC',
      seatKey: 'black',
      seatToken: 'seat-token-a',
      stateVersion: 1,
      publishChain: Promise.resolve()
    };
    let sessionEpoch = 1;
    let resolveRequest: any;
    const applyPayloadSessionState = jest.fn();
    const applySnapshotThroughCoordinator = jest.fn();
    const settleTrackedPublish = jest.fn();
    const recordNetworkTelemetry = jest.fn();
    const emitStatus = jest.fn();
    const controller = publishFlowModule.createNetworkPublishFlowController({
      getState: () => state,
      getSessionEpoch: () => sessionEpoch,
      isActive: () => state.active,
      normalizePlayerKey: (value: any) => (value === 'white' ? 'white' : 'black'),
      emitStatus,
      createOperationId: () => 'op_old_session',
      resolveNetworkPublishRequestModule: () => ({
        buildPublishRequest: () => ({
          commandPayload: { actor: 'black', params: {} },
          requestPayload: { actionType: 'place' },
          queuedActionType: 'place'
        })
      }),
      createTrackedPublish: () => ({ sequence: 1 }),
      settleTrackedPublish,
      publishRequestWithRetry: jest.fn(() => new Promise((resolve) => {
        resolveRequest = resolve;
      })),
      applyPayloadSessionState,
      applySnapshotThroughCoordinator,
      recordNetworkTelemetry,
      pruneTrackedPublishes: jest.fn()
    });

    const resultPromise = controller.publishSnapshot({
      playerKey: 'black',
      actionType: 'place'
    });
    await Promise.resolve();

    sessionEpoch += 1;
    state.roomId = 'XYZ';
    state.seatToken = 'seat-token-b';
    state.stateVersion = 20;
    resolveRequest({
      ok: true,
      data: {
        ok: true,
        roomId: 'ABC',
        stateVersion: 2,
        snapshot: { stateVersion: 2 }
      }
    });

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      reason: 'SESSION_CHANGED',
      stale: true
    });
    expect(state.stateVersion).toBe(20);
    expect(applyPayloadSessionState).not.toHaveBeenCalled();
    expect(applySnapshotThroughCoordinator).not.toHaveBeenCalled();
    expect(settleTrackedPublish).toHaveBeenCalled();
    expect(emitStatus).not.toHaveBeenCalled();
    expect(recordNetworkTelemetry).toHaveBeenCalledWith(
      'publish_response_stale_session_ignored',
      expect.objectContaining({
        operationId: 'op_old_session',
        stage: 'initial_response',
        requestRoomId: 'ABC',
        currentRoomId: 'XYZ'
      })
    );
  });
});
