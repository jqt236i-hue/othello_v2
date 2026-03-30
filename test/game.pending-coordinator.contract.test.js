const PendingCoordinator = require('../game/turn/pending-coordinator');

describe('PendingCoordinator', () => {
  afterEach(() => {
    PendingCoordinator.clearPendingSelectionAction('black');
    PendingCoordinator.clearPendingSelectionAction('white');
    delete global.ActionManager;
  });

  test('setPendingHintLocally only updates pending state for the selected player', () => {
    const cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      hands: { black: ['guard_01'], white: [] },
      charge: { black: 5, white: 0 },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: { black: null, white: null }
    };

    const beforeHands = JSON.parse(JSON.stringify(cardState.hands));
    const beforeCharge = JSON.parse(JSON.stringify(cardState.charge));
    const beforeUsage = JSON.parse(JSON.stringify(cardState.hasUsedCardThisTurnByPlayer));
    const beforeLastUsed = JSON.parse(JSON.stringify(cardState.lastUsedCardByPlayer));

    const result = PendingCoordinator.setPendingHintLocally(cardState, 'black', 'GUARD_WILL', {
      cardId: 'guard_01',
      sourceHandIndex: 0
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      playerKey: 'black',
      pending: expect.objectContaining({
        type: 'GUARD_WILL',
        cardId: 'guard_01',
        sourceHandIndex: 0,
        stage: 'selectTarget'
      })
    }));
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'GUARD_WILL',
      cardId: 'guard_01',
      sourceHandIndex: 0,
      stage: 'selectTarget'
    }));
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
    expect(cardState.hands).toEqual(beforeHands);
    expect(cardState.charge).toEqual(beforeCharge);
    expect(cardState.hasUsedCardThisTurnByPlayer).toEqual(beforeUsage);
    expect(cardState.lastUsedCardByPlayer).toEqual(beforeLastUsed);
  });

  test('clearPendingHint nulls only the requested player entry', () => {
    const cardState = {
      pendingEffectByPlayer: {
        black: { type: 'TRAP_WILL', stage: 'selectTarget' },
        white: { type: 'GUARD_WILL', stage: 'selectTarget' }
      }
    };

    expect(PendingCoordinator.clearPendingHint(cardState, 'black')).toEqual({
      ok: true,
      playerKey: 'black'
    });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.pendingEffectByPlayer.white).toEqual(expect.objectContaining({
      type: 'GUARD_WILL',
      stage: 'selectTarget'
    }));
  });

  test('clearPendingEffect clears pending state and cached pending action for the requested player', () => {
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    const cardState = {
      turnIndex: 4,
      pendingEffectByPlayer: {
        black: { type: 'POSITION_SWAP_WILL', stage: 'selectTarget', firstTarget: { row: 1, col: 2 } },
        white: { type: 'GUARD_WILL', stage: 'selectTarget' }
      }
    };

    PendingCoordinator.createPendingSelectionAction(
      'black',
      'POSITION_SWAP_WILL',
      { firstTarget: { row: 1, col: 2 } },
      { cardState }
    );

    expect(PendingCoordinator.clearPendingEffect(cardState, 'black')).toEqual({
      ok: true,
      playerKey: 'black'
    });
    expect(PendingCoordinator.readPendingEffect(cardState, 'black')).toBeNull();
    expect(PendingCoordinator.getPendingEffectType(cardState, 'black')).toBeNull();
    expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
    expect(PendingCoordinator.readPendingEffect(cardState, 'white')).toEqual(expect.objectContaining({
      type: 'GUARD_WILL',
      stage: 'selectTarget'
    }));
  });

  test('writePendingEffect updates only the requested player entry', () => {
    const cardState = {
      pendingEffectByPlayer: {
        black: null,
        white: { type: 'GUARD_WILL', stage: 'selectTarget' }
      }
    };

    expect(
      PendingCoordinator.writePendingEffect(cardState, 'black', {
        type: 'TRAP_WILL',
        stage: 'selectTarget',
        cardId: 'trap_01'
      })
    ).toEqual({
      ok: true,
      playerKey: 'black',
      pendingEffect: {
        type: 'TRAP_WILL',
        stage: 'selectTarget',
        cardId: 'trap_01'
      }
    });
    expect(PendingCoordinator.readPendingEffect(cardState, 'black')).toEqual({
      type: 'TRAP_WILL',
      stage: 'selectTarget',
      cardId: 'trap_01'
    });
    expect(PendingCoordinator.readPendingEffect(cardState, 'white')).toEqual({
      type: 'GUARD_WILL',
      stage: 'selectTarget'
    });
  });

  test('delegates target requirements and pending contracts to shared owner', () => {
    expect(PendingCoordinator.requiresPendingTarget('CAPTURE_WILL')).toBe(true);
    expect(PendingCoordinator.getPendingSelectionContract('TRAP_WILL')).toEqual(expect.objectContaining({
      kind: 'end_turn',
      turnOutcome: 'end_turn',
      deferNetworkPublish: true
    }));
    expect(PendingCoordinator.getPendingSelectionContract('GUARD_WILL')).toEqual(expect.objectContaining({
      kind: 'continue_turn',
      deferNetworkPublish: true
    }));
  });

  test('createPendingSelectionAction caches multi-stage transport state under the coordinator owner', () => {
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    const cardState = {
      turnIndex: 9,
      pendingEffectByPlayer: {
        black: {
          type: 'BOARD_EXPANSION_GOD',
          stage: 'selectTarget',
          selectedTargets: [{ row: 2, col: 3 }],
          selectedCount: 1,
          maxSelections: 2
        },
        white: null
      }
    };

    const action = PendingCoordinator.createPendingSelectionAction(
      'black',
      'BOARD_EXPANSION_GOD',
      { anchor: { row: 4, col: 4 } },
      { cardState }
    );

    expect(action).toEqual(expect.objectContaining({
      type: 'place',
      player: 'black',
      anchor: { row: 4, col: 4 },
      deferNetworkPublish: true,
      turnIndex: 9,
      pendingSelectionState: expect.objectContaining({
        type: 'BOARD_EXPANSION_GOD',
        stage: 'selectTarget',
        selectedTargets: [{ row: 2, col: 3 }],
        selectedCount: 1,
        maxSelections: 2
      })
    }));
    expect(PendingCoordinator.readPendingSelectionAction('black')).toEqual(expect.objectContaining({
      pendingSelectionState: expect.objectContaining({
        type: 'BOARD_EXPANSION_GOD',
        stage: 'selectTarget'
      })
    }));
  });

  test('syncPendingSelectionActionCache prunes stale entries while retaining matching pending types', () => {
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };

    PendingCoordinator.createPendingSelectionAction(
      'black',
      'POSITION_SWAP_WILL',
      { firstTarget: { row: 1, col: 2 } },
      {
        cardState: {
          turnIndex: 5,
          pendingEffectByPlayer: {
            black: { type: 'POSITION_SWAP_WILL', stage: 'selectTarget', firstTarget: { row: 1, col: 2 } },
            white: null
          }
        }
      }
    );
    PendingCoordinator.createPendingSelectionAction(
      'white',
      'BOARD_EXPANSION_GOD',
      { anchor: { row: 4, col: 4 } },
      {
        cardState: {
          turnIndex: 6,
          pendingEffectByPlayer: {
            black: null,
            white: { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget', selectedTargets: [{ row: 3, col: 3 }] }
          }
        }
      }
    );

    expect(PendingCoordinator.syncPendingSelectionActionCache({
      black: null,
      white: { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget' }
    })).toEqual({
      cleared: ['black'],
      retained: ['white']
    });
    expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
    expect(PendingCoordinator.readPendingSelectionAction('white')).toEqual(expect.objectContaining({
      type: 'place',
      deferNetworkPublish: true
    }));
  });

  test('syncPendingSelectionActionCache clears same-type entries when turnIndex changes', () => {
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };

    PendingCoordinator.createPendingSelectionAction(
      'white',
      'BOARD_EXPANSION_GOD',
      { anchor: { row: 4, col: 4 } },
      {
        cardState: {
          turnIndex: 6,
          pendingEffectByPlayer: {
            black: null,
            white: { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget', selectedTargets: [{ row: 3, col: 3 }] }
          }
        }
      }
    );

    expect(PendingCoordinator.syncPendingSelectionActionCache({
      turnIndex: 7,
      pendingEffectByPlayer: {
        black: null,
        white: { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget' }
      }
    })).toEqual({
      cleared: ['white'],
      retained: []
    });
    expect(PendingCoordinator.readPendingSelectionAction('white')).toBeNull();
  });
});
