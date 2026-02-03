const { run, defaultRng } = require('../src/engine/engine');
const assert = require('assert');

describe('engine determinism', () => {
  it('same seed + same actions -> identical state and events', () => {
    const actions = [ { type: 'place', playerId: 1 }, { type: 'pass', playerId: 2 } ];
    const r1 = run(12345, actions, { rng: (seed) => defaultRng(seed) });
    const r2 = run(12345, actions, { rng: (seed) => defaultRng(seed) });
    assert.deepStrictEqual(r1, r2);
  });

  it('different seeds produce different results (very likely)', () => {
    const actions = [ { type: 'place', playerId: 1 } ];
    const r1 = run(1, actions, { rng: (seed) => defaultRng(seed) });
    const r2 = run(2, actions, { rng: (seed) => defaultRng(seed) });
    // not a strict requirement for determinism but a sanity check
    assert.notDeepStrictEqual(r1, r2);
  });
});
