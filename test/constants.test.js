const constants = require('../src/shared-constants');
const assert = require('assert');

describe('shared-constants', () => {
  it('exports basic constants', () => {
    assert.strictEqual(constants.BOARD_SIZE, 8);
    assert.strictEqual(constants.HAND_LIMIT > 0, true);
    assert.ok(Array.isArray(constants.DEFAULT_DECK));
  });
});
