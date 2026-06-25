'use strict';

const RATED_QUEUE_TTL_MS = 10 * 60 * 1000;
const RATED_ROOM_NAME = 'レート戦';
const RATED_BOARD_CONFIG = Object.freeze({
  rows: 8,
  cols: 8,
  standard8x8: true
});

type RatedQueueStatus = 'waiting' | 'matched';
type RatedQueueSeatKey = 'black' | 'white';

type RatedQueueEntryInput = {
  playerId?: unknown;
  playerName?: unknown;
  avatarStoneType?: unknown;
  bio?: unknown;
  deckCode?: unknown;
  selectedHandSkinId?: unknown;
  queuedAt?: unknown;
};

type RatedQueueEntry = {
  version: number;
  status: RatedQueueStatus;
  playerId: string;
  playerName: string;
  avatarStoneType: string;
  bio: string;
  deckCode: string;
  selectedHandSkinId: string;
  queuedAt: number;
  expiresAt: number;
  matchedAt: number;
  roomId: string;
  seatKey: RatedQueueSeatKey | '';
  match: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function toFiniteInteger(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : fallback;
}

function cloneData<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneRatedBoardConfig(): { rows: number; cols: number; standard8x8: boolean } {
  return {
    rows: RATED_BOARD_CONFIG.rows,
    cols: RATED_BOARD_CONFIG.cols,
    standard8x8: true
  };
}

function createRatedMatchId(nowValue?: unknown, blackPlayerIdValue?: unknown, whitePlayerIdValue?: unknown): string {
  const nowMs = toFiniteInteger(nowValue, Date.now());
  const black = normalizePlayerId(blackPlayerIdValue).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16) || 'black';
  const white = normalizePlayerId(whitePlayerIdValue).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16) || 'white';
  const random = Math.random().toString(36).slice(2, 10) || 'match';
  return `rated_${nowMs}_${black}_${white}_${random}`;
}

function normalizePlayerName(value: unknown): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return Array.from(normalized).slice(0, 7).join('') || 'ななし';
}

function normalizeAvatarStoneType(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || 'REGEN';
}

function normalizeBio(value: unknown): string {
  return Array.from(String(value || '').replace(/\r\n?/g, '\n').trim()).slice(0, 120).join('');
}

function normalizePlayerId(value: unknown): string {
  return String(value || '').trim();
}

function normalizeDeckCode(value: unknown): string {
  return String(value || '').trim();
}

function normalizeSelectedHandSkinId(value: unknown): string {
  return String(value || '').trim() || 'default';
}

function createQueueEntry(inputValue: RatedQueueEntryInput, nowValue?: unknown): RatedQueueEntry | null {
  const input = asRecord(inputValue);
  const playerId = normalizePlayerId(input.playerId);
  if (!playerId) return null;
  const queuedAt = toFiniteInteger(input.queuedAt, toFiniteInteger(nowValue, Date.now()));
  const normalizedQueuedAt = queuedAt > 0 ? queuedAt : toFiniteInteger(nowValue, Date.now());
  return {
    version: 1,
    status: 'waiting',
    playerId,
    playerName: normalizePlayerName(input.playerName),
    avatarStoneType: normalizeAvatarStoneType(input.avatarStoneType),
    bio: normalizeBio(input.bio),
    deckCode: normalizeDeckCode(input.deckCode),
    selectedHandSkinId: normalizeSelectedHandSkinId(input.selectedHandSkinId),
    queuedAt: normalizedQueuedAt,
    expiresAt: normalizedQueuedAt + RATED_QUEUE_TTL_MS,
    matchedAt: 0,
    roomId: '',
    seatKey: '',
    match: null
  };
}

function normalizeQueueEntry(value: unknown): RatedQueueEntry | null {
  const source = asRecord(value);
  const playerId = normalizePlayerId(source.playerId);
  if (!playerId) return null;
  const queuedAt = toFiniteInteger(source.queuedAt, 0);
  if (queuedAt <= 0) return null;
  const status = source.status === 'matched' ? 'matched' : 'waiting';
  const seatKey = source.seatKey === 'black' || source.seatKey === 'white' ? source.seatKey : '';
  return {
    version: 1,
    status,
    playerId,
    playerName: normalizePlayerName(source.playerName),
    avatarStoneType: normalizeAvatarStoneType(source.avatarStoneType),
    bio: normalizeBio(source.bio),
    deckCode: normalizeDeckCode(source.deckCode),
    selectedHandSkinId: normalizeSelectedHandSkinId(source.selectedHandSkinId),
    queuedAt,
    expiresAt: toFiniteInteger(source.expiresAt, queuedAt + RATED_QUEUE_TTL_MS),
    matchedAt: toFiniteInteger(source.matchedAt, 0),
    roomId: String(source.roomId || '').trim().toUpperCase(),
    seatKey,
    match: source.match && typeof source.match === 'object' ? cloneData(source.match) : null
  };
}

function isQueueEntryExpired(entryValue: unknown, nowValue?: unknown): boolean {
  const entry = normalizeQueueEntry(entryValue);
  if (!entry || entry.status === 'matched') return false;
  const nowMs = toFiniteInteger(nowValue, Date.now());
  return nowMs >= entry.expiresAt;
}

function getQueueRemainingMs(entryValue: unknown, nowValue?: unknown): number {
  const entry = normalizeQueueEntry(entryValue);
  if (!entry) return 0;
  const nowMs = toFiniteInteger(nowValue, Date.now());
  return Math.max(0, entry.expiresAt - nowMs);
}

