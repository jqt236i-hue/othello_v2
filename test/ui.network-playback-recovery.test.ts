describe('NetworkPlaybackRecoveryController', () => {
  let controller: any;
  let stateObj: any;

  beforeEach(() => {
    jest.resetModules();
    stateObj = {
      pendingForceSyncPlaybackVersion: null,
      pendingForceSyncPlaybackSource: '',
      pendingForceSyncPlaybackSignature: ''
    };

    const { createNetworkPlaybackRecoveryController } = require('../ui/network/playback-recovery.js');
    controller = createNetworkPlaybackRecoveryController({
      getState: () => stateObj,
      cloneData: (value: any) => JSON.parse(JSON.stringify(value)),
      getCurrentSnapshotForPublish: () => ({
        gameState: { turnNumber: 2 },
        cardState: { turnIndex: 2, markers: [] }
      }),
      getTrackedPublishRequestedPlaybackEvents: (trackedPublish: any) => trackedPublish?.requestMeta?.playbackEvents || [],
      getSnapshotStateVersion: (snapshot: any) => snapshot?.stateVersion ?? null,
      getAppliedStateVersion: () => 5,
      shouldSkipForceSyncSnapshot: () => false
    });
  });

  test('builds matching signatures for equivalent snapshots ignoring presentation queues', () => {
    const signature = controller.computeForceSyncPlaybackRecoverySignature({
      stateVersion: 5,
      gameState: { turnNumber: 2 },
      cardState: {
        turnIndex: 2,
        markers: [],
        presentationEvents: [{ type: 'x' }],
        _presentationEventsPersist: [{ type: 'y' }]
      }
    });

    expect(signature).toContain('"turnNumber":2');
    expect(signature).not.toContain('presentationEvents');
    expect(signature).not.toContain('_presentationEventsPersist');
  });

  test('publish response shadow playback requires requested events and matching current signature', () => {
    const trackedPublish = {
      requestMeta: {
        playbackEvents: [{ type: 'flip' }]
      }
    };
    const shouldShadow = controller.shouldApplyPublishResponseAsShadowPlayback(
      trackedPublish,
      {
        gameState: { turnNumber: 2 },
        cardState: { turnIndex: 2, markers: [] }
      },
      [{ type: 'flip' }]
    );

    expect(shouldShadow).toBe(true);
  });

  test('remember and consume pending force sync recovery track matching version', () => {
    const remembered = controller.rememberPendingForceSyncPlaybackRecovery({
      stateVersion: 7,
      gameState: { turnNumber: 7 },
      cardState: { turnIndex: 7, markers: [] }
    }, {
      source: 'publish_response',
      force: true,
      playbackEvents: [],
      shadowPlaybackEvents: []
    });

    expect(remembered).toBe(true);
    expect(stateObj.pendingForceSyncPlaybackVersion).toBe(7);
    expect(controller.consumePendingForceSyncPlaybackRecovery(6)).toBe(false);
    expect(controller.consumePendingForceSyncPlaybackRecovery(7)).toBe(true);
    expect(stateObj.pendingForceSyncPlaybackVersion).toBeNull();
  });
});
