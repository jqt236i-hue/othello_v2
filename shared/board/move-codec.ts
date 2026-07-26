export interface NormalizedBoardPosition {
  row: number;
  col: number;
}

export type BoardPositionLike =
  | NormalizedBoardPosition
  | readonly [number, number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeBoardPosition(
  value: unknown,
): NormalizedBoardPosition | null {
  if (Array.isArray(value) && value.length !== 2) return null;
  const row = Array.isArray(value)
    ? value[0]
    : isRecord(value)
      ? value.row
      : null;
  const col = Array.isArray(value)
    ? value[1]
    : isRecord(value)
      ? value.col
      : null;
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  return { row: Number(row), col: Number(col) };
}

export function normalizeBoardPositions(
  value: unknown,
): NormalizedBoardPosition[] {
  if (!Array.isArray(value)) return [];
  const out: NormalizedBoardPosition[] = [];
  for (const entry of value) {
    const position = normalizeBoardPosition(entry);
    if (position) out.push(position);
  }
  return out;
}

export function normalizeBoardPositionsStrict(
  value: unknown,
): NormalizedBoardPosition[] | null {
  if (!Array.isArray(value)) return null;
  const positions = normalizeBoardPositions(value);
  return positions.length === value.length ? positions : null;
}

export function createBoardMoveIdentity(move: unknown): string | null {
  if (!isRecord(move)) return null;
  const position = normalizeBoardPosition(move);
  if (!position) return null;
  if (!Object.prototype.hasOwnProperty.call(move, "flips")) {
    return `${position.row},${position.col}|omitted`;
  }
  if (!Array.isArray(move.flips)) return null;
  const flips = normalizeBoardPositionsStrict(move.flips);
  if (!flips) return null;
  const flipKeys = flips
    .map((flip) => `${flip.row},${flip.col}`)
    .sort();
  return `${position.row},${position.col}|provided:${flipKeys.join(";")}`;
}
