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
  isMainBoardCell: (
    row: number,
    col: number,
    boardOrConfig: unknown,
    maybeCols?: unknown,
  ) => boolean;
  normalizeOwner: (value: unknown) => number;
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
    const outerBounds = deps.resolveOuterBounds(boardOrConfig, maybeCols);
    if (
      row < outerBounds.minRow ||
      row > outerBounds.maxRow ||
      col < outerBounds.minCol ||
      col > outerBounds.maxCol
    )
      return false;
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
    const outerBounds = deps.resolveOuterBounds(boardOrConfig, maybeCols);
    if (col === outerBounds.minCol) return "left";
    if (col === outerBounds.maxCol) return "right";
    if (row === outerBounds.minRow) return "top";
    if (row === outerBounds.maxRow) return "bottom";
    return null;
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
