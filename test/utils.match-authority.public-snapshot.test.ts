import * as MatchAuthority from '../utils/match-authority.js';

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

  test('stripTransientPresentationState は時間停止状態を保ったまま transient state を除去する', () => {
    const snapshot = {
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

    const sanitized = MatchAuthority.stripTransientPresentationState(snapshot);

    expect(sanitized.cardState.hands.white).toEqual(['__hidden_hand__:white:0']);
    expect(sanitized.cardState.discard).toEqual(['__hidden_hand__:white:0']);
    expect(sanitized.cardState.timeStopConsecutiveTurnsRemainingByPlayer).toEqual({ black: 1, white: 0 });
    expect(sanitized.cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 4,
        col: 4,
        owner: 'black',
        data: expect.objectContaining({ type: 'TIME_STOP', remainingOwnerTurns: 1 })
      })
    ]));
    expect(sanitized.cardState.presentationEvents).toEqual([]);
    expect(sanitized.cardState._presentationEventsPersist).toEqual([]);
    expect(sanitized.gameState.__resultShown).toBeUndefined();
  });

  test('stripTransientChargeDeltaState は charge ledger を残したまま stale delta queue だけ除去する', () => {
    const snapshot = {
      stateVersion: 9,
      gameState: {
        currentPlayer: 1,
        turnNumber: 14
      },
      cardState: {
        charge: { black: 3, white: 1 },
        chargeGainedTotal: { black: 3, white: 1 },
        chargeDeltaEvents: [
          { seq: 1, player: 'black', delta: 1, before: 2, after: 3, reason: 'turn_gain' }
        ]
      }
    };

    const sanitized = MatchAuthority.stripTransientChargeDeltaState(snapshot);

    expect(sanitized.cardState.charge).toEqual({ black: 3, white: 1 });
    expect(sanitized.cardState.chargeGainedTotal).toEqual({ black: 3, white: 1 });
    expect(sanitized.cardState.chargeDeltaEvents).toEqual([]);
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

  test('projectSnapshotForViewer reveals only marked opponent hand copies and strips internal copy metadata', () => {
    const snapshot = {
      stateVersion: 10,
      gameState: { currentPlayer: 1 },
      cardState: {
        hands: {
          black: ['b1'],
          white: ['w1', 'w2', 'w3']
        },
        discard: [],
        pendingEffectByPlayer: { black: null, white: null },
        _nextCardCopySeq: 20,
        _handCopyIdsByPlayer: {
          black: [1],
          white: [11, 12, 13]
        },
        _deckCopyIdsByPlayer: { black: [], white: [] },
        _discardCopyIds: [],
        _revealedHandCopyIdsByViewer: {
          black: [11, 13],
          white: []
        }
      }
    };

    const projected = MatchAuthority.projectSnapshotForViewer(snapshot, 'black');

    expect(projected.cardState.hands.white).toEqual(['w1', '__hidden_hand__:white:1', 'w3']);
    expect(projected.cardState._nextCardCopySeq).toBeUndefined();
    expect(projected.cardState._handCopyIdsByPlayer).toBeUndefined();
    expect(projected.cardState._deckCopyIdsByPlayer).toBeUndefined();
    expect(projected.cardState._discardCopyIds).toBeUndefined();
    expect(projected.cardState._revealedHandCopyIdsByViewer).toBeUndefined();
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

  test('projectSnapshotForViewer hides selected opponent hand identity without mutating canonical snapshot', () => {
    const snapshot = {
      stateVersion: 11,
      gameState: { currentPlayer: 1 },
      cardState: {
        hands: {
          black: ['b1'],
          white: ['meteor_01', 'guard_01']
        },
        selectedCardId: 'meteor_01',
        selectedCardOwnerKey: 'white',
        pendingEffectByPlayer: { black: null, white: null },
        markers: [],
        discard: []
      }
    };

    const before = JSON.parse(JSON.stringify(snapshot));
    const projected = MatchAuthority.projectSnapshotForViewer(snapshot, 'black');

    expect(projected.cardState.hands.white).toEqual([
      '__hidden_hand__:white:0',
      '__hidden_hand__:white:1'
    ]);
    expect(projected.cardState.selectedCardId).toBeNull();
    expect(projected.cardState.selectedCardOwnerKey).toBeNull();
    expect(snapshot).toEqual(before);
  });

  test('projectSnapshotForViewer redacts condemn offers for non-entitled viewers and preserves owner choice space', () => {
    const snapshot = {
      stateVersion: 12,
      gameState: { currentPlayer: 1 },
      cardState: {
        hands: {
          black: ['condemn_01'],
          white: ['meteor_01', 'guard_01']
        },
        pendingEffectByPlayer: {
          black: {
            type: 'CONDEMN_WILL',
            stage: 'selectTarget',
            cardId: 'condemn_01',
            offers: [
              { handIndex: 0, cardId: 'meteor_01' },
              { handIndex: 1, cardId: 'guard_01' }
            ]
          },
          white: null
        },
        markers: [],
        discard: []
      }
    };

    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black');
    const whiteView = MatchAuthority.projectSnapshotForViewer(snapshot, 'white');

    expect(blackView.cardState.pendingEffectByPlayer.black.offers).toEqual([
      { handIndex: 0, cardId: 'meteor_01' },
      { handIndex: 1, cardId: 'guard_01' }
    ]);
    expect(whiteView.cardState.pendingEffectByPlayer.black.offers).toEqual([
      { handIndex: 0, cardId: '__hidden_hand__:white:0' },
      { handIndex: 1, cardId: '__hidden_hand__:white:1' }
    ]);
  });

  test('projectSnapshotForViewer reveals only marked reveal-hand slots and keeps unrevealed cards hidden', () => {
    const snapshot = {
      stateVersion: 13,
      gameState: { currentPlayer: 1 },
      cardState: {
        hands: {
          black: ['reveal_hand_01'],
          white: ['meteor_01', 'guard_01', 'trap_01']
        },
        pendingEffectByPlayer: { black: null, white: null },
        _handCopyIdsByPlayer: {
          black: [1],
          white: [20, 21, 22]
        },
        _revealedHandCopyIdsByViewer: {
          black: [21],
          white: []
        },
        markers: [],
        discard: []
      }
    };

    const projected = MatchAuthority.projectSnapshotForViewer(snapshot, 'black');

    expect(projected.cardState.hands.white).toEqual([
      '__hidden_hand__:white:0',
      'guard_01',
      '__hidden_hand__:white:2'
    ]);
    expect(projected.cardState._handCopyIdsByPlayer).toBeUndefined();
    expect(projected.cardState._revealedHandCopyIdsByViewer).toBeUndefined();
  });

  test('projectSnapshotForViewer exposes observed hand slot metadata without leaking copy ids', () => {
    const snapshot = createSnapshot();
    snapshot.cardState.hands.black = ['reveal_hand_01'];
    snapshot.cardState.hands.white = ['meteor_01', 'guard_01', 'trap_01'];
    snapshot.cardState._handCopyIdsByPlayer = {
      black: [1],
      white: [20, 21, 22]
    };
    snapshot.cardState._revealedHandCopyIdsByViewer = {
      black: [21],
      white: []
    };

    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black');
    const whiteView = MatchAuthority.projectSnapshotForViewer(snapshot, 'white');

    expect(blackView.cardState.observedHandSlotsByPlayer).toEqual({
      black: [],
      white: [1]
    });
    expect(whiteView.cardState.observedHandSlotsByPlayer).toEqual({
      black: [],
      white: [1]
    });
    expect(blackView.cardState._revealedHandCopyIdsByViewer).toBeUndefined();
    expect(whiteView.cardState._revealedHandCopyIdsByViewer).toBeUndefined();
  });

  test('projectSnapshotForViewer projects visible hand cost adjustments without leaking copy ids', () => {
    const snapshot = createSnapshot();
    snapshot.cardState.hands.black = ['observer_will_01'];
    snapshot.cardState.hands.white = ['meteor_01', 'guard_01', 'trap_01'];
    snapshot.cardState._handCopyIdsByPlayer = {
      black: [1],
      white: [20, 21, 22]
    };
    snapshot.cardState._revealedHandCopyIdsByViewer = {
      black: [20],
      white: []
    };
    snapshot.cardState.cardCostModifiersByCopyId = {
      20: [{ delta: 5, sourceType: 'OBSERVER_WILL' }],
      22: [{ delta: 9, sourceType: 'DEBUG_HIDDEN' }]
    };
    snapshot.cardState.cardCostOverridesByCopyId = {
      21: { cost: 0, sourceType: 'OBSERVER_WILL' }
    };

    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black');

    expect(blackView.cardState.hands.white).toEqual([
      'meteor_01',
      '__hidden_hand__:white:1',
      '__hidden_hand__:white:2'
    ]);
    expect(blackView.cardState.handCostAdjustmentsByPlayer.white).toEqual([
      { delta: 5 },
      null,
      null
    ]);
    expect(blackView.cardState._handCopyIdsByPlayer).toBeUndefined();
    expect(blackView.cardState._revealedHandCopyIdsByViewer).toBeUndefined();
    expect(blackView.cardState.cardCostModifiersByCopyId).toBeUndefined();
    expect(blackView.cardState.cardCostOverridesByCopyId).toBeUndefined();
  });

  test('projectSnapshotForViewer reveals opponent hand to active observer will marker owner', () => {
    const snapshot = createSnapshot();
    snapshot.cardState.hands.black = ['observer_will_01'];
    snapshot.cardState.hands.white = ['meteor_01', 'guard_01'];
    snapshot.cardState.markers = [{
      id: 'obs-1',
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 3 }
    }];

    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black');
    const whiteView = MatchAuthority.projectSnapshotForViewer(snapshot, 'white');
    const observerView = MatchAuthority.projectSnapshotForViewer(snapshot, null);

    expect(blackView.cardState.hands.white).toEqual(['meteor_01', 'guard_01']);
    expect(whiteView.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);
    expect(observerView.cardState.hands.white).toEqual(['__hidden_hand__:white:0', '__hidden_hand__:white:1']);
  });

  test('projectSnapshotForViewer reveals opponent hand to active observer manifestation stone owner', () => {
    const snapshot = createSnapshot();
    snapshot.cardState.hands.black = ['observer_will_01'];
    snapshot.cardState.hands.white = ['meteor_01', 'guard_01'];
    snapshot.cardState.markers = [{
      id: 'obs-manifest-1',
      kind: 'manifestStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 3 }
    }];

    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black');
    const whiteView = MatchAuthority.projectSnapshotForViewer(snapshot, 'white');

    expect(blackView.cardState.hands.white).toEqual(['meteor_01', 'guard_01']);
    expect(whiteView.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);
  });

  test('projectSnapshotForViewer does not reveal from non manifestation observer-like markers', () => {
    const snapshot = createSnapshot();
    snapshot.cardState.hands.black = ['observer_will_01'];
    snapshot.cardState.hands.white = ['meteor_01', 'guard_01'];
    snapshot.cardState.markers = [{
      id: 'obs-invalid-1',
      kind: 'bomb',
      row: 2,
      col: 3,
      owner: 'black',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 3 }
    }];

    const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black');

    expect(blackView.cardState.hands.white).toEqual(['__hidden_hand__:white:0', '__hidden_hand__:white:1']);
  });
});
