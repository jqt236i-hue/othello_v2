const MatchAuthority = require('../utils/match-authority');
const PlaybackDigest = require('../shared/playback-digest');

function createRoom() {
  const initialSnapshot = {
    stateVersion: 1,
    _meta: { projectedSnapshotHash: 'hash_1' },
    gameState: { currentPlayer: 1 },
    cardState: { hands: { black: [], white: [] } }
  };
  return {
    roomId: 'ABC',
    stateVersion: 1,
    visualSeq: 0,
    presentationJournal: [],
    snapshot: initialSnapshot,
    initialSnapshotByViewer: {
      black: initialSnapshot,
      white: initialSnapshot,
      spectator: initialSnapshot
    }
  };
}

describe('match authority presentation journal', () => {
  test('keeps SSE and presentation journal buffers bounded at eight entries', () => {
    expect(MatchAuthority.SSE_RESUME_BUFFER_LIMIT).toBe(8);
    expect(MatchAuthority.PRESENTATION_JOURNAL_LIMIT).toBe(8);
  });

  test('appendPresentationFrame increments visualSeq and stores viewer payloads', () => {
    const room = createRoom();
    const frame = MatchAuthority.appendPresentationFrame(room, {
      stateVersionFrom: 1,
      stateVersionTo: 2,
      operationId: 'op_1',
      actorSeatKey: 'black',
      actionType: 'place',
      payloadByViewer: {
        black: { playbackEvents: [{ type: 'flip', phase: 2 }], effectLogs: ['black view'] },
        white: { playbackEvents: [{ type: 'flip', phase: 2 }], effectLogs: ['white view'] },
        spectator: { playbackEvents: [{ type: 'flip', phase: 2 }], effectLogs: ['spectator view'] }
      },
      snapshotAfterByViewer: {
        black: { stateVersion: 2, _meta: { projectedSnapshotHash: 'black_hash_2' } },
        white: { stateVersion: 2, _meta: { projectedSnapshotHash: 'white_hash_2' } },
        spectator: { stateVersion: 2, _meta: { projectedSnapshotHash: 'spectator_hash_2' } }
      },
      createdAt: 1000
    });

    expect(frame.visualSeq).toBe(1);
    expect(room.visualSeq).toBe(1);
    expect(room.presentationJournal).toHaveLength(1);
  });

  test('getPresentationFramesAfter returns projection-safe frames for a seat', () => {
    const room = createRoom();
    MatchAuthority.appendPresentationFrame(room, {
      stateVersionFrom: 1,
      stateVersionTo: 2,
      operationId: 'op_1',
      actorSeatKey: 'white',
      actionType: 'card',
      payloadByViewer: {
        black: { playbackEvents: [{ type: 'observer_bubble' }], effectLogs: ['black redacted'] },
        white: { playbackEvents: [{ type: 'observer_bubble' }], effectLogs: ['white private'] },
        spectator: { playbackEvents: [{ type: 'observer_bubble' }], effectLogs: ['spectator public'] }
      },
      snapshotAfterByViewer: {
        black: { stateVersion: 2, _meta: { projectedSnapshotHash: 'black_hash_2' } },
        white: { stateVersion: 2, _meta: { projectedSnapshotHash: 'white_hash_2' } },
        spectator: { stateVersion: 2, _meta: { projectedSnapshotHash: 'spectator_hash_2' } }
      },
      createdAt: 1000
    });

    const frames = MatchAuthority.getPresentationFramesAfter(room, 0, { role: 'seat', seatKey: 'black' });
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      visualSeq: 1,
      stateVersionFrom: 1,
      stateVersionTo: 2,
      effectLogs: ['black redacted'],
      projectedSnapshotHash: 'black_hash_2'
    });
    expect(frames[0].playbackDigest).toBe(PlaybackDigest.computePlaybackDigest([
      { type: 'observer_bubble' }
    ]));
  });

  test('buildPresentationJournalResponse returns base snapshot and contiguous frames', () => {
    const room = createRoom();
    MatchAuthority.appendPresentationFrame(room, {
      stateVersionFrom: 1,
      stateVersionTo: 2,
      operationId: 'op_1',
      actorSeatKey: 'black',
      actionType: 'place',
      payloadByViewer: {
        black: { playbackEvents: [{ type: 'flip' }], effectLogs: [] }
      },
      snapshotAfterByViewer: {
        black: { stateVersion: 2, _meta: { projectedSnapshotHash: 'hash_2' } }
      },
      createdAt: 1000
    });

    const response = MatchAuthority.buildPresentationJournalResponse(room, {
      afterVisualSeq: 0,
      viewer: { role: 'seat', seatKey: 'black' }
    });

    expect(response.ok).toBe(true);
    expect(response.baseVisualSeq).toBe(0);
    expect(response.baseSnapshot.stateVersion).toBe(1);
    expect(response.presentationFrames.map((frame: any) => frame.visualSeq)).toEqual([1]);
  });

  test('appendPresentationFrame caps retained frames to keep room storage bounded', () => {
    const room = createRoom();

    for (let index = 1; index <= 10; index += 1) {
      MatchAuthority.appendPresentationFrame(room, {
        stateVersionFrom: index,
        stateVersionTo: index + 1,
        operationId: `op_${index}`,
        actorSeatKey: 'black',
        actionType: 'place',
        payloadByViewer: {
          black: { playbackEvents: [{ type: 'flip', index }], effectLogs: [] }
        },
        snapshotAfterByViewer: {
          black: { stateVersion: index + 1, _meta: { projectedSnapshotHash: `hash_${index + 1}` } }
        },
        createdAt: 1000 + index
      });
    }

    expect(room.visualSeq).toBe(10);
    expect(room.presentationJournal).toHaveLength(8);
    expect(room.presentationJournal.map((entry: any) => entry.visualSeq)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('buildPresentationJournalResponse rejects cursors older than retained frames', () => {
    const room = createRoom();

    for (let index = 1; index <= 10; index += 1) {
      MatchAuthority.appendPresentationFrame(room, {
        stateVersionFrom: index,
        stateVersionTo: index + 1,
        operationId: `op_${index}`,
        actorSeatKey: 'black',
        actionType: 'place',
        payloadByViewer: {
          black: { playbackEvents: [{ type: 'flip', index }], effectLogs: [] }
        },
        snapshotAfterByViewer: {
          black: { stateVersion: index + 1, _meta: { projectedSnapshotHash: `hash_${index + 1}` } }
        },
        createdAt: 1000 + index
      });
    }

    const expired = MatchAuthority.buildPresentationJournalResponse(room, {
      afterVisualSeq: 0,
      viewer: { role: 'seat', seatKey: 'black' }
    });
    const retained = MatchAuthority.buildPresentationJournalResponse(room, {
      afterVisualSeq: 2,
      viewer: { role: 'seat', seatKey: 'black' }
    });

    expect(expired.ok).toBe(false);
    expect(expired.reason).toBe('VISUAL_CURSOR_EXPIRED');
    expect(expired.presentationFrames).toEqual([]);
    expect(expired.snapshot).toBe(room.snapshot);
    expect(retained.ok).toBe(true);
    expect(retained.presentationFrames.map((frame: any) => frame.visualSeq)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('appendBufferedSseEvent caps default snapshot replay buffer', () => {
    let buffer: any[] = [];

    for (let index = 1; index <= 10; index += 1) {
      buffer = MatchAuthority.appendBufferedSseEvent(buffer, {
        eventId: `ROOM_${index}`,
        eventName: 'snapshot',
        payloadByViewer: {
          black: { stateVersion: index, snapshot: { index } },
          white: { stateVersion: index, snapshot: { index } },
          spectator: { stateVersion: index, snapshot: { index } }
        }
      });
    }

    expect(buffer).toHaveLength(8);
    expect(buffer.map((entry) => entry.id)).toEqual([
      'ROOM_3',
      'ROOM_4',
      'ROOM_5',
      'ROOM_6',
      'ROOM_7',
      'ROOM_8',
      'ROOM_9',
      'ROOM_10'
    ]);
  });
});
