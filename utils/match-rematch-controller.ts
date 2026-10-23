const REMATCH_AGREEMENT_TTL_MS = 120000;
const REMATCH_REQUEST_LIMIT = 4;

type RematchRequestRecord = { fromSeat: string; accepted: boolean; createdAt: number; acceptedAt: number | null };

function readRematchRequests(room: any): Record<string, RematchRequestRecord> {
  if (!room.rematchRequests || typeof room.rematchRequests !== 'object') room.rematchRequests = {};
  return room.rematchRequests;
}

/** Server-side record of a rematch request; `reset_game` is only accepted after the opponent accepts one. */
export function recordRematchRequest(room: any, requestId: string, fromSeat: string, nowMs: number = Date.now()): void {
  const requests = readRematchRequests(room);
  requests[requestId] = { fromSeat, accepted: false, createdAt: nowMs, acceptedAt: null };
  const ids = Object.keys(requests).sort((a, b) => requests[a].createdAt - requests[b].createdAt);
  for (const id of ids.slice(0, Math.max(0, ids.length - REMATCH_REQUEST_LIMIT))) delete requests[id];
}

export function recordRematchResponse(room: any, requestId: string, responderSeat: string, accepted: boolean, nowMs: number = Date.now()): boolean {
  const request = readRematchRequests(room)[requestId];
  if (!request || request.fromSeat === responderSeat) return false;
  if (!accepted) {
    delete readRematchRequests(room)[requestId];
    return false;
  }
  request.accepted = true;
  request.acceptedAt = nowMs;
  return true;
}

export function hasRematchAgreement(room: any, nowMs: number = Date.now()): boolean {
  const requests = readRematchRequests(room);
  return Object.keys(requests).some((id) => {
    const request = requests[id];
    return request.accepted === true && Number.isFinite(request.acceptedAt) && nowMs - Number(request.acceptedAt) <= REMATCH_AGREEMENT_TTL_MS;
  });
}

export function clearRematchRequests(room: any): void {
  room.rematchRequests = {};
}

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
    recordRematchRequest(room, requestId, seatKey);
    cfg.touchRoom(room);
    if (typeof cfg.saveRoom === 'function') await cfg.saveRoom();
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

    recordRematchResponse(room, requestId, seatKey, accepted);
    cfg.touchRoom(room);
    if (typeof cfg.saveRoom === 'function') await cfg.saveRoom();
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
