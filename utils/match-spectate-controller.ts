export function createMatchSpectateController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};

  async function handleSpectate(body: Record<string, unknown>): Promise<any> {
    await cfg.loadRoom(body);
    const room = cfg.getRoom();
    if (!room) return cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
    if (await cfg.expireRoomIfNeeded()) {
      return cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
    }
    if (!cfg.isJoinPasswordAccepted(room, body.roomPassword)) {
      return cfg.jsonResponse(403, { ok: false, reason: 'ROOM_PASSWORD_INVALID' });
    }

    const result = cfg.MatchAuthority.addSpectatorToRoom(room, {
      spectatorName: body.spectatorName || body.playerName,
      makeSpectatorToken: cfg.makeSpectatorToken,
      makeSpectatorId: cfg.makeSpectatorId,
      now: Date.now()
    });
    if (!result.ok) {
      return cfg.jsonResponse(result.reason === 'SPECTATOR_FULL' ? 409 : 500, {
        ok: false,
        reason: result.reason
      });
    }

    await cfg.saveRoom();
    await cfg.broadcastPresence({
      type: 'spectator_join',
      spectatorId: result.spectatorId,
      spectatorName: result.spectatorName,
      rejoined: false
    });

    const viewer = { role: 'spectator', spectatorId: result.spectatorId };
    const serverTime = Date.now();
    const payload = cfg.MatchAuthority.buildRoomPayloadFromRoom(room, {
      ok: true,
      viewerRole: 'spectator',
      spectatorId: result.spectatorId,
      spectatorToken: result.spectatorToken,
      spectatorName: result.spectatorName,
      spectatorCount: result.spectatorCount,
      maxSpectators: result.maxSpectators,
      stateVersion: room.stateVersion,
      snapshot: cfg.toPublicSnapshotForViewer(room, viewer),
      roomDeck: cfg.toPublicRoomDeck(room),
      roomBoardConfig: cfg.toPublicRoomBoardConfig(room),
      networkDebugEnabled: cfg.toPublicNetworkDebugEnabled(room),
      networkAutoEnabled: cfg.toPublicNetworkAutoEnabled(room),
      turnTimer: cfg.toPublicTurnTimer(room, serverTime),
      serverTime
    });
    return cfg.jsonResponse(200, cfg.decorateRoomPayload(payload, room));
  }

  return { handleSpectate };
}
