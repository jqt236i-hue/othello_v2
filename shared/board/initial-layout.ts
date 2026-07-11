export interface BoardBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface BoardConfig {
  rows: number;
  cols: number;
  shape?: "rectangle" | "circle";
  baseBounds: BoardBounds;
}

export interface CellCoord {
  row: number;
  col: number;
}

export interface OpeningPlacement extends CellCoord {
  owner: number;
}

export interface InitialLayoutDependencies {
  empty: number;
  black: number;
  white: number;
  resolveBoardConfig: (boardOrConfig: unknown, maybeCols?: unknown) => BoardConfig;
}

export function createInitialLayout(deps: InitialLayoutDependencies) {
  function isCircleCell(row: number, col: number, config: BoardConfig): boolean {
    const centerRow = (config.rows - 1) / 2;
    const centerCol = (config.cols - 1) / 2;
    const radius = Math.min(config.rows, config.cols) / 2;
    const rowDistance = row - centerRow;
    const colDistance = col - centerCol;
    return (rowDistance * rowDistance) + (colDistance * colDistance) <= radius * radius;
  }

  function isMainBoardCell(row: number, col: number, boardOrConfig: unknown, maybeCols?: unknown): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const config = deps.resolveBoardConfig(boardOrConfig, maybeCols);
    const bounds = config.baseBounds;
    const inBounds = row >= bounds.minRow && row <= bounds.maxRow && col >= bounds.minCol && col <= bounds.maxCol;
    if (!inBounds) return false;
    return config.shape === "circle" ? isCircleCell(row, col, config) : true;
  }

  function collectMainBoardCoordinates(boardOrConfig: unknown, maybeCols?: unknown): CellCoord[] {
    const config = deps.resolveBoardConfig(boardOrConfig, maybeCols);
    const coords: CellCoord[] = [];
    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.cols; col++) {
        if (isMainBoardCell(row, col, config)) coords.push({ row, col });
      }
    }
    return coords;
  }

  function createEmptyBoard(boardOrConfig: unknown, maybeCols?: unknown, maybeFillValue?: unknown): number[][] {
    const looksLikeConfigObject = !!(boardOrConfig && typeof boardOrConfig === 'object');
    const useNumericArgs = !looksLikeConfigObject && Number.isFinite(Number(boardOrConfig)) && Number.isFinite(Number(maybeCols));
    const config = useNumericArgs
      ? deps.resolveBoardConfig(boardOrConfig, maybeCols)
      : deps.resolveBoardConfig(boardOrConfig);
    const fillValue = useNumericArgs ? maybeFillValue : maybeCols;
    const normalizedFillValue = (typeof fillValue === 'undefined') ? deps.empty : fillValue;
    return Array.from({ length: config.rows }, () => Array.from({ length: config.cols }, () => normalizedFillValue as number));
  }

  function getOpeningAnchor(boardOrConfig: unknown, maybeCols?: unknown): CellCoord {
    const config = deps.resolveBoardConfig(boardOrConfig, maybeCols);
    return { row: Math.floor((config.rows - 2) / 2), col: Math.floor((config.cols - 2) / 2) };
  }

  function getOpeningPlacements(boardOrConfig: unknown, maybeCols?: unknown): OpeningPlacement[] {
    const config = deps.resolveBoardConfig(boardOrConfig, maybeCols);
    const anchor = getOpeningAnchor(config);
    if (config.rows === 7 && config.cols === 7) {
      const placements: OpeningPlacement[] = [];
      for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
        for (let colOffset = 0; colOffset < 3; colOffset += 1) {
          if (rowOffset === 1 && colOffset === 1) continue;
          placements.push({
            row: anchor.row + rowOffset,
            col: anchor.col + colOffset,
            owner: ((rowOffset + colOffset) % 2 === 0) ? deps.white : deps.black
          });
        }
      }
      return placements;
    }
    return [
      { row: anchor.row, col: anchor.col, owner: deps.white },
      { row: anchor.row, col: anchor.col + 1, owner: deps.black },
      { row: anchor.row + 1, col: anchor.col, owner: deps.black },
      { row: anchor.row + 1, col: anchor.col + 1, owner: deps.white }
    ];
  }

  function getOpeningCells(boardOrConfig: unknown, maybeCols?: unknown): CellCoord[] {
    return getOpeningPlacements(boardOrConfig, maybeCols).map((placement) => ({ row: placement.row, col: placement.col }));
  }

  return { isMainBoardCell, collectMainBoardCoordinates, createEmptyBoard, getOpeningAnchor, getOpeningPlacements, getOpeningCells };
}
