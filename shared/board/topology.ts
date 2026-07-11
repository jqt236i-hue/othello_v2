export interface CellCoord {
  row: number;
  col: number;
}

export interface Bounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface ExpansionDescriptor extends CellCoord {
  side?: string;
  owner: number;
}

export interface BoardTopology {
  baseKeys: Set<string>;
  expansionKeys: Set<string>;
  existingKeys: Set<string>;
  playableKeys: Set<string>;
  holeKeys: Set<string>;
  baseCoordinates: CellCoord[];
  expansionCoordinates: CellCoord[];
  existingCoordinates: CellCoord[];
  playableCoordinates: CellCoord[];
  contentBounds: Bounds;
  renderBounds: Bounds;
  candidateBounds: Bounds;
}

export interface BoardTopologyDependencies {
  toBoardCellKey: (row: number, col: number) => string;
  resolveBoardConfig: (value: unknown) => {
    rows: number;
    cols: number;
    baseBounds: Bounds;
  };
  isMainBoardCell: (row: number, col: number, value: unknown) => boolean;
  collectExpansionDescriptors: (
    boardExpansion: unknown,
    boardOrConfig: unknown,
  ) => ExpansionDescriptor[];
  getBoardShapeMeta: (board: unknown) => {
    meteorHoleKeys?: Set<string>;
    expansionCells?: ExpansionDescriptor[];
  } | null;
  collectMeteorHoleKeys?: (cardState: unknown) => Set<string>;
}

function sortCoordinates(coords: CellCoord[]): CellCoord[] {
  return coords.sort((a, b) => a.row - b.row || a.col - b.col);
}

function coordinatesFromKeys(keys: Set<string>): CellCoord[] {
  const coords: CellCoord[] = [];
  for (const key of keys) {
    const [rowText, colText] = key.split(",");
    const row = Number(rowText);
    const col = Number(colText);
    if (Number.isInteger(row) && Number.isInteger(col)) coords.push({ row, col });
  }
  return sortCoordinates(coords);
}

function boundsFromCoordinates(coords: CellCoord[], fallback: Bounds): Bounds {
  if (!coords.length) return { ...fallback };
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  for (const coord of coords) {
    minRow = Math.min(minRow, coord.row);
    maxRow = Math.max(maxRow, coord.row);
    minCol = Math.min(minCol, coord.col);
    maxCol = Math.max(maxCol, coord.col);
  }
  return { minRow, maxRow, minCol, maxCol };
}

function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minRow: Math.min(a.minRow, b.minRow),
    maxRow: Math.max(a.maxRow, b.maxRow),
    minCol: Math.min(a.minCol, b.minCol),
    maxCol: Math.max(a.maxCol, b.maxCol),
  };
}

export function createBoardTopology(deps: BoardTopologyDependencies) {
  function buildBoardTopology(boardOrState: unknown, options?: unknown): BoardTopology {
    const state = boardOrState && typeof boardOrState === "object" && !Array.isArray(boardOrState)
      ? boardOrState as Record<string, unknown>
      : null;
    const opts = options && typeof options === "object"
      ? options as Record<string, unknown>
      : {};
    const board = state && Array.isArray(state.board)
      ? state.board
      : (Array.isArray(boardOrState) ? boardOrState : []);
    const configSource = state || opts.boardConfig || board;
    const config = deps.resolveBoardConfig(configSource);
    const expansionSource = state ? state.boardExpansion : opts.boardExpansion;
    const meta = deps.getBoardShapeMeta(board);
    const expansions = deps.collectExpansionDescriptors(expansionSource, configSource);
    if (!expansions.length && meta && Array.isArray(meta.expansionCells)) {
      for (const cell of meta.expansionCells) {
        if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col)) expansions.push(cell);
      }
    }

    const baseKeys = new Set<string>();
    for (let row = config.baseBounds.minRow; row <= config.baseBounds.maxRow; row++) {
      for (let col = config.baseBounds.minCol; col <= config.baseBounds.maxCol; col++) {
        if (deps.isMainBoardCell(row, col, configSource)) {
          baseKeys.add(deps.toBoardCellKey(row, col));
        }
      }
    }

    const expansionKeys = new Set<string>();
    for (const cell of expansions) expansionKeys.add(deps.toBoardCellKey(cell.row, cell.col));

    const holeKeys = new Set<string>(
      meta && meta.meteorHoleKeys instanceof Set
        ? Array.from(meta.meteorHoleKeys)
        : [],
    );
    if (typeof deps.collectMeteorHoleKeys === "function") {
      const explicitCardState = opts.cardState || (state && state.cardState);
      if (explicitCardState) {
        for (const key of deps.collectMeteorHoleKeys(explicitCardState)) holeKeys.add(key);
      }
    }

    const existingKeys = new Set<string>([...baseKeys, ...expansionKeys]);
    const playableKeys = new Set<string>();
    for (const key of existingKeys) if (!holeKeys.has(key)) playableKeys.add(key);

    const baseCoordinates = coordinatesFromKeys(baseKeys);
    const expansionCoordinates = coordinatesFromKeys(expansionKeys);
    const existingCoordinates = coordinatesFromKeys(existingKeys);
    const playableCoordinates = coordinatesFromKeys(playableKeys);
    const holeCoordinates = coordinatesFromKeys(holeKeys);
    const contentBounds = boundsFromCoordinates(
      [...existingCoordinates, ...holeCoordinates],
      config.baseBounds,
    );
    const renderBounds = unionBounds(config.baseBounds, contentBounds);
    const candidateBounds = {
      minRow: contentBounds.minRow - 1,
      maxRow: contentBounds.maxRow + 1,
      minCol: contentBounds.minCol - 1,
      maxCol: contentBounds.maxCol + 1,
    };

    return {
      baseKeys,
      expansionKeys,
      existingKeys,
      playableKeys,
      holeKeys,
      baseCoordinates,
      expansionCoordinates,
      existingCoordinates,
      playableCoordinates,
      contentBounds,
      renderBounds,
      candidateBounds,
    };
  }

  return { buildBoardTopology };
}
