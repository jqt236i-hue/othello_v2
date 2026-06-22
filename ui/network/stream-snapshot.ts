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

  function isRematchResetActionType(value: any): boolean {
    const actionType = String(value || '').trim().toLowerCase();
    return actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart';
  }

  function shouldSuppressReplayPlayback(payload: any, playbackEvents: any[]): boolean {
    if (!Array.isArray(playbackEvents) || playbackEvents.length <= 0) return false;
    const replay = payload && payload.sseReplay && typeof payload.sseReplay === 'object'
      ? payload.sseReplay
      : null;
    if (!replay || replay.replayed !== true) return false;
    const replayCount = Number.isFinite(Number(replay.count)) ? Number(replay.count) : 0;
    const threshold = Number.isFinite(Number(cfg.replayPlaybackSuppressThreshold))
      ? Math.max(1, Math.trunc(Number(cfg.replayPlaybackSuppressThreshold)))
      : 8;
    return replayCount > threshold;
  }

  function handleStreamSnapshotPayload(payload: any): void {
    if (!payload || payload.ok !== true) return;
    const state = readState();
    if (typeof cfg.applyPayloadSessionState === 'function') {
      cfg.applyPayloadSessionState(payload);
    }
    const hasPresentationFrames = Array.isArray(payload.presentationFrames) && payload.presentationFrames.length > 0;
    const snapshot = payload.snapshot;
    const incomingPlaybackEvents = Array.isArray(payload.playbackEvents) ? payload.playbackEvents : [];
    const suppressReplayPlayback = shouldSuppressReplayPlayback(payload, incomingPlaybackEvents);
    const playbackEvents = (suppressReplayPlayback || hasPresentationFrames) ? [] : incomingPlaybackEvents;
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
    const actionType = payload && payload.actionType ? String(payload.actionType) : '';
    const isRematchResetAction = isRematchResetActionType(actionType);
    const shouldSkipResultOverlay = isSelfOperation && !isTerminalResultSnapshot && !isRematchResetAction;

    const shouldShadowStreamPlayback = isSelfOperation
      && typeof cfg.shouldApplyStreamSnapshotAsShadowPlayback === 'function'
      && cfg.shouldApplyStreamSnapshotAsShadowPlayback(trackedPublish, playbackEvents, payload.playbackDigest);
    if (typeof cfg.recordNetworkTelemetry === 'function') {
      cfg.recordNetworkTelemetry('stream_snapshot_playback_decision', {
        operationId,
        snapshotVersion,
        isSelfOperation,
        isTerminalResultSnapshot,
        playbackEventCount: incomingPlaybackEvents.length,
        appliedPlaybackEventCount: playbackEvents.length,
        presentationFrameCount: hasPresentationFrames ? payload.presentationFrames.length : 0,
        shouldShadowStreamPlayback,
        suppressReplayPlayback
      });
      if (suppressReplayPlayback) {
        const replay = payload && payload.sseReplay && typeof payload.sseReplay === 'object' ? payload.sseReplay : {};
        cfg.recordNetworkTelemetry('stream_replay_playback_suppressed', {
          operationId,
          snapshotVersion,
          playbackEventCount: incomingPlaybackEvents.length,
          replayIndex: Number.isFinite(Number(replay.index)) ? Number(replay.index) : null,
          replayCount: Number.isFinite(Number(replay.count)) ? Number(replay.count) : null,
          replayRemaining: Number.isFinite(Number(replay.remaining)) ? Number(replay.remaining) : null
        });
      }
    }
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
    const presentationFrameApplyOptions = hasPresentationFrames
      ? {
        presentationFrames: payload.presentationFrames,
        presentationFrameSource: 'stream'
      }
      : {};

    let intakeResult: any = null;
    let applied = false;
    if (
      typeof cfg.normalizeNetworkSnapshotEnvelope === 'function'
      && typeof cfg.submitNetworkSnapshotEnvelope === 'function'
    ) {
      const envelope = cfg.normalizeNetworkSnapshotEnvelope({
        source: 'stream',
        payload,
        force: false,
        skipResultOverlay: shouldSkipResultOverlay,
        trackedPublish,
        applyOptions: Object.assign({}, streamPlaybackApplyOptions, presentationFrameApplyOptions, {
          force: false,
          skipResultOverlay: shouldSkipResultOverlay
        })
      });
      intakeResult = cfg.submitNetworkSnapshotEnvelope(envelope);
      applied = !!(intakeResult && intakeResult.appliedSnapshot === true);
    } else if (typeof cfg.applySnapshotThroughCoordinator === 'function') {
      applied = cfg.applySnapshotThroughCoordinator(snapshot, {
        source: 'stream',
        trackedPublish,
        applyOptions: Object.assign({}, streamPlaybackApplyOptions, presentationFrameApplyOptions, {
          force: false,
          skipResultOverlay: shouldSkipResultOverlay
        })
      });
    }
    const recoveredForcedPlayback = !applied
      && typeof cfg.shouldRecoverForceSyncedStreamPlayback === 'function'
      && cfg.shouldRecoverForceSyncedStreamPlayback(snapshot, playbackEvents)
      && typeof cfg.applySnapshot === 'function'
      ? cfg.applySnapshot(snapshot, Object.assign({}, streamPlaybackApplyOptions, presentationFrameApplyOptions, {
        force: true,
        skipResultOverlay: shouldSkipResultOverlay
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
      if (
        !hasPresentationFrames
        && (
        playbackEvents.length <= 0
        && typeof cfg.syncVisualCursorForSnapshotNoPlayback === 'function'
        )
      ) {
        const visualCursorSynced = cfg.syncVisualCursorForSnapshotNoPlayback(payload, snapshotVersion);
        const intakeRequestedBoardRefresh = !!(intakeResult && intakeResult.requestedBoardRefresh === true);
        if (!intakeRequestedBoardRefresh && visualCursorSynced && typeof cfg.requestNetworkTimelineBoardRefresh === 'function') {
          const cursor = payload && payload.presentationCursor && typeof payload.presentationCursor === 'object'
            ? payload.presentationCursor
            : null;
          cfg.requestNetworkTimelineBoardRefresh(null, {
            reason: 'snapshot_no_playback_visual_sync',
            visualSeq: cursor && Number.isFinite(Number(cursor.visualSeq))
              ? Math.max(0, Math.trunc(Number(cursor.visualSeq)))
              : null,
            visualVersion: cursor && Number.isFinite(Number(cursor.stateVersion))
              ? Math.max(0, Math.trunc(Number(cursor.stateVersion)))
              : snapshotVersion,
            source: 'network_timeline'
          });
        }
      }
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
        cfg.emitSnapshotCommentary(payload, snapshot, isSelfOperation, incomingPlaybackEvents);
      }
      if (typeof cfg.showAutoPassNoticeFromPayload === 'function') {
        cfg.showAutoPassNoticeFromPayload(payload);
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