function normalizeQueueStore(storeValue: unknown, nowValue?: unknown): Record<string, RatedQueueEntry> {
  const store = asRecord(storeValue);
  const entriesSource = asRecord(store.entries || store);
  const nowMs = toFiniteInteger(nowValue, Date.now());
  const entries: Record<string, RatedQueueEntry> = {};
  Object.keys(entriesSource).forEach((key) => {
    const entry = normalizeQueueEntry(entriesSource[key]);
    if (!entry) return;
    if (entry.status !== 'matched' && isQueueEntryExpired(entry, nowMs)) return;
    entries[entry.playerId] = entry;
  });
  return entries;
}

function findWaitingCandidate(entriesValue: unknown, playerIdValue: unknown, nowValue?: unknown): RatedQueueEntry | null {
  const entries = normalizeQueueStore(entriesValue, nowValue);
  const playerId = normalizePlayerId(playerIdValue);
  const waiting = Object.values(entries)
    .filter((entry) => entry.status === 'waiting' && entry.playerId !== playerId)
    .sort((a, b) => a.queuedAt - b.queuedAt);
  return waiting[0] || null;
}

function toWaitingResponse(entryValue: unknown, nowValue?: unknown): Record<string, unknown> {
  const entry = normalizeQueueEntry(entryValue);
  const nowMs = toFiniteInteger(nowValue, Date.now());
  if (!entry) {
    return { ok: false, status: 'idle', reason: 'QUEUE_ENTRY_INVALID', serverTime: nowMs };
  }
  return {
    ok: true,
    status: 'waiting',
    playerId: entry.playerId,
    queuedAt: entry.queuedAt,
    expiresAt: entry.expiresAt,
    remainingMs: getQueueRemainingMs(entry, nowMs),
    queueTtlMs: RATED_QUEUE_TTL_MS,
    boardConfig: cloneRatedBoardConfig(),
    constraints: {
      deckCarryAllowed: true,
      autoPlayAllowed: false,
      fixedBoard: cloneRatedBoardConfig()
    },
    serverTime: nowMs
  };
}

function toExpiredResponse(playerIdValue: unknown, nowValue?: unknown): Record<string, unknown> {
  const nowMs = toFiniteInteger(nowValue, Date.now());
  return {
    ok: true,
    status: 'expired',
    reason: 'QUEUE_EXPIRED',
    playerId: normalizePlayerId(playerIdValue),
    remainingMs: 0,
    queueTtlMs: RATED_QUEUE_TTL_MS,
    serverTime: nowMs
  };
}

function toIdleResponse(playerIdValue: unknown, nowValue?: unknown): Record<string, unknown> {
  const nowMs = toFiniteInteger(nowValue, Date.now());
  return {
    ok: true,
    status: 'idle',
    playerId: normalizePlayerId(playerIdValue),
    remainingMs: 0,
    queueTtlMs: RATED_QUEUE_TTL_MS,
    serverTime: nowMs
  };
}

function toMatchedResponse(entryValue: unknown, nowValue?: unknown): Record<string, unknown> {
  const entry = normalizeQueueEntry(entryValue);
  const nowMs = toFiniteInteger(nowValue, Date.now());
  if (!entry || entry.status !== 'matched' || !entry.match) {
    return { ok: false, status: 'idle', reason: 'MATCH_NOT_FOUND', serverTime: nowMs };
  }
  return {
    ok: true,
    status: 'matched',
    playerId: entry.playerId,
    queuedAt: entry.queuedAt,
    expiresAt: entry.expiresAt,
    matchedAt: entry.matchedAt,
    roomId: entry.roomId,
    seatKey: entry.seatKey,
    match: cloneData(entry.match),
    queueTtlMs: RATED_QUEUE_TTL_MS,
    serverTime: nowMs
  };
}

function markEntriesMatched(
  blackEntryValue: unknown,
  whiteEntryValue: unknown,
  matchValue: unknown,
  nowValue?: unknown
): { black: RatedQueueEntry; white: RatedQueueEntry } | null {
  const black = normalizeQueueEntry(blackEntryValue);
  const white = normalizeQueueEntry(whiteEntryValue);
  const match = asRecord(matchValue);
  if (!black || !white) return null;
  const roomId = String(match.roomId || '').trim().toUpperCase();
  const blackPayload = match.blackPayload && typeof match.blackPayload === 'object' ? match.blackPayload : null;
  const whitePayload = match.whitePayload && typeof match.whitePayload === 'object' ? match.whitePayload : null;
  if (!roomId || !blackPayload || !whitePayload) return null;
  const matchedAt = toFiniteInteger(nowValue, Date.now());
  return {
    black: Object.assign({}, black, {
      status: 'matched',
      matchedAt,
      roomId,
      seatKey: 'black',
      match: {
        roomId,
        seatKey: 'black',
        payload: cloneData(blackPayload)
      }
    }),
    white: Object.assign({}, white, {
      status: 'matched',
      matchedAt,
      roomId,
      seatKey: 'white',
      match: {
        roomId,
        seatKey: 'white',
        payload: cloneData(whitePayload)
      }
    })
  };
}

const RatedMatchmaking = {
  RATED_QUEUE_TTL_MS,
  RATED_ROOM_NAME,
  RATED_BOARD_CONFIG,
  cloneRatedBoardConfig,
  createRatedMatchId,
  normalizePlayerName,
  normalizeAvatarStoneType,
  normalizeBio,
  normalizePlayerId,
  normalizeDeckCode,
  normalizeSelectedHandSkinId,
  createQueueEntry,
  normalizeQueueEntry,
  normalizeQueueStore,
  isQueueEntryExpired,
  getQueueRemainingMs,
  findWaitingCandidate,
  toWaitingResponse,
  toExpiredResponse,
  toIdleResponse,
  toMatchedResponse,
  markEntriesMatched
};

export = RatedMatchmaking;
