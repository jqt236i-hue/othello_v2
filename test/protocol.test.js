const { validateEvent, makeEvent } = require('../src/protocol/events');
const assert = require('assert');

describe('protocol/events', () => {
  it('validateEvent accepts a complete event', () => {
    const ev = makeEvent({ type: 'move', phase: 'placement', createdSeq: 1, turnIndex: 0, eventIndex: 0 });
    const res = validateEvent(ev);
    assert.strictEqual(res.ok, true);
  });

  it('validateEvent rejects missing fields', () => {
    const bad = { type: 'move' };
    const res = validateEvent(bad);
    assert.strictEqual(res.ok, false);
    assert.ok(res.reason.startsWith('missing'));
  });
});
