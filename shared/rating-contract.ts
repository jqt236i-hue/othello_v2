'use strict';

export const RATED_POOL_CARD_RANKED_V1 = 'card_ranked_v1' as const;
export const RATING_SYSTEM_VERSION = 1;

export const RATING_CONFIG = Object.freeze({
  pool: RATED_POOL_CARD_RANKED_V1,
  algorithm: 'glicko2',
  systemVersion: RATING_SYSTEM_VERSION,
  initialRating: 1500,
  initialDeviation: 350,
  initialVolatility: 0.06,
  tau: 0.5,
  epsilon: 0.000001,
  scale: 173.7178,
  provisionalMatches: 0,
  ratingPeriod: 'one_match',
  inactivityInflation: false
});

export type RatedPool = typeof RATED_POOL_CARD_RANKED_V1;
export type RatedResult = 'BLACK_WIN' | 'WHITE_WIN' | 'DRAW' | 'NO_CONTEST';
export type RatedSeat = 'black' | 'white';

export type PlayerRating = {
  playerId: string;
  pool: RatedPool;
  systemVersion: number;
  rating: number;
  deviation: number;
  volatility: number;
  ratedGames: number;
  wins: number;
  draws: number;
  losses: number;
  lastRatedAt: string | null;
  updatedAt: string;
};

export type RatingMatchRecord = {
  matchId: string;
  pool: RatedPool;
  systemVersion: number;
  blackPlayerId: string;
  whitePlayerId: string;
  result: Exclude<RatedResult, 'NO_CONTEST'>;
  blackBeforeRating: number;
  blackBeforeDeviation: number;
  blackBeforeVolatility: number;
  blackAfterRating: number;
  blackAfterDeviation: number;
  blackAfterVolatility: number;
  whiteBeforeRating: number;
  whiteBeforeDeviation: number;
  whiteBeforeVolatility: number;
  whiteAfterRating: number;
  whiteAfterDeviation: number;
  whiteAfterVolatility: number;
  rulesetVersion: string;
  catalogVersion: string;
  ratedAt: string;
};

export type RatingDisplayChange = {
  before: number;
  after: number;
  delta: number;
};

export type RatingPlayerHistoryResult = 'WIN' | 'LOSS' | 'DRAW';

export type RatingPlayerHistoryEntry = {
  matchId: string;
  pool: RatedPool;
  systemVersion: number;
  playerId: string;
  opponentPlayerId: string;
  side: RatedSeat;
  result: RatingPlayerHistoryResult;
  rawResult: Exclude<RatedResult, 'NO_CONTEST'>;
  beforeRating: number;
  afterRating: number;
  displayBeforeRating: number;
  displayAfterRating: number;
  displayDelta: number;
  rulesetVersion: string;
  catalogVersion: string;
  ratedAt: string;
};

export type RatingPublicProfile = {
  playerId: string;
  playerName: string;
  avatarStoneType: string;
  bio: string;
  updatedAt: string;
};

export function normalizeRatedPool(value: unknown): RatedPool | null {
  return value === RATED_POOL_CARD_RANKED_V1 ? RATED_POOL_CARD_RANKED_V1 : null;
}

export function normalizeRatedResult(value: unknown): RatedResult | null {
  if (value === 'BLACK_WIN' || value === 'WHITE_WIN' || value === 'DRAW' || value === 'NO_CONTEST') {
    return value;
  }
  return null;
}

export function createInitialPlayerRating(playerId: string, nowIso: string): PlayerRating {
  return {
    playerId,
    pool: RATED_POOL_CARD_RANKED_V1,
    systemVersion: RATING_SYSTEM_VERSION,
    rating: RATING_CONFIG.initialRating,
    deviation: RATING_CONFIG.initialDeviation,
    volatility: RATING_CONFIG.initialVolatility,
    ratedGames: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    lastRatedAt: null,
    updatedAt: nowIso
  };
}
