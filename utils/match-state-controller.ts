export function createMatchStateController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};

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
      now: Date.now()
    });
    if (viewer) return { viewer };
    return {
      response: cfg.jsonResponse(403, {
        ok: false,
        reason: cfg.classifyViewerTokenRejectionReason(cfg.getSearchParams(urlObj))
      })
    };
  }

  async function applyTimeout(room: any, enabled: boolean): Promise<void> {
    if (enabled !== true) return;
    const result = cfg.applyExpiredTurnTimeoutIfNeeded(room);
    if (cfg.awaitApplyExpiredTurnTimeoutIfNeeded === true) await result;
  }

  async function handleState(urlObj: any): Promise<any> {
    const room = await getActiveRoom(urlObj);
    if (!room) return cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
    await applyTimeout(room, cfg.applyTimeoutForState === true);

    const viewerContext = resolveViewer(room, urlObj);
    if (viewerContext.response) return viewerContext.response;
    const viewer = viewerContext.viewer;
    const serverTime = Date.now();
    const recoveredMeta = cfg.asRecord(cfg.MatchAuthority.getBufferedSnapshotPayloadForStateVersion(
      room.sseEventBuffer,
      room.stateVersion,
      viewer
    ));

    const payload = cfg.MatchAuthority.buildRoomPayloadFromRoom(room, {
      ok: true,
      stateVersion: room.stateVersion,
      viewerRole: viewer.role,
      roomDeck: cfg.toPublicRoomDeck(room),
      roomBoardConfig: cfg.toPublicRoomBoardConfig(room),
      networkDebugEnabled: cfg.toPublicNetworkDebugEnabled(room),
      networkAutoEnabled: cfg.toPublicNetworkAutoEnabled(room),
      snapshot: cfg.toPublicSnapshotForViewer(room, viewer),
      turnTimer: cfg.toPublicTurnTimer(room, serverTime),
      playbackEvents: Array.isArray(recoveredMeta.playbackEvents) ? recoveredMeta.playbackEvents : [],
      effectLogs: cfg.MatchAuthority.normalizeEffectLogMessages(recoveredMeta.effectLogs),
      playbackDiagnostics: cfg.MatchAuthority.toDebugPlaybackDiagnostics(
        recoveredMeta.playbackDiagnostics,
        cfg.toPublicNetworkDebugEnabled(room)
      ),
      presentationCursor: cfg.buildPresentationCursor(room),
      presentationFrames: Array.isArray(recoveredMeta.presentationFrames) ? recoveredMeta.presentationFrames : [],
      operationId: recoveredMeta.operationId ? String(recoveredMeta.operationId) : null,
      playerKey: recoveredMeta.playerKey ? cfg.normalizePlayerKey(recoveredMeta.playerKey) : null,
      actionType: recoveredMeta.actionType ? String(recoveredMeta.actionType) : null,
      serverTime
    });
    return cfg.jsonResponse(200, payload);
  }

  async function handlePresentationJournal(urlObj: any): Promise<any> {
    const room = await getActiveRoom(urlObj);
    if (!room) return cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
    await applyTimeout(room, cfg.applyTimeoutForJournal === true);

    const viewerContext = resolveViewer(room, urlObj);
    if (viewerContext.response) return viewerContext.response;
    const payload = cfg.MatchAuthority.buildPresentationJournalResponse(room, {
      afterVisualSeq: parameter(urlObj, 'afterVisualSeq') || 0,
      viewer: viewerContext.viewer,
      serverTime: Date.now()
    });
    return cfg.jsonResponse(payload.ok === false ? 409 : 200, payload);
  }

  return { handleState, handlePresentationJournal };
}
