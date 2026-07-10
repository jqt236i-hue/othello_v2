export type PlayerSeatKey = 'black' | 'white';

export function parsePlayerSeatKey(value: unknown): PlayerSeatKey | null {
  if (value === 1 || value === '1') return 'black';
  if (value === -1 || value === '-1') return 'white';

  const normalized = (value === null || typeof value === 'undefined')
    ? ''
    : String(value).trim().toLowerCase();

  if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
  if (normalized === 'white' || normalized === '-1') return 'white';
  return null;
}

export function isCanonicalPlayerSeatKey(value: unknown): value is PlayerSeatKey {
  return value === 'black' || value === 'white';
}

export function normalizePlayerSeatKey(value: unknown, fallback?: unknown): PlayerSeatKey {
  return parsePlayerSeatKey(value) || parsePlayerSeatKey(fallback) || 'black';
}

export function getOpposingPlayerSeatKey(value: unknown): PlayerSeatKey | null {
  const parsed = parsePlayerSeatKey(value);
  if (!parsed) return null;
  return parsed === 'black' ? 'white' : 'black';
}

export function playerSeatKeyToValue<TBlack = number, TWhite = number>(
  playerKey: PlayerSeatKey,
  blackValue: TBlack,
  whiteValue: TWhite
): TBlack | TWhite {
  return playerKey === 'black' ? blackValue : whiteValue;
}

export function playerSeatValueToKey(value: unknown, blackValue: unknown): PlayerSeatKey {
  return value === blackValue ? 'black' : 'white';
}

