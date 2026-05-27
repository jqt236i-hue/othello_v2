'use strict';

function createNetworkPublishRejectionController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const getState = typeof cfg.getState === 'function' ? cfg.getState : () => ({});
  const hasNewerQueuedPublish = typeof cfg.hasNewerQueuedPublish === 'function'
    ? cfg.hasNewerQueuedPublish
    : () => false;
  const getCurrentPublishTurnIndex = typeof cfg.getCurrentPublishTurnIndex === 'function'
    ? cfg.getCurrentPublishTurnIndex
    : () => null;
  const getSnapshotStateVersion = typeof cfg.getSnapshotStateVersion === 'function'
    ? cfg.getSnapshotStateVersion
    : () => null;
  const shouldSkipForceSyncSnapshot = typeof cfg.shouldSkipForceSyncSnapshot === 'function'
    ? cfg.shouldSkipForceSyncSnapshot
    : () => false;

  function isVersionConflictReason(reasonValue: any) {
    const reason = String(reasonValue || '').trim();
    return reason === 'VERSION_MISMATCH'
      || reason === 'VERSION_AHEAD'
      || reason === 'VERSION_BEHIND'
      || reason === 'VERSION_GAP';
  }

  function getVersionConflictTelemetryKey(reasonValue: any) {
    const reason = String(reasonValue || '').trim();
    if (reason === 'VERSION_AHEAD') return 'publish_version_ahead';
    if (reason === 'VERSION_BEHIND') return 'publish_version_behind';
    if (reason === 'VERSION_GAP') return 'publish_version_gap';
    if (reason === 'VERSION_MISMATCH') return 'publish_version_mismatch';
    return '';
  }

  function shouldRetryVersionConflictPublish(reasonValue: any, actionTypeValue: any, trackedPublish: any) {
    if (!isVersionConflictReason(reasonValue)) return false;
    const actionType = String(actionTypeValue || '').trim().toLowerCase();
    if (actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart') return false;
    if (trackedPublish && hasNewerQueuedPublish(trackedPublish.sequence)) return false;
    return true;
  }

  function buildVersionConflictRetryPayload(payload: any) {
    const state = getState() || {};
    const retryTurnIndex = getCurrentPublishTurnIndex();
    const retryPayload = Object.assign({}, payload, {
      baseVersion: state.stateVersion,
      turnIndex: retryTurnIndex
    });
    if (retryPayload.action && typeof retryPayload.action === 'object') {
      retryPayload.action = Object.assign({}, retryPayload.action, {
        turnIndex: retryTurnIndex
      });
    }
    return retryPayload;
  }

  function resolveRejectedPublishSnapshotHandling(entry: any, payload: any, rejectedReason: any, options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const state = getState() || {};
    const reason = String(rejectedReason || '').trim() || 'PUBLISH_REJECTED';
    const snapshot = (payload && payload.snapshot && typeof payload.snapshot === 'object')
      ? payload.snapshot
      : null;
    const localStateVersionBefore = Number.isFinite(Number(state.stateVersion))
      ? Number(state.stateVersion)
      : null;
    const rejectionStateVersion = Number.isFinite(Number(payload && payload.stateVersion))
      ? Number(payload.stateVersion)
      : null;

    if (rejectionStateVersion !== null && (localStateVersionBefore === null || rejectionStateVersion > localStateVersionBefore)) {
      state.stateVersion = rejectionStateVersion;
    }

    const snapshotVersion = getSnapshotStateVersion(snapshot);
    if (!snapshot) {
      return { shouldApplySnapshot: false, skipReason: 'missing_snapshot', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
    }
    if (entry && hasNewerQueuedPublish(entry.sequence)) {
      return { shouldApplySnapshot: false, skipReason: 'newer_local_publish', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
    }
    if (snapshotVersion === null) {
      return { shouldApplySnapshot: false, skipReason: 'missing_snapshot_version', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
    }
    if (localStateVersionBefore !== null && snapshotVersion < localStateVersionBefore) {
      return { shouldApplySnapshot: false, skipReason: 'stale_snapshot_version', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
    }
    if (isVersionConflictReason(reason) && localStateVersionBefore !== null && snapshotVersion === localStateVersionBefore) {
      return { shouldApplySnapshot: false, skipReason: 'same_version_version_mismatch', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
    }
    if (shouldSkipForceSyncSnapshot(snapshot, {
      ignoreSequence: entry && entry.sequence,
      localProjectedSnapshotHash: opts.localProjectedSnapshotHash || null
    })) {
      return { shouldApplySnapshot: false, skipReason: 'skip_force_sync_guard', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
    }
    return { shouldApplySnapshot: true, skipReason: null, snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
  }

  return {
    isVersionConflictReason,
    getVersionConflictTelemetryKey,
    shouldRetryVersionConflictPublish,
    buildVersionConflictRetryPayload,
    resolveRejectedPublishSnapshotHandling
  };
}

export = {
  createNetworkPublishRejectionController
};
