// Minimal deterministic engine for tests
// Accepts injected RNG via opts.rng(seed) or uses JS Math.random as fallback

const { makeEvent } = require('../protocol/events');

function defaultRng(seed) {
  // simple LCGRNG for deterministic tests (not cryptographic)
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function run(seed, actions, opts = {}) {
  const rng = (opts.rng && typeof opts.rng === 'function') ? opts.rng(seed) : defaultRng(seed);
  // initial state minimal
  let state = { seed: seed, turn: 0, log: [] };
  const events = [];
  let seq = 0;
  for (const action of actions) {
    // produce an event reflecting the action; incorporate RNG to show determinism
    const r = Math.floor(rng() * 1000);
    const ev = makeEvent({
      type: `applied:${action.type}`,
      phase: 'action',
      targets: action.targets || [],
      createdSeq: seq++,
      turnIndex: state.turn,
      eventIndex: seq - 1,
      meta: { playerId: action.playerId, randomness: r }
    });
    events.push(ev);
    state.log.push({ actionType: action.type, randomness: r });
    // simple deterministic state update
    state.turn += 1;
  }
  return { state, events };
}

module.exports = { run, defaultRng };
