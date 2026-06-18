describe('NetworkStreamSnapshotController', () => {
  let controller: any;
  let stateObj: any;
  let calls: any;

  beforeEach(() => {
    jest.resetModules();
    stateObj = {
      appliedStateVersion: null,
      pendingForceSyncPlaybackSource: 'state_sync'
    };
    calls = {
      applyPayloadSessionState: jest.fn(),
      getSnapshotStateVersion: jest.fn((snapshot: any) => snapshot?.stateVersion ?? null),
      findTrackedPublish: jest.fn(() => ({ requestMeta: { playbackEvents: [{ type: 'x' }] } })),
      isTerminalSnapshotForResult: jest.fn(() => false),
      shouldApplyStreamSnapshotAsShadowPlayback: jest.fn(() => true),
      buildShadowAwarePlaybackApplyOptions: jest.fn((_events: any, shadow: any) => ({
        playbackEvents: shadow ? [] : [{ type: 'visible' }],
        shadowPlaybackEvents: shadow ? [{ type: 'shadow' }] : []
      })),
      applySnapshotThroughCoordinator: jest.fn(() => true),
      shouldRecoverForceSyncedStreamPlayback: jest.fn(() => false),
      applySnapshot: jest.fn(() => false),
      markTrackedPublishSnapshotApplied: jest.fn(),
      recordNetworkTelemetry: jest.fn(),
      consumePendingForceSyncPlaybackRecovery: jest.fn(),
      markTrackedPublishResultPresented: jest.fn(),
      emitPayloadEffectLogs: jest.fn(() => 0),
      emitSnapshotCommentary: jest.fn(),
      showAutoPassNoticeFromPayload: jest.fn(),
      markTrackedPublishSelfSnapshot: jest.fn(),
      handleTimeoutPassPayload: jest.fn(),
      enqueuePresentationFramesFromPayload: jest.fn(),
      pruneTrackedPublishes: jest.fn()
    };

    const { createNetworkStreamSnapshotController } = require('../ui/network/stream-snapshot.js');
    controller = createNetworkStreamSnapshotController({
      getState: () => stateObj,
      ...calls
    });
  });

  test('applies self stream snapshot and emits commentary when no effect logs were emitted', () => {
    controller.handleStreamSnapshotPayload({
      ok: true,
      operationId: 'op1',
      snapshot: { stateVersion: 12 },
      playbackEvents: [{ type: 'flip' }]
    });

    expect(calls.applyPayloadSessionState).toHaveBeenCalled();
    expect(calls.applySnapshotThroughCoordinator).toHaveBeenCalledWith(
      { stateVersion: 12 },
      expect.objectContaining({
        source: 'stream',
        applyOptions: expect.objectContaining({
          force: false,
          skipResultOverlay: true,
          playbackEvents: [],
          shadowPlaybackEvents: [{ type: 'shadow' }]
        })
      })
    );
    expect(calls.recordNetworkTelemetry).toHaveBeenCalledWith(
      'stream_self_snapshot_shadow_playback',
      expect.objectContaining({ operationId: 'op1', snapshotVersion: 12 })
    );
    expect(calls.emitSnapshotCommentary).toHaveBeenCalledWith(
      expect.any(Object),
      { stateVersion: 12 },
      true,
      [{ type: 'flip' }]
    );
    expect(calls.markTrackedPublishSelfSnapshot).toHaveBeenCalled();
    expect(calls.pruneTrackedPublishes).toHaveBeenCalled();
  });

  test('force recovery updates applied version and marks recovery telemetry', () => {
    calls.findTrackedPublish.mockReturnValue(null);
    calls.applySnapshotThroughCoordinator.mockReturnValue(false);
    calls.shouldRecoverForceSyncedStreamPlayback.mockReturnValue(true);
    calls.applySnapshot.mockReturnValue(true);

    controller.handleStreamSnapshotPayload({
      ok: true,
      snapshot: { stateVersion: 9 },
      playbackEvents: [{ type: 'destroy' }]
    });

    expect(stateObj.appliedStateVersion).toBe(9);
    expect(calls.recordNetworkTelemetry).toHaveBeenCalledWith(
      'stream_playback_recovered_after_force_sync',
      expect.objectContaining({ snapshotVersion: 9, playbackEventCount: 1, recoverySource: 'state_sync' })
    );
  });

  test('shows auto pass notice after applying an auto no-action pass snapshot', () => {
    calls.findTrackedPublish.mockReturnValue(null);

    controller.handleStreamSnapshotPayload({
      ok: true,
      operationId: 'op_auto_pass',
      playerKey: 'black',
      actionType: 'pass',
      autoPassNotice: {
        playerKey: 'black',
        reason: 'no_legal_moves_or_usable_cards'
      },
      snapshot: { stateVersion: 14 },
      playbackEvents: []
    });

    expect(calls.applySnapshotThroughCoordinator).toHaveBeenCalled();
    expect(calls.showAutoPassNoticeFromPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'pass',
        autoPassNotice: {
          playerKey: 'black',
          reason: 'no_legal_moves_or_usable_cards'
        }
      })
    );
  });

  test('routes presentationFrames through the visual timeline and suppresses legacy playbackEvents', () => {
    calls.findTrackedPublish.mockReturnValue(null);
    calls.shouldApplyStreamSnapshotAsShadowPlayback.mockReturnValue(false);
    calls.buildShadowAwarePlaybackApplyOptions.mockImplementation((events: any) => ({
      playbackEvents: events,
      shadowPlaybackEvents: []
    }));

    const payload = {
      ok: true,
      operationId: 'op_visual_1',
      snapshot: { stateVersion: 15 },
      playbackEvents: [{ type: 'legacy_flip' }],
      presentationFrames: [
        {
          visualSeq: 1,
          stateVersionFrom: 14,
          stateVersionTo: 15,
          playbackEvents: [{ type: 'strict_flip' }],
          snapshotAfter: { stateVersion: 15 }
        }
      ]
    };

    controller.handleStreamSnapshotPayload(payload);

    expect(calls.applySnapshotThroughCoordinator).toHaveBeenCalledWith(
      { stateVersion: 15 },
      expect.objectContaining({
        applyOptions: expect.objectContaining({
          playbackEvents: []
        })
      })
    );
    expect(calls.enqueuePresentationFramesFromPayload).toHaveBeenCalledWith(payload, { source: 'stream' });
  });

  test('self reset_game stream snapshot does not skip result overlay sync', () => {
    calls.shouldApplyStreamSnapshotAsShadowPlayback.mockReturnValue(false);

    controller.handleStreamSnapshotPayload({
      ok: true,
      operationId: 'op_rematch',
      actionType: 'reset_game',
      snapshot: {
        stateVersion: 22,
        gameState: {
          currentPlayer: 1,
          turnNumber: 0,
          consecutivePasses: 0
        }
      },
      playbackEvents: []
    });

    expect(calls.applySnapshotThroughCoordinator).toHaveBeenCalledWith(
      expect.objectContaining({ stateVersion: 22 }),
      expect.objectContaining({
        source: 'stream',
        applyOptions: expect.objectContaining({
          force: false,
          skipResultOverlay: false
        })
      })
    );
  });
});
