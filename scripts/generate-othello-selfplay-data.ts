#!/usr/bin/env node
/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

const BLACK = 1;
const WHITE = -1;
const EMPTY = 0;

type Player = typeof BLACK | typeof WHITE;
type Cell = Player | typeof EMPTY;
type Board = Cell[][];
type Args = Record<string, string | boolean>;
type Rng = {
  next(): number;
  int(max: number): number;
  pick<T>(items: T[]): T;
};
type FlipTuple = [number, number];
type Move = { row: number; col: number; flips: FlipTuple[] };
type Phase = 'opening' | 'mid' | 'end';
type SelectionKind = 'best' | 'sampled';
type Winner = 'black' | 'white' | 'draw';
type SelfplayOptions = {
  maxPlies: number;
  openingPliesMin: number;
  openingPliesMax: number;
  openingPreferredPlayer: string;
  openingPreferredPlayerRate: number;
  depthOpening: number;
  depthMid: number;
  depthEnd: number;
  exactSolveEmpties: number;
  explorationOpening: number;
  explorationMid: number;
  explorationEnd: number;
  quiet: boolean;
};
type MoveChoice = {
  move: Move;
  phase: Phase;
  searchDepth: number;
  selection: SelectionKind;
  searchScore: number;
  bestScore: number;
};
type SelfplayRecord = {
  schemaVersion: 'othello_selfplay.v1';
  dataLane: 'train';
  gameIndex: number;
  gameSeed: number;
  ply: number;
  player: 'black' | 'white';
  board: string;
  legalMoves: number;
  actionType: 'place';
  row: number;
  col: number;
  phase: Phase;
  searchDepth: number;
  selection: SelectionKind;
  searchScore: number;
  bestScore: number;
  searchValue: number;
  bestValue: number;
  blackCountBefore: number;
  whiteCountBefore: number;
  emptiesBefore: number;
  outcome?: number;
  finalDiscDiff?: number;
  winner?: Winner;
};

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const CORNERS = new Set(['0,0', '0,7', '7,0', '7,7']);
const X_SQUARES = new Set(['1,1', '1,6', '6,1', '6,6']);
const C_SQUARES = new Set([
  '0,1',
  '1,0',
  '0,6',
  '1,7',
  '6,0',
  '7,1',
  '6,7',
  '7,6',
]);

function oppositePlayer(player: Player): Player {
  return player === BLACK ? WHITE : BLACK;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function intArg(args: Args, key: string, fallback: number): number {
  const value = Number(args[key]);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function floatArg(args: Args, key: string, fallback: number): number {
  const value = Number(args[key]);
  return Number.isFinite(value) ? value : fallback;
}

function boolArg(args: Args, key: string, fallback: boolean): boolean {
  if (!(key in args)) return fallback;
  const value = String(args[key]).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

function createRng(seed: number): Rng {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;
  return {
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    },
    int(max: number) {
      return Math.floor(this.next() * max);
    },
    pick<T>(items: T[]): T {
      return items[this.int(items.length)];
    },
  };
}

function createInitialBoard(): Board {
  const board = Array.from({ length: 8 }, () => Array<Cell>(8).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function getFlips(board: Board, row: number, col: number, player: Player): FlipTuple[] {
  if (!inBounds(row, col) || board[row][col] !== EMPTY) return [];
  const opponent = oppositePlayer(player);
  const flips: FlipTuple[] = [];
  for (const [dr, dc] of DIRS) {
    let r = row + dr;
    let c = col + dc;
    const line: FlipTuple[] = [];
    while (inBounds(r, c) && board[r][c] === opponent) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }
    if (line.length > 0 && inBounds(r, c) && board[r][c] === player) {
      flips.push(...line);
    }
  }
  return flips;
}

function getLegalMoves(board: Board, player: Player): Move[] {
  const moves: Move[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const flips = getFlips(board, row, col, player);
      if (flips.length > 0) moves.push({ row, col, flips });
    }
  }
  return moves;
}

function applyMove(board: Board, move: Move, player: Player): Board {
  const next = cloneBoard(board);
  next[move.row][move.col] = player;
  for (const [row, col] of move.flips) {
    next[row][col] = player;
  }
  return next;
}

function countDiscs(board: Board): { black: number; white: number; empty: number } {
  let black = 0;
  let white = 0;
  let empty = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === BLACK) black += 1;
      else if (cell === WHITE) white += 1;
      else empty += 1;
    }
  }
  return { black, white, empty };
}

