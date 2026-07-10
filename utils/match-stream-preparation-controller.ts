export function createMatchStreamPreparationController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();

  function parameter(urlObj: any, key: string): string {
    return String(cfg.getSearchParam(urlObj, key) || '');
  }

  async function getActiveRoom(urlObj: any): Promise<any> {
    const loadResult = cfg.loadRoom(urlObj);
    if (cfg.awaitLoadRoom === true) await loadResult;
    const room = cfg.getRoom();
    if (!room) return null;

    const expireResult = cfg.expireRoomIfNeeded();
    if ((cfg.awaitExpireRoomIfNeeded === true ? await expireResult : expireResult)) return null;
    return room;
  }

  function resolveViewer(room: any, urlObj: any): any {
    const seatKey = cfg.parseSeatKeyOptional(parameter(urlObj, 'seatKey'));
    const viewer = cfg.resolveAuthenticatedViewer(room, {
      viewerRole: parameter(urlObj, 'viewerRole'),
      seatKey,
      seatToken: parameter(urlObj, 'seatToken').trim(),
      spectatorId: parameter(urlObj, 'spectatorId'),
      spectatorToken: parameter(urlObj, 'spectatorToken'),
      now: now()
    });
    if (viewer) return { viewer };
    return {
      response: cfg.jsonResponse(403, {
        ok: false,
        reason: cfg.classifyViewerTokenRejectionReason(cfg.getSearchParams(urlObj))
      })
    };
  }

  async function prepareStream(urlObj: any, headerLastEventId?: unknown): Promise<any> {
    const room = await getActiveRoom(urlObj);
    if (!room) return { response: cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' }) };

    const timeoutResult = cfg.applyExpiredTurnTimeoutIfNeeded(room);
    if (cfg.awaitApplyExpiredTurnTimeoutIfNeeded === true) await timeoutResult;

    const viewerContext = resolveViewer(room, urlObj);
    if (viewerContext.response) return viewerContext;

    const resumeEventId = parameter(urlObj, 'lastEventId').trim();
    const lastEventId = String(headerLastEventId || resumeEventId).trim();
    const replayBuffer = Array.isArray(room.sseEventBuffer)
      ? room.sseEventBuffer
      : cfg.getSseEventBuffer();
    return {
      room,
      viewer: viewerContext.viewer,
      replayEvents: cfg.getBufferedSseReplayEvents(replayBuffer, lastEventId, viewerContext.viewer)
    };
  }

  return { prepareStream };
}
