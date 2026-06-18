'use strict';

function createNetworkPublishFlowController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};

  function getState(): any {
    return (typeof cfg.getState === 'function') ? cfg.getState() : null;
  }

  function isActive(): boolean {
    return typeof cfg.isActive === 'function' ? cfg.isActive() === true : false;
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

  function publishSnapshot(meta: any): Promise<any> {
    const state = getState();
    if (!state || typeof state !== 'object') {
      emitStatus('ネット対戦: 通信失敗 (STATE_UNAVAILABLE)', true);
      return Promise.resolve({ ok: false, reason: 'PUBLISH_ERROR' });
    }
    if (!isActive()) return Promise.resolve({ ok: false, reason: 'INACTIVE' });
    if (!state.seatToken) return Promise.resolve({ ok: false, reason: 'SEAT_TOKEN_REQUIRED' });

    const info = meta || {};
    const playerKey = normalizePlayerKey(info.playerKey || state.seatKey);
    if (playerKey !== state.seatKey) {
      emitStatus(`ネット対戦: 操作主体が座席と不一致です (${playerKey} != ${state.seatKey})`, true);
      return Promise.resolve({ ok: false, reason: 'SEAT_MISMATCH_LOCAL' });
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
        roomId: state.roomId,
        seatKey: state.seatKey,
        seatToken: state.seatToken,
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

    state.publishChain = state.publishChain
      .then(async () => {
        if (!isActive()) {
          if (typeof cfg.settleTrackedPublish === 'function') cfg.settleTrackedPublish(trackedPublish);
          return { ok: false, reason: 'INACTIVE' };
        }
        if (!state.seatToken) {
          if (typeof cfg.settleTrackedPublish === 'function') cfg.settleTrackedPublish(trackedPublish);
          return { ok: false, reason: 'SEAT_TOKEN_REQUIRED' };
        }

        const payload = Object.assign({}, publishRequest.requestPayload, {
          roomId: state.roomId,
          seatKey: state.seatKey,
          seatToken: state.seatToken,
          playerKey,
          actionType: queuedActionType,
          operationId,
          baseVersion: state.stateVersion
        });

        if (typeof cfg.markTrackedPublishInFlight === 'function') cfg.markTrackedPublishInFlight(trackedPublish);
        let res = (typeof cfg.publishRequestWithRetry === 'function')
          ? await cfg.publishRequestWithRetry(payload)
          : { ok: false, data: null };
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
            const applied = (typeof cfg.applySnapshotThroughCoordinator === 'function')
              ? cfg.applySnapshotThroughCoordinator(res.data.snapshot, {
                source: 'publish_rejection',
                trackedPublish,
                applyOptions: {
                  force: true,
                  playbackEvents: rejectionPlaybackEvents
                }
              })
              : false;
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
          const serverPlaybackEvents = Array.isArray(res.data.playbackEvents) ? res.data.playbackEvents : [];
          const shouldShadowPlaybackResponse = (typeof cfg.shouldApplyPublishResponseAsShadowPlayback === 'function')
            ? cfg.shouldApplyPublishResponseAsShadowPlayback(trackedPublish, res.data.snapshot, serverPlaybackEvents)
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
          const applied = shouldSkipPublishResponse
            ? false
            : (
              typeof cfg.applySnapshotThroughCoordinator === 'function'
                ? cfg.applySnapshotThroughCoordinator(res.data.snapshot, {
                  source: 'publish_response',
                  trackedPublish,
                  applyOptions: Object.assign({}, publishResponsePlaybackApplyOptions, {
                    force: true,
                    skipResultOverlay: (typeof cfg.hasTrackedPublishPresentedResult === 'function')
                      ? cfg.hasTrackedPublishPresentedResult(trackedPublish)
                      : false
                  })
                })
                : false
            );
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
        }
        if (typeof cfg.pruneTrackedPublishes === 'function') cfg.pruneTrackedPublishes();
        return { ok: true };
      })
      .catch((error: any) => {
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
