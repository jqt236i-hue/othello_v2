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

export function createExpansionDescriptors(
  deps: ExpansionDescriptorDependencies,
) {
  function isExpansionCoordinate(
    row: number,
    col: number,
    boardOrConfig: unknown,
    maybeCols?: unknown,
  ): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const maxAbsCoordinate = Number.isFinite(Number(deps.maxAbsCoordinate))
      ? Math.max(16, Math.trunc(Number(deps.maxAbsCoordinate)))
      : 256;
    if (Math.abs(row) > maxAbsCoordinate || Math.abs(col) > maxAbsCoordinate) return false;
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
    const obj = boardExpansion as Record<string, unknown>;
    const push = (raw: unknown): void => {
      const normalized = normalizeExpansionCell(raw, boardOrConfig);
      if (
        !normalized ||
        out.some(
          (one) => one.row === normalized.row && one.col === normalized.col,
        )
      )
        return;
      out.push(normalized);
    };
    if (Array.isArray(obj.cells)) for (const cell of obj.cells) push(cell);
    if (out.length === 0 && obj.active === true) push(boardExpansion);
    return out;
  }

  return {
    isExpansionCoordinate,
    resolveExpansionSide,
    normalizeExpansionCell,
    collectExpansionDescriptors,
  };
}
