import {
  computeGlicko2PairUpdate,
  toDisplayRatingChange
} from '../shared/glicko2-rating';
import { createInitialPlayerRating } from '../shared/rating-contract';

describe('glicko2 rated pair update', () => {
  const nowIso = '2026-06-25T00:00:00.000Z';

  test('new player win is displayed as about 1662 vs 1338', () => {
    const black = createInitialPlayerRating('black-player', nowIso);
    const white = createInitialPlayerRating('white-player', nowIso);

    const result = computeGlicko2PairUpdate({ black, white, result: 'BLACK_WIN', ratedAt: nowIso });

    expect(Math.round(result.black.rating)).toBe(1662);
    expect(Math.round(result.white.rating)).toBe(1338);
    expect(result.black.deviation).toBeCloseTo(290.319, 3);
    expect(result.white.deviation).toBeCloseTo(290.319, 3);
  });

  test('new player draw keeps displayed rating at 1500', () => {
    const black = createInitialPlayerRating('black-player', nowIso);
    const white = createInitialPlayerRating('white-player', nowIso);

    const result = computeGlicko2PairUpdate({ black, white, result: 'DRAW', ratedAt: nowIso });

    expect(Math.round(result.black.rating)).toBe(1500);
    expect(Math.round(result.white.rating)).toBe(1500);
  });

  test('display delta is after rounded rating minus before rounded rating', () => {
    const change = toDisplayRatingChange(1500, 1662.3109);

    expect(change).toEqual({ before: 1500, after: 1662, delta: 162 });
  });
});
