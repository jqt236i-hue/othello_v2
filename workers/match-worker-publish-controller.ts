'use strict';

function createMatchWorkerPublishController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};

  async function handlePublish(body: Record<string, unknown>): Promise<Response> {
    await cfg.loadRoom();
    const room = cfg.getRoom();

    if (!room) {
      return cfg.jsonResponse(404, { ok: false, rejectedReason: 'ROOM_NOT_FOUND' });
    }

    await cfg.applyExpiredTurnTimeoutIfNeeded();

    const seatKey = cfg.normalizePlayerKey(body.seatKey);
    const playerKey = cfg.normalizePlayerKey(body.playerKey);
    const seatToken = String(body.seatToken || '').trim();
    const baseVersion = Number.isFinite(Number(body.baseVersion)) ? Number(body.baseVersion) : null;
    const actionType = String(body.actionType || '').trim().toLowerCase();
    const operationId = cfg.normalizeOperationId(body.operationId);
    const isRematchResetAction = actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart';
    const isNetworkDebugAction = cfg.isNetworkDebugFillHandPayload(body);
    const viewerSeatKey = cfg.resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    const acceptedOperationsBySeat = cfg.ensureAcceptedOperationsBySeat(room);
    if (!Array.isArray(room.authorityLog)) room.authorityLog = [];
    if (!Array.isArray(room.sseEventBuffer)) room.sseEventBuffer = [];
    if (typeof room.authoritativeStateHash === 'undefined') {
      room.authoritativeStateHash = cfg.MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
    }

    if (!cfg.asRecord(room.seats)[seatKey]) {
      return cfg.jsonResponse(403, cfg.buildPublishPayload(room, viewerSeatKey, cfg.MatchAuthority.buildPublishResponseOptions({
        ok: false,
        rejectedReason: 'SEAT_NOT_JOINED',
        publishKind: 'rejected',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      })));
    }

    if (seatKey !== playerKey) {
      return cfg.jsonResponse(403, cfg.buildPublishPayload(room, viewerSeatKey, cfg.MatchAuthority.buildPublishResponseOptions({
        ok: false,
        rejectedReason: 'SEAT_MISMATCH',
        publishKind: 'rejected',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      })));
    }

    if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
      return cfg.jsonResponse(403, cfg.buildPublishPayload(room, null, cfg.MatchAuthority.buildPublishResponseOptions({
        ok: false,
        rejectedReason: 'SEAT_TOKEN_MISMATCH',
        publishKind: 'rejected',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      })));
    }

    if (!cfg.MatchAuthority.hasRequiredOperationId(operationId)) {
      return cfg.jsonResponse(409, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
        ok: false,
        rejectedReason: 'OPERATION_ID_REQUIRED',
        publishKind: 'rejected',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      })));
    }

    const lastAcceptedOperation = cfg.MatchAuthority.resolveAcceptedOperation(room, seatKey, operationId, acceptedOperationsBySeat[seatKey]);
    if (
      operationId &&
      lastAcceptedOperation &&
      typeof lastAcceptedOperation === 'object'
    ) {
      const serverTime = Date.now();
      cfg.MatchAuthority.appendAuthorityLog(room, {
        kind: 'publish_idempotent_replay',
        operationId,
        actionType,
        baseVersion,
        committedVersion: room.stateVersion,
        stateHashBefore: room.authoritativeStateHash,
        dedupeOutcome: 'replay'
      }, undefined);
      return cfg.jsonResponse(200, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
        ok: true,
        idempotentReplay: true,
        serverTime,
        publishKind: 'idempotent_replay',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion,
        replayedStateVersion: lastAcceptedOperation.stateVersion
      })));
    }

    if (baseVersion === null || baseVersion !== room.stateVersion) {
      const versionRejectedOptions = cfg.MatchAuthority.buildVersionRejectedPublishResponseOptions(room, {
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      });
      const rejectedReason = versionRejectedOptions && versionRejectedOptions.rejectedReason
        ? versionRejectedOptions.rejectedReason
        : 'VERSION_MISMATCH';
      cfg.MatchAuthority.appendAuthorityLog(room, {
        kind: 'publish_rejected',
        operationId,
        actionType,
        baseVersion,
        committedVersion: room.stateVersion,
        stateHashBefore: room.authoritativeStateHash,
        rejectedReason
      }, undefined);
      return cfg.jsonResponse(409, cfg.buildPublishPayload(room, seatKey, versionRejectedOptions));
    }

    const expectedPlayerKey = cfg.getCurrentPlayerKey(cfg.asRecord(room.snapshot).gameState);
    if (playerKey !== expectedPlayerKey) {
      const allowOutOfTurnRematch = isRematchResetAction && await cfg.isSnapshotGameOver(room.snapshot);
      const allowOutOfTurnNetworkDebug = isNetworkDebugAction && cfg.toPublicNetworkDebugEnabled(room);
      const allowFateWillController = cfg.MatchAuthority.isFateWillControllerForCurrentTurn(room.snapshot, playerKey);
      if (!allowOutOfTurnRematch && !allowOutOfTurnNetworkDebug && !allowFateWillController) {
        return cfg.jsonResponse(409, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
          ok: false,
          rejectedReason: 'OUT_OF_TURN',
          publishKind: 'rejected',
          operationId,
          actionType,
          receivedBaseVersion: baseVersion,
          authoritativeStateVersion: room.stateVersion
        })));
      }
    }

    const hasCommandPayload = !!(
      !isRematchResetAction
      && body
      && typeof body === 'object'
      && (
        (body.params && typeof body.params === 'object')
        || (body.actor && String(body.actor).trim())
        || (body.action && typeof body.action === 'object')
      )
    );

    const stateHashBefore = cfg.MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
    const previousSnapshotForChargeDelta = cfg.deepClone(room.snapshot);
    let nextSnapshot: any = null;
    let serverPlaybackEvents: unknown[] = [];
    let serverEffectLogs: unknown[] = [];
    let serverPlaybackDiagnostics: unknown = null;
    let commandAction: unknown = null;
    let pendingEffectId: unknown = null;
    if (isRematchResetAction) {
      const rematchSeed = Date.now();
      try {
        nextSnapshot = await cfg.makeInitialSnapshot(rematchSeed, cfg.buildInitialDeckSnapshotOptions(room));
        room.seed = rematchSeed;
      } catch (e) {
        return cfg.jsonResponse(500, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
          ok: false,
          rejectedReason: 'REMATCH_RESET_FAILED',
          publishKind: 'rejected',
          operationId,
          actionType,
          receivedBaseVersion: baseVersion,
          authoritativeStateVersion: room.stateVersion
        })));
      }
    } else if (hasCommandPayload) {
      const commandResult = await cfg.applyCommandPublishToSnapshot(room, body, playerKey);
      if (!commandResult.ok) {
        cfg.MatchAuthority.appendAuthorityLog(room, {
          kind: 'publish_rejected',
          operationId,
          actionType,
          baseVersion,
          committedVersion: room.stateVersion,
          stateHashBefore,
          pendingEffectId: commandResult.pendingEffectId || null,
          rejectedReason: commandResult.rejectedReason || 'COMMAND_REJECTED'
        }, undefined);
        return cfg.jsonResponse(409, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
          ok: false,
          rejectedReason: commandResult.rejectedReason || 'COMMAND_REJECTED',
          errorMessage: commandResult.errorMessage || null,
          publishKind: 'rejected',
          operationId,
          actionType,
          receivedBaseVersion: baseVersion,
          authoritativeStateVersion: room.stateVersion
        })));
      }
      nextSnapshot = commandResult.snapshot;
      serverPlaybackEvents = Array.isArray(commandResult.playbackEvents) ? commandResult.playbackEvents : [];
      serverEffectLogs = Array.isArray(commandResult.effectLogs) ? commandResult.effectLogs : [];
      serverPlaybackDiagnostics = commandResult.playbackDiagnostics || null;
      commandAction = commandResult.action || null;
      pendingEffectId = commandResult.pendingEffectId || null;
    } else {
      return cfg.jsonResponse(409, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
        ok: false,
        rejectedReason: 'COMMAND_REQUIRED',
        publishKind: 'rejected',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      })));
    }

    room.stateVersion += 1;
    nextSnapshot.stateVersion = room.stateVersion;
    const snapshotUpdatedAt = Date.now();
    nextSnapshot.updatedAt = snapshotUpdatedAt;

    room.snapshot = nextSnapshot;
    room.updatedAt = snapshotUpdatedAt;
    room.authoritativeStateHash = cfg.MatchAuthority.computeAuthoritativeStateHash(nextSnapshot);
    if (operationId) {
      const acceptedEntry: any = {
        operationId,
        stateVersion: room.stateVersion,
        updatedAt: Number.isFinite(Number(room.updatedAt)) ? Number(room.updatedAt) : null
      };
      cfg.MatchAuthority.rememberAcceptedOperationBySeat(room, seatKey, acceptedEntry);
    }
    await cfg.refreshTurnTimer({ nowMs: room.updatedAt, forceRestart: !isNetworkDebugAction });

    const meta = {
      playerKey,
      actionType: body.actionType ? String(body.actionType) : null,
      playbackEvents: serverPlaybackEvents,
      effectLogs: serverEffectLogs,
      playbackDiagnostics: serverPlaybackDiagnostics,
      operationId: operationId || null
    };
    const serverTime = Date.now();
    const preparedSnapshot = cfg.prepareSnapshotBroadcast(meta);
    const responsePayload = cfg.buildPublishPayload(room, seatKey, Object.assign(
      cfg.MatchAuthority.buildPublishResponseOptions({
        ok: true,
        serverTime,
        playbackEvents: serverPlaybackEvents,
        effectLogs: serverEffectLogs,
        playbackDiagnostics: serverPlaybackDiagnostics,
        publishKind: 'accepted',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      }),
      { previousSnapshotForChargeDelta }
    ));
    cfg.MatchAuthority.appendAuthorityLog(room, {
      kind: 'publish_accepted',
      operationId,
      actionType: actionType || (commandAction && cfg.asRecord(commandAction).type ? String(cfg.asRecord(commandAction).type) : null),
      baseVersion,
      committedVersion: room.stateVersion,
      stateHashBefore,
      stateHashAfter: room.authoritativeStateHash,
      pendingEffectId,
      dedupeOutcome: 'accepted'
    }, undefined);
    cfg.MatchAuthority.stripTransientChargeDeltaState(room.snapshot);
    await cfg.saveRoom();
    await cfg.broadcastSnapshot({
      ...meta,
      __preparedSnapshot: preparedSnapshot
    });
    return cfg.jsonResponse(200, responsePayload);
  }

  return {
    handlePublish
  };
}

export {
  createMatchWorkerPublishController
};
