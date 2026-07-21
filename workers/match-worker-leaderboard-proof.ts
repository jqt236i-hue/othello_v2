'use strict';

const LeaderboardScore = require('../shared/leaderboard-score');
const PlayerIdentityContract = require('../shared/player-identity-contract');

type LeaderboardProofOptions = {
  terminal: boolean;
  debugEnabled?: boolean;
};

type LeaderboardProofResult =
  | { ok: true; status: 200; payload: Record<string, unknown> }
  | { ok: false; status: number; reason: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normalizeSeatKey(value: unknown): 'black' | 'white' | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'black' || normalized === 'white') return normalized;
  return null;
}

export function buildMatchWorkerLeaderboardProof(
  roomValue: unknown,
  bodyValue: unknown,
  optionsValue: LeaderboardProofOptions
): LeaderboardProofResult {
  const room = asRecord(roomValue);
  const body = asRecord(bodyValue);
  const options = optionsValue || { terminal: false };
  const playerId = PlayerIdentityContract.normalizePlayerId(body.playerId);
  const seatKey = normalizeSeatKey(body.seatKey);
  if (!playerId || !seatKey) {
    return { ok: false, status: 400, reason: 'LEADERBOARD_AUTHORITY_CONTEXT_REQUIRED' };
  }

  const seats = asRecord(room.seats);
  const seatPlayerIds = asRecord(room.seatPlayerIds);
  if (seats[seatKey] !== true || PlayerIdentityContract.normalizePlayerId(seatPlayerIds[seatKey]) !== playerId) {
    return { ok: false, status: 403, reason: 'LEADERBOARD_SEAT_IDENTITY_MISMATCH' };
  }
  if (options.terminal !== true) {
    return { ok: false, status: 409, reason: 'MATCH_NOT_FINISHED' };
  }
  if (options.debugEnabled === true) {
    return { ok: false, status: 400, reason: 'SCORE_INELIGIBLE' };
  }

  const snapshot = asRecord(room.snapshot);
  const gameState = asRecord(snapshot.gameState);
  const cardState = asRecord(snapshot.cardState);
  if (!LeaderboardScore.isStandardLeaderboardBoard(gameState)) {
    return { ok: false, status: 400, reason: 'BOARD_NOT_ELIGIBLE' };
  }

  const summary = LeaderboardScore.buildLeaderboardScoreSummaryFromState(gameState, cardState, seatKey);
  return {
    ok: true,
    status: 200,
    payload: {
      ok: true,
      authorityVerified: true,
      authoritySource: 'match_room',
      matchId: String(room.roomId || '').trim(),
      stateVersion: Number.isFinite(Number(room.stateVersion)) ? Math.max(0, Math.trunc(Number(room.stateVersion))) : 0,
      playerId,
      category: 'score',
      mode: 'network',
      score: summary.total,
      scoreVersion: summary.version,
      turnCount: summary.turnCount,
      boardConfig: LeaderboardScore.resolveLeaderboardBoardConfig(gameState),
      debug: false
    }
  };
}
