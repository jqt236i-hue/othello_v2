export interface Bounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}
export interface BoardConfig {
  rows: number;
  cols: number;
  shape: "rectangle" | "circle";
  standard8x8: boolean;
  baseBounds: Bounds;
  outerBounds: Bounds;
}
export interface BoardConfigurationDependencies {
  defaultRows: number;
  defaultCols: number;
  minRows: number;
  maxRows: number;
  minCols: number;
  maxCols: number;
  outerMin: number;
  defaultCircleSize?: number;
  minCircleSize?: number;
  maxCircleSize?: number;
  circleSizeStep?: number;
  clampBoardDimension: (
    value: unknown,
    fallbackValue: unknown,
    minValue: number,
    maxValue: number,
  ) => number;
}

export function createBoardConfiguration(deps: BoardConfigurationDependencies) {
  const minCircleSize = Number.isInteger(deps.minCircleSize) ? Math.max(1, Number(deps.minCircleSize)) : 6;
  const maxCircleSize = Number.isInteger(deps.maxCircleSize) ? Math.max(minCircleSize, Number(deps.maxCircleSize)) : 16;
  const circleSizeStep = Number.isInteger(deps.circleSizeStep) ? Math.max(1, Number(deps.circleSizeStep)) : 2;
  const defaultCircleSize = Number.isInteger(deps.defaultCircleSize) ? Number(deps.defaultCircleSize) : 10;

  function normalizeCircleBoardSize(value: unknown, fallbackValue: unknown = defaultCircleSize): number {
    const fallback = Number.isFinite(Number(fallbackValue)) ? Number(fallbackValue) : defaultCircleSize;
    const numeric = Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clamped = Math.max(minCircleSize, Math.min(maxCircleSize, Math.floor(numeric)));
    const stepped = minCircleSize + Math.round((clamped - minCircleSize) / circleSizeStep) * circleSizeStep;
    return Math.max(minCircleSize, Math.min(maxCircleSize, stepped));
  }

  function normalizeBoardShape(value: unknown): "rectangle" | "circle" {
    return String(value || "").trim().toLowerCase() === "circle"
      ? "circle"
      : "rectangle";
  }
  function isNumericBoardDimensionArg(value: unknown): boolean {
    return (
      value !== null &&
      typeof value !== "undefined" &&
      !Array.isArray(value) &&
      typeof value !== "object" &&
      Number.isFinite(Number(value))
    );
  }
  function deriveBoardDimsFromBoard(
    board: unknown,
  ): { rows: number; cols: number } | null {
    if (!Array.isArray(board) || board.length <= 0) return null;
    let cols = 0;
    for (const row of board as unknown[][])
      if (Array.isArray(row)) cols = Math.max(cols, row.length);
    return cols <= 0 ? null : { rows: (board as unknown[][]).length, cols };
  }
  function readBoundsSpan(bounds: unknown, axis: string): number | null {
    if (!bounds || typeof bounds !== "object") return null;
    const min = Number(
      (bounds as Record<string, unknown>)[axis === "col" ? "minCol" : "minRow"],
    );
    const max = Number(
      (bounds as Record<string, unknown>)[axis === "col" ? "maxCol" : "maxRow"],
    );
    return Number.isFinite(min) && Number.isFinite(max)
      ? Math.max(1, Math.floor(max - min + 1))
      : null;
  }
  function buildBoardConfig(rows?: unknown, cols?: unknown, shapeValue?: unknown): BoardConfig {
    const shape = normalizeBoardShape(shapeValue);
    const requestedRows = shape === "circle" ? normalizeCircleBoardSize(rows, cols) : rows;
    const requestedCols = shape === "circle" ? requestedRows : cols;
    const normalizedRows = deps.clampBoardDimension(
      requestedRows,
      deps.defaultRows,
      deps.minRows,
      deps.maxRows,
    );
    const fallbackCols = Number.isFinite(Number(requestedCols))
      ? Number(requestedCols)
      : Number.isFinite(Number(requestedRows))
        ? Number(requestedRows)
        : deps.defaultCols;
    const normalizedCols = deps.clampBoardDimension(
      fallbackCols,
      deps.defaultCols,
      deps.minCols,
      deps.maxCols,
    );
    return {
      rows: normalizedRows,
      cols: normalizedCols,
      shape,
      standard8x8:
        shape === "rectangle" &&
        normalizedRows === deps.defaultRows &&
        normalizedCols === deps.defaultCols,
      baseBounds: {
        minRow: 0,
        maxRow: normalizedRows - 1,
        minCol: 0,
        maxCol: normalizedCols - 1,
      },
      outerBounds: {
        minRow: deps.outerMin,
        maxRow: normalizedRows,
        minCol: deps.outerMin,
        maxCol: normalizedCols,
      },
    };
  }
  function normalizeBoardConfig(
    rawConfig: unknown,
    fallbackBoard: unknown,
  ): BoardConfig {
    let candidate = rawConfig;
    let board = Array.isArray(fallbackBoard)
      ? (fallbackBoard as unknown[][])
      : null;
    if (Array.isArray(candidate)) {
      board = candidate as unknown[][];
      candidate = null;
    }
    if (
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate)
    ) {
      const obj = candidate as Record<string, unknown>;
      if (Array.isArray(obj.board)) board = obj.board as unknown[][];
      if (obj.boardConfig && typeof obj.boardConfig === "object")
        candidate = obj.boardConfig;
    }
    const derived = deriveBoardDimsFromBoard(board);
    let rows: unknown = null;
    let cols: unknown = null;
    let shape: unknown = null;
    if (
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate)
    ) {
      const obj = candidate as Record<string, unknown>;
      rows = obj.rows;
      cols = obj.cols;
      shape = obj.shape;
      if (!Number.isFinite(Number(rows)))
        rows = readBoundsSpan(obj.baseBounds, "row");
      if (!Number.isFinite(Number(cols)))
        cols = readBoundsSpan(obj.baseBounds, "col");
      if (!Number.isFinite(Number(rows)) && obj.outerBounds) {
        const b = obj.outerBounds as Bounds;
        const min = Number(b.minRow);
        const max = Number(b.maxRow);
        if (Number.isFinite(min) && Number.isFinite(max))
          rows = Math.max(1, Math.floor(max - min - 1));
      }
      if (!Number.isFinite(Number(cols)) && obj.outerBounds) {
        const b = obj.outerBounds as Bounds;
        const min = Number(b.minCol);
        const max = Number(b.maxCol);
        if (Number.isFinite(min) && Number.isFinite(max))
          cols = Math.max(1, Math.floor(max - min - 1));
      }
    }
    if (!Number.isFinite(Number(rows)) && derived) rows = derived.rows;
    if (!Number.isFinite(Number(cols)) && derived) cols = derived.cols;
    return buildBoardConfig(rows, cols, shape);
  }
  function extractBoardConfigSource(value: unknown): unknown {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return null;
    const obj = value as Record<string, unknown>;
    if (obj.roomBoardConfig && typeof obj.roomBoardConfig === "object")
      return obj.roomBoardConfig;
    if (
      Array.isArray(obj.board) ||
      (obj.boardConfig && typeof obj.boardConfig === "object") ||
      isNumericBoardDimensionArg(obj.rows) ||
      isNumericBoardDimensionArg(obj.cols) ||
      (obj.baseBounds && typeof obj.baseBounds === "object") ||
      (obj.outerBounds && typeof obj.outerBounds === "object") ||
      typeof obj.shape === "string"
    )
      return value;
    return null;
  }
  function resolveBoardConfig(
    boardOrConfig: unknown,
    maybeCols?: unknown,
  ): BoardConfig {
    if (typeof boardOrConfig === "undefined" || boardOrConfig === null)
      return buildBoardConfig(deps.defaultRows, deps.defaultCols);
    if (Array.isArray(boardOrConfig)) {
      const derived = deriveBoardDimsFromBoard(boardOrConfig);
      return derived
        ? buildBoardConfig(derived.rows, derived.cols)
        : buildBoardConfig(deps.defaultRows, deps.defaultCols);
    }
    if (
      isNumericBoardDimensionArg(boardOrConfig) ||
      isNumericBoardDimensionArg(maybeCols)
    )
      return buildBoardConfig(boardOrConfig, maybeCols, "rectangle");
    if (
      boardOrConfig &&
      typeof boardOrConfig === "object" &&
      !Array.isArray(boardOrConfig)
    ) {
      const obj = boardOrConfig as Record<string, unknown>;
      const candidate =
        obj.boardConfig && typeof obj.boardConfig === "object"
          ? (obj.boardConfig as Record<string, unknown>)
          : obj;
      const boardFallback = Array.isArray(obj.board)
        ? (obj.board as unknown[][])
        : Array.isArray(candidate.board)
          ? (candidate.board as unknown[][])
          : null;
      const derived = deriveBoardDimsFromBoard(boardFallback);
      let rows: unknown = candidate.rows;
      let cols: unknown = candidate.cols;
      const shape: unknown = candidate.shape;
      if (!isNumericBoardDimensionArg(rows))
        rows = readBoundsSpan(candidate.baseBounds, "row");
      if (!isNumericBoardDimensionArg(cols))
        cols = readBoundsSpan(candidate.baseBounds, "col");
      if (!isNumericBoardDimensionArg(rows) && candidate.outerBounds) {
        const b = candidate.outerBounds as Bounds;
        const min = Number(b.minRow);
        const max = Number(b.maxRow);
        if (Number.isFinite(min) && Number.isFinite(max))
          rows = Math.max(1, Math.floor(max - min - 1));
      }
      if (!isNumericBoardDimensionArg(cols) && candidate.outerBounds) {
        const b = candidate.outerBounds as Bounds;
        const min = Number(b.minCol);
        const max = Number(b.maxCol);
        if (Number.isFinite(min) && Number.isFinite(max))
          cols = Math.max(1, Math.floor(max - min - 1));
      }
      if (!isNumericBoardDimensionArg(rows) && derived) rows = derived.rows;
      if (!isNumericBoardDimensionArg(cols) && derived) cols = derived.cols;
      return buildBoardConfig(rows, cols, shape);
    }
    return normalizeBoardConfig(boardOrConfig, undefined);
  }
  function maybeResolveBoardConfig(value: unknown): BoardConfig | null {
    const source = extractBoardConfigSource(value);
    return source ? resolveBoardConfig(source) : null;
  }
  function readBoardGeometry(
    value: unknown,
  ): { rows: number; cols: number; shape: "rectangle" | "circle" } | null {
    const config = maybeResolveBoardConfig(value);
    if (
      !config ||
      !Number.isFinite(Number(config.rows)) ||
      !Number.isFinite(Number(config.cols))
    )
      return null;
    return {
      rows: Math.trunc(Number(config.rows)),
      cols: Math.trunc(Number(config.cols)),
      shape: config.shape,
    };
  }
  function compareBoardGeometry(previousValue: unknown, nextValue: unknown) {
    const previous = readBoardGeometry(previousValue);
    const next = readBoardGeometry(nextValue);
    return {
      previous,
      next,
      changed: !!(
        previous &&
        next &&
        (previous.rows !== next.rows || previous.cols !== next.cols || previous.shape !== next.shape)
      ),
    };
  }
  function resolveBaseBoardBounds(
    boardOrConfig: unknown,
    maybeCols?: unknown,
  ): Bounds {
    return resolveBoardConfig(boardOrConfig, maybeCols).baseBounds;
  }
  function resolveOuterBounds(
    boardOrConfig: unknown,
    maybeCols?: unknown,
  ): Bounds {
    return resolveBoardConfig(boardOrConfig, maybeCols).outerBounds;
  }
  function getBoardRows(boardOrConfig: unknown, maybeCols?: unknown): number {
    return resolveBoardConfig(boardOrConfig, maybeCols).rows;
  }
  function getBoardCols(boardOrConfig: unknown, maybeCols?: unknown): number {
    return resolveBoardConfig(boardOrConfig, maybeCols).cols;
  }
  return {
    normalizeBoardShape,
    normalizeCircleBoardSize,
    buildBoardConfig,
    normalizeBoardConfig,
    extractBoardConfigSource,
    maybeResolveBoardConfig,
    readBoardGeometry,
    compareBoardGeometry,
    resolveBoardConfig,
    resolveBaseBoardBounds,
    resolveOuterBounds,
    getBoardRows,
    getBoardCols,
  };
}
