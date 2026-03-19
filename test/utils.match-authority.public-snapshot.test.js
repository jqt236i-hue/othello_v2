const MatchAuthority = require('../utils/match-authority');

describe('match authority public snapshot trap visibility', () => {
  function createSnapshot() {
    return {
      stateVersion: 7,
      gameState: {
        currentPlayer: 1,
        turnNumber: 12
      },
      cardState: {
        hands: {
          black: ['b1'],
          white: ['w1']
        },
        markers: [
          {
            id: 10,
            kind: 'specialStone',
            row: 2,
            col: 2,
            owner: 'black',
            data: { type: 'TRAP', hidden: true, armedForPlayer: 'white' }
          },
          {
            id: 11,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'white',
            data: { type: 'BREEDING', remainingOwnerTurns: 2 }
          }
        ],
        specialStones: [
          {
            row: 2,
            col: 2,
            type: 'TRAP',
            owner: 'black',
            remainingOwnerTurns: 1
          },
          {
            row: 3,
            col: 3,
            type: 'BREEDING',
            owner: 'white',
            remainingOwnerTurns: 2
          }
        ]
      }
    };
  }

  test('hides trap marker details from opposing viewer snapshots', () => {
    const snapshot = createSnapshot();

    const projected = MatchAuthority.projectSnapshotForViewer(snapshot, 'white');

    expect(projected.cardState.markers).toEqual([
      expect.objectContaining({
        row: 3,
        col: 3,
        owner: 'white',
        data: expect.objectContaining({ type: 'BREEDING' })
      })
    ]);
    expect(projected.cardState.specialStones).toEqual([
      expect.objectContaining({
        row: 3,
        col: 3,
        owner: 'white',
        type: 'BREEDING'
      })
    ]);
    expect(snapshot.cardState.markers).toHaveLength(2);
    expect(snapshot.cardState.specialStones).toHaveLength(2);
  });

  test('keeps trap marker details for the owner viewer snapshot', () => {
    const projected = MatchAuthority.projectSnapshotForViewer(createSnapshot(), 'black');

    expect(projected.cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 2,
        col: 2,
        owner: 'black',
        data: expect.objectContaining({ type: 'TRAP', hidden: true })
      })
    ]));
    expect(projected.cardState.specialStones).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 2,
        col: 2,
        owner: 'black',
        type: 'TRAP'
      })
    ]));
  });

  test('rehydrateSnapshotForPublish は時間停止状態を保ったまま transient state を除去する', () => {
    const previousSnapshot = createSnapshot();
    const incomingSnapshot = {
      stateVersion: 8,
      gameState: {
        currentPlayer: 1,
        turnNumber: 13,
        __resultShown: true
      },
      cardState: {
        hands: {
          black: ['b1'],
          white: ['__hidden_hand__:white:0']
        },
        discard: ['__hidden_hand__:white:0'],
        pendingEffectByPlayer: { black: null, white: null },
        markers: [
          {
            id: 50,
            kind: 'specialStone',
            row: 4,
            col: 4,
            owner: 'black',
            data: { type: 'TIME_STOP', remainingOwnerTurns: 1 }
          }
        ],
        timeStopConsecutiveTurnsRemainingByPlayer: { black: 1, white: 0 },
        presentationEvents: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }],
        _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] }]
      }
    };

    const rehydrated = MatchAuthority.rehydrateSnapshotForPublish(previousSnapshot, incomingSnapshot);

    expect(rehydrated.cardState.hands.white).toEqual(['w1']);
    expect(rehydrated.cardState.discard).toEqual(['w1']);
    expect(rehydrated.cardState.timeStopConsecutiveTurnsRemainingByPlayer).toEqual({ black: 1, white: 0 });
    expect(rehydrated.cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 4,
        col: 4,
        owner: 'black',
        data: expect.objectContaining({ type: 'TIME_STOP', remainingOwnerTurns: 1 })
      })
    ]));
    expect(rehydrated.cardState.presentationEvents).toEqual([]);
    expect(rehydrated.cardState._presentationEventsPersist).toEqual([]);
    expect(rehydrated.gameState.__resultShown).toBeUndefined();
  });

  test('time stop marker details stay visible in opponent public snapshots', () => {
    const snapshot = createSnapshot();
    snapshot.cardState.markers.push({
      id: 12,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'TIME_STOP', remainingOwnerTurns: 1 }
    });
    snapshot.cardState.specialStones.push({
      row: 4,
      col: 4,
      owner: 'black',
      type: 'TIME_STOP',
      remainingOwnerTurns: 1
    });
    snapshot.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 1, white: 0 };

    const projected = MatchAuthority.projectSnapshotForViewer(snapshot, 'white');

    expect(projected.cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 4,
        col: 4,
        owner: 'black',
        data: expect.objectContaining({ type: 'TIME_STOP', remainingOwnerTurns: 1 })
      })
    ]));
    expect(projected.cardState.specialStones).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 4,
        col: 4,
        owner: 'black',
        type: 'TIME_STOP',
        remainingOwnerTurns: 1
      })
    ]));
    expect(projected.cardState.timeStopConsecutiveTurnsRemainingByPlayer).toEqual({ black: 1, white: 0 });
  });
});