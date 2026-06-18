'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function createNetworkSessionSeatController(config: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : null);
  const STORED_SESSION_KEY = 'network_match_last_session';

  function resolveGachaHandCatalogSharedModule(): any {
    try {
      if (rootRef && rootRef.GachaHandCatalogSharedModule) {
        return rootRef.GachaHandCatalogSharedModule;
      }
    } catch (e) { /* ignore */ }
    try {
      if (typeof _require === 'function') {
        return _require('../../shared/gacha-hand-catalog-shared');
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function resolveState(): any {
    return (typeof cfg.getState === 'function' && cfg.getState()) || {};
  }

  function resetResultPresentationState(state?: any): any {
    const target = (state && typeof state === 'object') ? state : resolveState();
    if (typeof cfg.resetResultPresentationState === 'function') {
      return cfg.resetResultPresentationState(target);
    }
    if (!target || typeof target !== 'object') {
      return {
        lastResultVersionShown: null,
        resultShownForUnversioned: false
      };
    }
    target.lastResultVersionShown = null;
    target.resultShownForUnversioned = false;
    return target;
  }

  function normalizePlayerKey(value: any): string {
    if (typeof cfg.normalizePlayerKey === 'function') {
      return cfg.normalizePlayerKey(value);
    }
    const normalized = String(value || '').trim().toLowerCase();
    if (value === -1 || normalized === 'white' || normalized === '-1') return 'white';
    return 'black';
  }

  function normalizeRoomId(value: any): string {
    if (typeof cfg.normalizeRoomId === 'function') {
      return cfg.normalizeRoomId(value);
    }
    return String(value || '').trim().toUpperCase();
  }

  function normalizeViewerRole(value: any): 'seat' | 'spectator' {
    return String(value || '').trim().toLowerCase() === 'spectator' ? 'spectator' : 'seat';
  }

  function normalizePlayerName(value: any): string {
    const maxLength = Number.isFinite(Number(cfg.playerNameMax))
      ? Math.max(1, Math.trunc(Number(cfg.playerNameMax)))
      : 7;
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return Array.from(normalized).slice(0, maxLength).join('');
  }

  function normalizeRoomSeats(value: any): any {
    return {
      black: !!(value && value.black),
      white: !!(value && value.white)
    };
  }

  function normalizeSeatNames(value: any): any {
    return {
      black: normalizePlayerName(value && value.black),
      white: normalizePlayerName(value && value.white)
    };
  }

  function normalizeSeatHandSkinId(value: any): string {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    const catalogSharedModule = resolveGachaHandCatalogSharedModule();
    const canonical = (catalogSharedModule && typeof catalogSharedModule.normalizeCatalogItemId === 'function')
      ? catalogSharedModule.normalizeCatalogItemId(normalized)
      : normalized;
    return Array.from(canonical).slice(0, 128).join('');
  }

  function normalizeSeatHandSkins(value: any): any {
    return {
      black: normalizeSeatHandSkinId(value && value.black),
      white: normalizeSeatHandSkinId(value && value.white)
    };
  }

  function normalizeRoomDeck(value: any): any {
    const source = (value && typeof value === 'object') ? value : null;
    if (!source) return null;

    const deckCode = String(source.deckCode || '').trim();
    const parseDeckSize = (candidate: any) => {
      if (candidate === null || typeof candidate === 'undefined' || candidate === '') return null;
      return Number.isFinite(Number(candidate))
        ? Math.max(0, Math.trunc(Number(candidate)))
        : null;
    };
    const deckSize = parseDeckSize(source.deckSize);
    const deckCodeByPlayerSource = (source.deckCodeByPlayer && typeof source.deckCodeByPlayer === 'object')
      ? source.deckCodeByPlayer
      : null;
    const deckSizeByPlayerSource = (source.deckSizeByPlayer && typeof source.deckSizeByPlayer === 'object')
      ? source.deckSizeByPlayer
      : null;
    const deckCodeByPlayer = {
      black: deckCodeByPlayerSource ? String(deckCodeByPlayerSource.black || '').trim() : '',
      white: deckCodeByPlayerSource ? String(deckCodeByPlayerSource.white || '').trim() : ''
    };
    const deckSizeByPlayer = {
      black: parseDeckSize(deckSizeByPlayerSource && deckSizeByPlayerSource.black),
      white: parseDeckSize(deckSizeByPlayerSource && deckSizeByPlayerSource.white)
    };
    const hasPerPlayerDeck = !!(
      deckCodeByPlayer.black ||
      deckCodeByPlayer.white ||
      deckSizeByPlayer.black !== null ||
      deckSizeByPlayer.white !== null
    );
    const mode = String(source.mode || (hasPerPlayerDeck ? 'perPlayer' : 'shared')).trim() || 'shared';
    const roomSource = String(source.source || 'room').trim() || 'room';

    if (!deckCode && deckSize === null && !hasPerPlayerDeck) return null;

    return {
      mode,
      deckCode,
      deckSize,
      deckCodeByPlayer,
      deckSizeByPlayer,
      source: roomSource
    };
  }

  function resolveSharedBoardUtils(): any {
    try {
      if (rootRef && rootRef.SharedBoardUtils) {
        return rootRef.SharedBoardUtils;
      }
    } catch (e) { /* ignore */ }
    try {
      if (typeof _require === 'function') {
        return _require('../../shared/shared-board-utils');
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function maybeResolveBoardConfig(value: any): any {
    const boardUtils = resolveSharedBoardUtils();
    if (!boardUtils || typeof boardUtils.maybeResolveBoardConfig !== 'function') return maybeResolveInlineBoardConfig(value);
    try {
      return boardUtils.maybeResolveBoardConfig(value) || maybeResolveInlineBoardConfig(value);
    } catch (e) { /* ignore */ }
    return maybeResolveInlineBoardConfig(value);
  }

  function maybeResolveInlineBoardConfig(value: any): any {
    const source = resolveInlineBoardConfigSource(value);
    if (!source) return null;
    const rows = Number(source.rows);
    const cols = Number(source.cols);
    if (!Number.isFinite(rows) || !Number.isFinite(cols)) return null;
    const normalizedRows = Math.max(1, Math.trunc(rows));
    const normalizedCols = Math.max(1, Math.trunc(cols));
    return {
      rows: normalizedRows,
      cols: normalizedCols,
      standard8x8: source.standard8x8 === true || (normalizedRows === 8 && normalizedCols === 8)
    };
  }

  function resolveInlineBoardConfigSource(value: any): any {
    if (!value || typeof value !== 'object') return null;
    if (value.roomBoardConfig && typeof value.roomBoardConfig === 'object') return value.roomBoardConfig;
    if (value.boardConfig && typeof value.boardConfig === 'object') return value.boardConfig;
    if (value.gameState && typeof value.gameState === 'object') return resolveInlineBoardConfigSource(value.gameState);
    if (Number.isFinite(Number(value.rows)) || Number.isFinite(Number(value.cols))) return value;
    if (Array.isArray(value.board)) {
      const rows = value.board.length;
      const cols = value.board.reduce((max: number, row: any) => Array.isArray(row) ? Math.max(max, row.length) : max, 0);
      if (rows > 0 && cols > 0) return { rows, cols, standard8x8: rows === 8 && cols === 8 };
    }
    return null;
  }

  function normalizeRoomBoardConfig(value: any, options?: any): any {
    const opts = (options && typeof options === 'object') ? options : {};
    return (
      maybeResolveBoardConfig(value)
      || maybeResolveBoardConfig(opts.payload && opts.payload.boardConfig)
      || maybeResolveBoardConfig(opts.payload && opts.payload.roomBoardConfig)
      || maybeResolveBoardConfig(opts.snapshot && opts.snapshot.gameState)
      || maybeResolveBoardConfig(opts.snapshot)
      || maybeResolveBoardConfig(opts.fallbackBoardConfig)
    );
  }

  function normalizeNetworkDebugEnabled(value: any): boolean {
    return value === true;
  }

  function getSeatDisplayName(seatKey: any): string {
    return normalizePlayerKey(seatKey) === 'white' ? '白' : '黒';
  }

  function hasTwoPlayers(): boolean {
    const state = resolveState();
    return !!(state.roomSeats && state.roomSeats.black && state.roomSeats.white);
  }

  function emitRoomStateChanged(): void {
    const state = resolveState();
    if (typeof state.roomStateListener !== 'function') return;
    try {
      const active = typeof cfg.isActive === 'function' ? cfg.isActive() : !!state.active;
      state.roomStateListener({
        active,
        roomId: state.roomId,
        viewerRole: String(state.viewerRole || 'seat').trim().toLowerCase() === 'spectator' ? 'spectator' : 'seat',
        spectatorName: normalizePlayerName(state.spectatorName),
        seatKey: state.seatKey,
        seats: normalizeRoomSeats(state.roomSeats),
        seatNames: normalizeSeatNames(state.seatNames),
        seatHandSkins: normalizeSeatHandSkins(state.seatHandSkins),
        roomDeck: normalizeRoomDeck(state.roomDeck),
        roomBoardConfig: active ? normalizeRoomBoardConfig(state.roomBoardConfig) : null,
        networkDebugEnabled: normalizeNetworkDebugEnabled(state.networkDebugEnabled),
        hasTwoPlayers: hasTwoPlayers()
      });
    } catch (e) { /* ignore */ }
  }

  function updateRoomSeatsFromPayload(payload: any): void {
    if (!payload || typeof payload !== 'object') return;

    const state = resolveState();
    let changed = false;
    if (Object.prototype.hasOwnProperty.call(payload, 'seats')) {
      state.roomSeats = normalizeRoomSeats(payload.seats);
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'seatNames')) {
      state.seatNames = normalizeSeatNames(payload.seatNames);
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'seatHandSkins')) {
      state.seatHandSkins = normalizeSeatHandSkins(payload.seatHandSkins);
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'roomDeck')) {
      state.roomDeck = normalizeRoomDeck(payload.roomDeck);
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'roomBoardConfig')) {
      state.roomBoardConfig = normalizeRoomBoardConfig(payload.roomBoardConfig, {
        snapshot: payload.snapshot,
        fallbackBoardConfig: state.roomBoardConfig
      });
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'networkDebugEnabled')) {
      state.networkDebugEnabled = normalizeNetworkDebugEnabled(payload.networkDebugEnabled);
      changed = true;
    }

    if (changed) emitRoomStateChanged();
  }

  function ensureOwnSeatJoined(): void {
    const state = resolveState();
    state.roomSeats = normalizeRoomSeats(state.roomSeats);
    state.roomSeats[state.seatKey] = true;
  }

  function setSeatGlobals(seatKey: any): void {
    const normalized = normalizePlayerKey(seatKey);
    try {
      if (rootRef) {
        rootRef.LOCAL_PLAYER_KEY = normalized;
        rootRef.BOARD_VIEWER_KEY = normalized;
        rootRef.__LOCAL_PLAYER_KEY = normalized;
      }
    } catch (e) { /* ignore */ }

    try {
      if (typeof globalThis !== 'undefined') {
        (globalThis as any).LOCAL_PLAYER_KEY = normalized;
        (globalThis as any).BOARD_VIEWER_KEY = normalized;
        (globalThis as any).__LOCAL_PLAYER_KEY = normalized;
      }
    } catch (e) { /* ignore */ }
  }

  function getSeatStorageKey(roomId: any): string {
    return `network_match_seat_${normalizeRoomId(roomId)}`;
  }

  function getStorage(): any {
    try {
      if (rootRef && rootRef.localStorage) return rootRef.localStorage;
    } catch (e) { /* ignore */ }
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* ignore */ }
    return null;
  }

  function readSeatClaim(roomId: any): any {
    try {
      const storage = getStorage();
      if (!storage) return null;
      const raw = storage.getItem(getSeatStorageKey(roomId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.seatToken) return null;
      return {
        seatKey: normalizePlayerKey(parsed.seatKey),
        seatToken: String(parsed.seatToken)
      };
    } catch (e) { /* ignore */ }
    return null;
  }

  function writeSeatClaim(roomId: any, seatKey: any, seatToken: any): void {
    try {
      const storage = getStorage();
      if (!storage) return;
      if (!roomId || !seatToken) return;
      storage.setItem(getSeatStorageKey(roomId), JSON.stringify({
        roomId: normalizeRoomId(roomId),
        seatKey: normalizePlayerKey(seatKey),
        seatToken: String(seatToken)
      }));
    } catch (e) { /* ignore */ }
  }

  function clearSeatClaim(roomId: any): void {
    try {
      const storage = getStorage();
      if (!storage) return;
      if (!roomId) return;
      storage.removeItem(getSeatStorageKey(roomId));
      const stored = readStoredSession();
      if (stored && stored.viewerRole === 'seat' && stored.roomId === normalizeRoomId(roomId)) {
        clearStoredSession();
      }
    } catch (e) { /* ignore */ }
  }

  function normalizeStoredSession(value: any): any {
    const source = (value && typeof value === 'object') ? value : null;
    if (!source) return null;
    const roomId = normalizeRoomId(source.roomId);
    if (!roomId) return null;
    const viewerRole = normalizeViewerRole(source.viewerRole);
    const serverUrl = String(source.serverUrl || '').trim();
    const lastVisualSeq = Number.isFinite(Number(source.lastVisualSeq))
      ? Math.max(0, Math.trunc(Number(source.lastVisualSeq)))
      : 0;
    const lastVisualVersion = Number.isFinite(Number(source.lastVisualVersion))
      ? Math.max(0, Math.trunc(Number(source.lastVisualVersion)))
      : null;
    if (viewerRole === 'spectator') {
      const spectatorId = String(source.spectatorId || '').trim();
      const spectatorToken = String(source.spectatorToken || '').trim();
      if (!spectatorId || !spectatorToken) return null;
      return {
        version: 1,
        roomId,
        viewerRole: 'spectator',
        spectatorId,
        spectatorToken,
        spectatorName: normalizePlayerName(source.spectatorName || source.playerName),
        lastVisualSeq,
        lastVisualVersion,
        serverUrl
      };
    }

    const seatToken = String(source.seatToken || '').trim();
    if (!seatToken) return null;
    return {
      version: 1,
      roomId,
      viewerRole: 'seat',
      seatKey: normalizePlayerKey(source.seatKey),
      seatToken,
      playerName: normalizePlayerName(source.playerName),
      lastVisualSeq,
      lastVisualVersion,
      serverUrl
    };
  }

  function readStoredSession(): any {
    try {
      const storage = getStorage();
      if (!storage) return null;
      const raw = storage.getItem(STORED_SESSION_KEY);
      if (!raw) return null;
      return normalizeStoredSession(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return null;
  }

  function writeStoredSession(session: any): void {
    try {
      const storage = getStorage();
      if (!storage) return;
      const normalized = normalizeStoredSession(session);
      if (!normalized) return;
      storage.setItem(STORED_SESSION_KEY, JSON.stringify(normalized));
    } catch (e) { /* ignore */ }
  }

  function writeStoredSessionFromState(): void {
    const state = resolveState();
    const serverUrl = typeof cfg.getServerUrl === 'function' ? cfg.getServerUrl() : '';
    if (normalizeViewerRole(state.viewerRole) === 'spectator') {
      writeStoredSession({
        roomId: state.roomId,
        viewerRole: 'spectator',
        spectatorId: state.spectatorId,
        spectatorToken: state.spectatorToken,
        spectatorName: state.spectatorName,
        lastVisualSeq: state.lastVisualSeq,
        lastVisualVersion: state.lastVisualVersion,
        serverUrl
      });
      return;
    }
    writeStoredSession({
      roomId: state.roomId,
      viewerRole: 'seat',
      seatKey: state.seatKey,
      seatToken: state.seatToken,
      playerName: state.seatNames && state.seatNames[state.seatKey],
      lastVisualSeq: state.lastVisualSeq,
      lastVisualVersion: state.lastVisualVersion,
      serverUrl
    });
  }

  function clearStoredSession(): void {
    try {
      const storage = getStorage();
      if (!storage) return;
      storage.removeItem(STORED_SESSION_KEY);
    } catch (e) { /* ignore */ }
  }

  function activateStoredSession(session: any): boolean {
    const stored = normalizeStoredSession(session);
    if (!stored) return false;
    const state = resolveState();

    if (typeof cfg.prepareSessionActivation === 'function') {
      cfg.prepareSessionActivation(stored);
    }

    state.active = true;
    state.roomId = stored.roomId;
    state.viewerRole = stored.viewerRole;
    state.stateVersion = null;
    state.lastVisualSeq = Number.isFinite(Number(stored.lastVisualSeq)) ? Math.max(0, Math.trunc(Number(stored.lastVisualSeq))) : 0;
    state.lastVisualVersion = Number.isFinite(Number(stored.lastVisualVersion)) ? Math.max(0, Math.trunc(Number(stored.lastVisualVersion))) : null;
    resetResultPresentationState(state);
    state.chatHistory = [];
    state.roomSeats = { black: false, white: false };
    state.seatNames = { black: '', white: '' };
    state.seatHandSkins = { black: '', white: '' };
    state.roomDeck = null;
    state.roomBoardConfig = null;
    state.networkDebugEnabled = false;

    if (stored.viewerRole === 'spectator') {
      state.spectatorId = stored.spectatorId;
      state.spectatorToken = stored.spectatorToken;
      state.spectatorName = normalizePlayerName(stored.spectatorName);
      state.seatKey = normalizePlayerKey(state.seatKey || 'black');
      state.seatToken = '';
    } else {
      state.viewerRole = 'seat';
      state.spectatorId = '';
      state.spectatorToken = '';
      state.spectatorName = '';
      state.seatKey = normalizePlayerKey(stored.seatKey);
      state.seatToken = String(stored.seatToken || '').trim();
      ensureOwnSeatJoined();
      setSeatGlobals(state.seatKey);
      if (typeof cfg.ensureActionBridge === 'function') {
        cfg.ensureActionBridge();
      }
    }

    emitRoomStateChanged();
    return true;
  }

  function activateSessionFromResponse(data: any, fallbackRoomId: any): void {
    const payload = data || {};
    const state = resolveState();

    if (typeof cfg.prepareSessionActivation === 'function') {
      cfg.prepareSessionActivation(payload);
    }

    state.active = true;
    state.roomId = String(payload.roomId || fallbackRoomId || '').trim().toUpperCase();
    state.viewerRole = 'seat';
    state.spectatorId = '';
    state.spectatorToken = '';
    state.spectatorName = '';
    state.seatKey = normalizePlayerKey(payload.seatKey);
    state.seatToken = String(payload.seatToken || '').trim();
    state.stateVersion = Number.isFinite(Number(payload.stateVersion)) ? Number(payload.stateVersion) : null;
    resetResultPresentationState(state);
    state.chatHistory = [];
    state.roomSeats = normalizeRoomSeats(payload.seats);
    state.seatNames = normalizeSeatNames(payload.seatNames);
    state.seatHandSkins = normalizeSeatHandSkins(payload.seatHandSkins);
    state.roomDeck = normalizeRoomDeck(payload.roomDeck);
    state.roomBoardConfig = normalizeRoomBoardConfig(payload.roomBoardConfig, {
      snapshot: payload.snapshot,
      payload
    });
    state.networkDebugEnabled = normalizeNetworkDebugEnabled(payload.networkDebugEnabled);

    const ownName = normalizePlayerName(payload.playerName);
    if (ownName) {
      state.seatNames[state.seatKey] = ownName;
    }

    ensureOwnSeatJoined();

    if (typeof cfg.updateTurnTimerFromPayload === 'function') {
      cfg.updateTurnTimerFromPayload(payload);
    }
    setSeatGlobals(state.seatKey);
    if (typeof cfg.ensureActionBridge === 'function') {
      cfg.ensureActionBridge();
    }
    writeSeatClaim(state.roomId, state.seatKey, state.seatToken);
    writeStoredSessionFromState();
    emitRoomStateChanged();

    if (payload.snapshot && typeof cfg.applySnapshot === 'function') {
      cfg.applySnapshot(payload.snapshot, { force: true });
    }
  }

  function activateSpectatorSessionFromResponse(data: any, fallbackRoomId: any): void {
    const payload = data || {};
    const state = resolveState();

    if (typeof cfg.prepareSessionActivation === 'function') {
      cfg.prepareSessionActivation(payload);
    }

    state.active = true;
    state.roomId = String(payload.roomId || fallbackRoomId || '').trim().toUpperCase();
    state.viewerRole = 'spectator';
    state.spectatorId = String(payload.spectatorId || '').trim();
    state.spectatorToken = String(payload.spectatorToken || '').trim();
    state.spectatorName = normalizePlayerName(payload.spectatorName || payload.playerName);
    state.seatKey = normalizePlayerKey(payload.seatKey || state.seatKey || 'black');
    state.seatToken = '';
    state.stateVersion = Number.isFinite(Number(payload.stateVersion)) ? Number(payload.stateVersion) : null;
    resetResultPresentationState(state);
    state.chatHistory = [];
    state.roomSeats = normalizeRoomSeats(payload.seats);
    state.seatNames = normalizeSeatNames(payload.seatNames);
    state.seatHandSkins = normalizeSeatHandSkins(payload.seatHandSkins);
    state.roomDeck = normalizeRoomDeck(payload.roomDeck);
    state.roomBoardConfig = normalizeRoomBoardConfig(payload.roomBoardConfig, {
      snapshot: payload.snapshot,
      payload
    });
    state.networkDebugEnabled = normalizeNetworkDebugEnabled(payload.networkDebugEnabled);

    if (typeof cfg.updateTurnTimerFromPayload === 'function') {
      cfg.updateTurnTimerFromPayload(payload);
    }
    writeStoredSessionFromState();
    emitRoomStateChanged();

    if (payload.snapshot && typeof cfg.applySnapshot === 'function') {
      cfg.applySnapshot(payload.snapshot, { force: true });
    }
  }

  function resetSessionState(options?: any): void {
    const state = resolveState();
    const opts = (options && typeof options === 'object') ? options : {};
    state.active = false;
    state.roomId = '';
    state.viewerRole = 'seat';
    state.spectatorId = '';
    state.spectatorToken = '';
    state.spectatorName = '';
    state.seatKey = 'black';
    state.seatToken = '';
    state.roomSeats = { black: false, white: false };
    state.seatNames = { black: '', white: '' };
    state.seatHandSkins = { black: '', white: '' };
    state.roomDeck = null;
    state.roomBoardConfig = null;
    state.networkDebugEnabled = false;
    state.chatHistory = [];
    state.stateVersion = null;
    resetResultPresentationState(state);
    setSeatGlobals(state.seatKey);
    if (typeof cfg.onResetSessionState === 'function') {
      cfg.onResetSessionState(state, opts);
    }
    if (opts.preserveStoredSession !== true) {
      clearStoredSession();
    }
    if (opts.emit !== false) {
      emitRoomStateChanged();
    }
  }

  return {
    normalizePlayerName,
    normalizeRoomSeats,
    normalizeSeatNames,
    normalizeSeatHandSkins,
    normalizeRoomBoardConfig,
    getSeatDisplayName,
    hasTwoPlayers,
    emitRoomStateChanged,
    updateRoomSeatsFromPayload,
    ensureOwnSeatJoined,
    setSeatGlobals,
    readSeatClaim,
    writeSeatClaim,
    clearSeatClaim,
    readStoredSession,
    writeStoredSession,
    clearStoredSession,
    activateStoredSession,
    activateSessionFromResponse,
    activateSpectatorSessionFromResponse,
    resetSessionState
  };
}

const NetworkSessionSeatModule = {
  createNetworkSessionSeatController
};

export = NetworkSessionSeatModule;
