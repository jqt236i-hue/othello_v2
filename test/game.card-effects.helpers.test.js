const helpers = require('../game/card-effects/helpers');

describe('game card effect helpers', () => {
  beforeEach(() => {
    global.BLACK = 1;
    global.WHITE = -1;
    global.cardState = { markers: [] };
  });

  afterEach(() => {
    delete global.BLACK;
    delete global.WHITE;
    delete global.cardState;
  });

  test('getPlayerKey normalizes padded uppercase values', () => {
    expect(helpers.getPlayerKey(' BLACK ')).toBe('black');
    expect(helpers.getPlayerKey(' WHITE ')).toBe('white');
    expect(helpers.getPlayerKey(-1)).toBe('white');
  });

  test('getPlayerDisplayName and getOwner follow normalized key', () => {
    expect(helpers.getPlayerDisplayName(' BLACK ')).toBe('黒');
    expect(helpers.getPlayerDisplayName(' WHITE ')).toBe('白');
    expect(helpers.getOwner(' BLACK ')).toBe(global.BLACK);
    expect(helpers.getOwner(' WHITE ')).toBe(global.WHITE);
  });
});
