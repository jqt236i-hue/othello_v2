export const NETWORK_ROOM_ID_LENGTH = 3;
export const NETWORK_ROOM_ID_PATTERN = /^[A-Z0-9]{3}$/;
export const NETWORK_PLAYER_NAME_MAX = 7;
export const NETWORK_CHAT_MAX_LENGTH = 20;
export const NETWORK_CHAT_HISTORY_LIMIT = 40;
export const NETWORK_TURN_LIMIT_SECONDS = 120;
export const NETWORK_TURN_LIMIT_MIN_SECONDS = 3;
export const NETWORK_TURN_LIMIT_MAX_SECONDS = 1800;
export const NETWORK_TURN_LIMIT_WHEEL_STEP_SECONDS = 10;
export const NETWORK_TURN_LIMIT_MS = NETWORK_TURN_LIMIT_SECONDS * 1000;

export function normalizeNetworkTurnLimitSeconds(
  value: unknown,
  fallback: unknown = NETWORK_TURN_LIMIT_SECONDS
): number {
  const fallbackNumber = Number(fallback);
  const normalizedFallback = Number.isFinite(fallbackNumber)
    ? Math.max(
      NETWORK_TURN_LIMIT_MIN_SECONDS,
      Math.min(NETWORK_TURN_LIMIT_MAX_SECONDS, Math.trunc(fallbackNumber))
    )
    : NETWORK_TURN_LIMIT_SECONDS;
  if (value === null || value === undefined || String(value).trim() === '') return normalizedFallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return normalizedFallback;
  return Math.max(
    NETWORK_TURN_LIMIT_MIN_SECONDS,
    Math.min(NETWORK_TURN_LIMIT_MAX_SECONDS, Math.trunc(numeric))
  );
}

export function normalizeNetworkRoomId(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

export function isValidNetworkRoomId(value: unknown): boolean {
  const roomId = normalizeNetworkRoomId(value);
  return roomId.length === NETWORK_ROOM_ID_LENGTH && NETWORK_ROOM_ID_PATTERN.test(roomId);
}

export function normalizeNetworkPlayerName(value: unknown, maxLength = NETWORK_PLAYER_NAME_MAX): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  const limit = Number.isFinite(Number(maxLength))
    ? Math.max(1, Math.trunc(Number(maxLength)))
    : NETWORK_PLAYER_NAME_MAX;
  return Array.from(normalized).slice(0, limit).join('');
}

export function normalizeNetworkChatText(value: unknown): string {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

export type NetworkChatValidationResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'MESSAGE_REQUIRED' | 'MESSAGE_TOO_LONG' };

export function validateNetworkChatMessage(value: unknown): NetworkChatValidationResult {
  const normalized = normalizeNetworkChatText(value);
  if (!normalized) return { ok: false, reason: 'MESSAGE_REQUIRED' };
  const chars = Array.from(normalized);
  if (chars.length > NETWORK_CHAT_MAX_LENGTH) return { ok: false, reason: 'MESSAGE_TOO_LONG' };
  return { ok: true, text: chars.join('') };
}