function encodeBoard(board: Board): string {
  return board
    .map((row) =>
      row
        .map((cell) => {
          if (cell === BLACK) return 'B';
          if (cell === WHITE) return 'W';
          return '.';
        })
        .join('')
    )
    .join('/');
}

function phaseForPly(ply: number): Phase {
  if (ply < 20) return 'opening';
  if (ply < 48) return 'mid';
  return 'end';
}

function searchDepthForPhase(phase: Phase, options: SelfplayOptions): number {
  if (phase === 'opening') return options.depthOpening;
  if (phase === 'mid') return options.depthMid;
  return options.depthEnd;
}

function explorationForPhase(phase: Phase, options: SelfplayOptions): number {
  if (phase === 'opening') return options.explorationOpening;
  if (phase === 'mid') return options.explorationMid;
  return options.explorationEnd;
}

function stableCornerAdjPenalty(board: Board, row: number, col: number, player: Player): number {
  const key = `${row},${col}`;
  if (!X_SQUARES.has(key) && !C_SQUARES.has(key)) return 0;
  const corner =
    row <= 1 && col <= 1
      ? board[0][0]
      : row <= 1 && col >= 6
        ? board[0][7]
        : row >= 6 && col <= 1
          ? board[7][0]
          : board[7][7];
  if (corner === player) return 20;
  if (corner === EMPTY) return X_SQUARES.has(key) ? -180 : -90;
  return -40;
}

function heuristicMoveScore(board: Board, move: Move, player: Player, ply: number): number {
  const key = `${move.row},${move.col}`;
  const next = applyMove(board, move, player);
  const opponent = oppositePlayer(player);
  const ownMoves = getLegalMoves(next, player).length;
  const opponentMoves = getLegalMoves(next, opponent).length;
  const counts = countDiscs(next);
  const discDiff = player === BLACK ? counts.black - counts.white : counts.white - counts.black;

  let score = 0;
  if (CORNERS.has(key)) score += 900;
  else if (move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7) score += 45;
  score += stableCornerAdjPenalty(board, move.row, move.col, player);
  score += move.flips.length * (ply < 44 ? 2 : 7);
  score += ownMoves * 4;
  score -= opponentMoves * 10;
  if (ply >= 48) score += discDiff * 10;
  return score;
}

function staticBoardScore(board: Board, player: Player, ply: number): number {
  const counts = countDiscs(board);
  const discDiff = player === BLACK ? counts.black - counts.white : counts.white - counts.black;
  const mobility = getLegalMoves(board, player).length - getLegalMoves(board, oppositePlayer(player)).length;
  let cornerDiff = 0;
  for (const key of CORNERS) {
    const [row, col] = key.split(',').map(Number);
    if (board[row][col] === player) cornerDiff += 1;
    else if (board[row][col] === oppositePlayer(player)) cornerDiff -= 1;
  }
  return cornerDiff * 220 + mobility * 16 + discDiff * (ply >= 48 ? 12 : 2);
}

