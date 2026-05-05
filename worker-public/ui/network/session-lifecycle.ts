'use strict';

function createNetworkSessionLifecycleController(config: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const roomIdPattern = cfg.roomIdPattern instanceof RegExp ? cfg.roomIdPattern : /^[A-Z0-9]{3}$/;
  const roomIdLength = Number.isFinite(Number(cfg.roomIdLength)) ? Math.trunc(Number(cfg.roomIdLength)) : 3;
  const playerNameMax = Number.isFinite(Number(cfg.playerNameMax)) ? Math.trunc(Number(cfg.playerNameMax)) : 7;

  function readState(): any {
    const state = typeof cfg.getState === 'function' ? cfg.getState() : null;
    if (!state || typeof state !== 'object') {
      throw new Error('network_session_lifecycle_state_required');
    }
    return state;
  }

  function cloneData(value: any): any {
    if (typeof cfg.cloneData === 'function') {
      return cfg.cloneData(value);
    }
    try {
      if (typeof globalThis !== 'undefined' && typeof (globalThis as any).structuredClone === 'function') {
        return (globalThis as any).structuredClone(value);
      }
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(value));
  }

  function emitPlayerNameRequired(): void {
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('ニックネームを1〜' + String(playerNameMax) + '文字で入力してください', true);
    }
  }

  function openStream(): void {
    if (typeof cfg.openStream === 'function') {
      cfg.openStream();
    }
  }

  async function createRoom(options?: any): Promise<any> {
    const opts = (options && typeof options === 'object') ? options : {};
    if (opts.serverUrl && typeof cfg.setServerUrl === 'function') {
      cfg.setServerUrl(opts.serverUrl);
    }

    const playerName = typeof cfg.normalizePlayerName === 'function'
      ? cfg.normalizePlayerName(opts.playerName)
      : String(opts.playerName || '').trim();
    if (!playerName) {
      emitPlayerNameRequired();
      return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
    }

    const requestPayload: any = { playerName: playerName };
    if (opts.networkDebugEnabled === true) {
      requestPayload.networkDebugEnabled = true;
    }
    if (opts.deckCode) {
      requestPayload.deckCode = String(opts.deckCode).trim();
    }
    if (opts.roomBoardConfig && typeof opts.roomBoardConfig === 'object') {
      requestPayload.roomBoardConfig = cloneData(opts.roomBoardConfig);
    }
    if (typeof cfg.readSelectedHandSkinId === 'function') {
      requestPayload.selectedHandSkinId = cfg.readSelectedHandSkinId();
    }

    const res = await cfg.requestJson('POST', '/api/match/create', requestPayload);
    if (!res.ok || !res.data || res.data.ok !== true) {
      if (typeof cfg.isMatchApiMissing === 'function' && cfg.isMatchApiMissing(res)) {
        if (typeof cfg.emitStatus === 'function') {
          cfg.emitStatus('ネット対戦: 対戦用API(/api/match)が見つかりません', true);
        }
        return { ok: false, reason: 'MATCH_API_NOT_FOUND' };
      }
      if (res.data && res.data.reason === 'PLAYER_NAME_REQUIRED') {
        emitPlayerNameRequired();
        return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
      }
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('部屋作成に失敗しました', true);
      }
      return { ok: false, reason: (res.data && res.data.reason) || 'CREATE_FAILED' };
    }

    if (typeof cfg.activateSessionFromResponse === 'function') {
      cfg.activateSessionFromResponse(Object.assign({}, res.data, { playerName: playerName }), '');
    }
    if (typeof cfg.resetNetworkTelemetry === 'function') {
      cfg.resetNetworkTelemetry();
    }

    openStream();

    const state = readState();
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('ネット対戦: 部屋 ' + state.roomId + ' を作成（' + (state.seatKey === 'black' ? '黒' : '白') + '）');
    }

    return {
      ok: true,
      roomId: state.roomId,
      seatKey: state.seatKey,
      playerName: playerName,
      networkDebugEnabled: state.networkDebugEnabled === true
    };
  }

  async function joinRoom(roomId: any, options?: any): Promise<any> {
    const opts = (options && typeof options === 'object') ? options : {};
    if (opts.serverUrl && typeof cfg.setServerUrl === 'function') {
      cfg.setServerUrl(opts.serverUrl);
    }

    const playerName = typeof cfg.normalizePlayerName === 'function'
      ? cfg.normalizePlayerName(opts.playerName)
      : String(opts.playerName || '').trim();
    if (!playerName) {
      emitPlayerNameRequired();
      return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
    }

    const normalizedRoomId = typeof cfg.normalizeRoomId === 'function'
      ? cfg.normalizeRoomId(roomId)
      : String(roomId || '').trim().toUpperCase();
    if (!normalizedRoomId) {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('部屋番号を入力してください', true);
      }
      return { ok: false, reason: 'ROOM_ID_REQUIRED' };
    }
    if (!roomIdPattern.test(normalizedRoomId)) {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('部屋番号は英数字' + String(roomIdLength) + '文字で入力してください', true);
      }
      return { ok: false, reason: 'ROOM_ID_INVALID' };
    }

    const joinPayload: any = {
      roomId: normalizedRoomId,
      playerName: playerName,
      selectedHandSkinId: typeof cfg.readSelectedHandSkinId === 'function'
        ? cfg.readSelectedHandSkinId()
        : 'default'
    };
    if (opts.deckCode) {
      joinPayload.deckCode = String(opts.deckCode).trim();
    }
    const storedClaim = typeof cfg.readSeatClaim === 'function'
      ? cfg.readSeatClaim(normalizedRoomId)
      : null;
    let usedStoredClaim = false;
    if (storedClaim) {
      joinPayload.seatKey = storedClaim.seatKey;
      joinPayload.seatToken = storedClaim.seatToken;
      usedStoredClaim = true;
    }

    let res = await cfg.requestJson('POST', '/api/match/join', joinPayload);
    if ((!res.ok || !res.data || res.data.ok !== true)
      && usedStoredClaim
      && typeof cfg.shouldRetryJoinWithoutStoredClaim === 'function'
      && cfg.shouldRetryJoinWithoutStoredClaim(res)) {
      if (typeof cfg.clearSeatClaim === 'function') {
        cfg.clearSeatClaim(normalizedRoomId);
      }
      const retryPayload: any = {
        roomId: normalizedRoomId,
        playerName: playerName,
        selectedHandSkinId: joinPayload.selectedHandSkinId
      };
      if (opts.deckCode) {
        retryPayload.deckCode = String(opts.deckCode).trim();
      }
      res = await cfg.requestJson('POST', '/api/match/join', retryPayload);
    }

    if (!res.ok || !res.data || res.data.ok !== true) {
      if (typeof cfg.isMatchApiMissing === 'function' && cfg.isMatchApiMissing(res)) {
        if (typeof cfg.emitStatus === 'function') {
          cfg.emitStatus('ネット対戦: 対戦用API(/api/match)が見つかりません', true);
        }
        return { ok: false, reason: 'MATCH_API_NOT_FOUND' };
      }
      if (res.data && res.data.reason === 'PLAYER_NAME_REQUIRED') {
        emitPlayerNameRequired();
        return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
      }
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('部屋参加に失敗しました', true);
      }
      return { ok: false, reason: (res.data && res.data.reason) || 'JOIN_FAILED' };
    }

    if (typeof cfg.activateSessionFromResponse === 'function') {
      cfg.activateSessionFromResponse(Object.assign({}, res.data, { playerName: playerName }), normalizedRoomId);
    }
    if (typeof cfg.resetNetworkTelemetry === 'function') {
      cfg.resetNetworkTelemetry();
    }

    openStream();

    const state = readState();
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('ネット対戦: 部屋 ' + state.roomId + ' ' + (res.data.rejoined ? 'へ再参加' : 'に参加') + '（' + (state.seatKey === 'black' ? '黒' : '白') + '）');
    }

    return {
      ok: true,
      roomId: state.roomId,
      seatKey: state.seatKey,
      playerName: playerName,
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
        appliedSnapshot = typeof cfg.applySnapshotThroughCoordinator === 'function'
          ? cfg.applySnapshotThroughCoordinator(res.data.snapshot, {
            source: 'state_sync',
            applyOptions: { force: true }
          })
          : false;
        if (appliedSnapshot && typeof cfg.rememberPendingForceSyncPlaybackRecovery === 'function') {
          cfg.rememberPendingForceSyncPlaybackRecovery(res.data.snapshot, {
            source: 'state_sync',
            force: true,
            playbackEvents: []
          });
        }
        if (typeof cfg.recordNetworkTelemetry === 'function') {
          cfg.recordNetworkTelemetry('state_sync_snapshot_applied', {
            snapshotVersion: typeof cfg.getSnapshotStateVersion === 'function'
              ? cfg.getSnapshotStateVersion(res.data.snapshot)
              : null,
            force: true
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
    syncLatestState: syncLatestState,
    leaveRoom: leaveRoom
  };
}

const NetworkSessionLifecycleModule = {
  createNetworkSessionLifecycleController: createNetworkSessionLifecycleController
};

export = NetworkSessionLifecycleModule;
