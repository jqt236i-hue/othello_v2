describe('player identity contract', () => {
  let Contract: any;

  beforeEach(() => {
    jest.resetModules();
    Contract = require('../shared/player-identity-contract');
  });

  test('normalizes public player IDs, private tokens, and recovery codes', () => {
    expect(Contract.normalizePlayerId(' p_ABCDEFGHIJKLMNOPQRSTUVWXYZ ')).toBe('p_ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(Contract.normalizePlayerToken('pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12')).toBe('pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12');
    expect(Contract.normalizeRecoveryCode(' cr-abcde-fghjk-mnpqr-stuvw-xyz23 ')).toBe('CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23');
  });

  test('rejects invalid identity fields', () => {
    expect(Contract.normalizePlayerId('player_alpha_0001')).toBeNull();
    expect(Contract.normalizePlayerToken('pt_short')).toBeNull();
    expect(Contract.normalizeRecoveryCode('CR-BAD')).toBeNull();
  });

  test('formats short display IDs from canonical and legacy player IDs', () => {
    expect(Contract.formatShortPlayerId('p_ABCDEFGHIJKLMNOPQRSTUV0001')).toBe('#0001');
    expect(Contract.formatShortPlayerId('player_alpha_0001')).toBe('#0001');
    expect(Contract.formatShortPlayerId('bad')).toBe('');
  });

  test('normalizes seat player IDs without accepting secrets', () => {
    expect(Contract.normalizeSeatPlayerIds({
      black: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      white: 'p_ABCDEFGHIJKLMNOPQRSTUV0002',
      token: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
    })).toEqual({
      black: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      white: 'p_ABCDEFGHIJKLMNOPQRSTUV0002'
    });
  });
});
