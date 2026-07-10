export function createMatchJoinController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};

  async function handleJoin(body: Record<string, unknown>): Promise<any> {
    const verifiedIdentity = cfg.verifyIdentity ? cfg.verifyIdentity(body) : null;
    if (cfg.verifyIdentity && (!verifiedIdentity || !verifiedIdentity.ok)) {
      return cfg.jsonResponse(403, {
        ok: false,
        reason: verifiedIdentity && verifiedIdentity.reason
      });
    }

    let playerName: any = null;
    if (cfg.validatePlayerNameBeforeRoom === true) {
      playerName = cfg.normalizeNetworkPlayerName(body.playerName);
      if (!playerName) {
        return cfg.jsonResponse(400, { ok: false, reason: 'PLAYER_NAME_REQUIRED' });
      }
    }

    const loadResult = cfg.loadRoom(body);
    if (cfg.awaitLoadRoom === true) await loadResult;
    const room = cfg.getRoom();
    if (!room) return cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });

    const expireResult = cfg.expireRoomIfNeeded();
    if ((cfg.awaitExpireRoomIfNeeded === true ? await expireResult : expireResult)) {
      return cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
    }

    const deckSelectionResult = cfg.resolveDeckSelection(body.deckCode);
    const deckSelection = cfg.awaitResolveDeckSelection === true
      ? await deckSelectionResult
      : deckSelectionResult;
    if (!deckSelection.ok) {
      return cfg.jsonResponse(400, {
        ok: false,
        reason: deckSelection.reason || 'DECK_CODE_INVALID'
      });
    }

    if (!playerName) playerName = cfg.normalizeNetworkPlayerName(body.playerName);
    const playerId = cfg.resolvePlayerId(body, verifiedIdentity);
    const selectedHandSkinId = cfg.normalizeSeatHandSkinId(body.selectedHandSkinId);
    if (!playerName) {
      return cfg.jsonResponse(400, { ok: false, reason: 'PLAYER_NAME_REQUIRED' });
    }
    const requestedSeatKey = cfg.parseSeatKeyOptional(body.seatKey);
    const providedToken = String(body.seatToken || '').trim();
    const authenticatedSeatKey = cfg.resolveAuthenticatedSeatKey(room, requestedSeatKey, providedToken);
    if (!authenticatedSeatKey && !cfg.isJoinPasswordAccepted(room, body.roomPassword)) {
      return cfg.jsonResponse(403, { ok: false, reason: 'ROOM_PASSWORD_INVALID' });
    }

    const seatKey = cfg.resolveSeatForJoin(room, requestedSeatKey, providedToken);
    if (!seatKey) return cfg.jsonResponse(409, { ok: false, reason: 'ROOM_FULL' });

    if (!room.seatTokens || !room.seatTokens[seatKey]) {
      room.seatTokens = room.seatTokens || {};
      room.seatTokens[seatKey] = cfg.makeSeatToken();
    }
    const seatToken = room.seatTokens[seatKey];
    const rejoined = providedToken && providedToken === seatToken;

    const hadTwoSeats = cfg.hasTwoActiveSeats(room);
    cfg.setSeatJoined(room, seatKey);
    cfg.setSeatName(room, seatKey, playerName);
    room.seatHandSkins = cfg.toPublicSeatHandSkins(room);
    room.seatHandSkins[seatKey] = selectedHandSkinId;
    const seatPlayerIds = cfg.normalizeSeatPlayerIds(room.seatPlayerIds);
    seatPlayerIds[seatKey] = playerId;
    room.seatPlayerIds = seatPlayerIds;
    if (!cfg.isAllCardsDeckRoom(room) && deckSelection.hasCustomDeck) {
      cfg.assignRoomDeckSelection(room, seatKey, deckSelection);
    }

    const hasTwoSeatsNow = cfg.hasTwoActiveSeats(room);
    let rebasedInitialSnapshot = false;
    if (!hadTwoSeats && hasTwoSeatsNow && room.stateVersion === 0) {
      try {
        const initialSnapshotResult = cfg.makeInitialSnapshot(
          room.seed,
          cfg.buildInitialDeckSnapshotOptions(room)
        );
        const nextSnapshot = cfg.awaitMakeInitialSnapshot === true
          ? await initialSnapshotResult
          : initialSnapshotResult;
        room.stateVersion = 1;
        nextSnapshot.stateVersion = room.stateVersion;
        nextSnapshot.updatedAt = Date.now();
        room.snapshot = nextSnapshot;
        room.updatedAt = nextSnapshot.updatedAt;
        rebasedInitialSnapshot = true;
      } catch (error) {
        if (cfg.initialSnapshotFailureReason) {
          return cfg.jsonResponse(500, { ok: false, reason: cfg.initialSnapshotFailureReason });
        }
        throw error;
      }
    } else {
      room.updatedAt = Date.now();
    }

    const refreshResult = cfg.refreshTurnTimer(room, {
      nowMs: room.updatedAt,
      forceRestart: !hadTwoSeats && hasTwoSeatsNow
    });
    if (cfg.awaitRefreshTurnTimer === true) await refreshResult;

    const saveResult = cfg.saveRoom();
    if (cfg.awaitSaveRoom === true) await saveResult;

    if (rebasedInitialSnapshot) {
      const snapshotBroadcastResult = cfg.broadcastSnapshot({
        playerKey: seatKey,
        actionType: 'join_room',
        playbackEvents: [],
        operationId: `join_room_${room.stateVersion}`
      });
      if (cfg.awaitBroadcastSnapshot === true) await snapshotBroadcastResult;
    }

    const presenceBroadcastResult = cfg.broadcastPresence({
      type: 'join',
      seatKey,
      rejoined: !!rejoined
    });
    if (cfg.awaitBroadcastPresence === true) await presenceBroadcastResult;

    const serverTime = Date.now();
    const payload = cfg.MatchAuthority.buildRoomPayloadFromRoom(room, {
      ok: true,
      seatKey,
      playerName,
      seatToken,
      rejoined: !!rejoined,
      roomDeck: cfg.toPublicRoomDeck(room),
      roomBoardConfig: cfg.toPublicRoomBoardConfig(room),
      networkDebugEnabled: cfg.toPublicNetworkDebugEnabled(room),
      networkAutoEnabled: cfg.toPublicNetworkAutoEnabled(room),
      stateVersion: room.stateVersion,
      snapshot: cfg.toPublicSnapshot(room, seatKey),
      turnTimer: cfg.toPublicTurnTimer(room, serverTime),
      serverTime
    });
    return cfg.jsonResponse(200, cfg.decorateRoomPayload(payload, room));
  }

  return { handleJoin };
}
