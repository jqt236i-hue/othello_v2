import { compactNetworkPresentationEnvelope } from '../shared/network-presentation-envelope';
import PassTurnReturn = require('../shared/pass-turn-return');
import StoneSupply = require('../shared/stone-supply');
import { clearRematchRequests, hasRematchAgreement } from './match-rematch-controller';

// Adapters may construct a controller per request (local server), so the lane is
// keyed by the canonical room, not by the controller instance. A failed publish
// must release the lane too; the next request re-loads and validates authority.
const publishTailByRoom = new WeakMap<object, Promise<void>>();

export function createMatchPublishController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const preCommandHousekeepingKeys = Object.freeze([
    'lastAcceptedOperationBySeat',
    'acceptedOperationHistoryBySeat',
    'authorityLog',
    'sseEventBuffer',
    'authoritativeStateHash'
  ]);

  function capturePreCommandHousekeeping(room: Record<string, unknown>) {
    return preCommandHousekeepingKeys.map((key) => ({
      key,
      hadOwn: Object.prototype.hasOwnProperty.call(room, key),
      value: room[key]
    }));
  }

  function restorePreCommandHousekeeping(
    room: Record<string, unknown>,
    captured: Array<{ key: string; hadOwn: boolean; value: unknown }>
  ) {
    for (const entry of captured) {
      if (entry.hadOwn) room[entry.key] = entry.value;
      else delete room[entry.key];
    }
  }

  // パスの通知（01-rulebook.md §2.5）。行動が無い自動パス、任意のパス、時間切れパスを区別して両席へ届ける。
  function resolvePassNoticeReason(...sources: Record<string, unknown>[]): string {
    const isTrue = (key: string) => sources.some((source) => source[key] === true);
    if (isTrue('autoNoActionPass')) return 'no_legal_moves_or_usable_cards';
    const timeout = isTrue('timeoutPass') || isTrue('forcePass')
      || sources.some((source) => String(source.reason || '').trim().toLowerCase() === 'timeout');
    return timeout ? 'timeout_pass' : 'voluntary_pass';
  }

  function resolveAutoPassNoticeForCommand(actionType: unknown, actionValue: unknown, playerKey: unknown) {
    const action = cfg.asRecord(actionValue);
    const requestedActionType = String(actionType || '').trim().toLowerCase();
    const resolvedActionType = String(action.type || action.actionType || '').trim().toLowerCase();
    const normalizedActionType = requestedActionType === 'auto_turn'
      ? resolvedActionType
      : (requestedActionType || resolvedActionType);
    if (normalizedActionType !== 'pass' || (resolvedActionType && resolvedActionType !== 'pass')) return null;
    return {
      playerKey: cfg.normalizePlayerKey(action.playerKey || playerKey),
      reason: resolvePassNoticeReason(action)
    };
  }

  // 2回目のパスで終局せず、先にパスした側へ手番が戻った時は「続行」通知も出す（01-rulebook.md §8.2 / §8.4）。
  function withPassTurnReturned(notice: { playerKey: string; reason: string } | null, previousSnapshot: any, nextSnapshot: any) {
    if (!notice) return notice;
    const previousGameState = previousSnapshot && previousSnapshot.gameState;
    const nextGameState = nextSnapshot && nextSnapshot.gameState;
    return PassTurnReturn.didPassReturnTurn(previousGameState, nextGameState, notice.playerKey)
      ? { ...notice, turnReturned: true }
      : notice;
  }

  // 持ち石切れの自動パスは理由を分けて見せる（ローカルの pass-handler と同じ、01-rulebook.md §8.4）。
  function withStoneSupplyNoActionReason(notice: { playerKey: string; reason: string } | null, previousSnapshot: any) {
    if (!notice || notice.reason !== 'no_legal_moves_or_usable_cards') return notice;
    const previousCardState = previousSnapshot && previousSnapshot.cardState;
    let exhausted = false;
    try {
      exhausted = !!previousCardState && StoneSupply.isStoneSupplyExhausted(previousCardState, notice.playerKey) === true;
    } catch (_error) {
      exhausted = false;
    }
    return exhausted ? { ...notice, reason: 'stone_supply_exhausted_no_usable_cards' } : notice;
  }

  function resolveAutoPassNoticeForPublishBody(actionType: unknown, bodyValue: unknown, playerKey: unknown) {
    const source = cfg.asRecord(bodyValue);
    const params = cfg.asRecord(source.params);
    const action = cfg.asRecord(source.action);
    const normalizedActionType = String(actionType || source.actionType || action.type || action.actionType || '').trim().toLowerCase();
    if (normalizedActionType !== 'pass') return null;
    return {
      playerKey: cfg.normalizePlayerKey(action.playerKey || source.playerKey || source.actor || playerKey),
      reason: resolvePassNoticeReason(params, action, source)
    };
  }

  async function handlePublish(body: Record<string, unknown>): Promise<any> {
    await cfg.loadRoom(body);
    const room = cfg.getRoom();
    if (!room) return handlePublishNow(body);
    const previous = publishTailByRoom.get(room) || Promise.resolve();
    const result = previous.then(() => handlePublishNow(body));
    const tail = result.then(() => undefined, () => undefined);
    publishTailByRoom.set(room, tail);
    void tail.then(() => {
      if (publishTailByRoom.get(room) === tail) publishTailByRoom.delete(room);
    });
    return result;
  }

  async function handlePublishNow(body: Record<string, unknown>): Promise<any> {
    const respond = (statusCode: number, payload: unknown): any => cfg.jsonResponse(
      statusCode,
      compactNetworkPresentationEnvelope(payload, body && body.presentationEnvelopeVersion)
    );
    await cfg.loadRoom(body);
    const room = cfg.getRoom();

    if (!room) {
      return respond(404, { ok: false, rejectedReason: 'ROOM_NOT_FOUND' });
    }

    await cfg.applyExpiredTurnTimeoutIfNeeded();
    const preCommandHousekeeping = capturePreCommandHousekeeping(room);

    const seatKey = typeof cfg.resolveSeatKey === 'function'
      ? cfg.resolveSeatKey(body)
      : cfg.normalizePlayerKey(body.seatKey);
    const playerKey = typeof cfg.resolvePlayerKey === 'function'
      ? cfg.resolvePlayerKey(body, seatKey)
      : cfg.normalizePlayerKey(body.playerKey);
    const seatToken = String(body.seatToken || '').trim();
    const baseVersion = Number.isFinite(Number(body.baseVersion)) ? Number(body.baseVersion) : null;
    const actionType = String(
      body.actionType
      || cfg.asRecord(body.action).type
      || cfg.asRecord(body.action).actionType
      || ''
    ).trim().toLowerCase();
    const operationId = cfg.normalizeOperationId(body.operationId);
    const isRematchResetAction = actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart';
    const isNetworkDebugAction = cfg.isNetworkDebugFillHandPayload(body);
    const viewerSeatKey = cfg.resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    const preparedStateVersion = room.stateVersion;
    const preparedAuthoritySnapshot = room.snapshot;
    const preparedTurnPlayer = cfg.getCurrentPlayerKey(cfg.asRecord(room.snapshot).gameState);
    // Timeout/leave/reset can run outside the publish lane. Like the timeout
    // resolver, discard asynchronous preparation if its authority inputs changed.
    const commandContextChanged = () => cfg.getRoom() !== room
      || room.stateVersion !== preparedStateVersion
      || room.snapshot !== preparedAuthoritySnapshot
      || cfg.getCurrentPlayerKey(cfg.asRecord(room.snapshot).gameState) !== preparedTurnPlayer
      || !cfg.asRecord(room.seats)[seatKey]
      || cfg.asRecord(room.seatTokens)[seatKey] !== seatToken;
    const acceptedOperationsBySeat = cfg.ensureAcceptedOperationsBySeat(room);
    if (!Array.isArray(room.authorityLog)) room.authorityLog = [];
    if (!Array.isArray(room.sseEventBuffer)) room.sseEventBuffer = [];
    if (typeof room.authoritativeStateHash === 'undefined') {
      room.authoritativeStateHash = cfg.MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
    }

    if (!cfg.asRecord(room.seats)[seatKey]) {
      return respond(403, cfg.buildPublishPayload(room, viewerSeatKey, cfg.MatchAuthority.buildPublishResponseOptions({
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
        return respond(403, cfg.buildPublishPayload(room, viewerSeatKey, cfg.MatchAuthority.buildPublishResponseOptions({
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
      return respond(403, cfg.buildPublishPayload(room, null, cfg.MatchAuthority.buildPublishResponseOptions({
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
      return respond(409, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
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
      const storedAutoPassNotice = cfg.asRecord(lastAcceptedOperation.autoPassNotice);
      const autoPassNotice = Object.keys(storedAutoPassNotice).length > 0
        ? storedAutoPassNotice
        : resolveAutoPassNoticeForPublishBody(actionType, body, playerKey);
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
      return respond(200, cfg.buildPublishPayload(room, seatKey, Object.assign(
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
      return respond(409, cfg.buildPublishPayload(room, seatKey, versionRejectedOptions));
    }

    if (isRematchResetAction && !hasRematchAgreement(room)) {
      cfg.MatchAuthority.appendAuthorityLog(room, {
        kind: 'publish_rejected',
        operationId,
        actionType,
        baseVersion,
        committedVersion: room.stateVersion,
        stateHashBefore: room.authoritativeStateHash,
        rejectedReason: 'REMATCH_NOT_AGREED'
      }, undefined);
      return respond(409, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
        ok: false,
        rejectedReason: 'REMATCH_NOT_AGREED',
        publishKind: 'rejected',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      })));
    }

    const expectedPlayerKey = cfg.getCurrentPlayerKey(cfg.asRecord(room.snapshot).gameState);
    if (
      !isRematchResetAction
      && typeof cfg.isSnapshotGameOver === 'function'
      && await cfg.isSnapshotGameOver(room.snapshot)
    ) {
      return respond(409, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
        ok: false,
        rejectedReason: 'GAME_ALREADY_OVER',
        publishKind: 'rejected',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      })));
    }
    const fateWillControllerKey = (
      cfg.MatchAuthority
      && typeof cfg.MatchAuthority.getFateWillControllerKey === 'function'
    )
      ? cfg.MatchAuthority.getFateWillControllerKey(room.snapshot, expectedPlayerKey)
      : null;
    if (
      fateWillControllerKey
      && seatKey !== fateWillControllerKey
      && !isRematchResetAction
      && !isNetworkDebugAction
    ) {
      return respond(409, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
        ok: false,
        rejectedReason: 'TURN_CONTROLLED_BY_FATE_WILL',
        publishKind: 'rejected',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      })));
    }
    if (playerKey !== expectedPlayerKey) {
      const allowOutOfTurnRematch = isRematchResetAction;
      const allowOutOfTurnNetworkDebug = isNetworkDebugAction && cfg.toPublicNetworkDebugEnabled(room);
      const allowFateWillController = cfg.MatchAuthority.isFateWillControllerForCurrentTurn(room.snapshot, playerKey);
      if (!allowOutOfTurnRematch && !allowOutOfTurnNetworkDebug && !allowFateWillController) {
        return respond(409, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
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

    if (commandContextChanged()) return handlePublishNow(body);
    const stateHashBefore = cfg.MatchAuthority.computeAuthoritativeStateHash(room.snapshot);
    const snapshotBeforeCommand = room.snapshot;
    let nextSnapshot: any = null;
    let serverPlaybackEvents: unknown[] = [];
    let serverEffectLogs: unknown[] = [];
    let serverPlaybackDiagnostics: unknown = null;
    let commandAction: unknown = null;
    let pendingEffectId: unknown = null;
    let rematchSeed: number | null = null;
    if (isRematchResetAction) {
      rematchSeed = Date.now();
      if (cfg.catchRematchResetErrors === false) {
        nextSnapshot = await cfg.makeInitialSnapshot(rematchSeed, cfg.buildInitialDeckSnapshotOptions(room));
      } else {
        try {
          nextSnapshot = await cfg.makeInitialSnapshot(rematchSeed, cfg.buildInitialDeckSnapshotOptions(room));
        } catch (e) {
          return respond(500, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
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
      if (commandContextChanged()) return handlePublishNow(body);
      if (!commandResult.ok) {
        if (commandResult.rejectedReason === 'RUNTIME_UNAVAILABLE') {
          restorePreCommandHousekeeping(room, preCommandHousekeeping);
        } else {
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
        }
        return respond(409, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
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
      return respond(409, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
        ok: false,
        rejectedReason: 'COMMAND_REQUIRED',
        publishKind: 'rejected',
        operationId,
        actionType,
        receivedBaseVersion: baseVersion,
        authoritativeStateVersion: room.stateVersion
      })));
    }

    if (commandContextChanged()) return handlePublishNow(body);
    if (typeof cfg.MatchAuthority.normalizeSnapshotBoardContract === 'function') {
      const boardContractInspection = cfg.MatchAuthority.normalizeSnapshotBoardContract(nextSnapshot, {
        allowLegacy: true,
        requireFullSnapshot: true
      });
      if (!boardContractInspection || boardContractInspection.ok !== true) {
        cfg.MatchAuthority.appendAuthorityLog(room, {
          kind: 'publish_rejected',
          operationId,
          actionType,
          baseVersion,
          committedVersion: room.stateVersion,
          stateHashBefore,
          rejectedReason: 'INVALID_BOARD_CONTRACT',
          boardContractErrors: boardContractInspection && boardContractInspection.errors
        }, undefined);
        return respond(500, cfg.buildPublishPayload(room, seatKey, cfg.MatchAuthority.buildPublishResponseOptions({
          ok: false,
          rejectedReason: 'INVALID_BOARD_CONTRACT',
          publishKind: 'rejected',
          operationId,
          actionType,
          receivedBaseVersion: baseVersion,
          authoritativeStateVersion: room.stateVersion
        })));
      }
    }

    if (typeof cfg.ensureInitialPresentationSnapshots === 'function') {
      cfg.ensureInitialPresentationSnapshots(room);
    }
    const previousStateVersion = room.stateVersion;
    const committedStateVersion = previousStateVersion + 1;
    room.stateVersion = committedStateVersion;
    if (rematchSeed !== null) room.seed = rematchSeed;
    if (isRematchResetAction) clearRematchRequests(room);
    nextSnapshot.stateVersion = committedStateVersion;
    const snapshotUpdatedAt = Date.now();
    nextSnapshot.updatedAt = snapshotUpdatedAt;

    room.snapshot = nextSnapshot;
    room.updatedAt = snapshotUpdatedAt;
    const publishViewerArtifacts = cfg.buildPublishViewerArtifacts(room, {
      perfCounters: cfg.publishPerfCounters
    });
    room.authoritativeStateHash = publishViewerArtifacts.canonicalHash;
    const autoPassNotice = withPassTurnReturned(
      withStoneSupplyNoActionReason(
        resolveAutoPassNoticeForCommand(actionType, commandAction, playerKey)
          || resolveAutoPassNoticeForPublishBody(actionType, body, playerKey),
        snapshotBeforeCommand
      ),
      snapshotBeforeCommand,
      nextSnapshot
    );
    if (operationId) {
      const acceptedEntry: any = {
        operationId,
        stateVersion: committedStateVersion,
        updatedAt: Number.isFinite(Number(room.updatedAt)) ? Number(room.updatedAt) : null
      };
      if (autoPassNotice) {
        acceptedEntry.autoPassNotice = { ...autoPassNotice };
      }
      cfg.MatchAuthority.rememberAcceptedOperationBySeat(room, seatKey, acceptedEntry);
    }
    await cfg.refreshTurnTimer({ nowMs: room.updatedAt, forceRestart: !isNetworkDebugAction });

    const presentationFrameEntry = typeof cfg.appendPresentationFrameForAcceptedPublish === 'function'
      ? cfg.appendPresentationFrameForAcceptedPublish(room, {
        previousStateVersion,
        nextStateVersion: committedStateVersion,
        operationId,
        actorSeatKey: playerKey,
        actionType: body.actionType ? String(body.actionType) : actionType,
        playbackEvents: serverPlaybackEvents,
        effectLogs: serverEffectLogs,
        playbackDiagnostics: serverPlaybackDiagnostics,
        publishViewerArtifacts,
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
      presentationFrameEntry,
      __publishViewerArtifacts: publishViewerArtifacts
    };
    const serverTime = Date.now();
    const preparedSnapshot = cfg.prepareSnapshotBroadcast(meta);
    const publishResponseOptions = cfg.MatchAuthority.buildPublishResponseOptions({
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
      authoritativeStateVersion: committedStateVersion
    });
    publishResponseOptions.presentationFrameEntry = presentationFrameEntry;
    publishResponseOptions.__publishViewerArtifacts = publishViewerArtifacts;
    publishResponseOptions.snapshot = publishViewerArtifacts.projectedSnapshots[seatKey];
    const responsePayload = cfg.buildPublishPayload(room, seatKey, publishResponseOptions);
    cfg.MatchAuthority.appendAuthorityLog(room, {
      kind: 'publish_accepted',
      operationId,
      actionType: actionType || (commandAction && cfg.asRecord(commandAction).type ? String(cfg.asRecord(commandAction).type) : null),
      baseVersion,
      committedVersion: committedStateVersion,
      stateHashBefore,
      stateHashAfter: room.authoritativeStateHash,
      pendingEffectId,
      dedupeOutcome: 'accepted'
    }, undefined);
    cfg.MatchAuthority.stripTransientChargeDeltaState(room.snapshot);
    cfg.stagePreparedSnapshotBroadcast(preparedSnapshot);
    await cfg.saveRoom();
    let broadcastPromise: Promise<unknown>;
    try {
      broadcastPromise = Promise.resolve(cfg.broadcastSnapshot({
        ...meta,
        __preparedSnapshot: preparedSnapshot
      }));
    } catch (error) {
      broadcastPromise = Promise.reject(error);
    }
    if (typeof cfg.deferSnapshotBroadcast === 'function') {
      cfg.deferSnapshotBroadcast(broadcastPromise, {
        roomId: room.roomId || null,
        operationId: operationId || null,
        stateVersion: committedStateVersion
      });
    } else {
      await broadcastPromise;
    }
    return respond(200, responsePayload);
  }

  return {
    handlePublish
  };
}
