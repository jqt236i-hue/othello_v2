'use strict';

import SharedBoardUtilsImport = require('./shared-board-utils');

const SharedBoardUtils: any = SharedBoardUtilsImport;
if (!SharedBoardUtils || typeof SharedBoardUtils.countStateDiscs !== 'function') {
  throw new Error('SharedBoardUtils.countStateDiscs is required by LeaderboardScore');
}

type LeaderboardPlayerKey = 'black' | 'white';
type LeaderboardOutcome = 'win' | 'lose' | 'draw';

type LeaderboardCounts = {
  black: number;
  white: number;
};

type LeaderboardScoreInput = {
  counts: LeaderboardCounts;
  playerKey: unknown;
  localOutcomeKey?: unknown;
  turnCount?: unknown;
  flipTotals?: unknown;
  localFlipCount?: unknown;
  debugSuppressed?: boolean;
};

type LeaderboardSupportBreakdown = {
  readonly flipBonus: number;
  readonly ownDiscBonus: number;
  readonly total: number;
};

const SCORE_CONFIG = Object.freeze({
  version: 5,
  winBase: 5000,
  drawBase: 2000,
  loseBase: 0,
  speedBase: 2500,
  speedStartTurn: 0,
  speedZeroTurn: 100,
  monoBonus: 1500,
  supportMax: 3000,
  supportFlipMax: 1500,
  supportFlipTargetCount: 150,
  supportOwnDiscMax: 1500,
  supportOwnDiscTargetCount: 76,
  theoreticalMax: 12000
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function toFiniteInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function toNonNegativeInteger(value: unknown): number {
  return Math.max(0, toFiniteInteger(value, 0));
}

function normalizePlayerKey(value: unknown): LeaderboardPlayerKey {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'white' || normalized === 'w' || normalized === '-1'
    ? 'white'
    : 'black';
}

function normalizeBoardOwner(value: unknown): LeaderboardPlayerKey | null {
  if (value === 1 || value === '1') return 'black';
  if (value === -1 || value === '-1') return 'white';
  const source = asRecord(value);
  if (source.owner !== undefined) return normalizeBoardOwner(source.owner);
  if (source.player !== undefined) return normalizeBoardOwner(source.player);
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'black' || normalized === 'b') return 'black';
  if (normalized === 'white' || normalized === 'w') return 'white';
  return null;
}

function countLeaderboardDiscs(boardValue: unknown): LeaderboardCounts {
  const board = Array.isArray(boardValue) ? boardValue : [];
  const counts: LeaderboardCounts = { black: 0, white: 0 };
  for (const row of board) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      const owner = normalizeBoardOwner(cell);
      if (owner) counts[owner] += 1;
    }
  }
  return counts;
}

function resolveLeaderboardTurnCount(gameStateValue: unknown, cardStateValue: unknown): number {
  const gameState = asRecord(gameStateValue);
  const cardState = asRecord(cardStateValue);
  const perPlayer = asRecord(cardState.turnCountByPlayer);
  const blackTurns = toNonNegativeInteger(perPlayer.black);
  const whiteTurns = toNonNegativeInteger(perPlayer.white);
  const totalTurns = blackTurns + whiteTurns;
  if (totalTurns > 0) return totalTurns;

  const turnIndex = toNonNegativeInteger(cardState.turnIndex);
  if (turnIndex > 0) return turnIndex;

  if (Number.isFinite(Number(gameState.turnNumber))) {
    return toNonNegativeInteger(Number(gameState.turnNumber) + 1);
  }
  return 0;
}

function resolveLeaderboardBoardConfig(gameStateValue: unknown): Record<string, unknown> {
  const gameState = asRecord(gameStateValue);
  const rawConfig = asRecord(gameState.boardConfig);
  const board = Array.isArray(gameState.board) ? gameState.board : [];
  const boardRows = board.length;
  let boardCols = 0;
  for (const row of board) {
    if (Array.isArray(row)) boardCols = Math.max(boardCols, row.length);
  }
  const rows = Number.isFinite(Number(rawConfig.rows))
    ? toNonNegativeInteger(rawConfig.rows)
    : boardRows;
  const cols = Number.isFinite(Number(rawConfig.cols))
    ? toNonNegativeInteger(rawConfig.cols)
    : boardCols;
  const shape = String(rawConfig.shape || 'rectangle').trim().toLowerCase() || 'rectangle';
  const standard8x8 = rawConfig.standard8x8 !== false
    && rows === 8
    && cols === 8
    && shape === 'rectangle';
  return Object.freeze({ rows, cols, shape, standard8x8 });
}

function isStandardLeaderboardBoard(gameStateValue: unknown): boolean {
  return resolveLeaderboardBoardConfig(gameStateValue).standard8x8 === true;
}

function resolveOutcome(counts: LeaderboardCounts, playerKey: LeaderboardPlayerKey, value: unknown): LeaderboardOutcome {
  if (value === 'win' || value === 'lose' || value === 'draw') return value;
  const own = playerKey === 'black' ? counts.black : counts.white;
  const opponent = playerKey === 'black' ? counts.white : counts.black;
  if (own > opponent) return 'win';
  if (own < opponent) return 'lose';
  return 'draw';
}

