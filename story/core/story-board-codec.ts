import type { StoryInitialBoardCell, StoryInitialBoardSetup, StorySide } from './story-schema';

const STORY_BOARD_CODE_PREFIX = 'SB1';
const BLACK_TOKEN = 'b';
const WHITE_TOKEN = 'w';
const EMPTY_TOKEN = '_';

export type StoryBoardCodeValidationSeverity = 'error' | 'warning';

export type StoryBoardCodeValidationIssue = {
  severity: StoryBoardCodeValidationSeverity;
  code: string;
  message: string;
  path: string;
};

export type StoryBoardCodeDecodeResult = {
  ok: boolean;
  setup?: StoryInitialBoardSetup;
  issues: StoryBoardCodeValidationIssue[];
};

export function encodeStoryBoardCode(setup: StoryInitialBoardSetup): string {
  const issues = validateStoryInitialBoardSetup(setup);
  const firstError = issues.find((issue) => issue.severity === 'error');
  if (firstError) {
    throw new Error(firstError.message);
  }

  const cellStream = setup.cells
    .flat()
    .map((cell) => encodeCellToken(cell))
    .join('');
  return `${STORY_BOARD_CODE_PREFIX}:${setup.rows}x${setup.cols}:${setup.currentPlayer}:${cellStream}`;
}

export function decodeStoryBoardCode(boardCode: string): StoryInitialBoardSetup {
  const result = safeDecodeStoryBoardCode(boardCode);
  if (!result.ok || !result.setup) {
    const firstError = result.issues.find((issue) => issue.severity === 'error');
    throw new Error(firstError ? firstError.message : 'story board code decode failed.');
  }
  return result.setup;
}

export function safeDecodeStoryBoardCode(boardCode: string): StoryBoardCodeDecodeResult {
  const issues: StoryBoardCodeValidationIssue[] = [];
  const normalized = String(boardCode || '').trim();
  const match = /^SB1:(6x6|8x8):(black|white):([bw_]+)$/i.exec(normalized);
  if (!match) {
    return {
      ok: false,
      issues: [{
        severity: 'error',
        code: 'BOARD_CODE_FORMAT_INVALID',
        message: 'story board code format is invalid.',
        path: 'boardCode'
      }]
    };
  }

  const rows = Number(match[1].slice(0, 1)) as 6 | 8;
  const cols = rows;
  const currentPlayer = match[2].toLowerCase() as StorySide;
  const flatCells = match[3].toLowerCase();
  const expectedLength = rows * cols;
  if (flatCells.length !== expectedLength) {
    return {
      ok: false,
      issues: [{
        severity: 'error',
        code: 'BOARD_CODE_LENGTH_INVALID',
        message: `story board code cell count must be ${expectedLength}.`,
        path: 'boardCode'
      }]
    };
  }

  const cells: StoryInitialBoardCell[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const line: StoryInitialBoardCell[] = [];
    for (let col = 0; col < cols; col += 1) {
      line.push(decodeCellToken(flatCells[(row * cols) + col]));
    }
    cells.push(line);
  }

  const setup: StoryInitialBoardSetup = {
    rows,
    cols,
    cells,
    currentPlayer
  };
  const validationIssues = validateStoryInitialBoardSetup(setup);
  issues.push(...validationIssues);
  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    setup,
    issues
  };
}

