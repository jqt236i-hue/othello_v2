export function createMatchLeaveController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};

  async function getActiveRoom(body: Record<string, unknown>): Promise<any> {
    const loadResult = cfg.loadRoom(body);
    if (cfg.awaitLoadRoom === true) await loadResult;
    const room = cfg.getRoom();
    if (!room) return null;

    const expireResult = cfg.expireRoomIfNeeded();
    if ((cfg.awaitExpireRoomIfNeeded === true ? await expireResult : expireResult)) return null;
    return room;
  }

  async function handleLeave(body: Record<string, unknown>): Promise<any> {
    const room = await getActiveRoom(body);
    if (!room) return cfg.jsonResponse(200, { ok: true });

    const seatKey = cfg.normalizePlayerKey(body.seatKey);
    const seatToken = String(body.seatToken || '').trim();
    if (cfg.resolveAuthenticatedSeatKey(room, seatKey, seatToken) !== seatKey) {
      return cfg.jsonResponse(403, {
        ok: false,
        reason: cfg.classifySeatTokenRejectionReason(seatToken)
      });
    }

    cfg.MatchAuthority.applySeatLeaveToRoom(room, seatKey, {
      makeSeatToken: cfg.makeSeatToken,
      now: Date.now()
    });
    const refreshResult = cfg.refreshTurnTimer(room, { nowMs: room.updatedAt, forceRestart: false });
    if (cfg.awaitRefreshTurnTimer === true) await refreshResult;

    const closeStreamsResult = cfg.closeStreamsForSeat(room, seatKey);
    if (cfg.awaitCloseStreamsForSeat === true) await closeStreamsResult;

    const presenceResult = cfg.broadcastPresence({
      type: 'leave',
      seatKey,
      rejoined: false
    });
    if (cfg.awaitBroadcastPresence === true) await presenceResult;

    if (cfg.MatchAuthority.shouldDisposeRoom(room, cfg.getStreamCount(room))) {
      const removeResult = cfg.removeRoom();
      if (cfg.awaitRemoveRoom === true) await removeResult;
    } else {
      const saveResult = cfg.saveRoom();
      if (cfg.awaitSaveRoom === true) await saveResult;
    }

    const serverTime = Date.now();
    const payload = cfg.MatchAuthority.buildRoomPayloadFromRoom(room, {
      ok: true,
      roomBoardConfig: cfg.toPublicRoomBoardConfig(room),
      turnTimer: cfg.toPublicTurnTimer(room, serverTime),
      serverTime
    });
    return cfg.jsonResponse(200, cfg.decorateRoomPayload(payload, room));
  }

  async function handleSpectatorLeave(body: Record<string, unknown>): Promise<any> {
    const room = await getActiveRoom(body);
    if (!room) return cfg.jsonResponse(200, { ok: true });

    const result = cfg.MatchAuthority.removeSpectatorFromRoom(room, {
      spectatorId: body.spectatorId,
      spectatorToken: body.spectatorToken,
      now: Date.now()
    });
    if (!result.ok) {
      return cfg.jsonResponse(403, { ok: false, reason: result.reason });
    }

    const presenceResult = cfg.broadcastPresence({
      type: 'spectator_leave',
      spectatorId: result.spectatorId,
      spectatorName: result.spectatorName,
      rejoined: false
    });
    if (cfg.awaitBroadcastPresence === true) await presenceResult;

    const saveResult = cfg.saveRoom();
    if (cfg.awaitSaveRoom === true) await saveResult;

    const payload = cfg.MatchAuthority.buildRoomPayloadFromRoom(room, {
      ok: true,
      viewerRole: 'spectator',
      spectatorCount: result.spectatorCount,
      maxSpectators: result.maxSpectators,
      serverTime: Date.now()
    });
    return cfg.jsonResponse(200, cfg.decorateRoomPayload(payload, room));
  }

  return { handleLeave, handleSpectatorLeave };
}
