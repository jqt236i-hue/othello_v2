export interface ExpansionDescriptor {
  side: string;
  row: number;
  col: number;
  owner: number;
}
export interface DiscCounts {
  black: number;
  white: number;
}
export interface ShapeIterationDependencies {
  black: number;
  white: number;
  resolveBoardConfig: (value: unknown) => { rows: number; cols: number };
  collectExpansionDescriptors: (
    boardExpansion: unknown,
    boardOrConfig: unknown,
  ) => ExpansionDescriptor[];
  countDiscsViaBoardUtils: ((board: unknown) => DiscCounts) | null;
}
export function createShapeIteration(deps: ShapeIterationDependencies) {
  function resolveBoardShapeSource(boardOrConfig: unknown): {
    board: unknown[][] | null;
    boardExpansion: Record<string, unknown> | null;
  } {
    if (Array.isArray(boardOrConfig))
      return { board: boardOrConfig as unknown[][], boardExpansion: null };
    if (!boardOrConfig || typeof boardOrConfig !== "object")
      return { board: null, boardExpansion: null };
    const obj = boardOrConfig as Record<string, unknown>;
    const board = Array.isArray(obj.board) ? (obj.board as unknown[][]) : null;
    const boardExpansion =
      obj.boardExpansion && typeof obj.boardExpansion === "object"
        ? (obj.boardExpansion as Record<string, unknown>)
        : null;
    return { board, boardExpansion };
  }
  function forEachBoardShapeCell(
    boardOrConfig: unknown,
    visitor: (
      row: number,
      col: number,
      value: unknown,
      side: string | null,
    ) => void,
  ): void {
    if (typeof visitor !== "function") return;
    const source = resolveBoardShapeSource(boardOrConfig);
    const board = source.board,
      config = deps.resolveBoardConfig(boardOrConfig);
    for (let row = 0; row < config.rows; row += 1) {
      const boardRow =
        Array.isArray(board) && Array.isArray(board[row]) ? board[row] : [];
      for (let col = 0; col < config.cols; col += 1) {
        visitor(row, col, boardRow[col], null);
      }
    }
    const expansionDescriptors = source.boardExpansion
      ? deps.collectExpansionDescriptors(source.boardExpansion, boardOrConfig)
      : [];
    for (const cell of expansionDescriptors)
      if (cell)
        visitor(cell.row, cell.col, Number(cell.owner), cell.side || null);
  }
  function countDiscsByPlayer(boardOrConfig: unknown): DiscCounts {
    const counts = { black: 0, white: 0 };
    forEachBoardShapeCell(boardOrConfig, (_row, _col, value) => {
      if (Number(value) === deps.black) counts.black += 1;
      else if (Number(value) === deps.white) counts.white += 1;
    });
    return counts;
  }
  function countDiscs(boardOrConfig: unknown): DiscCounts {
    if (deps.countDiscsViaBoardUtils)
      return deps.countDiscsViaBoardUtils(boardOrConfig);
    const board = Array.isArray(boardOrConfig)
      ? (boardOrConfig as unknown[][])
      : boardOrConfig &&
          typeof boardOrConfig === "object" &&
          Array.isArray((boardOrConfig as Record<string, unknown>).board)
        ? ((boardOrConfig as Record<string, unknown>).board as unknown[][])
        : null;
    if (!Array.isArray(board)) return { black: 0, white: 0 };
    let black = 0,
      white = 0;
    for (const row of board)
      for (const value of Array.isArray(row) ? row : []) {
        if (Number(value) === deps.black) black += 1;
        else if (Number(value) === deps.white) white += 1;
      }
    return { black, white };
  }
  return { forEachBoardShapeCell, countDiscsByPlayer, countDiscs };
}
