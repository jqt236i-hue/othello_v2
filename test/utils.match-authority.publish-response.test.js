const MatchAuthority = require('../utils/match-authority');

describe('match authority publish response payload', () => {
  test('normalizes publishMeta and preserves room context', () => {
    const playbackEvents = [{ type: 'observer_bubble', phase: 2, targets: [{ player: 'black', text: 'ok' }] }];
    const effectLogs = ['黒: 反転保護を付与', '黒: 反転保護を付与', ''];
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
      effectLogs,
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
      effectLogs: ['黒: 反転保護を付与'],
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

describe('match authority FATE_WILL controller helpers', () => {
  function makeSnapshot({ currentPlayer, fateWillControllerByTurnOwner }) {
    return {
      gameState: { currentPlayer },
      cardState: { fateWillControllerByTurnOwner: fateWillControllerByTurnOwner || { black: null, white: null } }
    };
  }

  test('getFateWillControllerKey returns controller key when set', () => {
    const snapshot = makeSnapshot({ currentPlayer: 'white', fateWillControllerByTurnOwner: { black: null, white: 'black' } });
    expect(MatchAuthority.getFateWillControllerKey(snapshot, 'white')).toBe('black');
    expect(MatchAuthority.getFateWillControllerKey(snapshot, 'black')).toBeNull();
  });

  test('getFateWillControllerKey returns null when not set', () => {
    const snapshot = makeSnapshot({ currentPlayer: 'black' });
    expect(MatchAuthority.getFateWillControllerKey(snapshot, 'black')).toBeNull();
    expect(MatchAuthority.getFateWillControllerKey(snapshot, 'white')).toBeNull();
  });

  test('isFateWillControllerForCurrentTurn returns true for controller during controlled turn', () => {
    const snapshot = makeSnapshot({ currentPlayer: 'white', fateWillControllerByTurnOwner: { black: null, white: 'black' } });
    expect(MatchAuthority.isFateWillControllerForCurrentTurn(snapshot, 'black')).toBe(true);
  });

  test('isFateWillControllerForCurrentTurn returns false for turn owner themselves', () => {
    const snapshot = makeSnapshot({ currentPlayer: 'white', fateWillControllerByTurnOwner: { black: null, white: 'black' } });
    expect(MatchAuthority.isFateWillControllerForCurrentTurn(snapshot, 'white')).toBe(false);
  });

  test('isFateWillControllerForCurrentTurn returns false when controller map is inactive', () => {
    const snapshot = makeSnapshot({ currentPlayer: 'black' });
    expect(MatchAuthority.isFateWillControllerForCurrentTurn(snapshot, 'white')).toBe(false);
  });

  test('isFateWillControllerForCurrentTurn returns false when fateWill set but it is not currently that turn', () => {
    // fateWillControllerByTurnOwner['white'] = 'black' is set, but currentPlayer is 'black' (not white's turn yet)
    const snapshot = makeSnapshot({ currentPlayer: 'black', fateWillControllerByTurnOwner: { black: null, white: 'black' } });
    expect(MatchAuthority.isFateWillControllerForCurrentTurn(snapshot, 'black')).toBe(false);
  });

  test('projectSnapshotForViewer reveals controlled hand to FATE_WILL controller during controlled turn', () => {
    const snapshot = {
      gameState: { currentPlayer: 'white' },
      cardState: {
        hands: { black: ['b1', 'b2'], white: ['w1', 'w2'] },
        fateWillControllerByTurnOwner: { black: null, white: 'black' }
      }
    };
    // Black is the controller for white's turn - black should see white's hand
    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black', { stateVersion: 5 });
    expect(blackView.cardState.hands.black).toEqual(['b1', 'b2']);
    expect(blackView.cardState.hands.white).toEqual(['w1', 'w2']);
  });

  test('projectSnapshotForViewer does NOT reveal hand to controller outside of controlled turn', () => {
    // Same fateWill state, but currentPlayer is 'black' (not white's turn)
    const snapshot = {
      gameState: { currentPlayer: 'black' },
      cardState: {
        hands: { black: ['b1', 'b2'], white: ['w1', 'w2'] },
        fateWillControllerByTurnOwner: { black: null, white: 'black' }
      }
    };
    // Black is the controller for white's upcoming turn, but it's black's turn now - white's hand stays hidden
    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black', { stateVersion: 5 });
    expect(blackView.cardState.hands.black).toEqual(['b1', 'b2']);
    expect(blackView.cardState.hands.white).toEqual([
      '__hidden_hand__:white:0',
      '__hidden_hand__:white:1'
    ]);
  });

  test('projectSnapshotForViewer does NOT reveal controlled hand to non-controller observers', () => {
    // In a theoretical 3-seat scenario, or just checking null viewer
    const snapshot = {
      gameState: { currentPlayer: 'white' },
      cardState: {
        hands: { black: ['b1'], white: ['w1'] },
        fateWillControllerByTurnOwner: { black: null, white: 'black' }
      }
    };
    // Viewer is white (turn owner) - sees own hand, black's hidden
    const whiteView = MatchAuthority.projectSnapshotForViewer(snapshot, 'white', { stateVersion: 5 });
    expect(whiteView.cardState.hands.white).toEqual(['w1']);
    expect(whiteView.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);

    // Null viewer - both hands hidden
    const nullView = MatchAuthority.projectSnapshotForViewer(snapshot, null, { stateVersion: 5 });
    expect(nullView.cardState.hands.white).toEqual(['__hidden_hand__:white:0']);
    expect(nullView.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);
  });
});