export function validateStoryInitialBoardSetup(setup: StoryInitialBoardSetup): StoryBoardCodeValidationIssue[] {
  const issues: StoryBoardCodeValidationIssue[] = [];
  const rows = Number(setup?.rows);
  const cols = Number(setup?.cols);
  if (!((rows === 6 && cols === 6) || (rows === 8 && cols === 8))) {
    pushIssue(issues, 'error', 'BOARD_SIZE_UNSUPPORTED', `story board size must be 6x6 or 8x8: ${rows}x${cols}`, 'setup.rows');
    return issues;
  }
  if (!Array.isArray(setup?.cells) || setup.cells.length !== rows) {
    pushIssue(issues, 'error', 'BOARD_ROW_COUNT_INVALID', 'story board row count does not match board size.', 'setup.cells');
    return issues;
  }

  let blackCount = 0;
  let whiteCount = 0;
  let emptyCount = 0;
  let legalMoveExists = false;

  for (let row = 0; row < rows; row += 1) {
    const line = setup.cells[row];
    if (!Array.isArray(line) || line.length !== cols) {
      pushIssue(issues, 'error', 'BOARD_COL_COUNT_INVALID', `story board column count is invalid at row ${row}.`, `setup.cells[${row}]`);
      continue;
    }
    for (let col = 0; col < cols; col += 1) {
      const cell = line[col];
      if (cell === 'black') blackCount += 1;
      else if (cell === 'white') whiteCount += 1;
      else if (cell === null) emptyCount += 1;
      else pushIssue(issues, 'error', 'BOARD_CELL_INVALID', `invalid board cell at (${row}, ${col}).`, `setup.cells[${row}][${col}]`);
    }
  }

  if (setup.currentPlayer !== 'black' && setup.currentPlayer !== 'white') {
    pushIssue(issues, 'error', 'BOARD_CURRENT_PLAYER_INVALID', 'story board currentPlayer must be black or white.', 'setup.currentPlayer');
  }
  if (blackCount === 0) {
    pushIssue(issues, 'error', 'BOARD_BLACK_EMPTY', 'story board must contain at least one black stone.', 'setup.cells');
  }
  if (whiteCount === 0) {
    pushIssue(issues, 'error', 'BOARD_WHITE_EMPTY', 'story board must contain at least one white stone.', 'setup.cells');
  }
  if (emptyCount === 0) {
    pushIssue(issues, 'error', 'BOARD_EMPTY_CELL_MISSING', 'story board must contain at least one empty cell.', 'setup.cells');
  }

  if (issues.some((issue) => issue.severity === 'error')) {
    return issues;
  }

  legalMoveExists = hasLegalMove(setup, 'black') || hasLegalMove(setup, 'white');
  if (!legalMoveExists) {
    pushIssue(issues, 'error', 'BOARD_NO_LEGAL_MOVE', 'story board has no legal moves for either player.', 'setup.cells');
  }
  if (!hasLegalMove(setup, setup.currentPlayer)) {
    pushIssue(
      issues,
      'warning',
      'BOARD_CURRENT_PLAYER_NO_MOVE',
      'currentPlayer has no legal move at this setup. The battle will begin from a pass.',
      'setup.currentPlayer'
    );
  }

  return issues;
}

function hasLegalMove(setup: StoryInitialBoardSetup, player: StorySide): boolean {
  const targetCell = player === 'black' ? 'black' : 'white';
  const enemyCell = player === 'black' ? 'white' : 'black';
  for (let row = 0; row < setup.rows; row += 1) {
    for (let col = 0; col < setup.cols; col += 1) {
      if (setup.cells[row][col] !== null) continue;
      if (hasFlippableDirection(setup, row, col, targetCell, enemyCell)) {
        return true;
      }
    }
  }
  return false;
}

function hasFlippableDirection(
  setup: StoryInitialBoardSetup,
  row: number,
  col: number,
  ownCell: Exclude<StoryInitialBoardCell, null>,
  enemyCell: Exclude<StoryInitialBoardCell, null>
): boolean {
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  for (const [rowDelta, colDelta] of directions) {
    let cursorRow = row + rowDelta;
    let cursorCol = col + colDelta;
    let seenEnemy = false;
    while (cursorRow >= 0 && cursorRow < setup.rows && cursorCol >= 0 && cursorCol < setup.cols) {
      const cell = setup.cells[cursorRow][cursorCol];
      if (cell === enemyCell) {
        seenEnemy = true;
        cursorRow += rowDelta;
        cursorCol += colDelta;
        continue;
      }
      if (cell === ownCell && seenEnemy) {
        return true;
      }
      break;
    }
  }
  return false;
}

function encodeCellToken(cell: StoryInitialBoardCell): string {
  if (cell === 'black') return BLACK_TOKEN;
  if (cell === 'white') return WHITE_TOKEN;
  return EMPTY_TOKEN;
}

function decodeCellToken(token: string): StoryInitialBoardCell {
  if (token === BLACK_TOKEN) return 'black';
  if (token === WHITE_TOKEN) return 'white';
  return null;
}

function pushIssue(
  issues: StoryBoardCodeValidationIssue[],
  severity: StoryBoardCodeValidationSeverity,
  code: string,
  message: string,
  path: string
): void {
  issues.push({ severity, code, message, path });
}
