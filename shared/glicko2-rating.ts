'use strict';

import {
  PlayerRating,
  RatedResult,
  RatingDisplayChange,
  RATING_CONFIG
} from './rating-contract';

export type Glicko2PairUpdateInput = {
  black: PlayerRating;
  white: PlayerRating;
  result: Exclude<RatedResult, 'NO_CONTEST'>;
  ratedAt: string;
};

export type Glicko2PairUpdateResult = {
  black: PlayerRating;
  white: PlayerRating;
  blackDisplay: RatingDisplayChange;
  whiteDisplay: RatingDisplayChange;
};

function scoreFor(result: Exclude<RatedResult, 'NO_CONTEST'>, seat: 'black' | 'white'): number {
  if (result === 'DRAW') return 0.5;
  if (result === 'BLACK_WIN') return seat === 'black' ? 1 : 0;
  return seat === 'white' ? 1 : 0;
}

function toMu(rating: number): number {
  return (rating - RATING_CONFIG.initialRating) / RATING_CONFIG.scale;
}

function toPhi(deviation: number): number {
  return deviation / RATING_CONFIG.scale;
}

function fromMu(mu: number): number {
  return (RATING_CONFIG.scale * mu) + RATING_CONFIG.initialRating;
}

function fromPhi(phi: number): number {
  return RATING_CONFIG.scale * phi;
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expected(mu: number, opponentMu: number, opponentPhi: number): number {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

function calculateNewVolatility(phi: number, volatility: number, v: number, delta: number): number {
  const tau = RATING_CONFIG.tau;
  const epsilon = RATING_CONFIG.epsilon;
  const a = Math.log(volatility * volatility);

  function f(x: number): number {
    const expX = Math.exp(x);
    const numerator = expX * (delta * delta - phi * phi - v - expX);
    const denominator = 2 * Math.pow(phi * phi + v + expX, 2);
    return (numerator / denominator) - ((x - a) / (tau * tau));
  }

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > epsilon) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

function updateOne(
  player: PlayerRating,
  opponent: PlayerRating,
  resultScore: number,
  ratedAt: string,
  outcome: 'win' | 'draw' | 'loss'
): PlayerRating {
  const mu = toMu(player.rating);
  const phi = toPhi(player.deviation);
  const opponentMu = toMu(opponent.rating);
  const opponentPhi = toPhi(opponent.deviation);
  const opponentG = g(opponentPhi);
  const e = expected(mu, opponentMu, opponentPhi);
  const v = 1 / (opponentG * opponentG * e * (1 - e));
  const delta = v * opponentG * (resultScore - e);
  const nextVolatility = calculateNewVolatility(phi, player.volatility, v, delta);
  const phiStar = Math.sqrt(phi * phi + nextVolatility * nextVolatility);
  const nextPhi = 1 / Math.sqrt((1 / (phiStar * phiStar)) + (1 / v));
  const nextMu = mu + (nextPhi * nextPhi * opponentG * (resultScore - e));

  return {
    ...player,
    rating: fromMu(nextMu),
    deviation: fromPhi(nextPhi),
    volatility: nextVolatility,
    ratedGames: player.ratedGames + 1,
    wins: player.wins + (outcome === 'win' ? 1 : 0),
    draws: player.draws + (outcome === 'draw' ? 1 : 0),
    losses: player.losses + (outcome === 'loss' ? 1 : 0),
    lastRatedAt: ratedAt,
    updatedAt: ratedAt
  };
}

export function toDisplayRatingChange(beforeRating: number, afterRating: number): RatingDisplayChange {
  const before = Math.round(beforeRating);
  const after = Math.round(afterRating);
  return { before, after, delta: after - before };
}

export function computeGlicko2PairUpdate(input: Glicko2PairUpdateInput): Glicko2PairUpdateResult {
  const blackScore = scoreFor(input.result, 'black');
  const whiteScore = scoreFor(input.result, 'white');
  const blackOutcome = blackScore === 1 ? 'win' : blackScore === 0.5 ? 'draw' : 'loss';
  const whiteOutcome = whiteScore === 1 ? 'win' : whiteScore === 0.5 ? 'draw' : 'loss';
  const black = updateOne(input.black, input.white, blackScore, input.ratedAt, blackOutcome);
  const white = updateOne(input.white, input.black, whiteScore, input.ratedAt, whiteOutcome);

  return {
    black,
    white,
    blackDisplay: toDisplayRatingChange(input.black.rating, black.rating),
    whiteDisplay: toDisplayRatingChange(input.white.rating, white.rating)
  };
}
