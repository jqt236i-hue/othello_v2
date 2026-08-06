'use strict';

function createNetworkPublishFlowController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};

  function getState(): any {
    return (typeof cfg.getState === 'function') ? cfg.getState() : null;
  }

  function isActive(): boolean {
    return typeof cfg.isActive === 'function' ? cfg.isActive() === true : false;
  }

  function getCardState(): any {
    if (typeof cfg.getCardState === 'function') {
      try { return cfg.getCardState(); } catch (e) { return null; }
    }
    return null;
  }

  function normalizePlayerKey(value: any): string {
    if (typeof cfg.normalizePlayerKey === 'function') {
      return cfg.normalizePlayerKey(value);
    }
    return 'black';
  }

  function emitStatus(text: any, isError: any): void {
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus(text, isError);
    }
  }

  function toIntegerOrNull(value: any): number | null {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return null;
    return Math.trunc(numberValue);
  }

  function buildAcceptedPublishResult(data: any, responseStateVersion: number | null, operationId: string): any {
    const payload = (data && typeof data === 'object') ? data : {};
    const cursor = payload.presentationCursor && typeof payload.presentationCursor === 'object'
      ? payload.presentationCursor
      : null;
    const visualSeq = toIntegerOrNull(payload.visualSeq)
      ?? toIntegerOrNull(cursor && cursor.visualSeq);
    if (!cursor && visualSeq === null) return { ok: true };
    const result: any = {
      ok: true,
      operationId: String(payload.operationId || operationId || '') || null,
      stateVersion: responseStateVersion,
      presentationCursor: cursor,
      visualSeq
    };
    return result;
  }

  function publishSnapshot(meta: any): Promise<any> {
    const state = getState();
    if (!state || typeof state !== 'object') {
      emitStatus('ネット対戦: 通信失敗 (STATE_UNAVAILABLE)', true);
      return Promise.resolve({ ok: false, reason: 'PUBLISH_ERROR' });
    }
    if (!isActive()) return Promise.resolve({ ok: false, reason: 'INACTIVE' });
    if (!state.seatToken) return Promise.resolve({ ok: false, reason: 'SEAT_TOKEN_REQUIRED' });

    const info = meta || {};
    const requestSessionEpoch = typeof cfg.getSessionEpoch === 'function'
      ? cfg.getSessionEpoch()
      : null;
    const requestRoomId = String(state.roomId || '');
    const requestSeatKey = String(state.seatKey || '');
    const requestSeatToken = String(state.seatToken || '');
    function isCurrentRequestSession(): boolean {
      const currentState = getState();
      if (!currentState || typeof currentState !== 'object') return false;
      if (typeof cfg.getSessionEpoch === 'function' && cfg.getSessionEpoch() !== requestSessionEpoch) {
        return false;
      }
      return isActive()
        && String(currentState.roomId || '') === requestRoomId
        && String(currentState.seatKey || '') === requestSeatKey
        && String(currentState.seatToken || '') === requestSeatToken;
    }
    function isResponseForRequestRoom(data: any): boolean {
      const responseRoomId = data && data.roomId
        ? String(data.roomId).trim().toUpperCase()
        : '';
      return !responseRoomId || responseRoomId === requestRoomId.trim().toUpperCase();
    }
    function discardStaleSessionResponse(stage: string): any {
      if (typeof cfg.settleTrackedPublish === 'function') cfg.settleTrackedPublish(trackedPublish);
      if (typeof cfg.recordNetworkTelemetry === 'function') {
        cfg.recordNetworkTelemetry('publish_response_stale_session_ignored', {
          operationId,
          stage,
          requestRoomId,
          requestSessionEpoch,
          currentRoomId: String((getState() && getState().roomId) || ''),
          currentSessionEpoch: typeof cfg.getSessionEpoch === 'function'
            ? cfg.getSessionEpoch()
            : null
        });
      }
      return { ok: false, reason: 'SESSION_CHANGED', stale: true };
    }
    const playerKey = normalizePlayerKey(info.playerKey || state.seatKey);
    if (playerKey !== state.seatKey) {
      // FATE_WILL controller publishes an action for the turn owner (playerKey = owner).
      // Allow it when the local seat is the FATE_WILL controller for that owner.
      // Symmetric with the server-side validatePendingSelectionPublish fallback in utils/match-authority.ts.
      const cardStateRef = getCardState();
      const fateWillControllerByTurnOwner = cardStateRef && cardStateRef.fateWillControllerByTurnOwner;
      const fateWillController = fateWillControllerByTurnOwner && fateWillControllerByTurnOwner[playerKey];
      const isFateWillController = fateWillController === state.seatKey;
      if (!isFateWillController) {
        emitStatus('ネット対戦: 操作主体が座席と不一致です (' + playerKey + ' != ' + state.seatKey + ')', true);
        return Promise.resolve({ ok: false, reason: 'SEAT_MISMATCH_LOCAL' });
      }
    }

    const operationId = (typeof cfg.createOperationId === 'function')
      ? cfg.createOperationId()
      : '';
    const publishRequestModule = (typeof cfg.resolveNetworkPublishRequestModule === 'function')
      ? cfg.resolveNetworkPublishRequestModule()
      : null;
    const publishRequest = publishRequestModule && typeof publishRequestModule.buildPublishRequest === 'function'
      ? publishRequestModule.buildPublishRequest(info, {
        playerKey,
        operationId,
        roomId: requestRoomId,
        seatKey: requestSeatKey,
        seatToken: requestSeatToken,
        baseVersion: state.stateVersion,
        turnIndex: (typeof cfg.getCurrentPublishTurnIndex === 'function') ? cfg.getCurrentPublishTurnIndex() : null,
        buildPublishCommandPayload: cfg.buildPublishCommandPayload
      })
      : null;
    if (!publishRequest || !publishRequest.commandPayload || !publishRequest.requestPayload) {
      return Promise.resolve({ ok: false, reason: 'COMMAND_REQUIRED' });
    }

    const commandPayload = publishRequest.commandPayload;
    const queuedPlaybackEvents = (typeof cfg.sanitizePlaybackEventsForPublish === 'function')
      ? cfg.sanitizePlaybackEventsForPublish(info.playbackEvents)
      : (Array.isArray(info.playbackEvents) ? info.playbackEvents : []);
    const queuedActionType = publishRequest.queuedActionType;
    const snapshotMeta = (typeof cfg.getSnapshotMeta === 'function')
      ? (cfg.getSnapshotMeta(info && info.snapshot) || {})
      : {};
    const trackedPublish = (typeof cfg.createTrackedPublish === 'function')
      ? cfg.createTrackedPublish(operationId, {
        actionType: queuedActionType,
        actor: commandPayload ? (commandPayload.actor || playerKey) : playerKey,
        params: commandPayload ? (commandPayload.params || {}) : null,
        playbackEvents: queuedPlaybackEvents,
        localPlaybackEmitted: info.localPlaybackEmitted === true,
        usedSnapshotFallback: info.usedSnapshotFallback === true,
        snapshotProjectedHash: snapshotMeta.projectedSnapshotHash
      })
      : null;

    if (typeof cfg.onPublishStarted === 'function') {
      try {
        cfg.onPublishStarted(Object.freeze({
          placementFeedbackToken: info && info.placementFeedbackToken != null
            ? info.placementFeedbackToken
            : null,
          operationId,
          roomId: requestRoomId,
          sessionEpoch: requestSessionEpoch,
          actionType: queuedActionType
        }));
      } catch (error: any) {
        if (typeof cfg.recordNetworkTelemetry === 'function') {
          cfg.recordNetworkTelemetry('publish_feedback_start_failed', {
            operationId,
            message: error && error.message ? String(error.message) : String(error || '')
          });
        }
      }
    }

    state.publishChain = state.publishChain
      .then(async () => {
        if (!isCurrentRequestSession()) {
          return discardStaleSessionResponse('before_request');
        }
        if (!isActive()) {
          if (typeof cfg.settleTrackedPublish === 'function') cfg.settleTrackedPublish(trackedPublish);
          return { ok: false, reason: 'INACTIVE' };
        }
        if (!state.seatToken) {
          if (typeof cfg.settleTrackedPublish === 'function') cfg.settleTrackedPublish(trackedPublish);
          return { ok: false, reason: 'SEAT_TOKEN_REQUIRED' };
        }

        const payload = Object.assign({}, publishRequest.requestPayload, {
          roomId: requestRoomId,
          seatKey: requestSeatKey,
          seatToken: requestSeatToken,
          playerKey,
          actionType: queuedActionType,
          operationId,
          baseVersion: state.stateVersion
        });

        if (typeof cfg.markTrackedPublishInFlight === 'function') cfg.markTrackedPublishInFlight(trackedPublish);
        let res = (typeof cfg.publishRequestWithRetry === 'function')
          ? await cfg.publishRequestWithRetry(payload)
          : { ok: false, data: null };
        if (!isCurrentRequestSession()) {
          return discardStaleSessionResponse('initial_response');
        }
        if (!isResponseForRequestRoom(res && res.data)) {
          return discardStaleSessionResponse('initial_response_room_mismatch');
        }
        if (!res.ok || !res.data || res.data.ok !== true) {
          const reason = (res.data && res.data.rejectedReason) || 'PUBLISH_REJECTED';
          const localProjectedSnapshotHashBefore = (typeof cfg.getKnownProjectedSnapshotHash === 'function')
            ? cfg.getKnownProjectedSnapshotHash()
            : null;
          if (typeof cfg.applyPayloadSessionState === 'function') cfg.applyPayloadSessionState(res.data);
          const rejectionHandling = (typeof cfg.resolveRejectedPublishSnapshotHandling === 'function')
            ? cfg.resolveRejectedPublishSnapshotHandling(trackedPublish, res.data, reason, {
              localProjectedSnapshotHash: localProjectedSnapshotHashBefore
            })
            : {
              shouldApplySnapshot: false,
              snapshotVersion: null,
              rejectionStateVersion: null,
              localStateVersionBefore: null,
              skipReason: 'rejection_controller_missing'
            };
          const versionTelemetryKey = (typeof cfg.getVersionConflictTelemetryKey === 'function')
            ? cfg.getVersionConflictTelemetryKey(reason)
            : '';
          if (typeof cfg.recordNetworkTelemetry === 'function') {
            cfg.recordNetworkTelemetry(versionTelemetryKey || 'publish_rejected', {
              reason,
              operationId,
              sequence: trackedPublish && trackedPublish.sequence,
              snapshotVersion: rejectionHandling.snapshotVersion,
              rejectionStateVersion: rejectionHandling.rejectionStateVersion,
              localStateVersionBefore: rejectionHandling.localStateVersionBefore
            });
          }
          if (versionTelemetryKey && versionTelemetryKey !== 'publish_version_mismatch' && typeof cfg.recordNetworkTelemetry === 'function') {
            cfg.recordNetworkTelemetry('publish_version_mismatch', {
              reason,
              operationId,
              sequence: trackedPublish && trackedPublish.sequence,
              snapshotVersion: rejectionHandling.snapshotVersion,
              rejectionStateVersion: rejectionHandling.rejectionStateVersion,
              localStateVersionBefore: rejectionHandling.localStateVersionBefore
            });
          }
          if (rejectionHandling.shouldApplySnapshot) {
            const rejectionPlaybackEvents = Array.isArray(res.data.playbackEvents) ? res.data.playbackEvents : [];
            let applied = false;
            if (
              typeof cfg.normalizeNetworkSnapshotEnvelope === 'function'
              && typeof cfg.submitNetworkSnapshotEnvelope === 'function'
            ) {
              const envelope = cfg.normalizeNetworkSnapshotEnvelope({
                source: 'publish_response',
                payload: res.data,
                force: true,
                trackedPublish,
                applyOptions: {
                  force: true,
                  playbackEvents: rejectionPlaybackEvents,
                  presentationFrames: Array.isArray(res.data.presentationFrames)
                    ? res.data.presentationFrames
                    : [],
                  presentationFrameSource: 'publish_rejection'
                }
              });
              const intakeResult = cfg.submitNetworkSnapshotEnvelope(envelope);
              applied = !!(intakeResult && intakeResult.appliedSnapshot === true);
            } else if (typeof cfg.applySnapshotThroughCoordinator === 'function') {
              applied = cfg.applySnapshotThroughCoordinator(res.data.snapshot, {
                source: 'publish_rejection',
                trackedPublish,
                applyOptions: {
                  force: true,
                  playbackEvents: rejectionPlaybackEvents
                }
              });
            }
            if (applied && typeof cfg.rememberPendingForceSyncPlaybackRecovery === 'function') {
              cfg.rememberPendingForceSyncPlaybackRecovery(res.data.snapshot, {
                source: 'publish_rejection',
                force: true,
                playbackEvents: rejectionPlaybackEvents
              });
            }
            if (typeof cfg.recordNetworkTelemetry === 'function') {
              cfg.recordNetworkTelemetry('publish_rejection_snapshot_applied', {
                reason,
                operationId,
                applied,
                snapshotVersion: rejectionHandling.snapshotVersion
              });
            }
          } else if (typeof cfg.recordNetworkTelemetry === 'function') {
            cfg.recordNetworkTelemetry('publish_rejection_snapshot_skipped', {
              reason,
              operationId,
              skipReason: rejectionHandling.skipReason,
              snapshotVersion: rejectionHandling.snapshotVersion
            });
          }
          let retryAcceptedAfterResync = false;
          const shouldRetry = (typeof cfg.shouldRetryVersionConflictPublish === 'function')
            ? cfg.shouldRetryVersionConflictPublish(reason, queuedActionType, trackedPublish)
            : false;
          if (shouldRetry) {
            try {
              if (typeof cfg.syncLatestStateWithRetry === 'function') {
                await cfg.syncLatestStateWithRetry({ maxAttempts: 2, baseDelayMs: 150 });
              }
              if (!isCurrentRequestSession()) {
                return discardStaleSessionResponse('version_conflict_resync');
              }
              const retryPayload = (typeof cfg.buildVersionConflictRetryPayload === 'function')
                ? cfg.buildVersionConflictRetryPayload(payload)
                : payload;
              if (typeof cfg.recordNetworkTelemetry === 'function') {
                cfg.recordNetworkTelemetry('publish_version_conflict_retry', {
                  reason,
                  operationId,
                  sequence: trackedPublish && trackedPublish.sequence,
                  retryBaseVersion: retryPayload.baseVersion,
                  retryTurnIndex: retryPayload.turnIndex
                });
              }
              const retryRes = (typeof cfg.publishRequestWithRetry === 'function')
                ? await cfg.publishRequestWithRetry(retryPayload)
                : null;
              if (!isCurrentRequestSession()) {
                return discardStaleSessionResponse('version_conflict_retry_response');
              }
              if (!isResponseForRequestRoom(retryRes && retryRes.data)) {
                return discardStaleSessionResponse('version_conflict_retry_room_mismatch');
              }
              if (retryRes && retryRes.ok && retryRes.data && retryRes.data.ok === true) {
                res = retryRes;
                retryAcceptedAfterResync = true;
                if (typeof cfg.recordNetworkTelemetry === 'function') {
                  cfg.recordNetworkTelemetry('publish_version_conflict_retry_accepted', {
                    reason,
                    operationId,
                    sequence: trackedPublish && trackedPublish.sequence,
                    responseStateVersion: Number.isFinite(Number(retryRes.data.stateVersion))
                      ? Number(retryRes.data.stateVersion)
                      : null
                  });
                }
              } else if (typeof cfg.recordNetworkTelemetry === 'function') {
                cfg.recordNetworkTelemetry('publish_version_conflict_retry_rejected', {
                  reason: (retryRes && retryRes.data && retryRes.data.rejectedReason) || 'PUBLISH_REJECTED',
                  operationId,
                  sequence: trackedPublish && trackedPublish.sequence
                });
              }
            } catch (e: any) {
              if (typeof cfg.recordNetworkTelemetry === 'function') {
                cfg.recordNetworkTelemetry('publish_version_conflict_retry_failed', {
                  reason,
                  operationId,
                  sequence: trackedPublish && trackedPublish.sequence,
                  error: e && e.message ? String(e.message) : String(e || '')
                });
              }
            }
          }
          if (!retryAcceptedAfterResync) {
            if (typeof cfg.settleTrackedPublish === 'function') cfg.settleTrackedPublish(trackedPublish);
            emitStatus(`ネット対戦: 操作が拒否されました (${reason})`, true);
            return { ok: false, reason };
          }
        }

        if (typeof cfg.applyPayloadSessionState === 'function') cfg.applyPayloadSessionState(res.data);
        const responseStateVersion = Number.isFinite(Number(res.data.stateVersion))
          ? Number(res.data.stateVersion)
          : null;
        if (responseStateVersion !== null) {
          const currentAppliedVersion = (typeof cfg.getAppliedStateVersion === 'function')
            ? cfg.getAppliedStateVersion()
            : null;
          if (currentAppliedVersion === null || responseStateVersion >= currentAppliedVersion) {
            state.stateVersion = responseStateVersion;
          }
        }
        if (typeof cfg.markTrackedPublishResponse === 'function') {
          cfg.markTrackedPublishResponse(trackedPublish, responseStateVersion);
        }
        const acceptedPublishResult = buildAcceptedPublishResult(res.data, responseStateVersion, operationId);
        if (res.data && res.data.idempotentReplay === true && typeof cfg.recordNetworkTelemetry === 'function') {
          cfg.recordNetworkTelemetry('publish_idempotent_replay_ack', {
            operationId,
            responseStateVersion
          });
        }
        if (res.data && res.data.snapshot) {
          const shouldSkipPublishResponse = (typeof cfg.shouldSkipPublishResponseSnapshot === 'function')
            ? cfg.shouldSkipPublishResponseSnapshot(trackedPublish, res.data.snapshot)
            : false;
          const hasPresentationFrames = Array.isArray(res.data.presentationFrames) && res.data.presentationFrames.length > 0;
          const serverPlaybackEvents = (!hasPresentationFrames && Array.isArray(res.data.playbackEvents))
            ? res.data.playbackEvents
            : [];
          const shouldShadowPlaybackResponse = (typeof cfg.shouldApplyPublishResponseAsShadowPlayback === 'function')
            ? cfg.shouldApplyPublishResponseAsShadowPlayback(
              trackedPublish,
              res.data.snapshot,
              serverPlaybackEvents,
              res.data.playbackDigest
            )
            : false;
          const publishResponsePlaybackApplyOptions = (typeof cfg.buildShadowAwarePlaybackApplyOptions === 'function')
            ? cfg.buildShadowAwarePlaybackApplyOptions(
              serverPlaybackEvents,
              shouldShadowPlaybackResponse,
              'publish_response_shadow'
            )
            : {
              playbackEvents: serverPlaybackEvents,
              shadowPlaybackEvents: [],
              shadowPlaybackSource: null
            };
          const presentationFrameApplyOptions = hasPresentationFrames
            ? {
              presentationFrames: res.data.presentationFrames,
              presentationFrameSource: 'publish_response'
            }
            : {};
          let applied = false;
          if (!shouldSkipPublishResponse) {
            const skipResultOverlay = (typeof cfg.hasTrackedPublishPresentedResult === 'function')
              ? cfg.hasTrackedPublishPresentedResult(trackedPublish)
              : false;
            if (
              typeof cfg.normalizeNetworkSnapshotEnvelope === 'function'
              && typeof cfg.submitNetworkSnapshotEnvelope === 'function'
            ) {
              const envelope = cfg.normalizeNetworkSnapshotEnvelope({
                source: 'publish_response',
                payload: res.data,
                force: true,
                trackedPublish,
                skipResultOverlay,
                applyOptions: Object.assign({}, publishResponsePlaybackApplyOptions, presentationFrameApplyOptions, {
                  force: true,
                  skipResultOverlay
                })
              });
              const intakeResult = cfg.submitNetworkSnapshotEnvelope(envelope);
              applied = !!(intakeResult && intakeResult.appliedSnapshot === true);
            } else if (typeof cfg.applySnapshotThroughCoordinator === 'function') {
              applied = cfg.applySnapshotThroughCoordinator(res.data.snapshot, {
                source: 'publish_response',
                trackedPublish,
                applyOptions: Object.assign({}, publishResponsePlaybackApplyOptions, presentationFrameApplyOptions, {
                  force: true,
                  skipResultOverlay
                })
              });
            }
          }
          if (applied) {
            if (typeof cfg.rememberPendingForceSyncPlaybackRecovery === 'function') {
              cfg.rememberPendingForceSyncPlaybackRecovery(res.data.snapshot, Object.assign({}, publishResponsePlaybackApplyOptions, {
                source: 'publish_response',
                force: true
              }));
            }
            if (typeof cfg.emitPayloadEffectLogs === 'function') cfg.emitPayloadEffectLogs(res.data);
            if (typeof cfg.showAutoPassNoticeFromPayload === 'function') {
              cfg.showAutoPassNoticeFromPayload(res.data);
            }
            if (typeof cfg.recordNetworkTelemetry === 'function') {
              cfg.recordNetworkTelemetry('publish_response_snapshot_applied', {
                operationId,
                applied,
                responseStateVersion,
                playbackEventCount: serverPlaybackEvents.length,
                usedShadowPlayback: shouldShadowPlaybackResponse
              });
            }
          } else if (typeof cfg.recordNetworkTelemetry === 'function') {
            cfg.recordNetworkTelemetry('publish_response_snapshot_skipped', {
              operationId,
              responseStateVersion,
              snapshotVersion: (typeof cfg.getSnapshotStateVersion === 'function')
                ? cfg.getSnapshotStateVersion(res.data.snapshot)
                : null,
              skipReason: shouldSkipPublishResponse ? 'self_snapshot_already_applied' : 'apply_rejected'
            });
          }
        } else if (typeof cfg.recordNetworkTelemetry === 'function') {
          cfg.recordNetworkTelemetry('publish_ack_without_snapshot', {
            operationId: acceptedPublishResult.operationId || operationId,
            responseStateVersion,
            visualSeq: typeof acceptedPublishResult.visualSeq === 'number' ? acceptedPublishResult.visualSeq : null
          });
        }
        if (typeof cfg.pruneTrackedPublishes === 'function') cfg.pruneTrackedPublishes();
        return acceptedPublishResult;
      })
      .catch((error: any) => {
        if (!isCurrentRequestSession()) {
          return discardStaleSessionResponse('request_error');
        }
        const message = error && error.message ? error.message : 'PUBLISH_ERROR';
        if (typeof cfg.settleTrackedPublish === 'function') cfg.settleTrackedPublish(trackedPublish);
        emitStatus(`ネット対戦: 通信失敗 (${message})`, true);
        return { ok: false, reason: 'PUBLISH_ERROR' };
      })
      .finally(() => {
        if (typeof cfg.pruneTrackedPublishes === 'function') cfg.pruneTrackedPublishes();
      });

    return state.publishChain;
  }

  return {
    publishSnapshot
  };
}

const NetworkPublishFlowModule = {
  createNetworkPublishFlowController
};

export = NetworkPublishFlowModule;
