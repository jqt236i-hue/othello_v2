'use strict';

const MatchEntryPayload = require('../../shared/match-entry-payload');

function createNetworkSessionLifecycleController(config: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const roomIdPattern = cfg.roomIdPattern instanceof RegExp ? cfg.roomIdPattern : /^[A-Z0-9]{3}$/;
  const roomIdLength = Number.isFinite(Number(cfg.roomIdLength)) ? Math.trunc(Number(cfg.roomIdLength)) : 3;
  const playerNameMax = Number.isFinite(Number(cfg.playerNameMax)) ? Math.trunc(Number(cfg.playerNameMax)) : 7;
  let createRoomInProgress = false;

  function readState(): any {
    const state = typeof cfg.getState === 'function' ? cfg.getState() : null;
    if (!state || typeof state !== 'object') {
      throw new Error('network_session_lifecycle_state_required');
    }
    return state;
  }

  function emitPlayerNameRequired(): void {
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('ニックネームを1〜' + String(playerNameMax) + '文字で入力してください', true);
    }
  }

  function emitDeckCodeFallback(): void {
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('選択中のカスタムデッキを読み込めなかったため、標準デッキで続行します', false);
    }
  }

  function emitDeckCodeInvalid(): void {
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('選択中のデッキコードが無効です', true);
    }
  }

  function emitMatchApiMissing(): void {
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('ネット対戦: サーバーに接続できません', true);
    }
  }

  function createEntryPayloadHelpers(): any {
    return {
      normalizePlayerName: cfg.normalizePlayerName,
      normalizeRoomId: cfg.normalizeRoomId,
      createRandomPlayerName: cfg.createRandomPlayerName,
      sanitizeDeckCode: cfg.sanitizeDeckCode,
      cloneData: cfg.cloneData,
      readSelectedHandSkinId: cfg.readSelectedHandSkinId,
      readSeatClaim: cfg.readSeatClaim,
      roomIdPattern: roomIdPattern,
      defaultSelectedHandSkinId: 'default'
    };
  }

  function emitEntryPayloadFailure(reason: any): any {
    if (reason === 'PLAYER_NAME_REQUIRED') {
      emitPlayerNameRequired();
      return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
    }
    if (reason === 'ROOM_ID_REQUIRED') {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('部屋番号を入力してください', true);
      }
      return { ok: false, reason: 'ROOM_ID_REQUIRED' };
    }
    if (reason === 'ROOM_ID_INVALID') {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('部屋番号は英数字' + String(roomIdLength) + '文字で入力してください', true);
      }
      return { ok: false, reason: 'ROOM_ID_INVALID' };
    }
    return { ok: false, reason: String(reason || 'ENTRY_PAYLOAD_INVALID') };
  }

  function emitDeckCodeFallbackIfNeeded(entry: any): void {
    if (entry && entry.invalidDeckCode === true) {
      emitDeckCodeFallback();
    }
  }

  function handleRoomEntryFailure(res: any, options: { fallbackReason: string; fallbackMessage: string }): any {
    const opts = (options && typeof options === 'object') ? options : { fallbackReason: 'REQUEST_FAILED', fallbackMessage: '失敗しました' };
    if (typeof cfg.isMatchApiMissing === 'function' && cfg.isMatchApiMissing(res)) {
      emitMatchApiMissing();
      return { ok: false, reason: 'MATCH_API_NOT_FOUND' };
    }
    if (res.data && res.data.reason === 'PLAYER_NAME_REQUIRED') {
      emitPlayerNameRequired();
      return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
    }
    if (res.data && res.data.reason === 'DECK_CODE_INVALID') {
      emitDeckCodeInvalid();
      return { ok: false, reason: 'DECK_CODE_INVALID' };
    }
    if (res.data && res.data.reason === 'ROOM_PASSWORD_INVALID') {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('パスワードが違います', true);
      }
      return { ok: false, reason: 'ROOM_PASSWORD_INVALID' };
    }
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus(opts.fallbackMessage, true);
    }
    return { ok: false, reason: (res.data && res.data.reason) || opts.fallbackReason };
  }

  function openStream(): void {
    if (typeof cfg.openStream === 'function') {
      cfg.openStream();
    }
  }

  async function createRoom(options?: any): Promise<any> {
    const opts = (options && typeof options === 'object') ? options : {};
    const currentState = readState();
    if (currentState.roomId) {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('すでにネット対戦の部屋に参加しています', true);
      }
      return { ok: false, reason: 'ALREADY_IN_ROOM', roomId: currentState.roomId };
    }
    if (createRoomInProgress) {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('部屋作成中です', false);
      }
      return { ok: false, reason: 'CREATE_IN_PROGRESS' };
    }

    if (opts.serverUrl && typeof cfg.setServerUrl === 'function') {
      cfg.setServerUrl(opts.serverUrl);
    }

    const entryPayload = MatchEntryPayload.buildCreateRoomPayload(opts, createEntryPayloadHelpers());
    if (!entryPayload.ok) {
      return emitEntryPayloadFailure(entryPayload.reason);
    }
    emitDeckCodeFallbackIfNeeded(entryPayload);

    createRoomInProgress = true;
    let res: any;
    try {
      res = await cfg.requestJson('POST', '/api/match/create', entryPayload.payload);
    } finally {
      createRoomInProgress = false;
    }
    if (!res.ok || !res.data || res.data.ok !== true) {
      return handleRoomEntryFailure(res, {
        fallbackReason: 'CREATE_FAILED',
        fallbackMessage: '部屋作成に失敗しました'
      });
    }

    if (typeof cfg.activateSessionFromResponse === 'function') {
      cfg.activateSessionFromResponse(Object.assign({}, res.data, { playerName: entryPayload.playerName }), '');
    }
    if (typeof cfg.resetNetworkTelemetry === 'function') {
      cfg.resetNetworkTelemetry();
    }

    openStream();

    const state = readState();
    const roomName = String(res.data.roomName || entryPayload.payload.roomName || '無名部屋');
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('ネット対戦: ルーム「' + roomName + '」を作成（' + (state.seatKey === 'black' ? '黒' : '白') + '）');
    }

    return {
      ok: true,
      roomId: state.roomId,
      roomName,
      seatKey: state.seatKey,
      playerName: entryPayload.playerName,
      networkDebugEnabled: state.networkDebugEnabled === true
    };
  }

  async function listRooms(options?: any): Promise<any> {
    const opts = (options && typeof options === 'object') ? options : {};
    if (opts.serverUrl && typeof cfg.setServerUrl === 'function') {
      cfg.setServerUrl(opts.serverUrl);
    }

    const res = await cfg.requestJson('GET', '/api/match/list');
    if (!res.ok || !res.data || res.data.ok !== true) {
      if (typeof cfg.isMatchApiMissing === 'function' && cfg.isMatchApiMissing(res)) {
        emitMatchApiMissing();
        return { ok: false, reason: 'MATCH_API_NOT_FOUND', rooms: [] };
      }
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('ルーム一覧の取得に失敗しました', true);
      }
      return {
        ok: false,
        reason: (res.data && res.data.reason) || 'ROOM_LIST_FAILED',
        rooms: []
      };
    }

    return {
      ok: true,
      rooms: Array.isArray(res.data.rooms) ? res.data.rooms : []
    };
  }

  async function joinRoom(roomId: any, options?: any): Promise<any> {
    const opts = (options && typeof options === 'object') ? options : {};
    if (opts.serverUrl && typeof cfg.setServerUrl === 'function') {
      cfg.setServerUrl(opts.serverUrl);
    }

    const entryPayload = MatchEntryPayload.buildJoinRoomPayload(roomId, opts, createEntryPayloadHelpers());
    if (!entryPayload.ok) {
      return emitEntryPayloadFailure(entryPayload.reason);
    }
    emitDeckCodeFallbackIfNeeded(entryPayload);

    let res = await cfg.requestJson('POST', '/api/match/join', entryPayload.payload);
    if ((!res.ok || !res.data || res.data.ok !== true)
      && entryPayload.usedStoredClaim === true
      && typeof cfg.shouldRetryJoinWithoutStoredClaim === 'function'
      && cfg.shouldRetryJoinWithoutStoredClaim(res)) {
      if (typeof cfg.clearSeatClaim === 'function') {
        cfg.clearSeatClaim(entryPayload.roomId);
      }
      const retryPayload = MatchEntryPayload.buildJoinRetryPayload(entryPayload);
      res = await cfg.requestJson('POST', '/api/match/join', retryPayload);
    }

    if (!res.ok || !res.data || res.data.ok !== true) {
      return handleRoomEntryFailure(res, {
        fallbackReason: 'JOIN_FAILED',
        fallbackMessage: '部屋参加に失敗しました'
      });
    }

    if (typeof cfg.activateSessionFromResponse === 'function') {
      cfg.activateSessionFromResponse(Object.assign({}, res.data, { playerName: entryPayload.playerName }), entryPayload.roomId);
    }
    if (typeof cfg.resetNetworkTelemetry === 'function') {
      cfg.resetNetworkTelemetry();
    }

    openStream();

    const state = readState();
    const roomName = String(res.data.roomName || 'ルーム');
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('ネット対戦: ルーム「' + roomName + '」' + (res.data.rejoined ? 'へ再参加' : 'に参加') + '（' + (state.seatKey === 'black' ? '黒' : '白') + '）');
    }

    return {
      ok: true,
      roomId: state.roomId,
      roomName,
      seatKey: state.seatKey,
      playerName: entryPayload.playerName,
      networkDebugEnabled: state.networkDebugEnabled === true
    };
  }

  async function syncLatestState(): Promise<any> {
    const state = readState();
    if (!state.roomId) return { ok: false, reason: 'NO_ROOM' };

    const path = '/api/match/state?roomId=' + encodeURIComponent(state.roomId)
      + '&seatKey=' + encodeURIComponent(state.seatKey)
      + '&seatToken=' + encodeURIComponent(state.seatToken || '');
    const res = await cfg.requestJson('GET', path);
    if (!res.ok || !res.data || res.data.ok !== true) {
      return { ok: false, reason: (res.data && res.data.reason) || 'STATE_FETCH_FAILED' };
    }

    const localProjectedSnapshotHashBefore = typeof cfg.getKnownProjectedSnapshotHash === 'function'
      ? cfg.getKnownProjectedSnapshotHash()
      : null;
    if (typeof cfg.applyPayloadSessionState === 'function') {
      cfg.applyPayloadSessionState(res.data);
    }

    let appliedSnapshot = false;
    if (res.data.snapshot) {
      const skipSnapshot = typeof cfg.shouldSkipForceSyncSnapshot === 'function'
        ? cfg.shouldSkipForceSyncSnapshot(res.data.snapshot, {
          localProjectedSnapshotHash: localProjectedSnapshotHashBefore
        })
        : false;
      if (!skipSnapshot) {
        const playbackEvents = typeof cfg.resolveStateSyncRecoveredPlaybackEvents === 'function'
          ? cfg.resolveStateSyncRecoveredPlaybackEvents(res.data)
          : (Array.isArray(res.data.playbackEvents) ? res.data.playbackEvents : []);
        appliedSnapshot = typeof cfg.applySnapshotThroughCoordinator === 'function'
          ? cfg.applySnapshotThroughCoordinator(res.data.snapshot, {
            source: 'state_sync',
            applyOptions: {
              force: true,
              playbackEvents: playbackEvents
            }
          })
          : false;
        if (appliedSnapshot && typeof cfg.rememberPendingForceSyncPlaybackRecovery === 'function') {
          cfg.rememberPendingForceSyncPlaybackRecovery(res.data.snapshot, {
            source: 'state_sync',
            force: true,
            playbackEvents: playbackEvents
          });
        }
        if (typeof cfg.recordNetworkTelemetry === 'function') {
          cfg.recordNetworkTelemetry('state_sync_snapshot_applied', {
            snapshotVersion: typeof cfg.getSnapshotStateVersion === 'function'
              ? cfg.getSnapshotStateVersion(res.data.snapshot)
              : null,
            force: true,
            playbackEventCount: playbackEvents.length,
            usedRecoveredPlayback: playbackEvents.length > 0
          });
        }
      } else if (typeof cfg.recordNetworkTelemetry === 'function') {
        cfg.recordNetworkTelemetry('state_sync_snapshot_skipped', {
          snapshotVersion: typeof cfg.getSnapshotStateVersion === 'function'
            ? cfg.getSnapshotStateVersion(res.data.snapshot)
            : null,
          localVersion: Number.isFinite(Number(state.stateVersion)) ? Number(state.stateVersion) : null
        });
      }
    }

    return { ok: true, appliedSnapshot: appliedSnapshot };
  }

  async function leaveRoom(): Promise<any> {
    if (typeof cfg.clearPlaybackStateForLeave === 'function') {
      cfg.clearPlaybackStateForLeave();
    }
    if (typeof cfg.clearPendingForceSyncPlaybackRecovery === 'function') {
      cfg.clearPendingForceSyncPlaybackRecovery();
    }

    const state = readState();
    if (!state.roomId) {
      if (typeof cfg.resetSessionState === 'function') {
        cfg.resetSessionState();
      }
      if (typeof cfg.resetNetworkTelemetry === 'function') {
        cfg.resetNetworkTelemetry();
      }
      if (typeof cfg.resetTurnTimerState === 'function') {
        cfg.resetTurnTimerState();
      }
      if (typeof cfg.closeStream === 'function') {
        cfg.closeStream();
      }
      if (typeof cfg.teardownActionBridge === 'function') {
        cfg.teardownActionBridge();
      }
      return { ok: true };
    }

    const roomId = state.roomId;
    const seatKey = state.seatKey;
    const seatToken = state.seatToken;
    let leaveResponse: any = null;

    try {
      leaveResponse = await cfg.requestJson('POST', '/api/match/leave', {
        roomId: roomId,
        seatKey: seatKey,
        seatToken: seatToken
      });
    } catch (e) {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('ネット対戦: 部屋の退出に失敗しました');
      }
      return { ok: false, reason: 'LEAVE_REQUEST_FAILED' };
    }

    const leaveReason = String(leaveResponse && leaveResponse.data && leaveResponse.data.reason ? leaveResponse.data.reason : '').trim();
    if (!(leaveResponse && leaveResponse.ok) && leaveReason !== 'ROOM_NOT_FOUND') {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('ネット対戦: 部屋の退出に失敗しました (' + (leaveReason || 'LEAVE_FAILED') + ')');
      }
      return {
        ok: false,
        reason: leaveReason || 'LEAVE_FAILED',
        status: leaveResponse ? leaveResponse.status : 0
      };
    }

    if (typeof cfg.resetSessionState === 'function') {
      cfg.resetSessionState();
    }
    if (typeof cfg.resetNetworkTelemetry === 'function') {
      cfg.resetNetworkTelemetry();
    }
    if (typeof cfg.resetTurnTimerState === 'function') {
      cfg.resetTurnTimerState();
    }
    if (typeof cfg.closeStream === 'function') {
      cfg.closeStream();
    }
    if (typeof cfg.teardownActionBridge === 'function') {
      cfg.teardownActionBridge();
    }
    if (typeof cfg.clearSeatClaim === 'function') {
      cfg.clearSeatClaim(roomId);
    }
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('ネット対戦: 部屋から退出しました');
    }

    return { ok: true };
  }

  return {
    createRoom: createRoom,
    joinRoom: joinRoom,
    listRooms: listRooms,
    syncLatestState: syncLatestState,
    leaveRoom: leaveRoom
  };
}

const NetworkSessionLifecycleModule = {
  createNetworkSessionLifecycleController: createNetworkSessionLifecycleController
};

export = NetworkSessionLifecycleModule;
