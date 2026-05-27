'use strict';

function createNetworkStreamSnapshotController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const getState = typeof cfg.getState === 'function' ? cfg.getState : function () { return null; };

  function readState(): any {
    const state = getState();
    if (!state || typeof state !== 'object') {
      throw new Error('network_stream_snapshot_state_required');
    }
    return state;
  }

  function handleStreamSnapshotPayload(payload: any): void {
    if (!payload || payload.ok !== true) return;
    const state = readState();
    if (typeof cfg.applyPayloadSessionState === 'function') {
      cfg.applyPayloadSessionState(payload);
    }
    const snapshot = payload.snapshot;
    const playbackEvents = Array.isArray(payload.playbackEvents) ? payload.playbackEvents : [];
    const operationId = payload && payload.operationId ? String(payload.operationId) : '';
    const snapshotVersion = typeof cfg.getSnapshotStateVersion === 'function'
      ? cfg.getSnapshotStateVersion(snapshot)
      : null;
    const trackedPublish = typeof cfg.findTrackedPublish === 'function'
      ? cfg.findTrackedPublish(operationId)
      : null;
    const isSelfOperation = !!trackedPublish;
    const isTerminalResultSnapshot = typeof cfg.isTerminalSnapshotForResult === 'function'
      ? cfg.isTerminalSnapshotForResult(snapshot)
      : false;

    const shouldShadowStreamPlayback = isSelfOperation
      && typeof cfg.shouldApplyStreamSnapshotAsShadowPlayback === 'function'
      && cfg.shouldApplyStreamSnapshotAsShadowPlayback(trackedPublish, playbackEvents);
    const streamPlaybackApplyOptions = typeof cfg.buildShadowAwarePlaybackApplyOptions === 'function'
      ? cfg.buildShadowAwarePlaybackApplyOptions(
        playbackEvents,
        shouldShadowStreamPlayback,
        'stream_self_shadow'
      )
      : {
        playbackEvents: playbackEvents,
        shadowPlaybackEvents: [],
        shadowPlaybackSource: undefined
      };

    let applied = typeof cfg.applySnapshotThroughCoordinator === 'function'
      ? cfg.applySnapshotThroughCoordinator(snapshot, {
        source: 'stream',
        trackedPublish,
        applyOptions: Object.assign({}, streamPlaybackApplyOptions, {
          force: false,
          skipResultOverlay: isSelfOperation && !isTerminalResultSnapshot
        })
      })
      : false;
    const recoveredForcedPlayback = !applied
      && typeof cfg.shouldRecoverForceSyncedStreamPlayback === 'function'
      && cfg.shouldRecoverForceSyncedStreamPlayback(snapshot, playbackEvents)
      && typeof cfg.applySnapshot === 'function'
      ? cfg.applySnapshot(snapshot, Object.assign({}, streamPlaybackApplyOptions, {
        force: true,
        skipResultOverlay: isSelfOperation && !isTerminalResultSnapshot
      }))
      : false;

    if (!applied && recoveredForcedPlayback) {
      applied = true;
      if (snapshotVersion !== null) {
        state.appliedStateVersion = snapshotVersion;
      }
      if (trackedPublish && typeof cfg.markTrackedPublishSnapshotApplied === 'function') {
        cfg.markTrackedPublishSnapshotApplied(trackedPublish, snapshot, 'stream_force_recovery');
      }
      if (typeof cfg.recordNetworkTelemetry === 'function') {
        cfg.recordNetworkTelemetry('stream_playback_recovered_after_force_sync', {
          operationId,
          snapshotVersion,
          playbackEventCount: playbackEvents.length,
          recoverySource: state.pendingForceSyncPlaybackSource || ''
        });
      }
    }

    if (applied) {
      if (typeof cfg.consumePendingForceSyncPlaybackRecovery === 'function') {
        cfg.consumePendingForceSyncPlaybackRecovery(snapshotVersion);
      }
      if (isSelfOperation && isTerminalResultSnapshot && typeof cfg.markTrackedPublishResultPresented === 'function') {
        cfg.markTrackedPublishResultPresented(trackedPublish, snapshot);
      }
      if (shouldShadowStreamPlayback && typeof cfg.recordNetworkTelemetry === 'function') {
        cfg.recordNetworkTelemetry('stream_self_snapshot_shadow_playback', {
          operationId,
          snapshotVersion,
          playbackEventCount: playbackEvents.length
        });
      }
      const emittedEffectLogCount = typeof cfg.emitPayloadEffectLogs === 'function'
        ? cfg.emitPayloadEffectLogs(payload)
        : 0;
      if (emittedEffectLogCount === 0 && typeof cfg.emitSnapshotCommentary === 'function') {
        cfg.emitSnapshotCommentary(payload, snapshot, isSelfOperation, playbackEvents);
      }
    }

    if (isSelfOperation && typeof cfg.markTrackedPublishSelfSnapshot === 'function') {
      cfg.markTrackedPublishSelfSnapshot(trackedPublish, snapshot);
    }
    if (typeof cfg.handleTimeoutPassPayload === 'function') {
      cfg.handleTimeoutPassPayload(payload);
    }
    if (typeof cfg.pruneTrackedPublishes === 'function') {
      cfg.pruneTrackedPublishes();
    }
  }

  return {
    handleStreamSnapshotPayload
  };
}

const NetworkStreamSnapshotModule = {
  createNetworkStreamSnapshotController
};

export = NetworkStreamSnapshotModule;
