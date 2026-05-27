const { createNetworkPublishRejectionController } = require('../ui/network/publish-rejection');

function createController(overrides = {}) {
  const state = { stateVersion: 7 };
  const calls = {
    hasNewerQueuedPublish: jest.fn(() => false),
    getCurrentPublishTurnIndex: jest.fn(() => 12),
    getSnapshotStateVersion: jest.fn((snapshot) => snapshot && Number.isFinite(Number(snapshot.stateVersion)) ? Number(snapshot.stateVersion) : null),
    shouldSkipForceSyncSnapshot: jest.fn(() => false),
    ...overrides
  };
  const controller = createNetworkPublishRejectionController({
    getState: () => state,
    ...calls
  });
  return { controller, state, calls };
}

describe('NetworkPublishRejectionController', () => {
  test('classifies version conflict reasons and telemetry keys', () => {
    const { controller } = createController();

    expect(controller.isVersionConflictReason('VERSION_AHEAD')).toBe(true);
    expect(controller.isVersionConflictReason('VERSION_BEHIND')).toBe(true);
    expect(controller.isVersionConflictReason('OTHER')).toBe(false);
    expect(controller.getVersionConflictTelemetryKey('VERSION_GAP')).toBe('publish_version_gap');
    expect(controller.getVersionConflictTelemetryKey('OTHER')).toBe('');
  });

  test('builds retry payload from current state version and publish turn index', () => {
    const { controller } = createController();

    expect(controller.buildVersionConflictRetryPayload({
      baseVersion: 3,
      turnIndex: 4,
      action: { type: 'place', turnIndex: 4 }
    })).toEqual({
      baseVersion: 7,
      turnIndex: 12,
      action: { type: 'place', turnIndex: 12 }
    });
  });

  test('does not retry terminal restart-like actions or newer queued publishes', () => {
    const { controller, calls } = createController();

    expect(controller.shouldRetryVersionConflictPublish('VERSION_AHEAD', 'reset_game', null)).toBe(false);

    calls.hasNewerQueuedPublish.mockReturnValue(true);
    expect(controller.shouldRetryVersionConflictPublish('VERSION_AHEAD', 'place', { sequence: 1 })).toBe(false);

    calls.hasNewerQueuedPublish.mockReturnValue(false);
    expect(controller.shouldRetryVersionConflictPublish('VERSION_AHEAD', 'place', { sequence: 1 })).toBe(true);
  });

  test('updates local version and skips same-version mismatch snapshots', () => {
    const { controller, state } = createController();

    const result = controller.resolveRejectedPublishSnapshotHandling(
      { sequence: 1 },
      { stateVersion: 9, snapshot: { stateVersion: 7 } },
      'VERSION_MISMATCH',
      {}
    );

    expect(state.stateVersion).toBe(9);
    expect(result).toEqual(expect.objectContaining({
      shouldApplySnapshot: false,
      skipReason: 'same_version_version_mismatch',
      snapshotVersion: 7,
      rejectionStateVersion: 9,
      localStateVersionBefore: 7,
      reason: 'VERSION_MISMATCH'
    }));
  });

  test('applies fresh rejection snapshot unless force-sync guard rejects it', () => {
    const { controller, calls } = createController();

    expect(controller.resolveRejectedPublishSnapshotHandling(
      { sequence: 2 },
      { stateVersion: 8, snapshot: { stateVersion: 10 } },
      'VERSION_AHEAD',
      { localProjectedSnapshotHash: 'local-hash' }
    )).toEqual(expect.objectContaining({
      shouldApplySnapshot: true,
      skipReason: null,
      snapshotVersion: 10
    }));

    calls.shouldSkipForceSyncSnapshot.mockReturnValue(true);
    expect(controller.resolveRejectedPublishSnapshotHandling(
      { sequence: 2 },
      { stateVersion: 8, snapshot: { stateVersion: 10 } },
      'VERSION_AHEAD',
      { localProjectedSnapshotHash: 'local-hash' }
    )).toEqual(expect.objectContaining({
      shouldApplySnapshot: false,
      skipReason: 'skip_force_sync_guard'
    }));
    expect(calls.shouldSkipForceSyncSnapshot).toHaveBeenCalledWith(
      { stateVersion: 10 },
      { ignoreSequence: 2, localProjectedSnapshotHash: 'local-hash' }
    );
  });
});
