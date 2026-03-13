const OwnerHelpers = require('../utils/owner-helpers.js');

describe('OwnerHelpers network seat helpers', () => {
  test('normalizePlayerKey normalizes white/black variants', () => {
    expect(OwnerHelpers.normalizePlayerKey('white')).toBe('white');
    expect(OwnerHelpers.normalizePlayerKey(-1)).toBe('white');
    expect(OwnerHelpers.normalizePlayerKey('black')).toBe('black');
    expect(OwnerHelpers.normalizePlayerKey(1)).toBe('black');
  });

  test('normalizePlayerKey normalizes case and whitespace variants', () => {
    expect(OwnerHelpers.normalizePlayerKey(' WHITE ')).toBe('white');
    expect(OwnerHelpers.normalizePlayerKey(' Black ')).toBe('black');
    expect(OwnerHelpers.normalizePlayerKey(' -1 ')).toBe('white');
    expect(OwnerHelpers.normalizePlayerKey(' +1 ')).toBe('black');
  });

  test('normalizePlayerKey falls back to provided fallback seat', () => {
    expect(OwnerHelpers.normalizePlayerKey('unknown', 'white')).toBe('white');
    expect(OwnerHelpers.normalizePlayerKey(null, 'black')).toBe('black');
  });

  test('normalizePlayerKeyOptional returns null instead of forcing fallback', () => {
    expect(OwnerHelpers.normalizePlayerKeyOptional(' WHITE ')).toBe('white');
    expect(OwnerHelpers.normalizePlayerKeyOptional(' +1 ')).toBe('black');
    expect(OwnerHelpers.normalizePlayerKeyOptional('unknown')).toBeNull();
    expect(OwnerHelpers.normalizePlayerKeyOptional(null)).toBeNull();
  });

  test('resolveLocalPlayerKey prioritizes NetworkMatchClient seat', () => {
    const root = {
      LOCAL_PLAYER_KEY: 'black',
      BOARD_VIEWER_KEY: 'black',
      NetworkMatchClient: {
        getSeatKey: () => 'white'
      }
    };
    expect(OwnerHelpers.resolveLocalPlayerKey(root)).toBe('white');
  });

  test('resolveLocalPlayerKey falls back to direct globals in order', () => {
    expect(OwnerHelpers.resolveLocalPlayerKey({ LOCAL_PLAYER_KEY: 'white' })).toBe('white');
    expect(OwnerHelpers.resolveLocalPlayerKey({ __LOCAL_PLAYER_KEY: 'white' })).toBe('white');
    expect(OwnerHelpers.resolveLocalPlayerKey({ BOARD_VIEWER_KEY: 'white' })).toBe('white');
    expect(OwnerHelpers.resolveLocalPlayerKey({})).toBe('black');
  });

  test('isNetworkMode reflects current mode getter/fallback', () => {
    expect(OwnerHelpers.isNetworkMode({ getCurrentMatchMode: () => 'network' })).toBe(true);
    expect(OwnerHelpers.isNetworkMode({ MATCH_MODE: 'network' })).toBe(true);
    expect(OwnerHelpers.isNetworkMode({ MATCH_MODE: 'cpu' })).toBe(false);
  });
});
