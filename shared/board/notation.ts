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

export interface BoardNotationConfig {
  baseBounds: BoardBounds;
  outerBounds: BoardBounds;
}

export interface BoardNotationDependencies {
  resolveBoardConfig: (boardOrConfig: unknown) => BoardNotationConfig;
}

export function createBoardNotation(deps: BoardNotationDependencies) {
  function normalizePosArgs(posOrRow: unknown, maybeCol?: unknown): CellCoord {
    if (posOrRow && typeof posOrRow === 'object') {
      return {
        row: Number((posOrRow as { row?: number }).row),
        col: Number((posOrRow as { col?: number }).col)
      };
    }
    return { row: Number(posOrRow), col: Number(maybeCol) };
  }

  function resolveNotationArgs(posOrRow: unknown, maybeCol: unknown, maybeBoardOrConfig: unknown): { pos: CellCoord; boardOrConfig: unknown } {
    const objectPosWithBoardContext = !!(
      posOrRow &&
      typeof posOrRow === 'object' &&
      !Number.isFinite(Number(maybeCol))
    );
    return {
      pos: objectPosWithBoardContext
        ? normalizePosArgs(posOrRow)
        : normalizePosArgs(posOrRow, maybeCol),
      boardOrConfig: objectPosWithBoardContext ? maybeCol : maybeBoardOrConfig
    };
  }

  function formatPosTextJa(posOrRow: unknown, maybeCol?: unknown, maybeBoardOrConfig?: unknown): string {
    const resolved = resolveNotationArgs(posOrRow, maybeCol, maybeBoardOrConfig);
    const pos = resolved.pos;
    const config = deps.resolveBoardConfig(resolved.boardOrConfig);
    const baseBounds = config.baseBounds;
    const outerBounds = config.outerBounds;
    const row = pos.row;
    const col = pos.col;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return '';
    if (row === outerBounds.minRow && col === outerBounds.minCol) return '左上外';
    if (row === outerBounds.minRow && col === outerBounds.maxCol) return '右上外';
    if (row === outerBounds.maxRow && col === outerBounds.minCol) return '左下外';
    if (row === outerBounds.maxRow && col === outerBounds.maxCol) return '右下外';
    if (row === outerBounds.minRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
      return `上外${String.fromCharCode(65 + col)}`;
    }
    if (row === outerBounds.maxRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
      return `下外${String.fromCharCode(65 + col)}`;
    }
    if (col === outerBounds.minCol && row >= baseBounds.minRow && row <= baseBounds.maxRow) return `左外${row + 1}`;
    if (col === outerBounds.maxCol && row >= baseBounds.minRow && row <= baseBounds.maxRow) return `右外${row + 1}`;
    if (row >= baseBounds.minRow && row <= baseBounds.maxRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
      return `${String.fromCharCode(65 + col)}${row + 1}`;
    }
    return `(${row},${col})`;
  }

  function posToNotation(posOrRow: unknown, maybeCol?: unknown, maybeBoardOrConfig?: unknown): string {
    const resolved = resolveNotationArgs(posOrRow, maybeCol, maybeBoardOrConfig);
    const pos = resolved.pos;
    const config = deps.resolveBoardConfig(resolved.boardOrConfig);
    const baseBounds = config.baseBounds;
    const outerBounds = config.outerBounds;
    const row = pos.row;
    const col = pos.col;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return '';
    if (row === outerBounds.minRow && col === outerBounds.minCol) return 'top-left';
    if (row === outerBounds.minRow && col === outerBounds.maxCol) return 'top-right';
    if (row === outerBounds.maxRow && col === outerBounds.minCol) return 'bottom-left';
    if (row === outerBounds.maxRow && col === outerBounds.maxCol) return 'bottom-right';
    if (row === outerBounds.minRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
      return `top-${String.fromCharCode(97 + col)}`;
    }
    if (row === outerBounds.maxRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
      return `bottom-${String.fromCharCode(97 + col)}`;
    }
    if (col === outerBounds.minCol && row >= baseBounds.minRow && row <= baseBounds.maxRow) return `left${row + 1}`;
    if (col === outerBounds.maxCol && row >= baseBounds.minRow && row <= baseBounds.maxRow) return `right${row + 1}`;
    if (row >= baseBounds.minRow && row <= baseBounds.maxRow && col >= baseBounds.minCol && col <= baseBounds.maxCol) {
      return `${String.fromCharCode(97 + col)}${row + 1}`;
    }
    return `r${row}c${col}`;
  }

  return { formatPosTextJa, posToNotation };
}
