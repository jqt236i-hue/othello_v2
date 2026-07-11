export type BoardExpansionDirectionKey =
  | "up"
  | "right"
  | "down"
  | "left"
  | "up-left"
  | "up-right"
  | "down-right"
  | "down-left";

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

export interface BoardConfig {
  baseBounds: Bounds;
  outerBounds: Bounds;
}

export interface BoardShapeMeta {
  playableKeys: Set<string>;
  meteorHoleKeys: Set<string>;
}

export interface BoardExpansionSocket {
  kind: "edge" | "corner";
  anchor: CellCoord;
  direction: CellCoord;
  directionKey: BoardExpansionDirectionKey;
  additions: CellCoord[];
}

export interface ExpansionSocketDependencies {
  toBoardCellKey: (row: number, col: number) => string;
  getBoardShapeMeta: (board: unknown) => BoardShapeMeta | null;
  collectBoardCoordinates: (board: unknown) => CellCoord[];
  resolveBoardConfig: (boardOrConfig: unknown) => BoardConfig;
  isExpansionCoordinate: (
    row: number,
    col: number,
    boardOrConfig: unknown,
  ) => boolean;
}

const CARDINAL_DIRECTIONS = [
  { key: "up", row: -1, col: 0 },
  { key: "right", row: 0, col: 1 },
  { key: "down", row: 1, col: 0 },
  { key: "left", row: 0, col: -1 },
] as const;

const CORNER_DIRECTIONS = [
  { key: "up-left", row: -1, col: -1 },
  { key: "up-right", row: -1, col: 1 },
  { key: "down-right", row: 1, col: 1 },
  { key: "down-left", row: 1, col: -1 },
] as const;

export function createExpansionSockets(deps: ExpansionSocketDependencies) {
  function isWithinBounds(row: number, col: number, bounds: Bounds): boolean {
    return (
      row >= bounds.minRow &&
      row <= bounds.maxRow &&
      col >= bounds.minCol &&
      col <= bounds.maxCol
    );
  }

  function collectPlayableKeys(board: unknown): Set<string> {
    const meta = deps.getBoardShapeMeta(board);
    if (meta && meta.playableKeys instanceof Set)
      return new Set(meta.playableKeys);
    return new Set(
      deps
        .collectBoardCoordinates(board)
        .map((cell) => deps.toBoardCellKey(cell.row, cell.col)),
    );
  }

  function collectMeteorHoleKeys(board: unknown): Set<string> {
    const meta = deps.getBoardShapeMeta(board);
    return meta && meta.meteorHoleKeys instanceof Set
      ? new Set(meta.meteorHoleKeys)
      : new Set();
  }

  function getExteriorVoidKeys(
    board: unknown,
    boardOrConfig?: unknown,
  ): Set<string> {
    const config = deps.resolveBoardConfig(boardOrConfig || board);
    const bounds = config.outerBounds;
    const playableKeys = collectPlayableKeys(board);
    const exteriorKeys = new Set<string>();
    const queue: CellCoord[] = [];

    const enqueue = (row: number, col: number): void => {
      if (!isWithinBounds(row, col, bounds)) return;
      const key = deps.toBoardCellKey(row, col);
      if (playableKeys.has(key) || exteriorKeys.has(key)) return;
      exteriorKeys.add(key);
      queue.push({ row, col });
    };

    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      enqueue(bounds.minRow, col);
      enqueue(bounds.maxRow, col);
    }
    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      enqueue(row, bounds.minCol);
      enqueue(row, bounds.maxCol);
    }

    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      for (const direction of CARDINAL_DIRECTIONS) {
        enqueue(current.row + direction.row, current.col + direction.col);
      }
    }
    return exteriorKeys;
  }

  function getSortedPlayableCoordinates(board: unknown): CellCoord[] {
    const playableKeys = collectPlayableKeys(board);
    const coords: CellCoord[] = [];
    for (const key of playableKeys) {
      const [rowText, colText] = key.split(",");
      const row = Number(rowText);
      const col = Number(colText);
      if (Number.isInteger(row) && Number.isInteger(col))
        coords.push({ row, col });
    }
    return coords.sort((a, b) => a.row - b.row || a.col - b.col);
  }

  function isAvailableAddition(
    row: number,
    col: number,
    boardOrConfig: unknown,
    playableKeys: Set<string>,
    meteorHoleKeys: Set<string>,
    exteriorKeys: Set<string>,
  ): boolean {
    const key = deps.toBoardCellKey(row, col);
    return (
      !playableKeys.has(key) &&
      !meteorHoleKeys.has(key) &&
      exteriorKeys.has(key) &&
      deps.isExpansionCoordinate(row, col, boardOrConfig)
    );
  }

  function getBoardExpansionEdgeSockets(
    board: unknown,
    boardOrConfig?: unknown,
  ): BoardExpansionSocket[] {
    const configSource = boardOrConfig || board;
    const playableKeys = collectPlayableKeys(board);
    const meteorHoleKeys = collectMeteorHoleKeys(board);
    const exteriorKeys = getExteriorVoidKeys(board, configSource);
    const sockets: BoardExpansionSocket[] = [];

    for (const anchor of getSortedPlayableCoordinates(board)) {
      for (const direction of CARDINAL_DIRECTIONS) {
        const row = anchor.row + direction.row;
        const col = anchor.col + direction.col;
        if (
          !isAvailableAddition(
            row,
            col,
            configSource,
            playableKeys,
            meteorHoleKeys,
            exteriorKeys,
          )
        )
          continue;
        sockets.push({
          kind: "edge",
          anchor: { row: anchor.row, col: anchor.col },
          direction: { row: direction.row, col: direction.col },
          directionKey: direction.key,
          additions: [{ row, col }],
        });
      }
    }
    return sockets;
  }

  function getBoardExpansionCornerSockets(
    board: unknown,
    boardOrConfig?: unknown,
  ): BoardExpansionSocket[] {
    const configSource = boardOrConfig || board;
    const playableKeys = collectPlayableKeys(board);
    const meteorHoleKeys = collectMeteorHoleKeys(board);
    const exteriorKeys = getExteriorVoidKeys(board, configSource);
    const sockets: BoardExpansionSocket[] = [];

    for (const anchor of getSortedPlayableCoordinates(board)) {
      for (const direction of CORNER_DIRECTIONS) {
        const additions = [
          { row: anchor.row + direction.row, col: anchor.col },
          { row: anchor.row, col: anchor.col + direction.col },
          {
            row: anchor.row + direction.row,
            col: anchor.col + direction.col,
          },
        ];
        if (
          !additions.every((cell) =>
            isAvailableAddition(
              cell.row,
              cell.col,
              configSource,
              playableKeys,
              meteorHoleKeys,
              exteriorKeys,
            ),
          )
        )
          continue;
        sockets.push({
          kind: "corner",
          anchor: { row: anchor.row, col: anchor.col },
          direction: { row: direction.row, col: direction.col },
          directionKey: direction.key,
          additions,
        });
      }
    }
    return sockets;
  }

  return {
    getExteriorVoidKeys,
    getBoardExpansionEdgeSockets,
    getBoardExpansionCornerSockets,
  };
}
