export interface CellCoord {
  row: number;
  col: number;
}

export interface BoardBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface CanonicalResult {
  boardKey: string;
  transformId: number;
  size: number;
  minRow: number;
  minCol: number;
}

export interface CanonicalEncodingDependencies {
  resolveBoardBounds: (board: unknown) => BoardBounds | null;
  collectBoardCoordinates: (board: unknown) => CellCoord[];
  getCellValue: (board: unknown, row: number, col: number) => unknown;
}

export function createCanonicalBoardEncoding(deps: CanonicalEncodingDependencies) {
  function toCellChar(value: unknown): string {
    if (value === 1) return 'B';
    if (value === -1) return 'W';
    if (value === 0) return '.';
    return '#';
  }

  function transformCoord(row: number, col: number, size: number, transformId: number): CellCoord {
    if (transformId === 0) return { row, col };
    if (transformId === 1) return { row: col, col: size - 1 - row };
    if (transformId === 2) return { row: size - 1 - row, col: size - 1 - col };
    if (transformId === 3) return { row: size - 1 - col, col: row };
    if (transformId === 4) return { row, col: size - 1 - col };
    if (transformId === 5) return { row: size - 1 - col, col: size - 1 - row };
    if (transformId === 6) return { row: size - 1 - row, col };
    if (transformId === 7) return { row: col, col: row };
    return { row, col };
  }

  function buildEnvelopeMatrix(board: unknown): { matrix: string[][]; size: number; minRow: number; minCol: number } {
    const bounds = deps.resolveBoardBounds(board);
    if (!bounds || bounds.maxRow < bounds.minRow || bounds.maxCol < bounds.minCol) {
      return { matrix: [], size: 0, minRow: 0, minCol: 0 };
    }
    const rowSpan = (bounds.maxRow - bounds.minRow) + 1;
    const colSpan = (bounds.maxCol - bounds.minCol) + 1;
    const size = Math.max(rowSpan, colSpan);
    const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => '#'));
    for (const cell of deps.collectBoardCoordinates(board)) {
      const envelopeRow = cell.row - bounds.minRow;
      const envelopeCol = cell.col - bounds.minCol;
      matrix[envelopeRow][envelopeCol] = toCellChar(deps.getCellValue(board, cell.row, cell.col));
    }
    return { matrix, size, minRow: bounds.minRow, minCol: bounds.minCol };
  }

  function encodeEnvelopeMatrix(matrix: string[][]): string {
    if (!Array.isArray(matrix) || matrix.length <= 0) return '';
    return matrix.map((row) => Array.isArray(row) ? row.join('') : '').join('/');
  }

  function transformMatrix(matrix: string[][], transformId: number): string[][] {
    if (!Array.isArray(matrix) || matrix.length <= 0) return [];
    const size = matrix.length;
    const out = Array.from({ length: size }, () => Array.from({ length: size }, () => '#'));
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const mapped = transformCoord(row, col, size, transformId);
        out[mapped.row][mapped.col] = matrix[row][col];
      }
    }
    return out;
  }

  function encodeBoard(board: unknown): string {
    return encodeEnvelopeMatrix(buildEnvelopeMatrix(board).matrix);
  }

  function canonicalizeBoard(board: unknown): CanonicalResult {
    const envelope = buildEnvelopeMatrix(board);
    const raw = encodeEnvelopeMatrix(envelope.matrix);
    if (!raw) return { boardKey: raw, transformId: 0, size: envelope.size, minRow: envelope.minRow, minCol: envelope.minCol };
    let best: string | null = null;
    let bestTransform = 0;
    for (let transformId = 0; transformId < 8; transformId++) {
      const encoded = encodeEnvelopeMatrix(transformMatrix(envelope.matrix, transformId));
      if (best === null || encoded < best) {
        best = encoded;
        bestTransform = transformId;
      }
    }
    return { boardKey: best || raw, transformId: bestTransform, size: envelope.size, minRow: envelope.minRow, minCol: envelope.minCol };
  }

  function mapCoordToCanonical(row: number, col: number, board: unknown, transformId: number): CellCoord | null {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    const envelope = buildEnvelopeMatrix(board);
    if (envelope.size <= 0) return null;
    const relativeRow = row - envelope.minRow;
    const relativeCol = col - envelope.minCol;
    if (relativeRow < 0 || relativeCol < 0 || relativeRow >= envelope.size || relativeCol >= envelope.size) return null;
    return transformCoord(relativeRow, relativeCol, envelope.size, transformId);
  }

  function makeCanonicalActionKey(move: unknown, board: unknown, transformId: number): string {
    if (!move || !Number.isFinite((move as { row?: number }).row) || !Number.isFinite((move as { col?: number }).col)) return '';
    const mapped = mapCoordToCanonical(Number((move as { row: number }).row), Number((move as { col: number }).col), board, Number(transformId) || 0);
    return mapped ? `place:${mapped.row}:${mapped.col}` : '';
  }

  return { toCellChar, transformCoord, encodeBoard, canonicalizeBoard, mapCoordToCanonical, makeCanonicalActionKey };
}
