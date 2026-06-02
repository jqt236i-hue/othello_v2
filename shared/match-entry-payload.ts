'use strict';

interface MatchEntryPayloadHelpers {
  normalizePlayerName?: (value: unknown) => string;
  normalizeRoomId?: (value: unknown) => string;
  sanitizeDeckCode?: (value: unknown) => unknown;
  cloneData?: (value: unknown) => unknown;
  readSelectedHandSkinId?: () => unknown;
  readSeatClaim?: (roomId: string) => unknown;
  roomIdPattern?: RegExp;
  defaultSelectedHandSkinId?: unknown;
}

interface MatchEntryPayloadOptions {
  playerName?: unknown;
  deckCode?: unknown;
  roomBoardConfig?: unknown;
  networkDebugEnabled?: unknown;
}

interface ResolvedDeckCode {
  value: string;
  invalid: boolean;
}

interface MatchEntryPayloadResult {
  ok: boolean;
  reason?: string;
  payload?: Record<string, unknown>;
  playerName?: string;
  roomId?: string;
  deckCode?: string;
  invalidDeckCode?: boolean;
  usedStoredClaim?: boolean;
}

function resolveHelpers(helpers?: MatchEntryPayloadHelpers): MatchEntryPayloadHelpers {
  return (helpers && typeof helpers === 'object') ? helpers : {};
}

function defaultCloneData<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(value);
    }
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneData(value: unknown, helpers: MatchEntryPayloadHelpers): unknown {
  if (typeof helpers.cloneData === 'function') {
    return helpers.cloneData(value);
  }
  return defaultCloneData(value);
}

function normalizePlayerName(value: unknown, helpers?: MatchEntryPayloadHelpers): string {
  const h = resolveHelpers(helpers);
  if (typeof h.normalizePlayerName === 'function') {
    return String(h.normalizePlayerName(value) || '').trim();
  }
  return String(value || '').trim();
}

function normalizeRoomId(value: unknown, helpers?: MatchEntryPayloadHelpers): string {
  const h = resolveHelpers(helpers);
  if (typeof h.normalizeRoomId === 'function') {
    return String(h.normalizeRoomId(value) || '').trim().toUpperCase();
  }
  return String(value || '').trim().toUpperCase();
}

function resolveDeckCode(rawDeckCode: unknown, helpers?: MatchEntryPayloadHelpers): ResolvedDeckCode {
  const h = resolveHelpers(helpers);
  if (typeof h.sanitizeDeckCode === 'function') {
    const sanitized = h.sanitizeDeckCode(rawDeckCode);
    if (sanitized && typeof sanitized === 'object') {
      const resolved = sanitized as { value?: unknown; invalid?: unknown };
      return {
        value: String(resolved.value || '').trim(),
        invalid: resolved.invalid === true
      };
    }
    return {
      value: String(sanitized || '').trim(),
      invalid: false
    };
  }
  return {
    value: String(rawDeckCode || '').trim(),
    invalid: false
  };
}

function appendOptionalDeckCode(
  payload: Record<string, unknown>,
  rawDeckCode: unknown,
  helpers?: MatchEntryPayloadHelpers
): ResolvedDeckCode {
  const deckCode = resolveDeckCode(rawDeckCode, helpers);
  if (deckCode.value) {
    payload.deckCode = deckCode.value;
  }
  return deckCode;
}

function appendSelectedHandSkinId(payload: Record<string, unknown>, helpers?: MatchEntryPayloadHelpers): boolean {
  const h = resolveHelpers(helpers);
  if (typeof h.readSelectedHandSkinId === 'function') {
    payload.selectedHandSkinId = h.readSelectedHandSkinId();
    return true;
  }
  return Object.prototype.hasOwnProperty.call(payload, 'selectedHandSkinId');
}

function getRoomIdPattern(helpers?: MatchEntryPayloadHelpers): RegExp {
  const h = resolveHelpers(helpers);
  return h.roomIdPattern instanceof RegExp ? h.roomIdPattern : /^[A-Z0-9]{3}$/;
}

function testRoomIdPattern(pattern: RegExp, value: string): boolean {
  try {
    pattern.lastIndex = 0;
  } catch (e) { /* ignore */ }
  return pattern.test(value);
}

