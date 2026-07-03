'use strict';

const ROOM_PASSWORD_MAX_LENGTH = 20;
const ROOM_NAME_MAX_LENGTH = 20;
const DEFAULT_ROOM_NAME = '無名部屋';
const WAITING_ROOM_TTL_MS = 10 * 60 * 1000;
const INACTIVE_ROOM_TTL_MS = 15 * 60 * 1000;

type RoomListEntry = {
  roomId: string;
  roomName: string;
  hostName: string;
  blackPlayerName: string;
  whitePlayerName: string;
  seatNames: {
    black: string;
    white: string;
  };
  seatCount: number;
  maxSeats: number;
  spectatorCount: number;
  maxSpectators: number;
  canJoin: boolean;
  canSpectate: boolean;
  hasPassword: boolean;
  boardLabel: string;
  stateVersion: number;
  createdAt: number;
  waitingExpiresAt: number;
  updatedAt: number;
};

type PublicRoomListEntryOptions = {
  nowMs?: unknown;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function normalizeRoomPassword(value: unknown): string {
  return Array.from(String(value || '').trim()).slice(0, ROOM_PASSWORD_MAX_LENGTH).join('');
}

function normalizeRoomName(value: unknown): string {
  return Array.from(String(value || '').trim()).slice(0, ROOM_NAME_MAX_LENGTH).join('');
}

function resolveRoomName(value: unknown): string {
  return normalizeRoomName(value) || DEFAULT_ROOM_NAME;
}

function createRandomPlayerName(randomValue?: unknown): string {
  const source = Number.isFinite(Number(randomValue)) ? Number(randomValue) : Math.random();
  const normalized = Math.max(0, Math.min(0.999999999, source));
  const code = Math.floor(normalized * 46656).toString(36).toUpperCase().padStart(3, '0').slice(-3);
  return `ゲスト${code}`;
}

function hasRoomPassword(roomValue: unknown): boolean {
  const room = asRecord(roomValue);
  return normalizeRoomPassword(room.roomPassword).length > 0;
}

function constantTimeStringEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function isJoinPasswordAccepted(roomValue: unknown, passwordValue: unknown): boolean {
  const room = asRecord(roomValue);
  const expected = normalizeRoomPassword(room.roomPassword);
  if (!expected) return true;
  return constantTimeStringEquals(normalizeRoomPassword(passwordValue), expected);
}

function readSeatActive(seats: Record<string, any>, seatKey: string): boolean {
  return seats && seats[seatKey] === true;
}

function formatBoardLabel(room: Record<string, any>): string {
  const boardConfig = asRecord(room.roomBoardConfig);
  const rows = Number(boardConfig.rows);
  const cols = Number(boardConfig.cols);
  if (Number.isFinite(rows) && Number.isFinite(cols)) {
    return `${Math.trunc(rows)}x${Math.trunc(cols)}`;
  }

  const board = asRecord(asRecord(room.snapshot).gameState).board;
  if (Array.isArray(board) && board.length > 0 && Array.isArray(board[0])) {
    return `${board.length}x${board[0].length}`;
  }

  return '8x8';
}

function toFiniteInteger(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : fallback;
}

function getActiveSeatCount(roomValue: unknown): number {
  const room = asRecord(roomValue);
  const seats = asRecord(room.seats);
  const blackActive = readSeatActive(seats, 'black');
  const whiteActive = readSeatActive(seats, 'white');
  const activeSeatCount = (blackActive ? 1 : 0) + (whiteActive ? 1 : 0);
  if (activeSeatCount > 0) return activeSeatCount;
  return toFiniteInteger(room.seatCount, 0);
}

function getActiveSpectatorCount(roomValue: unknown): number {
  const room = asRecord(roomValue);
  const spectators = asRecord(room.spectators);
  const activeCount = Object.keys(spectators)
    .filter((id) => !!String(asRecord(spectators[id]).token || '').trim())
    .length;
  if (activeCount > 0) return activeCount;
  return toFiniteInteger(room.spectatorCount, 0);
}

function getMaxSpectators(roomValue: unknown): number {
  const room = asRecord(roomValue);
  return Math.max(0, toFiniteInteger(room.maxSpectators, 4));
}

function readCreatedAt(roomValue: unknown): number {
  const room = asRecord(roomValue);
  return toFiniteInteger(room.createdAt, toFiniteInteger(room.updatedAt, 0));
}

function getWaitingRoomExpiresAt(roomValue: unknown): number {
  const createdAt = readCreatedAt(roomValue);
  return createdAt > 0 ? createdAt + WAITING_ROOM_TTL_MS : 0;
}

function readInactiveSince(roomValue: unknown): number {
  const room = asRecord(roomValue);
  return toFiniteInteger(room.inactiveSince, 0);
}

function getInactiveRoomExpiresAt(roomValue: unknown): number {
  const inactiveSince = readInactiveSince(roomValue);
  return inactiveSince > 0 ? inactiveSince + INACTIVE_ROOM_TTL_MS : 0;
}

function isInactiveRoomExpired(roomValue: unknown, nowValue?: unknown): boolean {
  const expiresAt = getInactiveRoomExpiresAt(roomValue);
  if (expiresAt <= 0) return false;
  const nowMs = toFiniteInteger(nowValue, Date.now());
  return nowMs >= expiresAt;
}

function markRoomInactive(roomValue: unknown, nowValue?: unknown): boolean {
  const room = asRecord(roomValue);
  if (!room || !String(room.roomId || '').trim()) return false;
  if (readInactiveSince(room) > 0) return false;
  room.inactiveSince = toFiniteInteger(nowValue, Date.now());
  return true;
}

function clearRoomInactive(roomValue: unknown): boolean {
  const room = asRecord(roomValue);
  if (!Object.prototype.hasOwnProperty.call(room, 'inactiveSince')) return false;
  delete room.inactiveSince;
  return true;
}

function isWaitingRoom(roomValue: unknown): boolean {
  const room = asRecord(roomValue);
  const maxSeats = toFiniteInteger(room.maxSeats, 2);
  const seatCount = getActiveSeatCount(room);
  return seatCount > 0
    && seatCount < maxSeats
    && toFiniteInteger(room.stateVersion, 0) <= 0;
}

function isWaitingRoomExpired(roomValue: unknown, nowValue?: unknown): boolean {
  if (!isWaitingRoom(roomValue)) return false;
  const expiresAt = getWaitingRoomExpiresAt(roomValue);
  if (expiresAt <= 0) return false;
  const nowMs = toFiniteInteger(nowValue, Date.now());
  return nowMs >= expiresAt;
}

function toPublicRoomListEntry(roomValue: unknown, options?: PublicRoomListEntryOptions | null): RoomListEntry | null {
  const room = asRecord(roomValue);
  const roomId = String(room.roomId || '').trim().toUpperCase();
  if (!roomId) return null;

  const maxSeats = toFiniteInteger(room.maxSeats, 2);
  const seatCount = getActiveSeatCount(room);
  const spectatorCount = getActiveSpectatorCount(room);
  const maxSpectators = getMaxSpectators(room);
  const canJoin = seatCount > 0 && seatCount < maxSeats;
  const canSpectate = seatCount > 0 && spectatorCount < maxSpectators;
  if (!canJoin && !canSpectate) return null;
  const opts = asRecord(options);
  if (isWaitingRoomExpired(room, opts.nowMs)) return null;
  if (isInactiveRoomExpired(room, opts.nowMs)) return null;

  const seats = asRecord(room.seats);
  const blackActive = readSeatActive(seats, 'black');
  const whiteActive = readSeatActive(seats, 'white');
  const seatNames = asRecord(room.seatNames);
  const blackPlayerName = String(blackActive ? seatNames.black || '' : '').trim();
  const whitePlayerName = String(whiteActive ? seatNames.white || '' : '').trim();
  const hostName = String(
    blackPlayerName
    || whitePlayerName
    || room.hostName
    || seatNames.black
    || seatNames.white
    || ''
  ).trim();

  return {
    roomId,
    roomName: resolveRoomName(room.roomName),
    hostName,
    blackPlayerName,
    whitePlayerName,
    seatNames: {
      black: blackPlayerName,
      white: whitePlayerName
    },
    seatCount,
    maxSeats,
    spectatorCount,
    maxSpectators,
    canJoin,
    canSpectate,
    hasPassword: room.hasPassword === true || room.roomHasPassword === true || hasRoomPassword(room),
    boardLabel: formatBoardLabel(room),
    stateVersion: toFiniteInteger(room.stateVersion, 0),
    createdAt: readCreatedAt(room),
    waitingExpiresAt: getWaitingRoomExpiresAt(room),
    updatedAt: toFiniteInteger(room.updatedAt, 0)
  };
}

function sortRoomListEntries(entriesValue: unknown): RoomListEntry[] {
  const entries = Array.isArray(entriesValue) ? entriesValue : [];
  return entries
    .filter((entry): entry is RoomListEntry => !!(entry && typeof entry === 'object'))
    .slice()
    .sort((a, b) => {
      const byUpdated = toFiniteInteger(b.updatedAt, 0) - toFiniteInteger(a.updatedAt, 0);
      if (byUpdated) return byUpdated;
      return String(a.roomId || '').localeCompare(String(b.roomId || ''));
    });
}

const MatchRoomLobby = {
  ROOM_PASSWORD_MAX_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  DEFAULT_ROOM_NAME,
  WAITING_ROOM_TTL_MS,
  INACTIVE_ROOM_TTL_MS,
  normalizeRoomPassword,
  normalizeRoomName,
  resolveRoomName,
  createRandomPlayerName,
  hasRoomPassword,
  isJoinPasswordAccepted,
  getActiveSeatCount,
  getActiveSpectatorCount,
  getMaxSpectators,
  readCreatedAt,
  getWaitingRoomExpiresAt,
  readInactiveSince,
  getInactiveRoomExpiresAt,
  isWaitingRoom,
  isWaitingRoomExpired,
  isInactiveRoomExpired,
  markRoomInactive,
  clearRoomInactive,
  toPublicRoomListEntry,
  sortRoomListEntries
};

export = MatchRoomLobby;
