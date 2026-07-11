export function createMatchPublishController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};

  function resolveAutoPassNoticeForCommand(actionType: unknown, actionValue: unknown, playerKey: unknown) {
    const action = cfg.asRecord(actionValue);
    const normalizedActionType = String(actionType || action.type || '').trim().toLowerCase();
    if (normalizedActionType !== 'pass' || action.autoNoActionPass !== true) return null;
    return {
      playerKey: cfg.normalizePlayerKey(action.playerKey || playerKey),
      reason: 'no_legal_moves_or_usable_cards'
    };
  }

  function resolveAutoPassNoticeForPublishBody(actionType: unknown, bodyValue: unknown, playerKey: unknown) {
    const source = cfg.asRecord(bodyValue);
    const params = cfg.asRecord(source.params);
    const action = cfg.asRecord(source.action);
    const normalizedActionType = String(actionType || source.actionType || action.type || action.actionType || '').trim().toLowerCase();
    const autoNoActionPass = params.autoNoActionPass === true || action.autoNoActionPass === true || source.autoNoActionPass === true;
    if (normalizedActionType !== 'pass' || autoNoActionPass !== true) return null;
    return {
      playerKey: cfg.normalizePlayerKey(action.playerKey || source.playerKey || source.actor || playerKey),
      reason: 'no_legal_moves_or_usable_cards'
    };
  }

  async function handlePublish(body: Record<string, unknown>): Promise<any> {
    await cfg.loadRoom(body);
    const room = cfg.getRoom();

    if (!room) {
      return cfg.jsonResponse(404, { ok: false, rejectedReason: 'ROOM_NOT_FOUND' });
    }

    await cfg.applyExpiredTurnTimeoutIfNeeded();

    const seatKey = typeof cfg.resolveSeatKey === 'function'
      ? cfg.resolveSeatKey(body)
      : cfg.normalizePlayerKey(body.seatKey);
    const playerKey = typeof cfg.resolvePlayerKey === 'function'
      ? cfg.resolvePlayerKey(body, seatKey)
      : cfg.normalizePlayerKey(body.playerKey);
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
      const isFateWillControllerForOwner = cfg.allowFateWillOwnerAction === true
        && cfg.MatchAuthority.isFateWillControllerForCurrentTurn(room.snapshot, seatKey) === true
        && cfg.getCurrentPlayerKey(cfg.asRecord(room.snapshot).gameState) === playerKey;
      if (!isFateWillControllerForOwner) {
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
      const autoPassNotice = resolveAutoPassNoticeForPublishBody(actionType, body, playerKey);
      const replayPresentationFrameEntry = typeof cfg.MatchAuthority.findPresentationFrameEntryForAcceptedOperation === 'function'
        ? cfg.MatchAuthority.findPresentationFrameEntryForAcceptedOperation(room, lastAcceptedOperation)
        : null;
      const replayPublicFrame = replayPresentationFrameEntry && typeof cfg.MatchAuthority.toPublicPresentationFrame === 'function'
        ? cfg.MatchAuthority.toPublicPresentationFrame(replayPresentationFrameEntry, { role: 'seat', seatKey }, room)
        : null;
      const replayPlaybackEvents = replayPublicFrame && Array.isArray(replayPublicFrame.playbackEvents)
        ? replayPublicFrame.playbackEvents
        : [];
      const replayEffectLogs = replayPublicFrame && Array.isArray(replayPublicFrame.effectLogs)
        ? replayPublicFrame.effectLogs
        : [];
      return cfg.jsonResponse(200, cfg.buildPublishPayload(room, seatKey, Object.assign(
        cfg.MatchAuthority.buildPublishResponseOptions({
          ok: true,
          idempotentReplay: true,
          serverTime,
          autoPassNotice,
          playbackEvents: replayPlaybackEvents,
          effectLogs: replayEffectLogs,
          playbackDiagnostics: replayPublicFrame ? replayPublicFrame.playbackDiagnostics : null,
          publishKind: 'idempotent_replay',
          operationId,
          actionType,
          receivedBaseVersion: baseVersion,
          authoritativeStateVersion: room.stateVersion,
          replayedStateVersion: lastAcceptedOperation.stateVersion
        }),
        { presentationFrameEntry: replayPresentationFrameEntry }
      )));
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
      const allowOutOfTurnRematch = isRematchResetAction;
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
    const previousSnapshotForChargeDelta = cfg.includePreviousSnapshotForChargeDelta === true
      ? cfg.deepClone(room.snapshot)
      : null;
    let nextSnapshot: any = null;
    let serverPlaybackEvents: unknown[] = [];
    let serverEffectLogs: unknown[] = [];
    let serverPlaybackDiagnostics: unknown = null;
    let commandAction: unknown = null;
    let pendingEffectId: unknown = null;
    if (isRematchResetAction) {
      const rematchSeed = Date.now();
      if (cfg.catchRematchResetErrors === false) {
        nextSnapshot = await cfg.makeInitialSnapshot(rematchSeed, cfg.buildInitialDeckSnapshotOptions(room));
        room.seed = rematchSeed;
      } else {
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

    if (typeof cfg.ensureInitialPresentationSnapshots === 'function') {
      cfg.ensureInitialPresentationSnapshots(room);
    }
    const previousStateVersion = room.stateVersion;
    room.stateVersion += 1;
    nextSnapshot.stateVersion = room.stateVersion;
    const snapshotUpdatedAt = Date.now();
    nextSnapshot.updatedAt = snapshotUpdatedAt;

    room.snapshot = nextSnapshot;
    room.updatedAt = snapshotUpdatedAt;
    const publishViewerArtifacts = cfg.buildPublishViewerArtifacts(room, {
      perfCounters: cfg.publishPerfCounters
    });
    room.authoritativeStateHash = publishViewerArtifacts.canonicalHash;
    if (operationId) {
      const acceptedEntry: any = {
        operationId,
        stateVersion: room.stateVersion,
        updatedAt: Number.isFinite(Number(room.updatedAt)) ? Number(room.updatedAt) : null
      };
      cfg.MatchAuthority.rememberAcceptedOperationBySeat(room, seatKey, acceptedEntry);
    }
    await cfg.refreshTurnTimer({ nowMs: room.updatedAt, forceRestart: !isNetworkDebugAction });

    if (typeof cfg.finalizeRatedMatchAfterAcceptedPublish === 'function') {
      await cfg.finalizeRatedMatchAfterAcceptedPublish(room);
    }

    const autoPassNotice = resolveAutoPassNoticeForCommand(actionType, commandAction, playerKey)
      || resolveAutoPassNoticeForPublishBody(actionType, body, playerKey);
    const presentationFrameEntry = typeof cfg.appendPresentationFrameForAcceptedPublish === 'function'
      ? cfg.appendPresentationFrameForAcceptedPublish(room, {
        previousStateVersion,
        nextStateVersion: room.stateVersion,
        operationId,
        actorSeatKey: playerKey,
        actionType: body.actionType ? String(body.actionType) : actionType,
        playbackEvents: serverPlaybackEvents,
        effectLogs: serverEffectLogs,
        playbackDiagnostics: serverPlaybackDiagnostics,
        createdAt: room.updatedAt
      })
      : null;
    const meta = {
      playerKey,
      actionType: body.actionType ? String(body.actionType) : null,
      playbackEvents: serverPlaybackEvents,
      effectLogs: serverEffectLogs,
      playbackDiagnostics: serverPlaybackDiagnostics,
      autoPassNotice,
      operationId: operationId || null,
      presentationFrameEntry
    };
    const serverTime = Date.now();
    const preparedSnapshot = cfg.prepareSnapshotBroadcast(meta);
    const publishResponseOptions = Object.assign(
      cfg.MatchAuthority.buildPublishResponseOptions({
        ok: true,
        serverTime,
        playbackEvents: serverPlaybackEvents,
        effectLogs: serverEffectLogs,
        playbackDiagnostics: serverPlaybackDiagnostics,
        autoPassNotice,
        presentationFrameEntry,
        publishKind: 'accepted',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      }),
      { previousSnapshotForChargeDelta, presentationFrameEntry }
    );
    if (cfg.includePreviousSnapshotForChargeDelta !== true) {
      delete publishResponseOptions.previousSnapshotForChargeDelta;
    }
    publishResponseOptions.snapshot = publishViewerArtifacts.projectedSnapshots[seatKey];
    const responsePayload = cfg.buildPublishPayload(room, seatKey, publishResponseOptions);
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
