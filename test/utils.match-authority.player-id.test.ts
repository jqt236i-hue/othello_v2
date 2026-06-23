describe('match authority player id projection', () => {
  let MatchAuthority: any;

  beforeEach(() => {
    jest.resetModules();
    MatchAuthority = require('../utils/match-authority');
  });

  test('buildRoomPayloadFromRoom projects public seatPlayerIds only', () => {
    const payload = MatchAuthority.buildRoomPayloadFromRoom({
      roomId: 'ABC',
      seats: { black: true, white: true },
      seatNames: { black: 'くろ', white: 'しろ' },
      seatPlayerIds: {
        black: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        white: 'p_ABCDEFGHIJKLMNOPQRSTUV0002',
        token: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
      }
    }, {
      ok: true,
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
    });

    expect(payload.seatPlayerIds).toEqual({
      black: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      white: 'p_ABCDEFGHIJKLMNOPQRSTUV0002'
    });
    expect(payload).not.toHaveProperty('playerToken');
    expect(payload).not.toHaveProperty('recoveryCode');
  });
});
