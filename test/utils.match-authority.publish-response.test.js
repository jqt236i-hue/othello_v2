const MatchAuthority = require('../utils/match-authority');

describe('match authority publish response payload', () => {
  test('normalizes publishMeta and preserves room context', () => {
    const playbackEvents = [{ type: 'observer_bubble', phase: 2, targets: [{ player: 'black', text: 'ok' }] }];
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
      playbackEvents,
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
      playbackEvents,
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

  test('buildPublicSnapshot adds authority metadata for viewer-projected snapshots', () => {
    const snapshot = MatchAuthority.buildPublicSnapshot({
      stateVersion: 7,
      updatedAt: 1234,
      snapshot: {
        gameState: {},
        cardState: {
          hands: {
            black: ['b1'],
            white: ['w1']
          }
        }
      }
    }, 'white');

    expect(snapshot._meta).toEqual({
      authority: 'server',
      version: 7,
      projectedForSeat: 'white',
      turnStartReconciled: true
    });
    expect(snapshot.stateVersion).toBe(7);
    expect(snapshot.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);
    expect(snapshot.cardState.hands.white).toEqual(['w1']);
  });

  test('classifies version rejection reasons by received vs authoritative version', () => {
    expect(MatchAuthority.classifyVersionRejectionReason(10, 11)).toBe('VERSION_AHEAD');
    expect(MatchAuthority.classifyVersionRejectionReason(12, 11)).toBe('VERSION_BEHIND');
    expect(MatchAuthority.classifyVersionRejectionReason(null, 11)).toBe('VERSION_GAP');
    expect(MatchAuthority.classifyVersionRejectionReason(11, 11)).toBe('VERSION_MISMATCH');
    expect(MatchAuthority.isVersionRejectionReason('VERSION_AHEAD')).toBe(true);
    expect(MatchAuthority.isVersionRejectionReason('VERSION_BEHIND')).toBe(true);
    expect(MatchAuthority.isVersionRejectionReason('VERSION_GAP')).toBe(true);
    expect(MatchAuthority.isVersionRejectionReason('OTHER')).toBe(false);
  });

  test('tracks recent accepted operations without losing lastAccepted compatibility', () => {
    const room = {
      lastAcceptedOperationBySeat: {
        black: { operationId: 'op_black_1', stateVersion: 1, updatedAt: 10 },
        white: null
      }
    };

    expect(MatchAuthority.findAcceptedOperationBySeat(room, 'black', 'op_black_1')).toEqual({
      operationId: 'op_black_1',
      stateVersion: 1,
      updatedAt: 10
    });

    MatchAuthority.rememberAcceptedOperationBySeat(room, 'black', {
      operationId: 'op_black_2',
      stateVersion: 3,
      updatedAt: 30
    });

    expect(MatchAuthority.findAcceptedOperationBySeat(room, 'black', 'op_black_1')).toEqual({
      operationId: 'op_black_1',
      stateVersion: 1,
      updatedAt: 10
    });
    expect(MatchAuthority.findAcceptedOperationBySeat(room, 'black', 'op_black_2')).toEqual({
      operationId: 'op_black_2',
      stateVersion: 3,
      updatedAt: 30
    });
    expect(room.acceptedOperationHistoryBySeat.black.map((entry) => entry.operationId)).toEqual(['op_black_1', 'op_black_2']);
    expect(room.lastAcceptedOperationBySeat.black).toEqual({
      operationId: 'op_black_2',
      stateVersion: 3,
      updatedAt: 30
    });
  });

  test('replays buffered SSE events after Last-Event-ID with viewer-specific snapshots', () => {
    let buffer = [];
    buffer = MatchAuthority.appendBufferedSseEvent(buffer, {
      eventId: 'ROOM_1_1',
      eventName: 'heartbeat',
      payload: { roomId: 'ROOM', stateVersion: 1 }
    });
    buffer = MatchAuthority.appendBufferedSseEvent(buffer, {
      eventId: 'ROOM_2_2',
      eventName: 'snapshot',
      payloadByViewer: {
        black: { roomId: 'ROOM', stateVersion: 2, snapshot: { stateVersion: 2, cardState: { hands: { black: ['b1'], white: ['__hidden_hand__:white:0'] } } } },
        white: { roomId: 'ROOM', stateVersion: 2, snapshot: { stateVersion: 2, cardState: { hands: { black: ['__hidden_hand__:black:0'], white: ['w1'] } } } }
      }
    });

    const replay = MatchAuthority.getBufferedSseReplayEvents(buffer, 'ROOM_1_1', 'white');
    expect(replay).toEqual([
      {
        eventId: 'ROOM_2_2',
        eventName: 'snapshot',
        payload: {
          roomId: 'ROOM',
          stateVersion: 2,
          snapshot: {
            stateVersion: 2,
            cardState: {
              hands: {
                black: ['__hidden_hand__:black:0'],
                white: ['w1']
              }
            }
          }
        }
      }
    ]);
  });

  test('returns null when Last-Event-ID is not in the buffer', () => {
    const buffer = MatchAuthority.appendBufferedSseEvent([], {
      eventId: 'ROOM_5_8',
      eventName: 'heartbeat',
      payload: { roomId: 'ROOM', stateVersion: 5 }
    });

    expect(MatchAuthority.getBufferedSseReplayEvents(buffer, 'ROOM_4_7', 'black')).toBeNull();
  });
});
