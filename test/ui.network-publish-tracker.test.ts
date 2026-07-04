const { createNetworkPublishTracker } = require('../ui/network/publish-tracker');

describe('NetworkPublishTracker', () => {
  test('returns the newest pending projected snapshot hash while honoring ignoreSequence', () => {
    const state = {};
    const tracker = createNetworkPublishTracker({
      getState: () => state,
      maxOperations: 10,
      retentionMs: 1000
    });

    const first = tracker.createTrackedPublish('op-1', {
      snapshotProjectedHash: 'hash-1'
    });
    tracker.markTrackedPublishInFlight(first);
    const second = tracker.createTrackedPublish('op-2', {
      snapshotProjectedHash: 'hash-2'
    });
    tracker.markTrackedPublishInFlight(second);
    const third = tracker.createTrackedPublish('op-3', {
      snapshotProjectedHash: 'hash-3'
    });
    tracker.settleTrackedPublish(third);

    expect(tracker.getPendingLocalPublishProjectedSnapshotHash()).toBe('hash-2');
    expect(tracker.getPendingLocalPublishProjectedSnapshotHash({ ignoreSequence: second.sequence })).toBe('hash-1');
  });
});
