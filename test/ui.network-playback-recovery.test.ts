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

    const { createNetworkPlaybackRecoveryController } = require('../ui/network/playback-recovery.ts');
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
        playbackEvents: [{ type: 'flip', phase: 1, targets: [{ r: 1, col: 1 }] }]
      }
    };
    const shouldShadow = controller.shouldApplyPublishResponseAsShadowPlayback(
      trackedPublish,
      {
        gameState: { turnNumber: 2 },
        cardState: { turnIndex: 2, markers: [] }
      },
      [{ type: 'flip', phase: 1, targets: [{ r: 1, col: 1 }] }]
    );

    expect(shouldShadow).toBe(true);
  });

  test('publish response shadow playback accepts matching authoritative events and digest', () => {
    const requestedPlaybackEvents = [{ type: 'flip', phase: 1, targets: [{ r: 1, col: 1 }] }];
    const trackedPublish = {
      requestMeta: {
        playbackEvents: requestedPlaybackEvents
      }
    };
    const authoritativeDigest = controller.computePlaybackDigest(requestedPlaybackEvents);
    const shouldShadow = controller.shouldApplyPublishResponseAsShadowPlayback(
      trackedPublish,
      {
        gameState: { turnNumber: 2 },
        cardState: { turnIndex: 2, markers: [] }
      },
      [{ type: 'flip', phase: 1, targets: [{ r: 1, col: 1 }] }],
      authoritativeDigest
    );

    expect(shouldShadow).toBe(true);
  });

  test('publish response shadow playback rejects a digest that disagrees with authoritative events', () => {
    const requestedPlaybackEvents = [{ type: 'flip', phase: 1, targets: [{ r: 1, col: 1 }] }];
    const trackedPublish = {
      requestMeta: {
        playbackEvents: requestedPlaybackEvents
      }
    };
    const localDigest = controller.computePlaybackDigest(requestedPlaybackEvents);
    const shouldShadow = controller.shouldApplyPublishResponseAsShadowPlayback(
      trackedPublish,
      {
        gameState: { turnNumber: 2 },
        cardState: { turnIndex: 2, markers: [] }
      },
      [{ type: 'flip', phase: 9, targets: [{ r: 9, col: 9 }] }],
      localDigest
    );

    expect(shouldShadow).toBe(false);
  });

  test('publish response shadow playback rejects matching snapshot with different playback digest', () => {
    const trackedPublish = {
      requestMeta: {
        playbackEvents: [
          { type: 'destroy', phase: 1, actionId: 'a', targets: [{ r: 1, col: 1 }] },
          { type: 'destroy', phase: 2, actionId: 'b', targets: [{ r: 2, col: 2 }] }
        ]
      }
    };
    const shouldShadow = controller.shouldApplyPublishResponseAsShadowPlayback(
      trackedPublish,
      {
        gameState: { turnNumber: 2 },
        cardState: { turnIndex: 2, markers: [] }
      },
      [
        { type: 'destroy', phase: 1, actionId: 'b', targets: [{ r: 2, col: 2 }] },
        { type: 'destroy', phase: 2, actionId: 'a', targets: [{ r: 1, col: 1 }] }
      ]
    );

    expect(shouldShadow).toBe(false);
  });

  test('stream shadow playback rejects different authoritative playback digest', () => {
    const trackedPublish = {
      requestMeta: {
        playbackEvents: [{ type: 'destroy', phase: 1, actionId: 'local-a', targets: [{ r: 1, col: 1 }] }]
      }
    };

    expect(controller.shouldApplyStreamSnapshotAsShadowPlayback(
      trackedPublish,
      [{ type: 'destroy', phase: 1, actionId: 'server-b', targets: [{ r: 1, col: 1 }] }]
    )).toBe(false);
  });

  test('stream shadow playback rejects a mismatched server-provided digest', () => {
    const trackedPublish = {
      requestMeta: {
        playbackEvents: [{ type: 'destroy', phase: 1, actionId: 'local-a', targets: [{ r: 1, col: 1 }] }]
      }
    };

    expect(controller.shouldApplyStreamSnapshotAsShadowPlayback(
      trackedPublish,
      [{ type: 'destroy', phase: 1, actionId: 'local-a', targets: [{ r: 1, col: 1 }] }],
      'fnv1a32:different_server_digest'
    )).toBe(false);
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
