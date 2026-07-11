export interface CellCoord {
  row: number;
  col: number;
}
export interface ExpansionDescriptor {
  side: string;
  row: number;
  col: number;
  owner: number;
}
export interface BoardShapeMeta {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
  playableKeys: Set<string>;
  meteorHoleKeys: Set<string>;
  expansionCells: ExpansionDescriptor[];
  expansionOwnerByKey: Record<string, number>;
  standard8x8: boolean;
  coordinateCache: CellCoord[] | null;
  cornerKeyCache: Set<string> | null;
  xKeyCache: Set<string> | null;
  cKeyCache: Set<string> | null;
}
export interface BoardShapeMetadataDependencies {
  metaKey: string;
  defaultRows: number;
  defaultCols: number;
  toBoardCellKey: (row: number, col: number) => string;
  normalizeOwner: (value: unknown) => number;
  resolveBoardConfig: (value: unknown) => { rows: number; cols: number };
  isMainBoardCell: (row: number, col: number, boardOrConfig: unknown) => boolean;
  collectExpansionDescriptors: (
    boardExpansion: unknown,
    boardOrConfig: unknown,
  ) => ExpansionDescriptor[];
}

export function createBoardShapeMetadata(deps: BoardShapeMetadataDependencies) {
  function collectMeteorHoleKeys(cardState: unknown): Set<string> {
    const out = new Set<string>();
    const obj = cardState as { markers?: unknown[] } | null;
    const markers = obj && Array.isArray(obj.markers) ? obj.markers : [];
    for (const marker of markers) {
      const item = marker as {
        kind?: string;
        data?: { type?: string };
        row?: number;
        col?: number;
      } | null;
      if (
        !item ||
        item.kind !== "specialStone" ||
        !item.data ||
        String(item.data.type || "").toUpperCase() !== "METEOR_HOLE"
      )
        continue;
      const row = Number(item.row);
      const col = Number(item.col);
      if (Number.isInteger(row) && Number.isInteger(col))
        out.add(deps.toBoardCellKey(row, col));
    }
    return out;
  }

  function cloneMeta(meta: unknown): BoardShapeMeta | null {
    if (!meta || typeof meta !== "object") return null;
    const obj = meta as BoardShapeMeta;
    return {
      minRow: Number.isInteger(obj.minRow) ? obj.minRow : 0,
      maxRow: Number.isInteger(obj.maxRow) ? obj.maxRow : -1,
      minCol: Number.isInteger(obj.minCol) ? obj.minCol : 0,
      maxCol: Number.isInteger(obj.maxCol) ? obj.maxCol : -1,
      playableKeys: new Set(
        obj.playableKeys instanceof Set ? Array.from(obj.playableKeys) : [],
      ),
      meteorHoleKeys: new Set(
        obj.meteorHoleKeys instanceof Set ? Array.from(obj.meteorHoleKeys) : [],
      ),
      expansionCells: Array.isArray(obj.expansionCells)
        ? obj.expansionCells.map((cell) => ({
            side: cell.side,
            row: cell.row,
            col: cell.col,
            owner: deps.normalizeOwner(cell.owner),
          }))
        : [],
      expansionOwnerByKey: Object.assign(
        Object.create(null),
        obj.expansionOwnerByKey || null,
      ),
      standard8x8: obj.standard8x8 === true,
      coordinateCache: null,
      cornerKeyCache: null,
      xKeyCache: null,
      cKeyCache: null,
    };
  }

  function setBoardShapeMeta(board: unknown, meta: unknown): unknown[][] {
    if (!Array.isArray(board)) return board as unknown[][];
    Object.defineProperty(board, deps.metaKey, {
      value: meta,
      writable: true,
      configurable: true,
    });
    return board as unknown[][];
  }
  function getBoardShapeMeta(board: unknown): BoardShapeMeta | null {
    if (!Array.isArray(board)) return null;
    const meta = (board as unknown as Record<string, unknown>)[deps.metaKey];
    return meta && typeof meta === "object" ? (meta as BoardShapeMeta) : null;
  }
  function buildShapeMeta(
    board: unknown,
    options?: unknown,
  ): BoardShapeMeta | null {
    if (!Array.isArray(board)) return null;
    const opts =
      options && typeof options === "object"
        ? (options as Record<string, unknown>)
        : {};
    const boardConfig = deps.resolveBoardConfig(opts.boardConfig || board);
    const expansionCells = deps.collectExpansionDescriptors(
      opts.boardExpansion,
      boardConfig,
    );
    const meteorHoleKeys = collectMeteorHoleKeys(opts.cardState);
    const playableKeys = new Set<string>();
    let minRow = Infinity,
      maxRow = -Infinity,
      minCol = Infinity,
      maxCol = -Infinity;
    const addCoord = (row: number, col: number) => {
      const key = deps.toBoardCellKey(row, col);
      if (meteorHoleKeys.has(key)) return;
      playableKeys.add(key);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    };
    for (let row = 0; row < (board as unknown[][]).length; row++) {
      const line = Array.isArray((board as unknown[][])[row])
        ? (board as unknown[][])[row]
        : [];
      for (let col = 0; col < line.length; col++) {
        if (deps.isMainBoardCell(row, col, boardConfig)) addCoord(row, col);
      }
    }
    for (const cell of expansionCells) addCoord(cell.row, cell.col);
    if (
      !Number.isFinite(minRow) ||
      !Number.isFinite(maxRow) ||
      !Number.isFinite(minCol) ||
      !Number.isFinite(maxCol)
    ) {
      minRow = 0;
      maxRow = -1;
      minCol = 0;
      maxCol = -1;
    }
    const expansionOwnerByKey: Record<string, number> = Object.create(null);
    for (const cell of expansionCells)
      expansionOwnerByKey[deps.toBoardCellKey(cell.row, cell.col)] =
        deps.normalizeOwner(cell.owner);
    const standard8x8 =
      (boardConfig as { standard8x8?: boolean }).standard8x8 === true &&
      expansionCells.length === 0 &&
      meteorHoleKeys.size === 0;
    return {
      minRow,
      maxRow,
      minCol,
      maxCol,
      playableKeys,
      meteorHoleKeys,
      expansionCells,
      expansionOwnerByKey,
      standard8x8,
      coordinateCache: null,
      cornerKeyCache: null,
      xKeyCache: null,
      cKeyCache: null,
    };
  }
  function attachBoardShape(board: unknown, options?: unknown): unknown[][] {
    if (!Array.isArray(board)) return board as unknown[][];
    if (!options && getBoardShapeMeta(board)) return board as unknown[][];
    return setBoardShapeMeta(board, buildShapeMeta(board, options || null));
  }
  function copyBoardShape(fromBoard: unknown, toBoard: unknown): unknown[][] {
    if (!Array.isArray(toBoard)) return toBoard as unknown[][];
    const meta = getBoardShapeMeta(fromBoard);
    if (!meta) return toBoard as unknown[][];
    return setBoardShapeMeta(toBoard, cloneMeta(meta));
  }
  function cloneBoard(board: unknown): unknown[][] {
    if (!Array.isArray(board)) return [];
    return copyBoardShape(
      board,
      (board as unknown[][]).map((row) =>
        Array.isArray(row) ? row.slice() : [],
      ),
    );
  }
  return {
    getBoardShapeMeta,
    buildShapeMeta,
    attachBoardShape,
    copyBoardShape,
    cloneBoard,
  };
}
