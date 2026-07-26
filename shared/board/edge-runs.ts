export interface CellCoord {
  row: number;
  col: number;
}
export interface CornerEdgeLineDescriptor {
  key: string;
  canonicalKey: string;
  corner: CellCoord;
  direction: CellCoord;
  directionTarget: CellCoord;
  cells: CellCoord[];
}
export interface EdgeRunSummary {
  totalLines: number;
  maxLineLength: number;
  totalLineCells: number;
  totalOwnedCells: number;
  chainStrength: number;
  longestRun: number;
  longestRunShare: number;
  completeLineCount: number;
  segmentCount: number;
  loneDiscCount: number;
}
export interface EdgeRunDependencies {
  toBoardCellKey: (row: number, col: number) => string;
  normalizeOwner: (value: unknown) => number;
  getCornerCells: (board: unknown) => CellCoord[];
  hasPlayableCell: (board: unknown, row: number, col: number) => boolean;
  isCornerCell: (row: number, col: number, boardOrRows: unknown) => boolean;
  isEdgeCell: (row: number, col: number, boardOrRows: unknown) => boolean;
  getCellValue: (board: unknown, row: number, col: number) => number | null;
}

export function createEdgeRuns(deps: EdgeRunDependencies) {
  function getCornerEdgeLineDescriptors(
    board: unknown,
  ): CornerEdgeLineDescriptor[] {
    if (!board || typeof board !== "object") return [];
    const lines: CornerEdgeLineDescriptor[] = [];
    const directions = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];
    for (const corner of deps.getCornerCells(board)) {
      if (
        !corner ||
        !Number.isInteger(corner.row) ||
        !Number.isInteger(corner.col)
      )
        continue;
      for (const direction of directions) {
        const nextRow = corner.row + direction.row,
          nextCol = corner.col + direction.col;
        if (
          !deps.hasPlayableCell(board, nextRow, nextCol) ||
          !deps.isEdgeCell(nextRow, nextCol, board)
        )
          continue;
        const cells: CellCoord[] = [{ row: corner.row, col: corner.col }];
        let currentRow = nextRow,
          currentCol = nextCol;
        while (
          deps.hasPlayableCell(board, currentRow, currentCol) &&
          deps.isEdgeCell(currentRow, currentCol, board)
        ) {
          cells.push({ row: currentRow, col: currentCol });
          if (
            deps.isCornerCell(currentRow, currentCol, board) &&
            (currentRow !== corner.row || currentCol !== corner.col)
          )
            break;
          currentRow += direction.row;
          currentCol += direction.col;
        }
        if (cells.length <= 1) continue;
        const cellKeys = cells.map((cell) =>
          deps.toBoardCellKey(cell.row, cell.col),
        );
        lines.push({
          key: cellKeys.join("|"),
          canonicalKey: cellKeys.slice().sort().join("|"),
          corner: { row: corner.row, col: corner.col },
          direction: { row: direction.row, col: direction.col },
          directionTarget: { row: nextRow, col: nextCol },
          cells,
        });
      }
    }
    return lines;
  }
  function collectUniqueCornerEdgeLines(
    board: unknown,
  ): CornerEdgeLineDescriptor[] {
    if (!board || typeof board !== "object") return [];
    const seen = new Set<string>();
    const lines: CornerEdgeLineDescriptor[] = [];
    for (const descriptor of getCornerEdgeLineDescriptors(board)) {
      if (
        !descriptor ||
        !Array.isArray(descriptor.cells) ||
        descriptor.cells.length <= 1
      )
        continue;
      const canonicalKey =
        typeof descriptor.canonicalKey === "string" && descriptor.canonicalKey
          ? descriptor.canonicalKey
          : descriptor.cells
              .map((cell) => deps.toBoardCellKey(cell.row, cell.col))
              .slice()
              .sort()
              .join("|");
      if (!seen.has(canonicalKey)) {
        seen.add(canonicalKey);
        lines.push(descriptor);
      }
    }
    return lines;
  }
  function summarizeEdgeRuns(
    board: unknown,
    playerValue: number,
  ): EdgeRunSummary {
    const out: EdgeRunSummary = {
      totalLines: 0,
      maxLineLength: 0,
      totalLineCells: 0,
      totalOwnedCells: 0,
      chainStrength: 0,
      longestRun: 0,
      longestRunShare: 0,
      completeLineCount: 0,
      segmentCount: 0,
      loneDiscCount: 0,
    };
    if (!board || typeof board !== "object") return out;
    const owner = deps.normalizeOwner(playerValue);
    if (!owner) return out;
    const lines = collectUniqueCornerEdgeLines(board);
    out.totalLines = lines.length;
    for (const line of lines) {
      if (!line || !Array.isArray(line.cells) || line.cells.length <= 0)
        continue;
      const cells = line.cells,
        lineLength = cells.length;
      out.maxLineLength = Math.max(out.maxLineLength, lineLength);
      out.totalLineCells += lineLength;
      let lineOwnedCells = 0,
        currentRunLength = 0,
        runStartIndex = -1;
      const finalizeRun = () => {
        if (currentRunLength <= 0) return;
        out.chainStrength += currentRunLength * currentRunLength;
        out.segmentCount += 1;
        out.longestRun = Math.max(out.longestRun, currentRunLength);
        if (currentRunLength === lineLength) out.completeLineCount += 1;
        const loneCell = cells[runStartIndex];
        if (
          currentRunLength === 1 &&
          loneCell &&
          !deps.isCornerCell(loneCell.row, loneCell.col, board)
        )
          out.loneDiscCount += 1;
        currentRunLength = 0;
        runStartIndex = -1;
      };
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (deps.getCellValue(board, cell.row, cell.col) === owner) {
          lineOwnedCells += 1;
          if (currentRunLength <= 0) runStartIndex = i;
          currentRunLength += 1;
          continue;
        }
        finalizeRun();
      }
      finalizeRun();
      out.totalOwnedCells += lineOwnedCells;
    }
    out.longestRunShare =
      out.maxLineLength > 0
        ? Math.max(0, Math.min(1, out.longestRun / out.maxLineLength))
        : 0;
    return out;
  }
  function countAdjacentLoneEdgeDiscs(
    board: unknown,
    row: number,
    col: number,
    playerValue: number,
  ): number {
    if (
      !board ||
      typeof board !== "object" ||
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      !deps.isEdgeCell(row, col, board) ||
      deps.isCornerCell(row, col, board)
    )
      return 0;
    const owner = deps.normalizeOwner(playerValue);
    if (!owner) return 0;
    const seen = new Set<string>();
    let count = 0;
    for (const line of collectUniqueCornerEdgeLines(board)) {
      if (!line || !Array.isArray(line.cells) || line.cells.length <= 0)
        continue;
      const targetIndex = line.cells.findIndex(
        (cell) => cell && cell.row === row && cell.col === col,
      );
      if (targetIndex < 0) continue;
      for (const adjacentIndex of [targetIndex - 1, targetIndex + 1]) {
        if (adjacentIndex < 0 || adjacentIndex >= line.cells.length) continue;
        const adjacentCell = line.cells[adjacentIndex];
        if (
          !adjacentCell ||
          deps.isCornerCell(adjacentCell.row, adjacentCell.col, board) ||
          deps.getCellValue(board, adjacentCell.row, adjacentCell.col) !== owner
        )
          continue;
        const adjacentKey = deps.toBoardCellKey(
          adjacentCell.row,
          adjacentCell.col,
        );
        if (seen.has(adjacentKey)) continue;
        let hasSameNeighbor = false;
        for (const neighborIndex of [adjacentIndex - 1, adjacentIndex + 1]) {
          if (neighborIndex < 0 || neighborIndex >= line.cells.length) continue;
          const neighborCell = line.cells[neighborIndex];
          if (
            neighborCell &&
            deps.getCellValue(board, neighborCell.row, neighborCell.col) ===
              owner
          ) {
            hasSameNeighbor = true;
            break;
          }
        }
        if (!hasSameNeighbor) {
          seen.add(adjacentKey);
          count += 1;
        }
      }
    }
    return count;
  }
  return {
    getCornerEdgeLineDescriptors,
    summarizeEdgeRuns,
    countAdjacentLoneEdgeDiscs,
  };
}