function buildCreateRoomPayload(
  options?: MatchEntryPayloadOptions,
  helpers?: MatchEntryPayloadHelpers
): MatchEntryPayloadResult {
  const opts = (options && typeof options === 'object') ? options : {};
  const h = resolveHelpers(helpers);
  const playerName = normalizePlayerName(opts.playerName, h);
  if (!playerName) {
    return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
  }

  const payload: Record<string, unknown> = { playerName };
  if (opts.networkDebugEnabled === true) {
    payload.networkDebugEnabled = true;
  }

  const deckCode = appendOptionalDeckCode(payload, opts.deckCode, h);
  if (opts.roomBoardConfig && typeof opts.roomBoardConfig === 'object') {
    payload.roomBoardConfig = cloneData(opts.roomBoardConfig, h);
  }
  appendSelectedHandSkinId(payload, h);

  return {
    ok: true,
    payload,
    playerName,
    deckCode: deckCode.value,
    invalidDeckCode: deckCode.invalid
  };
}

function buildJoinRoomPayload(
  roomId: unknown,
  options?: MatchEntryPayloadOptions,
  helpers?: MatchEntryPayloadHelpers
): MatchEntryPayloadResult {
  const opts = (options && typeof options === 'object') ? options : {};
  const h = resolveHelpers(helpers);
  const playerName = normalizePlayerName(opts.playerName, h);
  if (!playerName) {
    return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
  }

  const normalizedRoomId = normalizeRoomId(roomId, h);
  if (!normalizedRoomId) {
    return { ok: false, reason: 'ROOM_ID_REQUIRED', playerName };
  }
  if (!testRoomIdPattern(getRoomIdPattern(h), normalizedRoomId)) {
    return { ok: false, reason: 'ROOM_ID_INVALID', roomId: normalizedRoomId, playerName };
  }

  const payload: Record<string, unknown> = {
    roomId: normalizedRoomId,
    playerName
  };
  const hasSelectedHandSkinId = appendSelectedHandSkinId(payload, h);
  if (!hasSelectedHandSkinId) {
    payload.selectedHandSkinId = Object.prototype.hasOwnProperty.call(h, 'defaultSelectedHandSkinId')
      ? h.defaultSelectedHandSkinId
      : 'default';
  }

  const deckCode = appendOptionalDeckCode(payload, opts.deckCode, h);
  const storedClaim = typeof h.readSeatClaim === 'function' ? h.readSeatClaim(normalizedRoomId) : null;
  let usedStoredClaim = false;
  if (storedClaim && typeof storedClaim === 'object') {
    const claim = storedClaim as { seatKey?: unknown; seatToken?: unknown };
    payload.seatKey = claim.seatKey;
    payload.seatToken = claim.seatToken;
    usedStoredClaim = true;
  }

  return {
    ok: true,
    payload,
    roomId: normalizedRoomId,
    playerName,
    deckCode: deckCode.value,
    invalidDeckCode: deckCode.invalid,
    usedStoredClaim
  };
}

function buildJoinRetryPayload(entry: MatchEntryPayloadResult | Record<string, unknown>): Record<string, unknown> {
  const payload = ((entry as MatchEntryPayloadResult).payload && typeof (entry as MatchEntryPayloadResult).payload === 'object')
    ? (entry as MatchEntryPayloadResult).payload as Record<string, unknown>
    : ((entry && typeof entry === 'object') ? entry as Record<string, unknown> : {});
  const retryPayload: Record<string, unknown> = {
    roomId: payload.roomId,
    playerName: payload.playerName,
    selectedHandSkinId: payload.selectedHandSkinId
  };
  const deckCode = String((entry as MatchEntryPayloadResult).deckCode || payload.deckCode || '').trim();
  if (deckCode) {
    retryPayload.deckCode = deckCode;
  }
  return retryPayload;
}

const MatchEntryPayload = {
  normalizePlayerName,
  normalizeRoomId,
  resolveDeckCode,
  buildCreateRoomPayload,
  buildJoinRoomPayload,
  buildJoinRetryPayload
};

export = MatchEntryPayload;