function negamax(board: Board, player: Player, depth: number, ply: number, alpha: number, beta: number): number {
  const moves = getLegalMoves(board, player);
  const opponent = oppositePlayer(player);
  const opponentMoves = getLegalMoves(board, opponent);
  if (depth <= 0 || (moves.length === 0 && opponentMoves.length === 0)) {
    return staticBoardScore(board, player, ply);
  }
  if (moves.length === 0) {
    return -negamax(board, opponent, depth - 1, ply + 1, -beta, -alpha);
  }

  let best = -Infinity;
  const ordered = moves
    .map((move) => ({ move, score: heuristicMoveScore(board, move, player, ply) }))
    .sort((a, b) => b.score - a.score);

  for (const entry of ordered) {
    const next = applyMove(board, entry.move, player);
    const value = -negamax(next, opponent, depth - 1, ply + 1, -beta, -alpha);
    if (value > best) best = value;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return best;
}

function chooseMove(board: Board, player: Player, ply: number, rng: Rng, options: SelfplayOptions): MoveChoice | null {
  const moves = getLegalMoves(board, player);
  if (moves.length === 0) return null;
  const phase = phaseForPly(ply);
  const searchDepth = searchDepthForPhase(phase, options);
  const evalDepth = Math.max(0, Math.min(searchDepth - 1, 3));
  const opponent = oppositePlayer(player);
  const scored = moves.map((move) => {
    const next = applyMove(board, move, player);
    const searchScore =
      heuristicMoveScore(board, move, player, ply) -
      (evalDepth > 0 ? negamax(next, opponent, evalDepth, ply + 1, -100000, 100000) : 0);
    return { move, searchScore };
  });
  scored.sort((a, b) => b.searchScore - a.searchScore);

  const exploration = explorationForPhase(phase, options);
  let selection: SelectionKind = 'best';
  let picked = scored[0];
  if (rng.next() < exploration && scored.length > 1) {
    const pool = scored.slice(0, Math.min(scored.length, 4));
    picked = rng.pick(pool);
    selection = 'sampled';
  }

  return {
    move: picked.move,
    phase,
    searchDepth,
    selection,
    searchScore: picked.searchScore,
    bestScore: scored[0].searchScore,
  };
}

function randomOpening(board: Board, player: Player, plies: number, rng: Rng): { board: Board; player: Player; ply: number } {
  let currentBoard = board;
  let currentPlayer = player;
  let applied = 0;
  for (let ply = 0; ply < plies; ply += 1) {
    const moves = getLegalMoves(currentBoard, currentPlayer);
    const opponent = oppositePlayer(currentPlayer);
    if (moves.length === 0) {
      if (getLegalMoves(currentBoard, opponent).length === 0) break;
      currentPlayer = opponent;
      continue;
    }
    const move = rng.pick(moves);
    currentBoard = applyMove(currentBoard, move, currentPlayer);
    currentPlayer = opponent;
    applied += 1;
  }
  return { board: currentBoard, player: currentPlayer, ply: applied };
}

function createRecord(gameIndex: number, gameSeed: number, ply: number, board: Board, player: Player, choice: MoveChoice): SelfplayRecord {
  const counts = countDiscs(board);
  const playerKey = player === BLACK ? 'black' : 'white';
  const legalMoves = getLegalMoves(board, player).length;
  const normalizedValue = Math.max(-1, Math.min(1, choice.searchScore / 400));
  return {
    schemaVersion: 'othello_selfplay.v1',
    dataLane: 'train',
    gameIndex,
    gameSeed,
    ply,
    player: playerKey,
    board: encodeBoard(board),
    legalMoves,
    actionType: 'place',
    row: choice.move.row,
    col: choice.move.col,
    phase: choice.phase,
    searchDepth: choice.searchDepth,
    selection: choice.selection,
    searchScore: choice.searchScore,
    bestScore: choice.bestScore,
    searchValue: normalizedValue,
    bestValue: normalizedValue,
    blackCountBefore: counts.black,
    whiteCountBefore: counts.white,
    emptiesBefore: counts.empty,
  };
}

function playGame(gameIndex: number, seed: number, options: SelfplayOptions): { records: SelfplayRecord[]; counts: { black: number; white: number; empty: number }; winner: Winner; plies: number } {
  const rng = createRng(seed);
  const openingMin = Math.max(0, options.openingPliesMin);
  const openingMax = Math.max(openingMin, options.openingPliesMax);
  const openingSpan = openingMax - openingMin + 1;
  let openingPlies = openingMin + rng.int(openingSpan);
  if (options.openingPreferredPlayer === 'white' && rng.next() < options.openingPreferredPlayerRate) {
    if (openingPlies % 2 === 0 && openingPlies < openingMax) openingPlies += 1;
    else if (openingPlies % 2 === 0 && openingPlies > openingMin) openingPlies -= 1;
  }

  let { board, player, ply } = randomOpening(createInitialBoard(), BLACK, openingPlies, rng);
  const records: SelfplayRecord[] = [];
  let passCount = 0;

  while (ply < options.maxPlies && passCount < 2) {
    const moves = getLegalMoves(board, player);
    if (moves.length === 0) {
      passCount += 1;
      player = oppositePlayer(player);
      ply += 1;
      continue;
    }
    passCount = 0;
    const choice = chooseMove(board, player, ply, rng, options);
    if (!choice) {
      player = oppositePlayer(player);
      ply += 1;
      continue;
    }
    records.push(createRecord(gameIndex, seed, ply, board, player, choice));
    board = applyMove(board, choice.move, player);
    player = oppositePlayer(player);
    ply += 1;
  }

  const counts = countDiscs(board);
  const blackDiff = counts.black - counts.white;
  const winner: Winner = blackDiff > 0 ? 'black' : blackDiff < 0 ? 'white' : 'draw';
  for (const record of records) {
    const finalDiscDiff = record.player === 'black' ? blackDiff : -blackDiff;
    record.outcome = finalDiscDiff / 64;
    record.finalDiscDiff = finalDiscDiff;
    record.winner = winner;
  }

  return { records, counts, winner, plies: ply };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log('Usage: node scripts/generate-othello-selfplay-data.js --games 512 --out data.ndjson --summary-out summary.json');
    process.exit(0);
  }

  const games = intArg(args, 'games', 128);
  const seed = intArg(args, 'seed', Date.now() & 0xffffffff);
  const outPath = args.out ? path.resolve(String(args.out)) : '';
  const summaryPath = args['summary-out'] ? path.resolve(String(args['summary-out'])) : '';
  if (!outPath) throw new Error('--out is required');

  const options: SelfplayOptions = {
    maxPlies: intArg(args, 'max-plies', 80),
    openingPliesMin: intArg(args, 'opening-plies-min', 0),
    openingPliesMax: intArg(args, 'opening-plies-max', 8),
    openingPreferredPlayer: String(args['opening-preferred-player'] || ''),
    openingPreferredPlayerRate: floatArg(args, 'opening-preferred-player-rate', 0),
    depthOpening: intArg(args, 'depth-opening', 2),
    depthMid: intArg(args, 'depth-mid', 2),
    depthEnd: intArg(args, 'depth-end', 3),
    exactSolveEmpties: intArg(args, 'exact-solve-empties', 8),
    explorationOpening: floatArg(args, 'exploration-opening', 0.12),
    explorationMid: floatArg(args, 'exploration-mid', 0.06),
    explorationEnd: floatArg(args, 'exploration-end', 0),
    quiet: boolArg(args, 'quiet', false),
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const stream = fs.createWriteStream(outPath, { encoding: 'utf8' });
  const wins: Record<Winner, number> = { black: 0, white: 0, draw: 0 };
  let totalRecords = 0;
  let totalPlies = 0;

  for (let gameIndex = 0; gameIndex < games; gameIndex += 1) {
    const gameSeed = (seed + Math.imul(gameIndex + 1, 2654435761)) >>> 0;
    const game = playGame(gameIndex, gameSeed, options);
    wins[game.winner] += 1;
    totalPlies += game.plies;
    totalRecords += game.records.length;
    for (const record of game.records) {
      stream.write(`${JSON.stringify(record)}\n`);
    }
    if (!options.quiet && ((gameIndex + 1) % 10 === 0 || gameIndex + 1 === games)) {
      console.log(`[othello-selfplay] progress ${gameIndex + 1}/${games} records=${totalRecords}`);
    }
  }

  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on('error', reject);
  });

  const summary = {
    schemaVersion: 'othello_selfplay_summary.v1',
    status: 'completed',
    games,
    seed,
    totalRecords,
    avgPlies: games > 0 ? totalPlies / games : 0,
    wins,
    options,
    output: outPath,
  };
  if (summaryPath) writeJson(summaryPath, summary);
  if (!options.quiet) {
    console.log(
      `[othello-selfplay] summary: totalGames=${games} avgPlies=${summary.avgPlies.toFixed(2)} wins=${JSON.stringify(wins)}`
    );
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error && typeof error === 'object' && 'stack' in error ? (error as { stack?: unknown }).stack : String(error));
    process.exit(1);
  });
}

export = {
  main
};
