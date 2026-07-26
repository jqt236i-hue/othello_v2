import {
  isBoardCoordinateWithinLimit,
  resolveBoardMaxAbsCoordinate,
} from "./expansion-descriptors";

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

export type BoardBoundaryEdgeKind = "none" | "outer" | "hole";

export interface BoardCellBoundaryEdges {
  top: BoardBoundaryEdgeKind;
  right: BoardBoundaryEdgeKind;
  bottom: BoardBoundaryEdgeKind;
  left: BoardBoundaryEdgeKind;
}

export interface BoardTopology {
  baseRows: number;
  baseCols: number;
  baseKeys: Set<string>;
  expansionKeys: Set<string>;
  existingKeys: Set<string>;
  playableKeys: Set<string>;
  holeKeys: Set<string>;
  baseCoordinates: CellCoord[];
  expansionCoordinates: CellCoord[];
  existingCoordinates: CellCoord[];
  playableCoordinates: CellCoord[];
  holeCoordinates: CellCoord[];
  expansionSideByKey: Map<string, string | null>;
  renderRowOffset: number;
  renderColOffset: number;
  renderRows: number;
  renderCols: number;
  boundaryEdgesByKey: Map<string, BoardCellBoundaryEdges>;
  contentBounds: Bounds;
  renderBounds: Bounds;
  candidateBounds: Bounds;
}

export interface BoardTopologyDependencies {
  maxAbsCoordinate?: number;
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

function buildBoundaryEdgesByKey(
  existingKeys: Set<string>,
  holeKeys: Set<string>,
  toBoardCellKey: (row: number, col: number) => string,
): Map<string, BoardCellBoundaryEdges> {
  const result = new Map<string, BoardCellBoundaryEdges>();
  const directions = [
    ["top", -1, 0],
    ["right", 0, 1],
    ["bottom", 1, 0],
    ["left", 0, -1],
  ] as const;
  for (const key of existingKeys) {
    const [rowText, colText] = key.split(",");
    const row = Number(rowText);
    const col = Number(colText);
    if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
    const currentIsHole = holeKeys.has(key);
    const edges: BoardCellBoundaryEdges = {
      top: "none",
      right: "none",
      bottom: "none",
      left: "none",
    };
    for (const [edge, rowDelta, colDelta] of directions) {
      const neighborKey = toBoardCellKey(row + rowDelta, col + colDelta);
      if (!existingKeys.has(neighborKey)) {
        edges[edge] = "outer";
      } else if (currentIsHole !== holeKeys.has(neighborKey)) {
        edges[edge] = "hole";
      }
    }
    result.set(key, edges);
  }
  return result;
}

export function createBoardTopology(deps: BoardTopologyDependencies) {
  const maxAbsCoordinate = resolveBoardMaxAbsCoordinate(
    deps.maxAbsCoordinate,
  );

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
    const expansions = deps.collectExpansionDescriptors(expansionSource, configSource);

    const baseKeys = new Set<string>();
    for (let row = config.baseBounds.minRow; row <= config.baseBounds.maxRow; row++) {
      for (let col = config.baseBounds.minCol; col <= config.baseBounds.maxCol; col++) {
        if (deps.isMainBoardCell(row, col, configSource)) {
          baseKeys.add(deps.toBoardCellKey(row, col));
        }
      }
    }

    const expansionKeys = new Set<string>();
    const expansionSideByKey = new Map<string, string | null>();
    for (const cell of expansions) {
      const key = deps.toBoardCellKey(cell.row, cell.col);
      expansionKeys.add(key);
      expansionSideByKey.set(key, typeof cell.side === "string" ? cell.side : null);
    }

    const explicitCardState = Object.prototype.hasOwnProperty.call(opts, "cardState")
      ? opts.cardState
      : (state && Object.prototype.hasOwnProperty.call(state, "cardState")
        ? state.cardState
        : undefined);
    const hasExplicitCardState = explicitCardState !== undefined;
    const holeKeys = new Set<string>();
    if (typeof deps.collectMeteorHoleKeys === "function") {
      if (hasExplicitCardState) {
        for (const key of deps.collectMeteorHoleKeys(explicitCardState)) {
          const [rowText, colText] = key.split(",");
          const row = Number(rowText);
          const col = Number(colText);
          if (!isBoardCoordinateWithinLimit(row, col, maxAbsCoordinate)) {
            continue;
          }
          holeKeys.add(deps.toBoardCellKey(row, col));
        }
      }
    }

    // Explicit holes are existing topology tombstones, even when a malformed or
    // recovered snapshot places one outside the current base/expansion sets.
    // A missing key inside renderBounds is the only representation of void.
    const existingKeys = new Set<string>([...baseKeys, ...expansionKeys, ...holeKeys]);
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
    const renderRowOffset = renderBounds.minRow < 0 ? -renderBounds.minRow : 0;
    const renderColOffset = renderBounds.minCol < 0 ? -renderBounds.minCol : 0;
    const renderRows = renderBounds.maxRow - renderBounds.minRow + 1;
    const renderCols = renderBounds.maxCol - renderBounds.minCol + 1;
    const boundaryEdgesByKey = buildBoundaryEdgesByKey(
      existingKeys,
      holeKeys,
      deps.toBoardCellKey,
    );
    const candidateBounds = {
      minRow: contentBounds.minRow - 1,
      maxRow: contentBounds.maxRow + 1,
      minCol: contentBounds.minCol - 1,
      maxCol: contentBounds.maxCol + 1,
    };

    return {
      baseRows: config.rows,
      baseCols: config.cols,
      baseKeys,
      expansionKeys,
      existingKeys,
      playableKeys,
      holeKeys,
      baseCoordinates,
      expansionCoordinates,
      existingCoordinates,
      playableCoordinates,
      holeCoordinates,
      expansionSideByKey,
      renderRowOffset,
      renderColOffset,
      renderRows,
      renderCols,
      boundaryEdgesByKey,
      contentBounds,
      renderBounds,
      candidateBounds,
    };
  }

  return { buildBoardTopology };
}
