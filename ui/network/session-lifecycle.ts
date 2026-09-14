'use strict';

const MatchEntryPayload = require('../../shared/match-entry-payload');

function createNetworkSessionLifecycleController(config: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const roomIdPattern = cfg.roomIdPattern instanceof RegExp ? cfg.roomIdPattern : /^[A-Z0-9]{3}$/;
  const roomIdLength = Number.isFinite(Number(cfg.roomIdLength)) ? Math.trunc(Number(cfg.roomIdLength)) : 3;
  const playerNameMax = Number.isFinite(Number(cfg.playerNameMax)) ? Math.trunc(Number(cfg.playerNameMax)) : 7;
  let roomEntryInProgress: string | null = null;
  let localSessionEpoch = 0;

  function readState(): any {
    const state = typeof cfg.getState === 'function' ? cfg.getState() : null;
    if (!state || typeof state !== 'object') {
      throw new Error('network_session_lifecycle_state_required');
    }
    return state;
  }

  function readSessionEpoch(): number {
    if (typeof cfg.getSessionEpoch === 'function') {
      const configuredEpoch = Number(cfg.getSessionEpoch());
      if (Number.isFinite(configuredEpoch)) return Math.max(0, Math.trunc(configuredEpoch));
    }
    return localSessionEpoch;
  }

  function advanceSessionEpoch(reason: string): number {
    if (typeof cfg.advanceSessionEpoch === 'function') {
      const configuredEpoch = Number(cfg.advanceSessionEpoch(reason));
      if (Number.isFinite(configuredEpoch)) {
        localSessionEpoch = Math.max(localSessionEpoch + 1, Math.trunc(configuredEpoch));
        return Math.max(0, Math.trunc(configuredEpoch));
      }
    }
    localSessionEpoch += 1;
    return localSessionEpoch;
  }

  function captureSessionGuard(stateCandidate?: any): any {
    const state = stateCandidate && typeof stateCandidate === 'object' ? stateCandidate : readState();
    const spectator = isSpectatorState(state);
    return Object.freeze({
      epoch: readSessionEpoch(),
      roomId: String(state.roomId || ''),
      viewerRole: spectator ? 'spectator' : 'seat',
      seatKey: spectator ? '' : String(state.seatKey || ''),
      seatToken: spectator ? '' : String(state.seatToken || ''),
      spectatorId: spectator ? String(state.spectatorId || '') : '',
      spectatorToken: spectator ? String(state.spectatorToken || '') : ''
    });
  }

  function isSessionGuardCurrent(guard: any): boolean {
    if (!guard || guard.epoch !== readSessionEpoch()) return false;
    let state: any;
    try { state = readState(); } catch (e) { return false; }
    const spectator = isSpectatorState(state);
    return guard.roomId === String(state.roomId || '')
      && guard.viewerRole === (spectator ? 'spectator' : 'seat')
      && guard.seatKey === (spectator ? '' : String(state.seatKey || ''))
      && guard.seatToken === (spectator ? '' : String(state.seatToken || ''))
      && guard.spectatorId === (spectator ? String(state.spectatorId || '') : '')
      && guard.spectatorToken === (spectator ? String(state.spectatorToken || '') : '');
  }

  function sessionChangedResult(stage: string): any {
    if (typeof cfg.recordNetworkTelemetry === 'function') {
      cfg.recordNetworkTelemetry('stale_network_session_response_ignored', { stage: String(stage || 'unknown') });
    }
    return { ok: false, recovered: false, stale: true, reason: 'SESSION_CHANGED' };
  }

  async function runRoomEntrySingleFlight(kind: string, operation: () => Promise<any>): Promise<any> {
    const normalizedKind = String(kind || 'entry');
    if (roomEntryInProgress !== null) {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus(
          roomEntryInProgress === 'create' && normalizedKind === 'create'
            ? '部屋作成中です'
            : '部屋への接続処理中です',
          false
        );
      }
      return {
        ok: false,
        reason: roomEntryInProgress === 'create' && normalizedKind === 'create'
          ? 'CREATE_IN_PROGRESS'
          : 'ROOM_ENTRY_IN_PROGRESS'
      };
    }
    roomEntryInProgress = normalizedKind;
    try {
      return await operation();
    } finally {
      if (roomEntryInProgress === normalizedKind) roomEntryInProgress = null;
    }
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

  function createEntryPayloadHelpers(playerIdentity?: any): any {
    return {
      normalizePlayerName: cfg.normalizePlayerName,
      normalizeRoomId: cfg.normalizeRoomId,
      createRandomPlayerName: cfg.createRandomPlayerName,
      sanitizeDeckCode: cfg.sanitizeDeckCode,
      cloneData: cfg.cloneData,
      readSelectedHandSkinId: cfg.readSelectedHandSkinId,
      readPlayerIdentity: () => playerIdentity || null,
      readSeatClaim: cfg.readSeatClaim,
      roomIdPattern: roomIdPattern,
      defaultSelectedHandSkinId: 'default'
    };
  }

  async function ensureEntryPlayerIdentity(options?: any): Promise<any> {
    if (typeof cfg.ensurePlayerIdentity !== 'function') return null;
    try {
      return await cfg.ensurePlayerIdentity(options);
    } catch (e) {
      return null;
    }
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

  function isSpectatorState(state: any): boolean {
    return String(state && state.viewerRole || '').trim().toLowerCase() === 'spectator';
  }

  function buildStatePath(state: any): string {
    if (isSpectatorState(state)) {
      return '/api/match/state?roomId=' + encodeURIComponent(state.roomId)
        + '&viewerRole=spectator'
        + '&spectatorId=' + encodeURIComponent(state.spectatorId || '')
        + '&spectatorToken=' + encodeURIComponent(state.spectatorToken || '');
    }
    return '/api/match/state?roomId=' + encodeURIComponent(state.roomId)
      + '&seatKey=' + encodeURIComponent(state.seatKey)
      + '&seatToken=' + encodeURIComponent(state.seatToken || '');
  }

  function toIntegerOrNull(value: any): number | null {
    if (value === null || typeof value === 'undefined') return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return null;
    return Math.trunc(numberValue);
  }

  function normalizeStateSyncIntakeSource(value: any): 'state_sync' | 'heartbeat_recovery' {
    return String(value || '').trim() === 'heartbeat_recovery'
      ? 'heartbeat_recovery'
      : 'state_sync';
  }

  function buildPresentationJournalPath(state: any, afterVisualSeq: any): string {
    const seq = Math.max(0, toIntegerOrNull(afterVisualSeq) || 0);
    if (isSpectatorState(state)) {
      return '/api/match/presentation-journal?roomId=' + encodeURIComponent(state.roomId)
        + '&viewerRole=spectator'
        + '&spectatorId=' + encodeURIComponent(state.spectatorId || '')
        + '&spectatorToken=' + encodeURIComponent(state.spectatorToken || '')
        + '&afterVisualSeq=' + encodeURIComponent(String(seq));
    }
    return '/api/match/presentation-journal?roomId=' + encodeURIComponent(state.roomId)
      + '&seatKey=' + encodeURIComponent(state.seatKey)
      + '&seatToken=' + encodeURIComponent(state.seatToken || '')
      + '&afterVisualSeq=' + encodeURIComponent(String(seq));
  }

  function getCanonicalStateVersion(state: any): number | null {
    const direct = toIntegerOrNull(state && state.stateVersion);
    if (direct !== null) return direct;
    const applied = toIntegerOrNull(state && state.appliedStateVersion);
    if (applied !== null) return applied;
    return null;
  }

  function getStoredVisualSeq(stored: any, state: any): number {
    const storedSeq = toIntegerOrNull(stored && stored.lastVisualSeq);
    if (storedSeq !== null && storedSeq >= 0) return storedSeq;
    const stateSeq = toIntegerOrNull(state && state.lastVisualSeq);
    if (stateSeq !== null && stateSeq >= 0) return stateSeq;
    return 0;
  }

  function getStoredVisualVersion(stored: any, state: any): number {
    const storedVersion = toIntegerOrNull(stored && stored.lastVisualVersion);
    if (storedVersion !== null && storedVersion >= 0) return storedVersion;
    const stateVersion = toIntegerOrNull(state && state.lastVisualVersion);
    if (stateVersion !== null && stateVersion >= 0) return stateVersion;
    return 0;
  }

  function resolveVisualStateStore(): any {
    if (cfg.visualStateStore && typeof cfg.visualStateStore === 'object') return cfg.visualStateStore;
    if (typeof cfg.resolveVisualStateStore === 'function') {
      try { return cfg.resolveVisualStateStore(); } catch (e) { /* ignore */ }
    }
    return null;
  }

  function setJournalBaseVisualSnapshot(payload: any, source?: any): void {
    const store = resolveVisualStateStore();
    if (!store || typeof store.setBaseVisualSnapshot !== 'function') return;
    if (!payload || !payload.baseSnapshot) return;
    const baseVisualSeq = toIntegerOrNull(payload.baseVisualSeq);
    const frames = Array.isArray(payload.presentationFrames) ? payload.presentationFrames : [];
    const firstFrame = frames
      .slice()
      .sort((a: any, b: any) => Number(a && a.visualSeq) - Number(b && b.visualSeq))[0] || null;
    const baseVersion = toIntegerOrNull(firstFrame && firstFrame.stateVersionFrom)
      || toIntegerOrNull(payload.baseSnapshot && payload.baseSnapshot.stateVersion)
      || toIntegerOrNull(payload.baseVisualVersion);
    store.setBaseVisualSnapshot(payload.baseSnapshot, {
      visualSeq: baseVisualSeq !== null ? baseVisualSeq : 0,
      visualVersion: baseVersion,
      preserveExisting: true,
      source: String(source || 'journal_recovery')
    });
  }

  async function fetchAndApplyPresentationJournal(
    afterVisualSeq: any,
    canonicalVersion: any,
    source?: any,
    lastVisualVersion?: any,
    expectedSession?: any
  ): Promise<any> {
    const state = readState();
    const sessionGuard = expectedSession || captureSessionGuard(state);
    if (!isSessionGuardCurrent(sessionGuard)) return sessionChangedResult('journal_before_request');
    const normalizedSource = String(source || 'journal_recovery');
    const path = buildPresentationJournalPath(state, afterVisualSeq);
    const res = await cfg.requestJson('GET', path);
    if (!isSessionGuardCurrent(sessionGuard)) return sessionChangedResult('journal_after_request');
    if (!res.ok || !res.data || res.data.ok !== true) {
      return { recovered: false, reason: (res.data && res.data.reason) || 'PRESENTATION_JOURNAL_FETCH_FAILED' };
    }
    setJournalBaseVisualSnapshot(res.data, normalizedSource);
    let enqueued = 0;
    if (
      typeof cfg.normalizeNetworkSnapshotEnvelope === 'function'
      && typeof cfg.submitNetworkSnapshotEnvelope === 'function'
    ) {
      const envelope = cfg.normalizeNetworkSnapshotEnvelope({
        source: 'presentation_journal',
        payload: res.data,
        snapshot: null,
        stateVersion: canonicalVersion,
        force: false
      });
      const intakeResult = cfg.submitNetworkSnapshotEnvelope(envelope);
      enqueued = Number.isFinite(Number(intakeResult && intakeResult.enqueuedFrameCount))
        ? Math.max(0, Math.trunc(Number(intakeResult.enqueuedFrameCount)))
        : 0;
    } else if (typeof cfg.enqueuePresentationFramesFromPayload === 'function') {
      enqueued = cfg.enqueuePresentationFramesFromPayload(res.data, { source: normalizedSource }) || 0;
    }
    if (typeof cfg.drainPresentationTimeline === 'function') {
      await cfg.drainPresentationTimeline();
    }
    if (!isSessionGuardCurrent(sessionGuard)) return sessionChangedResult('journal_after_drain');
    const converged = typeof cfg.verifyPresentationCursorConvergence === 'function'
      ? cfg.verifyPresentationCursorConvergence(res.data.presentationCursor) === true
      : enqueued > 0;
    if (!converged) {
      if (typeof cfg.recordNetworkTelemetry === 'function') {
        cfg.recordNetworkTelemetry('presentation_journal_unresolved', {
          afterVisualSeq,
          canonicalVersion,
          lastVisualVersion,
          enqueued,
          presentationCursor: res.data.presentationCursor || null
        });
      }
      const recovered = typeof cfg.recoverPresentationContinuity === 'function'
        ? await cfg.recoverPresentationContinuity(
          'state_sync_presentation_journal_did_not_converge',
          normalizedSource
        )
        : false;
      if (!isSessionGuardCurrent(sessionGuard)) return sessionChangedResult('journal_after_recovery');
      return {
        recovered: recovered === true,
        enqueued,
        reason: recovered === true ? null : 'PRESENTATION_JOURNAL_NOT_CONVERGED'
      };
    }
    if (typeof cfg.recordNetworkTelemetry === 'function') {
      cfg.recordNetworkTelemetry(normalizedSource === 'state_sync' ? 'state_sync_presentation_journal_recovered' : 'presentation_journal_recovered', {
        afterVisualSeq,
        canonicalVersion,
        lastVisualVersion,
        enqueued
      });
    }
    return { recovered: true, enqueued };
  }

  async function recoverPresentationJournalCatchup(stored: any): Promise<any> {
    const state = readState();
    const canonicalVersion = getCanonicalStateVersion(state);
    if (canonicalVersion === null) return { recovered: false, reason: 'canonical_version_unavailable' };
    const lastVisualVersion = getStoredVisualVersion(stored, state);
    if (canonicalVersion <= lastVisualVersion) {
      return { recovered: false, reason: 'visual_cursor_current' };
    }
    const afterVisualSeq = getStoredVisualSeq(stored, state);
    return fetchAndApplyPresentationJournal(afterVisualSeq, canonicalVersion, 'journal_recovery', lastVisualVersion);
  }

  function isInvalidStoredSessionReason(reason: any): boolean {
    const normalized = String(reason || '').trim().toUpperCase();
    return normalized === 'ROOM_NOT_FOUND'
      || normalized === 'SPECTATOR_NOT_FOUND'
      || normalized === 'SPECTATOR_TOKEN_INVALID'
      || normalized === 'SEAT_TOKEN_INVALID'
      || normalized === 'SEAT_NOT_FOUND';
  }

  async function disposePresentationTimeline(reason: string): Promise<void> {
    if (typeof cfg.disposePresentationTimeline !== 'function') return;
    const disposed = await cfg.disposePresentationTimeline(reason);
    if (disposed !== true) throw new Error('NETWORK_PRESENTATION_TIMELINE_DISPOSE_FAILED');
  }

  function convergeConfirmedLeaveDisposeFailure(state: any, spectatorSession: boolean, error: any): any {
    if (typeof cfg.markSessionReloadRequired === 'function') {
      cfg.markSessionReloadRequired({
        reason: 'LEAVE_SETTLEMENT_DISPOSE_FAILED',
        error: error && error.message ? String(error.message) : String(error || '')
      });
    }
    if (typeof cfg.teardownActionBridge === 'function') cfg.teardownActionBridge();
    if (!spectatorSession && typeof cfg.clearSeatClaim === 'function') {
      cfg.clearSeatClaim(state && state.roomId);
    }
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('ネット対戦の終了処理を完了できませんでした。ページを再読み込みしてください', true);
    }
    if (typeof cfg.recordNetworkTelemetry === 'function') {
      cfg.recordNetworkTelemetry('confirmed_leave_settlement_dispose_failed', {
        roomId: state && state.roomId ? String(state.roomId) : null,
        spectator: spectatorSession === true,
        error: error && error.message ? String(error.message) : String(error || '')
      });
    }
    return {
      ok: false,
      reason: 'LEAVE_SETTLEMENT_DISPOSE_FAILED',
      authorityLeft: true,
      reloadRequired: true
    };
  }

  async function createRoomAttempt(options?: any): Promise<any> {
    const opts = (options && typeof options === 'object') ? options : {};
    const currentState = readState();
    if (currentState.roomId) {
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('すでにネット対戦の部屋に参加しています', true);
      }
      return { ok: false, reason: 'ALREADY_IN_ROOM', roomId: currentState.roomId };
    }
    const entryEpoch = readSessionEpoch();
    if (opts.serverUrl && typeof cfg.setServerUrl === 'function') {
      cfg.setServerUrl(opts.serverUrl);
    }

    const playerIdentity = await ensureEntryPlayerIdentity(opts);
    if (readSessionEpoch() !== entryEpoch || readState().roomId) {
      return sessionChangedResult('create_after_identity');
    }
    const entryPayload = MatchEntryPayload.buildCreateRoomPayload(opts, createEntryPayloadHelpers(playerIdentity));
    if (!entryPayload.ok) {
      return emitEntryPayloadFailure(entryPayload.reason);
    }
    emitDeckCodeFallbackIfNeeded(entryPayload);
    const res = await cfg.requestJson('POST', '/api/match/create', entryPayload.payload);
    if (!res.ok || !res.data || res.data.ok !== true) {
      return handleRoomEntryFailure(res, {
        fallbackReason: 'CREATE_FAILED',
        fallbackMessage: '部屋作成に失敗しました'
      });
    }

    if (readSessionEpoch() !== entryEpoch || readState().roomId) {
      return sessionChangedResult('create_before_activation');
    }
    const activationEpoch = advanceSessionEpoch('session_create_activation');
    await disposePresentationTimeline('session_create_activation');
    if (readSessionEpoch() !== activationEpoch || readState().roomId) {
      return sessionChangedResult('create_after_timeline_dispose');
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
      networkDebugEnabled: state.networkDebugEnabled === true,
      networkAutoEnabled: state.networkAutoEnabled === true
    };
  }

  async function listRooms(options?: any): Promise<any> {
    const opts = (options && typeof options === 'object') ? options : {};
    if (!readState().roomId && opts.serverUrl && typeof cfg.setServerUrl === 'function') {
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

  async function joinRoomAttempt(roomId: any, options?: any): Promise<any> {
    const opts = (options && typeof options === 'object') ? options : {};
    const entryState = readState();
    if (entryState.roomId) {
      return { ok: false, reason: 'ALREADY_IN_ROOM', roomId: entryState.roomId };
    }
    const entryEpoch = readSessionEpoch();
    if (opts.serverUrl && typeof cfg.setServerUrl === 'function') {
      cfg.setServerUrl(opts.serverUrl);
    }

    const validationPayload = MatchEntryPayload.buildJoinRoomPayload(roomId, opts, createEntryPayloadHelpers(null));
    if (!validationPayload.ok) {
      return emitEntryPayloadFailure(validationPayload.reason);
    }

    const playerIdentity = await ensureEntryPlayerIdentity(opts);
    if (readSessionEpoch() !== entryEpoch || readState().roomId) {
      return sessionChangedResult('join_after_identity');
    }
    const entryPayload = MatchEntryPayload.buildJoinRoomPayload(roomId, opts, createEntryPayloadHelpers(playerIdentity));
    if (!entryPayload.ok) {
      return emitEntryPayloadFailure(entryPayload.reason);
    }
    emitDeckCodeFallbackIfNeeded(entryPayload);

    let res = await cfg.requestJson('POST', '/api/match/join', entryPayload.payload);
    if (readSessionEpoch() !== entryEpoch || readState().roomId) {
      return sessionChangedResult('join_after_request');
    }
    if ((!res.ok || !res.data || res.data.ok !== true)
      && entryPayload.usedStoredClaim === true
      && typeof cfg.shouldRetryJoinWithoutStoredClaim === 'function'
      && cfg.shouldRetryJoinWithoutStoredClaim(res)) {
      if (typeof cfg.clearSeatClaim === 'function') {
        cfg.clearSeatClaim(entryPayload.roomId);
      }
      const retryPayload = MatchEntryPayload.buildJoinRetryPayload(entryPayload);
      res = await cfg.requestJson('POST', '/api/match/join', retryPayload);
      if (readSessionEpoch() !== entryEpoch || readState().roomId) {
        return sessionChangedResult('join_after_retry');
      }
    }

    if (!res.ok || !res.data || res.data.ok !== true) {
      return handleRoomEntryFailure(res, {
        fallbackReason: 'JOIN_FAILED',
        fallbackMessage: '部屋参加に失敗しました'
      });
    }

    if (readSessionEpoch() !== entryEpoch || readState().roomId) {
      return sessionChangedResult('join_before_activation');
    }
    const activationEpoch = advanceSessionEpoch('session_join_activation');
    await disposePresentationTimeline('session_join_activation');
    if (readSessionEpoch() !== activationEpoch || readState().roomId) {
      return sessionChangedResult('join_after_timeline_dispose');
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
      networkDebugEnabled: state.networkDebugEnabled === true,
      networkAutoEnabled: state.networkAutoEnabled === true
    };
  }

  async function spectateRoomAttempt(roomId: any, options?: any): Promise<any> {
    const opts = (options && typeof options === 'object') ? options : {};
    const entryState = readState();
    if (entryState.roomId) {
      return { ok: false, reason: 'ALREADY_IN_ROOM', roomId: entryState.roomId };
    }
    const entryEpoch = readSessionEpoch();
    if (opts.serverUrl && typeof cfg.setServerUrl === 'function') {
      cfg.setServerUrl(opts.serverUrl);
    }

    const entryPayload = MatchEntryPayload.buildSpectateRoomPayload(roomId, opts, createEntryPayloadHelpers());
    if (!entryPayload.ok) {
      return emitEntryPayloadFailure(entryPayload.reason);
    }

    const res = await cfg.requestJson('POST', '/api/match/spectate', entryPayload.payload);
    if (readSessionEpoch() !== entryEpoch || readState().roomId) {
      return sessionChangedResult('spectate_after_request');
    }
    if (!res.ok || !res.data || res.data.ok !== true) {
      return handleRoomEntryFailure(res, {
        fallbackReason: 'SPECTATE_FAILED',
        fallbackMessage: '観測への参加に失敗しました'
      });
    }

    if (readSessionEpoch() !== entryEpoch || readState().roomId) {
      return sessionChangedResult('spectate_before_activation');
    }
    const activationEpoch = advanceSessionEpoch('session_spectator_activation');
    await disposePresentationTimeline('session_spectator_activation');
    if (readSessionEpoch() !== activationEpoch || readState().roomId) {
      return sessionChangedResult('spectate_after_timeline_dispose');
    }
    if (typeof cfg.activateSpectatorSessionFromResponse === 'function') {
      cfg.activateSpectatorSessionFromResponse(Object.assign({}, res.data, { playerName: entryPayload.playerName }), entryPayload.roomId);
    }
    if (typeof cfg.resetNetworkTelemetry === 'function') {
      cfg.resetNetworkTelemetry();
    }

    openStream();

    const state = readState();
    const roomName = String(res.data.roomName || 'ルーム');
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('ネット対戦: ルーム「' + roomName + '」を観測中');
    }

    return {
      ok: true,
      roomId: state.roomId,
      roomName,
      viewerRole: 'spectator',
      spectatorId: state.spectatorId,
      spectatorName: state.spectatorName || entryPayload.playerName,
      networkAutoEnabled: state.networkAutoEnabled === true
    };
  }

  async function syncLatestState(options?: any): Promise<any> {
    const opts = (options && typeof options === 'object') ? options : {};
    const intakeSource = normalizeStateSyncIntakeSource(opts.source);
    const state = readState();
    if (!state.roomId) return { ok: false, reason: 'NO_ROOM' };
    const sessionGuard = captureSessionGuard(state);

    const path = buildStatePath(state);
    const res = await cfg.requestJson('GET', path);
    if (!isSessionGuardCurrent(sessionGuard)) return sessionChangedResult('state_sync_after_request');
    if (!res.ok || !res.data || res.data.ok !== true) {
      return { ok: false, reason: (res.data && res.data.reason) || 'STATE_FETCH_FAILED' };
    }
    const responseRoomId = res.data.roomId ? String(res.data.roomId).trim().toUpperCase() : '';
    const currentRoomId = state.roomId ? String(state.roomId).trim().toUpperCase() : '';
    if (responseRoomId && currentRoomId && responseRoomId !== currentRoomId) {
      if (typeof cfg.recordNetworkTelemetry === 'function') {
        cfg.recordNetworkTelemetry('state_sync_stale_room_ignored', {
          responseRoomId,
          currentRoomId
        });
      }
      return { ok: false, reason: 'ROOM_MISMATCH' };
    }

    const responseStateVersion = toIntegerOrNull(res.data.stateVersion);
    const responseSnapshotVersion = res.data.snapshot && typeof cfg.getSnapshotStateVersion === 'function'
      ? toIntegerOrNull(cfg.getSnapshotStateVersion(res.data.snapshot))
      : null;
    const currentStateVersion = toIntegerOrNull(state.appliedStateVersion) ?? getCanonicalStateVersion(state);
    if (currentStateVersion !== null && (
      (responseStateVersion !== null && responseStateVersion < currentStateVersion)
      || (responseSnapshotVersion !== null && responseSnapshotVersion < currentStateVersion)
    )) {
      if (typeof cfg.recordNetworkTelemetry === 'function') {
        cfg.recordNetworkTelemetry('state_sync_stale_response_ignored', {
          responseStateVersion,
          responseSnapshotVersion,
          currentStateVersion
        });
      }
      return { ok: false, stale: true, reason: 'STALE_STATE_SYNC' };
    }

    const visualSeqBeforeStateSync = getStoredVisualSeq(null, state);
    const visualVersionBeforeStateSync = getStoredVisualVersion(null, state);
    const localProjectedSnapshotHashBefore = typeof cfg.getKnownProjectedSnapshotHash === 'function'
      ? cfg.getKnownProjectedSnapshotHash()
      : null;
    const cursor = res.data && res.data.presentationCursor && typeof res.data.presentationCursor === 'object'
      ? res.data.presentationCursor
      : null;
    const cursorVisualSeq = toIntegerOrNull(cursor && cursor.visualSeq);
    const cursorStateVersion = toIntegerOrNull(cursor && cursor.stateVersion);
    if (typeof cfg.applyPayloadSessionState === 'function') {
      cfg.applyPayloadSessionState(res.data);
    }
    if (responseStateVersion !== null) {
      state.stateVersion = responseStateVersion;
    }

    let appliedSnapshot = false;
    let stateSyncPresentationFrameCount = 0;
    let stateSyncRecoveredVisualContinuity = false;
    let shouldCatchUpPresentationJournal = false;
    if (res.data.snapshot) {
      const exactVisualRebase = opts.syncVisualCursorForSnapshotNoPlayback === true;
      const skipSnapshot = !exactVisualRebase && typeof cfg.shouldSkipForceSyncSnapshot === 'function'
        ? cfg.shouldSkipForceSyncSnapshot(res.data.snapshot, {
          localProjectedSnapshotHash: localProjectedSnapshotHashBefore
        })
        : false;
      if (!skipSnapshot) {
        const hasPresentationFrames = !exactVisualRebase
          && Array.isArray(res.data.presentationFrames)
          && res.data.presentationFrames.length > 0;
        stateSyncPresentationFrameCount = hasPresentationFrames ? res.data.presentationFrames.length : 0;
        shouldCatchUpPresentationJournal = (
          !exactVisualRebase
          && opts.suppressPresentationJournalCatchup !== true
          && cursorVisualSeq !== null
          && cursorVisualSeq > visualSeqBeforeStateSync + stateSyncPresentationFrameCount
          && typeof cfg.enqueuePresentationFramesFromPayload === 'function'
        );
        const playbackEvents = exactVisualRebase || hasPresentationFrames
          ? []
          : (typeof cfg.resolveStateSyncRecoveredPlaybackEvents === 'function'
            ? cfg.resolveStateSyncRecoveredPlaybackEvents(res.data)
            : (Array.isArray(res.data.playbackEvents) ? res.data.playbackEvents : []));
        if (
          typeof cfg.normalizeNetworkSnapshotEnvelope === 'function'
          && typeof cfg.submitNetworkSnapshotEnvelope === 'function'
        ) {
          const envelope = cfg.normalizeNetworkSnapshotEnvelope({
            source: intakeSource,
            payload: res.data,
            force: true,
            // Intake reads replay from the envelope itself, not applyOptions.
            // A restored session rebases to the current snapshot without replay.
            presentationFrames: hasPresentationFrames ? res.data.presentationFrames : [],
            playbackEvents,
            applyOptions: {
              force: true,
              playbackEvents: playbackEvents,
              presentationFrames: hasPresentationFrames ? res.data.presentationFrames : [],
              presentationFrameSource: intakeSource,
              suppressContinuityRecovery: exactVisualRebase || shouldCatchUpPresentationJournal
            }
          });
          const intakeResult = cfg.submitNetworkSnapshotEnvelope(envelope);
          appliedSnapshot = !!(intakeResult && intakeResult.appliedSnapshot === true);
          stateSyncRecoveredVisualContinuity = !!(
            intakeResult
            && intakeResult.recoveredVisualContinuity === true
          );
        } else {
          appliedSnapshot = typeof cfg.applySnapshotThroughCoordinator === 'function'
            ? cfg.applySnapshotThroughCoordinator(res.data.snapshot, {
              source: intakeSource,
              applyOptions: {
                force: true,
                playbackEvents: playbackEvents,
                presentationFrames: hasPresentationFrames ? res.data.presentationFrames : [],
                presentationFrameSource: intakeSource,
                suppressContinuityRecovery: exactVisualRebase || shouldCatchUpPresentationJournal
              }
            })
            : false;
        }
        if (appliedSnapshot && typeof cfg.rememberPendingForceSyncPlaybackRecovery === 'function') {
          cfg.rememberPendingForceSyncPlaybackRecovery(res.data.snapshot, {
            source: intakeSource,
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
            presentationFrameCount: hasPresentationFrames ? res.data.presentationFrames.length : 0,
            usedRecoveredPlayback: playbackEvents.length > 0
          });
        }
        if (
          opts.syncVisualCursorForSnapshotNoPlayback === true &&
          typeof cfg.syncVisualCursorForSnapshotNoPlayback === 'function'
        ) {
          const visualRebased = cfg.syncVisualCursorForSnapshotNoPlayback(
            res.data,
            typeof cfg.getSnapshotStateVersion === 'function'
              ? cfg.getSnapshotStateVersion(res.data.snapshot)
              : responseStateVersion,
            {
              requirePresentationCursor: opts.requirePresentationCursor === true,
              source: intakeSource
            }
          );
          if (visualRebased !== true) {
            return { ok: false, reason: 'VISUAL_REBASE_FAILED' };
          }
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

    if (
      appliedSnapshot &&
      opts.syncVisualCursorForSnapshotNoPlayback !== true &&
      opts.suppressPresentationJournalCatchup !== true &&
      stateSyncRecoveredVisualContinuity !== true &&
      shouldCatchUpPresentationJournal
    ) {
      const journalResult = await fetchAndApplyPresentationJournal(
        visualSeqBeforeStateSync,
        cursorStateVersion !== null ? cursorStateVersion : responseStateVersion,
        'state_sync',
        visualVersionBeforeStateSync,
        sessionGuard
      );
      if (journalResult && journalResult.reason === 'SESSION_CHANGED') {
        return { ok: false, stale: true, reason: 'SESSION_CHANGED' };
      }
      if (!journalResult || journalResult.recovered !== true) {
        return {
          ok: false,
          reason: journalResult && journalResult.reason
            ? journalResult.reason
            : 'PRESENTATION_JOURNAL_NOT_CONVERGED'
        };
      }
    }

    if (!isSessionGuardCurrent(sessionGuard)) return sessionChangedResult('state_sync_before_return');
    const result: any = {
      ok: true,
      appliedSnapshot: appliedSnapshot
    };
    if (opts.syncVisualCursorForSnapshotNoPlayback === true) {
      result.visualRebased = true;
      result.presentationCursor = cursor;
    }
    return result;
  }

  async function restoreStoredSessionAttempt(options?: any): Promise<any> {
    const opts = (options && typeof options === 'object') ? options : {};
    const state = readState();
    if (state.roomId) {
      return { ok: false, reason: 'ALREADY_IN_ROOM', roomId: state.roomId };
    }
    if (opts.serverUrl && typeof cfg.setServerUrl === 'function') {
      cfg.setServerUrl(opts.serverUrl);
    }

    const stored = typeof cfg.readStoredSession === 'function' ? cfg.readStoredSession() : null;
    if (!stored || typeof stored !== 'object') {
      return { ok: false, reason: 'NO_STORED_SESSION' };
    }
    if (stored.serverUrl && typeof cfg.setServerUrl === 'function') {
      cfg.setServerUrl(stored.serverUrl);
    }
    const activationEpoch = advanceSessionEpoch('stored_session_activation');
    await disposePresentationTimeline('stored_session_activation');
    if (readSessionEpoch() !== activationEpoch || readState().roomId) {
      return sessionChangedResult('restore_after_timeline_dispose');
    }
    if (typeof cfg.activateStoredSession !== 'function' || cfg.activateStoredSession(stored) !== true) {
      if (typeof cfg.clearStoredSession === 'function') cfg.clearStoredSession();
      return { ok: false, reason: 'STORED_SESSION_INVALID' };
    }

    if (typeof cfg.resetNetworkTelemetry === 'function') {
      cfg.resetNetworkTelemetry();
    }

    const syncResult = await syncLatestState({
      suppressPresentationJournalCatchup: true,
      syncVisualCursorForSnapshotNoPlayback: true,
      requirePresentationCursor: true
    });
    if (!syncResult || syncResult.ok !== true) {
      const reason = syncResult && syncResult.reason ? syncResult.reason : 'STATE_FETCH_FAILED';
      if (reason === 'SESSION_CHANGED') {
        return { ok: false, stale: true, reason };
      }
      if (isInvalidStoredSessionReason(reason) && typeof cfg.clearStoredSession === 'function') {
        cfg.clearStoredSession();
      }
      advanceSessionEpoch('stored_session_sync_failed');
      await disposePresentationTimeline('stored_session_sync_failed');
      if (typeof cfg.resetSessionState === 'function') {
        cfg.resetSessionState();
      }
      return { ok: false, reason };
    }

    openStream();

    const restoredState = readState();
    const viewerRole = isSpectatorState(restoredState) ? 'spectator' : 'seat';
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus(viewerRole === 'spectator'
        ? 'ネット対戦: 観測セッションへ復帰しました'
        : 'ネット対戦: 対戦セッションへ復帰しました');
    }

    return {
      ok: true,
      restored: true,
      roomId: restoredState.roomId,
      viewerRole,
      seatKey: viewerRole === 'seat' ? restoredState.seatKey : undefined,
      spectatorId: viewerRole === 'spectator' ? restoredState.spectatorId : undefined,
      spectatorName: viewerRole === 'spectator' ? restoredState.spectatorName : undefined,
      appliedSnapshot: syncResult.appliedSnapshot === true
    };
  }

  async function leaveRoom(): Promise<any> {
    if (typeof cfg.clearPendingForceSyncPlaybackRecovery === 'function') {
      cfg.clearPendingForceSyncPlaybackRecovery();
    }

    const state = readState();
    if (!state.roomId) {
      advanceSessionEpoch('session_leave_inactive');
      await disposePresentationTimeline('session_leave_inactive');
      if (typeof cfg.clearPlaybackStateForLeave === 'function') {
        cfg.clearPlaybackStateForLeave();
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
      return { ok: true };
    }

    const roomId = state.roomId;
    const seatKey = state.seatKey;
    const seatToken = state.seatToken;
    const spectatorId = state.spectatorId;
    const spectatorToken = state.spectatorToken;
    const spectatorSession = isSpectatorState(state);
    let leaveResponse: any = null;

    // Detach queued snapshot/presentation work before the authority revokes the
    // current credentials. Failed leaves reopen the stream on this new epoch.
    advanceSessionEpoch('session_leave_requested');
    if (typeof cfg.cancelSessionReadRequests === 'function') {
      // Wait until aborted reads have settled before revoking the seat token.
      // Otherwise the leave POST can reach the authority first and turn the
      // older journal response into a visible 403.
      await cfg.cancelSessionReadRequests();
    }

    // Close the live stream before the authority invalidates the session token.
    // Otherwise EventSource can race the leave response and briefly reconnect
    // with the now-invalid token, producing a spurious 403 in the browser.
    if (typeof cfg.closeStream === 'function') {
      cfg.closeStream();
    }

    function restoreStreamAfterLeaveFailure(): void {
      if (typeof cfg.openStream === 'function') {
        cfg.openStream({ reconnect: true });
      }
    }

    try {
      leaveResponse = spectatorSession
        ? await cfg.requestJson('POST', '/api/match/spectator-leave', {
          roomId: roomId,
          spectatorId: spectatorId,
          spectatorToken: spectatorToken
        })
        : await cfg.requestJson('POST', '/api/match/leave', {
          roomId: roomId,
          seatKey: seatKey,
          seatToken: seatToken
        });
    } catch (e) {
      restoreStreamAfterLeaveFailure();
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('ネット対戦: 部屋の退出に失敗しました');
      }
      return { ok: false, reason: 'LEAVE_REQUEST_FAILED' };
    }

    const leaveReason = String(leaveResponse && leaveResponse.data && leaveResponse.data.reason ? leaveResponse.data.reason : '').trim();
    if (!(leaveResponse && leaveResponse.ok) && leaveReason !== 'ROOM_NOT_FOUND') {
      restoreStreamAfterLeaveFailure();
      if (typeof cfg.emitStatus === 'function') {
        cfg.emitStatus('ネット対戦: 部屋の退出に失敗しました (' + (leaveReason || 'LEAVE_FAILED') + ')');
      }
      return {
        ok: false,
        reason: leaveReason || 'LEAVE_FAILED',
        status: leaveResponse ? leaveResponse.status : 0
      };
    }

    advanceSessionEpoch('session_leave_confirmed');
    try {
      await disposePresentationTimeline('session_leave_confirmed');
    } catch (error) {
      return convergeConfirmedLeaveDisposeFailure(state, spectatorSession, error);
    }
    if (typeof cfg.clearPlaybackStateForLeave === 'function') {
      cfg.clearPlaybackStateForLeave();
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
    if (typeof cfg.teardownActionBridge === 'function') {
      cfg.teardownActionBridge();
    }
    if (!spectatorSession && typeof cfg.clearSeatClaim === 'function') {
      cfg.clearSeatClaim(roomId);
    }
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus('ネット対戦: 部屋から退出しました');
    }

    return { ok: true };
  }

  function createRoom(options?: any): Promise<any> {
    return runRoomEntrySingleFlight('create', () => createRoomAttempt(options));
  }

  function joinRoom(roomId: any, options?: any): Promise<any> {
    return runRoomEntrySingleFlight('join', () => joinRoomAttempt(roomId, options));
  }

  function spectateRoom(roomId: any, options?: any): Promise<any> {
    return runRoomEntrySingleFlight('spectate', () => spectateRoomAttempt(roomId, options));
  }

  function restoreStoredSession(options?: any): Promise<any> {
    return runRoomEntrySingleFlight('restore', () => restoreStoredSessionAttempt(options));
  }

  return {
    createRoom: createRoom,
    joinRoom: joinRoom,
    spectateRoom: spectateRoom,
    listRooms: listRooms,
    syncLatestState: syncLatestState,
    restoreStoredSession: restoreStoredSession,
    leaveRoom: leaveRoom
  };
}

const NetworkSessionLifecycleModule = {
  createNetworkSessionLifecycleController: createNetworkSessionLifecycleController
};

export = NetworkSessionLifecycleModule;
