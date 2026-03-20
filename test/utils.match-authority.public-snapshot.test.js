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

  test('rehydrateSnapshotForPublish sanitizes malformed or out-of-range hidden tokens before they reach authority state', () => {
    const previousSnapshot = createSnapshot();
    previousSnapshot.cardState.hands.white = ['w1', 'w2'];
    const incomingSnapshot = {
      stateVersion: 8,
      gameState: {
        currentPlayer: 1,
        turnNumber: 13
      },
      cardState: {
        hands: {
          black: ['b1'],
          white: ['__hidden_hand__:white:99', '__hidden_hand__:white:-1', '__hidden_hand__:white:999']
        },
        discard: ['__hidden_hand__:white:1', '__hidden_hand__:white:999', '__hidden_hand__:white:-1'],
        selectedCardId: '__hidden_hand__:white:999',
        selectedCardOwnerKey: 'white',
        pendingEffectByPlayer: {
          black: {
            type: 'CONDEMN_WILL',
            stage: 'selectTarget',
            offers: [
              { handIndex: 99, cardId: '__hidden_hand__:white:999' },
              { handIndex: 1, cardId: '__hidden_hand__:white:-1' },
              { handIndex: 99, cardId: '__hidden_hand__:white:999' }
            ]
          },
          white: null
        },
        presentationEvents: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }],
        _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] }]
      }
    };

    const rehydrated = MatchAuthority.rehydrateSnapshotForPublish(previousSnapshot, incomingSnapshot);

    expect(rehydrated.cardState.hands.white).toEqual(['w1', 'w2']);
    expect(rehydrated.cardState.discard).toEqual(['w2']);
    expect(rehydrated.cardState.selectedCardId).toBeNull();
    expect(rehydrated.cardState.selectedCardOwnerKey).toBeNull();
    expect(rehydrated.cardState.pendingEffectByPlayer.black.offers).toEqual([
      { handIndex: 0, cardId: 'w1' },
      { handIndex: 1, cardId: 'w2' }
    ]);

    const hiddenStrings = [
      ...rehydrated.cardState.hands.white,
      ...rehydrated.cardState.discard,
      ...rehydrated.cardState.pendingEffectByPlayer.black.offers.map((offer) => offer.cardId)
    ].filter((value) => typeof value === 'string' && value.startsWith('__hidden_hand__:'));
    expect(hiddenStrings).toEqual([]);
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

  test('projectSnapshotForViewer reconnect sanitizes malformed hidden tokens instead of leaking raw token ids', () => {
    const snapshot = createSnapshot();
    snapshot.cardState.hands.white = ['__hidden_hand__:white:99', 'w2'];
    snapshot.cardState.discard = ['w_discard', '__hidden_hand__:white:99'];
    snapshot.cardState.selectedCardId = '__hidden_hand__:white:77';
    snapshot.cardState.selectedCardOwnerKey = 'white';
    snapshot.cardState.pendingEffectByPlayer = {
      black: null,
      white: {
        type: 'CONDEMN_WILL',
        stage: 'selectTarget',
        offers: [
          { handIndex: 99, cardId: '__hidden_hand__:black:99' },
          { handIndex: 99, cardId: '__hidden_hand__:black:199' }
        ]
      }
    };

    const projected = MatchAuthority.projectSnapshotForViewer(snapshot, 'white');

    expect(projected.cardState.hands.white).toEqual(['__hidden_hand__:white:0', 'w2']);
    expect(projected.cardState.discard).toEqual(['w_discard']);
    expect(projected.cardState.selectedCardId).toBeNull();
    expect(projected.cardState.selectedCardOwnerKey).toBeNull();
    expect(projected.cardState.pendingEffectByPlayer.white.offers).toEqual([
      { handIndex: 0, cardId: 'b1' },
      { handIndex: null, cardId: null }
    ]);
  });
});
