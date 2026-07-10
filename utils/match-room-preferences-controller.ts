export function createMatchRoomPreferencesController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};

  async function resolveAuthenticatedSeat(body: Record<string, unknown>): Promise<any> {
    const loadResult = cfg.loadRoom(body);
    if (cfg.awaitLoadRoom === true) await loadResult;
    const room = cfg.getRoom();
    if (!room) return { response: cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' }) };

    const expireResult = cfg.expireRoomIfNeeded();
    if ((cfg.awaitExpireRoomIfNeeded === true ? await expireResult : expireResult)) {
      return { response: cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' }) };
    }

    const requestedSeatKey = cfg.parseSeatKeyOptional(body.seatKey);
    const seatToken = String(body.seatToken || '').trim();
    const seatKey = cfg.resolveAuthenticatedSeatKey(room, requestedSeatKey, seatToken);
    if (!seatKey) {
      return {
        response: cfg.jsonResponse(403, {
          ok: false,
          reason: cfg.classifySeatTokenRejectionReason(seatToken)
        })
      };
    }
    if (!cfg.isSeatJoined(room, seatKey)) {
      return { response: cfg.jsonResponse(409, { ok: false, reason: 'SEAT_NOT_JOINED' }) };
    }
    return { room, seatKey };
  }

  function buildRoomPayload(room: any, seatKey: any, extra: any, includeNetworkAutoEnabled: boolean): any {
    const serverTime = Date.now();
    const options: any = { ok: true, seatKey };
    if (extra && Object.prototype.hasOwnProperty.call(extra, 'selectedHandSkinId')) {
      options.selectedHandSkinId = extra.selectedHandSkinId;
    }
    options.roomDeck = extra && Object.prototype.hasOwnProperty.call(extra, 'roomDeck')
      ? extra.roomDeck
      : cfg.toPublicRoomDeck(room);
    options.roomBoardConfig = cfg.toPublicRoomBoardConfig(room);
    options.networkDebugEnabled = cfg.toPublicNetworkDebugEnabled(room);
    if (includeNetworkAutoEnabled === true) {
      options.networkAutoEnabled = cfg.toPublicNetworkAutoEnabled(room);
    }
    options.turnTimer = cfg.toPublicTurnTimer(room, serverTime);
    options.serverTime = serverTime;
    return cfg.MatchAuthority.buildRoomPayloadFromRoom(room, options);
  }

  async function handleHandSkin(body: Record<string, unknown>): Promise<any> {
    const context = await resolveAuthenticatedSeat(body);
    if (context.response) return context.response;
    const { room, seatKey } = context;

    const selectedHandSkinId = cfg.normalizeSeatHandSkinId(body.selectedHandSkinId);
    room.seatHandSkins = cfg.toPublicSeatHandSkins(room);
    const previousSkinId = room.seatHandSkins[seatKey] || '';
    room.seatHandSkins[seatKey] = selectedHandSkinId;
    room.updatedAt = Date.now();

    const saveResult = cfg.saveRoom();
    if (cfg.awaitSaveRoom === true) await saveResult;

    if (previousSkinId !== selectedHandSkinId) {
      const presenceResult = cfg.broadcastPresence({
        type: 'hand_skin',
        seatKey,
        rejoined: false
      });
      if (cfg.awaitBroadcastPresence === true) await presenceResult;
    }

    return cfg.jsonResponse(200, cfg.decorateRoomPayload(
      buildRoomPayload(room, seatKey, { selectedHandSkinId }, cfg.includeNetworkAutoEnabledForHandSkin === true),
      room
    ));
  }

  async function handleDeck(body: Record<string, unknown>): Promise<any> {
    const context = await resolveAuthenticatedSeat(body);
    if (context.response) return context.response;
    const { room, seatKey } = context;

    if (cfg.isAllCardsDeckRoom(room)) {
      return cfg.jsonResponse(200, cfg.decorateRoomPayload(
        buildRoomPayload(room, seatKey, null, cfg.includeNetworkAutoEnabledForDeck === true),
        room
      ));
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

    const previousRoomDeckJson = JSON.stringify(cfg.toPublicRoomDeck(room) || null);
    cfg.assignRoomDeckSelection(room, seatKey, deckSelection);
    const nextRoomDeck = cfg.toPublicRoomDeck(room);
    room.updatedAt = Date.now();

    const saveResult = cfg.saveRoom();
    if (cfg.awaitSaveRoom === true) await saveResult;

    if (previousRoomDeckJson !== JSON.stringify(nextRoomDeck || null)) {
      const presenceResult = cfg.broadcastPresence({
        type: 'deck',
        seatKey,
        rejoined: false
      });
      if (cfg.awaitBroadcastPresence === true) await presenceResult;
    }

    return cfg.jsonResponse(200, cfg.decorateRoomPayload(
      buildRoomPayload(room, seatKey, { roomDeck: nextRoomDeck }, cfg.includeNetworkAutoEnabledForDeck === true),
      room
    ));
  }

  return { handleHandSkin, handleDeck };
}
