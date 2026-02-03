const path = require('path');

describe('constants unification', () => {
  test('src/shared-constants is a shim to root shared-constants', () => {
    const root = require(path.resolve(__dirname, '..', 'shared-constants.js'));
    const shim = require(path.resolve(__dirname, '..', 'src', 'shared-constants.js'));

    // The shim should export the same object (or equivalent keys)
    expect(shim.BOARD_SIZE).toBe(root.BOARD_SIZE);
    expect(shim.HAND_LIMIT).toBe(root.HAND_LIMIT);
    expect(shim.DEFAULT_DECK).toEqual(root.DEFAULT_DECK);
  });

  test('constants defined as expected', () => {
    const constants = require(path.resolve(__dirname, '..', 'src', 'shared-constants.js'));
    expect(constants.BOARD_SIZE).toBe(8);
    expect(constants.HAND_LIMIT).toBeGreaterThan(0);
    expect(constants.DEFAULT_DECK).toBeDefined();
  });
});