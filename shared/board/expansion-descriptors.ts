export interface BoardBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface ExpansionDescriptor {
  side: string;
  row: number;
  col: number;
  owner: number;
}

export interface ExpansionDescriptorDependencies {
  resolveOuterBounds: (
    boardOrConfig: unknown,
    maybeCols?: unknown,
  ) => BoardBounds;
  resolveBaseBounds: (
    boardOrConfig: unknown,
    maybeCols?: unknown,
  ) => BoardBounds;
  isMainBoardCell: (
    row: number,
    col: number,
    boardOrConfig: unknown,
    maybeCols?: unknown,
  ) => boolean;
  normalizeOwner: (value: unknown) => number;
  maxAbsCoordinate?: number;
}

export const DEFAULT_BOARD_MAX_ABS_COORDINATE = 256;
export const DEFAULT_BOARD_MAX_MATRIX_DIMENSION = 64;
export const DEFAULT_BOARD_MAX_SHAPE_ENTRIES = 8192;

export function copyBoundedOwnArray<T = unknown>(
  value: unknown,
  maxLength: number = DEFAULT_BOARD_MAX_SHAPE_ENTRIES,
): T[] | null {
  if (!Array.isArray(value)) return null;
  const length = value.length;
  if (
    !Number.isSafeInteger(maxLength) ||
    maxLength < 0 ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > maxLength
  ) {
    return null;
  }
  const out: T[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      return null;
    }
    out.push(descriptor.value as T);
  }
  return out;
}

export function resolveBoardMaxAbsCoordinate(value: unknown): number {
  return Number.isFinite(Number(value))
    ? Math.max(16, Math.trunc(Number(value)))
    : DEFAULT_BOARD_MAX_ABS_COORDINATE;
}

export function isBoardCoordinateWithinLimit(
  row: number,
  col: number,
  maxAbsCoordinate: unknown = DEFAULT_BOARD_MAX_ABS_COORDINATE,
): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  const limit = resolveBoardMaxAbsCoordinate(maxAbsCoordinate);
  return Math.abs(row) <= limit && Math.abs(col) <= limit;
}

export function createExpansionDescriptors(
  deps: ExpansionDescriptorDependencies,
) {
  const maxAbsCoordinate = resolveBoardMaxAbsCoordinate(
    deps.maxAbsCoordinate,
  );

  function isExpansionCoordinate(
    row: number,
    col: number,
    boardOrConfig: unknown,
    maybeCols?: unknown,
  ): boolean {
    if (!isBoardCoordinateWithinLimit(row, col, maxAbsCoordinate)) return false;
    return !deps.isMainBoardCell(row, col, boardOrConfig, maybeCols);
  }

  function resolveExpansionSide(
    side: unknown,
    row: number,
    col: number,
    boardOrConfig: unknown,
    maybeCols?: unknown,
  ): string | null {
    if (
      side === "left" ||
      side === "right" ||
      side === "top" ||
      side === "bottom"
    )
      return side;
    const baseBounds = deps.resolveBaseBounds(boardOrConfig, maybeCols);
    if (col < baseBounds.minCol) return "left";
    if (col > baseBounds.maxCol) return "right";
    if (row < baseBounds.minRow) return "top";
    if (row > baseBounds.maxRow) return "bottom";
    const distances = [
      { side: "top", value: Math.abs(row - baseBounds.minRow) },
      { side: "right", value: Math.abs(baseBounds.maxCol - col) },
      { side: "bottom", value: Math.abs(baseBounds.maxRow - row) },
      { side: "left", value: Math.abs(col - baseBounds.minCol) },
    ];
    distances.sort((a, b) => a.value - b.value);
    return distances[0].side;
  }

  function normalizeExpansionCell(
    cell: unknown,
    boardOrConfig: unknown,
  ): ExpansionDescriptor | null {
    if (!cell || typeof cell !== "object") return null;
    const obj = cell as Record<string, unknown>;
    const row = Number(obj.row);
    let col = Number(obj.col);
    const side = resolveExpansionSide(obj.side, row, col, boardOrConfig);
    const outerBounds = deps.resolveOuterBounds(boardOrConfig);
    if (!Number.isInteger(row)) return null;
    if (!Number.isInteger(col)) {
      if (side === "left") col = outerBounds.minCol;
      else if (side === "right") col = outerBounds.maxCol;
    }
    if (
      !Number.isInteger(col) ||
      !isExpansionCoordinate(row, col, boardOrConfig)
    )
      return null;
    return {
      side: resolveExpansionSide(side, row, col, boardOrConfig) as string,
      row,
      col,
      owner: deps.normalizeOwner(obj.owner),
    };
  }

  function collectExpansionDescriptors(
    boardExpansion: unknown,
    boardOrConfig: unknown,
  ): ExpansionDescriptor[] {
    if (!boardExpansion || typeof boardExpansion !== "object") return [];
    const out: ExpansionDescriptor[] = [];
    const seen = new Set<string>();
    const canonicalize = (): ExpansionDescriptor[] =>
      out.sort((left, right) => left.row - right.row || left.col - right.col);
    const obj = boardExpansion as Record<string, unknown>;
    const push = (raw: unknown): void => {
      const normalized = normalizeExpansionCell(raw, boardOrConfig);
      if (!normalized) return;
      const key = `${normalized.row},${normalized.col}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(normalized);
    };
    if (Object.prototype.hasOwnProperty.call(obj, "cells")) {
      if (Array.isArray(obj.cells)) {
        const cells = copyBoundedOwnArray(obj.cells);
        if (!cells) {
          throw new Error(
            "boardExpansion.cells must be a bounded dense array",
          );
        }
        for (const cell of cells) push(cell);
      }
      return canonicalize();
    }
    if (obj.active === true) push(boardExpansion);
    return canonicalize();
  }

  return {
    isExpansionCoordinate,
    resolveExpansionSide,
    normalizeExpansionCell,
    collectExpansionDescriptors,
  };
}
