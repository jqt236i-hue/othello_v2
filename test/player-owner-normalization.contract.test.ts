import * as PlayerSeatContract from '../shared/player-seat-contract';

const PlayerEncoding = require('../shared/player-encoding');
const OwnerHelpers = require('../utils/owner-helpers');
const MatchAuthority = require('../utils/match-authority');

type MatrixRow = {
  label: string;
  value: unknown;
  strict: 'black' | 'white' | null;
  optional: 'black' | 'white' | null;
  fallbackWhite: 'black' | 'white';
};

const NORMALIZATION_MATRIX: MatrixRow[] = [
  { label: 'canonical black', value: 'black', strict: 'black', optional: 'black', fallbackWhite: 'black' },
  { label: 'canonical white', value: 'white', strict: 'white', optional: 'white', fallbackWhite: 'white' },
  { label: 'trimmed case-insensitive black', value: ' Black ', strict: null, optional: 'black', fallbackWhite: 'black' },
  { label: 'trimmed case-insensitive white', value: ' WHITE ', strict: null, optional: 'white', fallbackWhite: 'white' },
  { label: 'numeric black', value: 1, strict: 'black', optional: 'black', fallbackWhite: 'black' },
  { label: 'numeric white', value: -1, strict: 'white', optional: 'white', fallbackWhite: 'white' },
  { label: 'numeric-string black', value: '1', strict: 'black', optional: 'black', fallbackWhite: 'black' },
  { label: 'numeric-string white', value: '-1', strict: 'white', optional: 'white', fallbackWhite: 'white' },
  { label: 'positive numeric-string black', value: ' +1 ', strict: null, optional: 'black', fallbackWhite: 'black' },
  { label: 'short black alias remains invalid', value: 'b', strict: null, optional: null, fallbackWhite: 'white' },
  { label: 'short white alias remains invalid', value: 'w', strict: null, optional: null, fallbackWhite: 'white' },
  { label: 'zero remains invalid', value: 0, strict: null, optional: null, fallbackWhite: 'white' },
  { label: 'empty string remains invalid', value: ' ', strict: null, optional: null, fallbackWhite: 'white' },
  { label: 'null remains invalid', value: null, strict: null, optional: null, fallbackWhite: 'white' },
  { label: 'undefined remains invalid', value: undefined, strict: null, optional: null, fallbackWhite: 'white' },
  { label: 'unknown string remains invalid', value: 'spectator', strict: null, optional: null, fallbackWhite: 'white' }
];

describe('player/owner normalization contract', () => {
  test.each(NORMALIZATION_MATRIX)('$label preserves strict parsing semantics', ({ value, strict }) => {
    expect(PlayerSeatContract.parsePlayerSeatKeyStrict(value)).toBe(strict);
  });

  test.each(NORMALIZATION_MATRIX)('$label preserves optional parsing semantics', ({ value, optional }) => {
    expect(PlayerSeatContract.parsePlayerSeatKey(value)).toBe(optional);
    expect(PlayerEncoding.parseSeatKeyOptional(value)).toBe(optional);
    expect(OwnerHelpers.parseSeatKeyOptional(value)).toBe(optional);
    expect(MatchAuthority.parseSeatKeyOptional(value)).toBe(optional);
  });

  test.each(NORMALIZATION_MATRIX)('$label preserves explicit fallback semantics', ({ value, fallbackWhite }) => {
    expect(PlayerSeatContract.normalizePlayerSeatKey(value, 'white')).toBe(fallbackWhite);
    expect(PlayerEncoding.normalizePlayerKey(value, 'white')).toBe(fallbackWhite);
    expect(OwnerHelpers.normalizePlayerKey(value, 'white')).toBe(fallbackWhite);
    expect(MatchAuthority.normalizePlayerKey(value, 'white')).toBe(fallbackWhite);
  });

  test('keeps exact-key validation and numeric codecs distinct from permissive parsing', () => {
    expect(PlayerSeatContract.isCanonicalPlayerSeatKey('black')).toBe(true);
    expect(PlayerSeatContract.isCanonicalPlayerSeatKey('white')).toBe(true);
    expect(PlayerSeatContract.isCanonicalPlayerSeatKey(' BLACK ')).toBe(false);
    expect(PlayerSeatContract.playerSeatKeyToValue('black', 1, -1)).toBe(1);
    expect(PlayerSeatContract.playerSeatKeyToValue('white', 1, -1)).toBe(-1);
    expect(PlayerSeatContract.playerSeatValueToKey(1, 1)).toBe('black');
    expect(PlayerSeatContract.playerSeatValueToKey(-1, 1)).toBe('white');
    expect(PlayerSeatContract.parsePlayerSeatKeyWithShortAliases('b')).toBe('black');
    expect(PlayerSeatContract.parsePlayerSeatKeyWithShortAliases(' W ')).toBe('white');
    expect(PlayerSeatContract.parsePlayerSeatKeyWithShortAliases('spectator')).toBeNull();
  });
});
