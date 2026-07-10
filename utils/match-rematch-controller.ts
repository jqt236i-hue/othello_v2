export function createMatchRematchController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};

  async function resolveSeat(body: Record<string, unknown>): Promise<any> {
    const loadResult = cfg.loadRoom(body);
    if (cfg.awaitLoadRoom === true) await loadResult;
    const room = cfg.getRoom();
    if (!room) return { response: cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' }) };

    const expireResult = cfg.expireRoomIfNeeded();
    if ((cfg.awaitExpireRoomIfNeeded === true ? await expireResult : expireResult)) {
      return { response: cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' }) };
    }

    const validation = cfg.validateSeat(room, body);
    if (!validation.ok) {
      return {
        response: cfg.jsonResponse(validation.status, cfg.buildSeatFailurePayload(room, validation))
      };
    }
    return { room, seatKey: validation.seatKey };
  }

  async function publishPresence(meta: any): Promise<void> {
    const result = cfg.broadcastPresence(meta);
    if (cfg.awaitBroadcastPresence === true) await result;
  }

  async function handleRematchRequest(body: Record<string, unknown>): Promise<any> {
    const context = await resolveSeat(body);
    if (context.response) return context.response;
    const { room, seatKey } = context;

    if (!cfg.hasOpponent(room)) {
      return cfg.jsonResponse(409, cfg.buildOpponentRequiredPayload(room));
    }

    const requestId = cfg.makeRematchRequestId();
    cfg.touchRoom(room);
    await publishPresence({
      type: 'rematch_request',
      seatKey,
      requestId,
      rejoined: false
    });
    return cfg.jsonResponse(200, cfg.buildRequestPayload(room, { seatKey, requestId }));
  }

  async function handleRematchResponse(body: Record<string, unknown>): Promise<any> {
    const context = await resolveSeat(body);
    if (context.response) return context.response;
    const { room, seatKey } = context;
    const requestId = String(body.requestId || '').trim();
    const accepted = body.accepted === true;

    cfg.touchRoom(room);
    await publishPresence({
      type: 'rematch_response',
      seatKey,
      requestId,
      accepted,
      rejoined: false
    });
    return cfg.jsonResponse(200, cfg.buildResponsePayload(room, { seatKey, requestId, accepted }));
  }

  return { handleRematchRequest, handleRematchResponse };
}
