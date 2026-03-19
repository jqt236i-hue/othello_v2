const MatchAuthority = require('../utils/match-authority');

describe('match authority publish response payload', () => {
  test('normalizes publishMeta and preserves room context', () => {
    const payload = MatchAuthority.buildPublishResponsePayload({
      ok: false,
      roomId: 'abc',
      stateVersion: '12',
      snapshot: { stateVersion: 12, gameState: {}, cardState: {} },
      seats: { black: true, white: false },
      seatNames: { black: 'くろ', white: '' },
      roomDeck: null,
      networkDebugEnabled: true,
      turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black' },
      serverTime: 12345,
      rejectedReason: 'VERSION_MISMATCH',
      publishMeta: {
        kind: 'REJECTED',
        operationId: ' op_same_turn ',
        actionType: 'PLACE',
        receivedBaseVersion: '11',
        authoritativeStateVersion: '12',
        rejectedReason: 'VERSION_MISMATCH'
      }
    });

    expect(payload).toEqual(expect.objectContaining({
      ok: false,
      roomId: 'ABC',
      stateVersion: 12,
      rejectedReason: 'VERSION_MISMATCH',
      networkDebugEnabled: true,
      serverTime: 12345,
      publishMeta: {
        kind: 'rejected',
        operationId: 'op_same_turn',
        actionType: 'place',
        receivedBaseVersion: 11,
        authoritativeStateVersion: 12,
        replayedStateVersion: null,
        rejectedReason: 'VERSION_MISMATCH'
      }
    }));
  });

  test('omits empty publishMeta payloads', () => {
    const payload = MatchAuthority.buildPublishResponsePayload({
      ok: true,
      roomId: 'ABC',
      stateVersion: 5,
      snapshot: { stateVersion: 5, gameState: {}, cardState: {} },
      seats: { black: true, white: true },
      seatNames: { black: 'くろ', white: 'しろ' },
      roomDeck: null,
      networkDebugEnabled: false,
      turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black' },
      serverTime: 999,
      publishMeta: {}
    });

    expect(payload.publishMeta).toBeUndefined();
  });
});