function computeResultBaseBonus(outcome: LeaderboardOutcome): number {
  if (outcome === 'win') return SCORE_CONFIG.winBase;
  if (outcome === 'draw') return SCORE_CONFIG.drawBase;
  return SCORE_CONFIG.loseBase;
}

function computeSpeedBonus(turnCountValue: unknown): number {
  const turnCount = toNonNegativeInteger(turnCountValue);
  if (turnCount <= SCORE_CONFIG.speedStartTurn) return SCORE_CONFIG.speedBase;
  if (turnCount >= SCORE_CONFIG.speedZeroTurn) return 0;
  const range = Math.max(1, SCORE_CONFIG.speedZeroTurn - SCORE_CONFIG.speedStartTurn);
  return Math.max(0, Math.floor((SCORE_CONFIG.speedBase * (SCORE_CONFIG.speedZeroTurn - turnCount)) / range));
}

function computeSupportComponentBonus(rawCount: unknown, targetCount: unknown, maxBonus: unknown): number {
  const count = toNonNegativeInteger(rawCount);
  const target = Math.max(1, toNonNegativeInteger(targetCount));
  const cap = toNonNegativeInteger(maxBonus);
  if (cap === 0) return 0;
  return Math.min(cap, Math.floor((count * cap) / target));
}

function computeSupportBreakdown(localDiscCount: unknown, localFlipCount: unknown): LeaderboardSupportBreakdown {
  const flipBonus = computeSupportComponentBonus(
    localFlipCount,
    SCORE_CONFIG.supportFlipTargetCount,
    SCORE_CONFIG.supportFlipMax
  );
  const ownDiscBonus = computeSupportComponentBonus(
    localDiscCount,
    SCORE_CONFIG.supportOwnDiscTargetCount,
    SCORE_CONFIG.supportOwnDiscMax
  );
  return Object.freeze({
    flipBonus,
    ownDiscBonus,
    total: Math.min(SCORE_CONFIG.supportMax, flipBonus + ownDiscBonus)
  });
}

function computeLeaderboardScoreSummary(inputValue: LeaderboardScoreInput) {
  const input = inputValue || {} as LeaderboardScoreInput;
  const counts: LeaderboardCounts = {
    black: toNonNegativeInteger(input.counts && input.counts.black),
    white: toNonNegativeInteger(input.counts && input.counts.white)
  };
  const playerKey = normalizePlayerKey(input.playerKey);
  const opponentKey: LeaderboardPlayerKey = playerKey === 'black' ? 'white' : 'black';
  const outcome = resolveOutcome(counts, playerKey, input.localOutcomeKey);
  const turnCount = toNonNegativeInteger(input.turnCount);
  const flipTotals = asRecord(input.flipTotals);
  const localFlipCount = input.localFlipCount !== undefined
    ? toNonNegativeInteger(input.localFlipCount)
    : toNonNegativeInteger(flipTotals[playerKey]);
  const debugSuppressed = input.debugSuppressed === true;

  const baseBonus = computeResultBaseBonus(outcome);
  let speedBonus = 0;
  let monoBonus = 0;
  let supportBreakdown: LeaderboardSupportBreakdown = Object.freeze({
    flipBonus: 0,
    ownDiscBonus: 0,
    total: 0
  });
  if (!debugSuppressed && outcome === 'win') {
    speedBonus = computeSpeedBonus(turnCount);
    monoBonus = counts[opponentKey] === 0 ? SCORE_CONFIG.monoBonus : 0;
    supportBreakdown = computeSupportBreakdown(counts[playerKey], localFlipCount);
  }
  const supportBonus = supportBreakdown.total;
  const total = debugSuppressed ? 0 : baseBonus + speedBonus + monoBonus + supportBonus;

  return Object.freeze({
    version: SCORE_CONFIG.version,
    total,
    baseBonus: debugSuppressed ? 0 : baseBonus,
    speedBonus,
    monoBonus,
    supportBonus,
    supportBreakdown,
    turnCount,
    localOutcomeKey: outcome,
    localKey: playerKey,
    localDiscCount: counts[playerKey],
    opponentDiscCount: counts[opponentKey],
    theoreticalMax: SCORE_CONFIG.theoreticalMax
  });
}

function buildLeaderboardScoreSummaryFromState(gameStateValue: unknown, cardStateValue: unknown, playerKeyValue: unknown) {
  const gameState = asRecord(gameStateValue);
  const cardState = asRecord(cardStateValue);
  return computeLeaderboardScoreSummary({
    counts: SharedBoardUtils.countStateDiscs(gameState, cardState),
    playerKey: playerKeyValue,
    turnCount: resolveLeaderboardTurnCount(gameState, cardState),
    flipTotals: cardState.totalFlipCountByPlayer
  });
}

export = {
  SCORE_CONFIG,
  countLeaderboardDiscs,
  resolveLeaderboardTurnCount,
  resolveLeaderboardBoardConfig,
  isStandardLeaderboardBoard,
  computeResultBaseBonus,
  computeSpeedBonus,
  computeSupportComponentBonus,
  computeSupportBreakdown,
  computeLeaderboardScoreSummary,
  buildLeaderboardScoreSummaryFromState
};
