'use strict';

const PLAYER_ID_RE = /^p_[A-Za-z0-9_-]{26}$/;
const LEGACY_LEADERBOARD_PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
const PLAYER_TOKEN_RE = /^pt_[A-Za-z0-9_-]{43}$/;
const RECOVERY_CODE_RE = /^CR-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}$/;

type SeatPlayerIds = {
  black: string;
  white: string;
};

function normalizePlayerId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return PLAYER_ID_RE.test(normalized) ? normalized : null;
}

function normalizeLeaderboardDisplayPlayerId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  if (PLAYER_ID_RE.test(normalized)) return normalized;
  return LEGACY_LEADERBOARD_PLAYER_ID_RE.test(normalized) ? normalized : null;
}

function normalizePlayerToken(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return PLAYER_TOKEN_RE.test(normalized) ? normalized : null;
}

function normalizeRecoveryCode(value: unknown): string | null {
  const normalized = String(value || '').trim().toUpperCase();
  return RECOVERY_CODE_RE.test(normalized) ? normalized : null;
}

function normalizeSeatPlayerIds(value: unknown): SeatPlayerIds {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    black: normalizePlayerId(source.black) || '',
    white: normalizePlayerId(source.white) || ''
  };
}

function formatShortPlayerId(value: unknown): string {
  const playerId = normalizeLeaderboardDisplayPlayerId(value);
  return playerId ? `#${playerId.slice(-4)}` : '';
}

export = {
  PLAYER_ID_RE,
  LEGACY_LEADERBOARD_PLAYER_ID_RE,
  PLAYER_TOKEN_RE,
  RECOVERY_CODE_RE,
  normalizePlayerId,
  normalizeLeaderboardDisplayPlayerId,
  normalizePlayerToken,
  normalizeRecoveryCode,
  normalizeSeatPlayerIds,
  formatShortPlayerId
};
