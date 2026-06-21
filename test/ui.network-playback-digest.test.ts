const PlaybackDigest = require('../shared/playback-digest');

describe('network playback digest', () => {
  let controller: any;

  beforeEach(() => {
    jest.resetModules();
    const { createNetworkPlaybackRecoveryController } = require('../ui/network/playback-recovery.ts');
    controller = createNetworkPlaybackRecoveryController({
      getState: () => ({
        pendingForceSyncPlaybackVersion: null,
        pendingForceSyncPlaybackSource: '',
        pendingForceSyncPlaybackSignature: ''
      }),
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

  test('digest ignores harmless object property order', () => {
    const first = [{
      type: 'destroy',
      phase: 2,
      actionId: 'bomb-A',
      effectBlockId: 'bomb-A:explode',
      sequenceIndex: 10,
      targets: [{ r: 1, col: 2 }]
    }];
    const second = [{
      targets: [{ col: 2, r: 1 }],
      sequenceIndex: 10,
      effectBlockId: 'bomb-A:explode',
      actionId: 'bomb-A',
      phase: 2,
      type: 'destroy'
    }];

    expect(PlaybackDigest.computePlaybackDigest(first)).toBe(PlaybackDigest.computePlaybackDigest(second));
  });

  test('digest changes when semantic order or phase boundaries change', () => {
    const sequential = [
      { type: 'destroy', phase: 1, actionId: 'bomb-A', row: 1, col: 1 },
      { type: 'destroy', phase: 2, actionId: 'bomb-B', row: 2, col: 2 }
    ];
    const reversed = [
      { type: 'destroy', phase: 2, actionId: 'bomb-B', row: 2, col: 2 },
      { type: 'destroy', phase: 1, actionId: 'bomb-A', row: 1, col: 1 }
    ];
    const mergedPhase = [
      { type: 'destroy', phase: 1, actionId: 'bomb-A', row: 1, col: 1 },
      { type: 'destroy', phase: 1, actionId: 'bomb-B', row: 2, col: 2 }
    ];

    expect(PlaybackDigest.computePlaybackDigest(sequential)).not.toBe(PlaybackDigest.computePlaybackDigest(reversed));
    expect(PlaybackDigest.computePlaybackDigest(sequential)).not.toBe(PlaybackDigest.computePlaybackDigest(mergedPhase));
  });

  test('self publish shadow playback requires digest agreement', () => {
    const localPlaybackEvents = [
      { type: 'destroy', phase: 1, actionId: 'local-A', targets: [{ r: 1, col: 1 }] },
      { type: 'destroy', phase: 2, actionId: 'local-B', targets: [{ r: 2, col: 2 }] }
    ];
    const trackedPublish = {
      requestMeta: {
        playbackEvents: localPlaybackEvents
      }
    };

    const matchingDigest = controller.computePlaybackDigest(localPlaybackEvents);
    expect(controller.shouldApplyPublishResponseAsShadowPlayback(
      trackedPublish,
      { gameState: { turnNumber: 2 }, cardState: { turnIndex: 2, markers: [] } },
      localPlaybackEvents,
      matchingDigest
    )).toBe(true);

    expect(controller.shouldApplyPublishResponseAsShadowPlayback(
      trackedPublish,
      { gameState: { turnNumber: 2 }, cardState: { turnIndex: 2, markers: [] } },
      localPlaybackEvents
    )).toBe(true);

    expect(controller.shouldApplyPublishResponseAsShadowPlayback(
      trackedPublish,
      { gameState: { turnNumber: 2 }, cardState: { turnIndex: 2, markers: [] } },
      [
        { type: 'destroy', phase: 99, actionId: 'server-different-shape', targets: [{ r: 9, col: 9 }] }
      ],
      matchingDigest
    )).toBe(false);

    expect(controller.shouldApplyPublishResponseAsShadowPlayback(
      trackedPublish,
      { gameState: { turnNumber: 2 }, cardState: { turnIndex: 2, markers: [] } },
      [
        { type: 'destroy', phase: 1, actionId: 'server-B', targets: [{ r: 2, col: 2 }] },
        { type: 'destroy', phase: 2, actionId: 'server-A', targets: [{ r: 1, col: 1 }] }
      ]
    )).toBe(false);
  });
});
