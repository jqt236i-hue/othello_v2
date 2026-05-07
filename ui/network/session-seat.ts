'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function createNetworkSessionSeatController(config: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : null);

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
    if (!boardUtils || typeof boardUtils.maybeResolveBoardConfig !== 'function') return null;
    try {
      return boardUtils.maybeResolveBoardConfig(value);
    } catch (e) { /* ignore */ }
    return null;
  }

  function normalizeRoomBoardConfig(value: any, options?: any): any {
    const opts = (options && typeof options === 'object') ? options : {};
    return (
      maybeResolveBoardConfig(value)
      || maybeResolveBoardConfig(opts.snapshot && opts.snapshot.gameState)
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

  function readSeatClaim(roomId: any): any {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(getSeatStorageKey(roomId));
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
      if (typeof localStorage === 'undefined') return;
      if (!roomId || !seatToken) return;
      localStorage.setItem(getSeatStorageKey(roomId), JSON.stringify({
        roomId: normalizeRoomId(roomId),
        seatKey: normalizePlayerKey(seatKey),
        seatToken: String(seatToken)
      }));
    } catch (e) { /* ignore */ }
  }

  function clearSeatClaim(roomId: any): void {
    try {
      if (typeof localStorage === 'undefined') return;
      if (!roomId) return;
      localStorage.removeItem(getSeatStorageKey(roomId));
    } catch (e) { /* ignore */ }
  }

  function activateSessionFromResponse(data: any, fallbackRoomId: any): void {
    const payload = data || {};
    const state = resolveState();

    if (typeof cfg.prepareSessionActivation === 'function') {
      cfg.prepareSessionActivation(payload);
    }

    state.active = true;
    state.roomId = String(payload.roomId || fallbackRoomId || '').trim().toUpperCase();
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
      snapshot: payload.snapshot
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
    activateSessionFromResponse,
    resetSessionState
  };
}

const NetworkSessionSeatModule = {
  createNetworkSessionSeatController
};

export = NetworkSessionSeatModule;
