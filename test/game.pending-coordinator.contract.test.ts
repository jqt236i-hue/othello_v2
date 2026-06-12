import * as PendingCoordinator from '../game/turn/pending-coordinator.js';
import * as CardLogic from '../game/logic/cards.js';

describe('PendingCoordinator', () => {
  afterEach(() => {
    PendingCoordinator.clearPendingSelectionAction('black');
    PendingCoordinator.clearPendingSelectionAction('white');
    delete global.ActionManager;
  });

  test('applyPendingSelectionCardContext keeps deferred card identity inside pendingSelectionState only', () => {
    const payload = {
      pendingSelectionState: {
        type: 'GUARD_WILL',
        stage: 'selectTarget',
        cardId: 'guard_01'
      }
    };

    expect(PendingCoordinator.applyPendingSelectionCardContext(payload, 'black')).toEqual({
      pendingSelectionState: {
        type: 'GUARD_WILL',
        stage: 'selectTarget',
        cardId: 'guard_01'
      }
    });
  });

  test('applyPendingSelectionCardContext keeps explicit card identity when already present', () => {
    const payload = {
      pendingSelectionState: {
        type: 'HEAVEN_BLESSING',
        stage: 'selectTarget',
        cardId: 'heaven_01'
      },
      useCardId: 'explicit_01',
      useCardOwnerKey: 'white'
    };

    expect(PendingCoordinator.applyPendingSelectionCardContext(payload, 'black')).toEqual({
      pendingSelectionState: {
        type: 'HEAVEN_BLESSING',
        stage: 'selectTarget',
        cardId: 'heaven_01'
      },
      useCardId: 'explicit_01',
      useCardOwnerKey: 'white'
    });
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
      pendingEffect: expect.objectContaining({
        type: 'TRAP_WILL',
        stage: 'selectTarget',
        cardId: 'trap_01'
      })
    });
    expect(PendingCoordinator.readPendingEffect(cardState, 'black')).toEqual(expect.objectContaining({
      type: 'TRAP_WILL',
      stage: 'selectTarget',
      cardId: 'trap_01'
    }));
    expect(PendingCoordinator.readPendingEffect(cardState, 'white')).toEqual({
      type: 'GUARD_WILL',
      stage: 'selectTarget'
    });
  });

  test('createPendingSelectionAction transports authoritative pendingEffectId with deferred selection state', () => {
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    const cardState = {
      turnIndex: 9,
      pendingEffectByPlayer: {
        black: {
          type: 'TEMPT_WILL',
          stage: 'selectTarget',
          cardId: 'tempt_01',
          pendingEffectId: 'pending_9_2'
        },
        white: null
      }
    };

    const action = PendingCoordinator.createPendingSelectionAction(
      'black',
      'TEMPT_WILL',
      { temptTarget: { row: 2, col: 3 } },
      { cardState }
    );

    expect(action.pendingSelectionState).toEqual(expect.objectContaining({
      type: 'TEMPT_WILL',
      pendingEffectId: 'pending_9_2'
    }));
  });

  test('buildPendingSelectionTargetPayload derives target fields from the pending selection registry', () => {
    const cases = [
      ['DESTROY_ONE_STONE', 'destroyTarget'],
      ['REVERSE_WILL', 'reverseWillTarget'],
      [['EXTEND_LIFE_WILL', 'EXTEND_LIFE_GOD'], 'extendTarget'],
      ['CORROSION_WILL', 'corrosionTarget'],
      ['SEED_WILL', 'seedTarget'],
      ['FREEZE_WILL', 'freezeTarget'],
      [['BOARD_SHRINK_WILL', 'BOARD_SHRINK_GOD'], 'shrinkTarget']
    ];

    for (const [pendingTypes, field] of cases) {
      expect(PendingCoordinator.buildPendingSelectionTargetPayload(pendingTypes, 2, 3)).toEqual({
        [field as string]: { row: 2, col: 3 }
      });
    }
  });

  test('buildPendingSelectionTargetPayload rejects mixed pending types with different target fields', () => {
    expect(() => PendingCoordinator.buildPendingSelectionTargetPayload(['FREEZE_WILL', 'SEED_WILL'], 2, 3))
      .toThrow('inconsistent_pending_selection_target_field');
  });

  test('buildPendingSelectionTargetPayload rejects pending types without target action fields', () => {
    expect(() => PendingCoordinator.buildPendingSelectionTargetPayload(['FREEZE_WILL', 'HEAVEN_BLESSING'], 2, 3))
      .toThrow('missing_pending_selection_target_field');
    expect(() => PendingCoordinator.buildPendingSelectionTargetPayload('UNKNOWN_PENDING_TYPE', 2, 3))
      .toThrow('missing_pending_selection_target_field');
  });

  test('normalizes seat aliases through OwnerHelpers when reading and writing pending state', () => {
    const cardState = {
      pendingEffectByPlayer: {
        black: null,
        white: null
      }
    };

    expect(
      PendingCoordinator.writePendingEffect(cardState, -1, {
        type: 'TRAP_WILL',
        stage: 'selectTarget'
      })
    ).toEqual(expect.objectContaining({
      ok: true,
      playerKey: 'white',
      pendingEffect: expect.objectContaining({
        type: 'TRAP_WILL',
        stage: 'selectTarget'
      })
    }));
    expect(PendingCoordinator.readPendingEffect(cardState, 'white')).toEqual(expect.objectContaining({
      type: 'TRAP_WILL',
      stage: 'selectTarget'
    }));
    expect(PendingCoordinator.readPendingEffect(cardState, '-1')).toEqual(expect.objectContaining({
      type: 'TRAP_WILL',
      stage: 'selectTarget'
    }));
    expect(PendingCoordinator.readPendingEffect(cardState, '+1')).toBeNull();
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
    expect(PendingCoordinator.getPendingSelectionContract('HEAVEN_BLESSING')).toEqual(expect.objectContaining({
      kind: 'hand_overlay',
      turnOutcome: 'continue_turn',
      deferNetworkPublish: true
    }));
    expect(PendingCoordinator.isSelectionOnlyEndTurnPendingType('TRAP_WILL')).toBe(true);
    expect(PendingCoordinator.isSelectionOnlyEndTurnPendingType('GUARD_WILL')).toBe(false);
    expect(PendingCoordinator.shouldDeferNetworkPublishForPendingType('GUARD_WILL')).toBe(true);
    expect(PendingCoordinator.shouldWaitForPlaybackIdleForPendingType('GUARD_WILL')).toBe(true);
    expect(PendingCoordinator.resolvePendingSelectionDispatchKey('HEAVEN_BLESSING')).toBe('heaven_blessing');
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

  test('createPendingSelectionAction keeps card identity inside pendingSelectionState only', () => {
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    const cardState = {
      turnIndex: 9,
      pendingEffectByPlayer: {
        black: {
          type: 'TEMPT_WILL',
          stage: 'selectTarget',
          cardId: 'tempt_01'
        },
        white: null
      }
    };

    const action = PendingCoordinator.createPendingSelectionAction(
      'black',
      'TEMPT_WILL',
      { temptTarget: { row: 2, col: 2 } },
      { cardState }
    );

    expect(action).toEqual(expect.objectContaining({
      type: 'place',
      player: 'black',
      temptTarget: { row: 2, col: 2 },
      deferNetworkPublish: true,
      turnIndex: 9,
      pendingSelectionState: {
        type: 'TEMPT_WILL',
        stage: 'selectTarget',
        cardId: 'tempt_01'
      }
    }));
    expect(action.useCardId).toBeUndefined();
    expect(action.useCardOwnerKey).toBeUndefined();
  });

  test('clearPendingSelectionFailureState clears cached action but keeps authoritative pending by default', () => {
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    const cardState = {
      turnIndex: 9,
      pendingEffectByPlayer: {
        black: {
          type: 'TEMPT_WILL',
          stage: 'selectTarget',
          cardId: 'tempt_01'
        },
        white: null
      }
    };

    PendingCoordinator.createPendingSelectionAction(
      'black',
      'TEMPT_WILL',
      { temptTarget: { row: 2, col: 2 } },
      { cardState }
    );

    expect(PendingCoordinator.clearPendingSelectionFailureState(cardState, 'black')).toEqual(expect.objectContaining({
      ok: true,
      playerKey: 'black',
      clearedPendingEffect: false
    }));
    expect(PendingCoordinator.readPendingEffect(cardState, 'black')).toEqual({
      type: 'TEMPT_WILL',
      stage: 'selectTarget',
      cardId: 'tempt_01'
    });
    expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
  });

  test('createPendingSelectionAction transports shrink selections for both selectedTargets and firstTarget contracts', () => {
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };

    const shrinkWillState = {
      turnIndex: 11,
      pendingEffectByPlayer: {
        black: {
          type: 'BOARD_SHRINK_WILL',
          stage: 'selectTarget',
          selectedTargets: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
          selectedCount: 2,
          maxSelections: 3
        },
        white: null
      }
    };
    const shrinkWillAction = PendingCoordinator.createPendingSelectionAction(
      'black',
      'BOARD_SHRINK_WILL',
      { shrinkTarget: { row: 7, col: 0 } },
      { cardState: shrinkWillState }
    );

    expect(shrinkWillAction.pendingSelectionState).toEqual({
      type: 'BOARD_SHRINK_WILL',
      stage: 'selectTarget',
      selectedTargets: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
      selectedCount: 2,
      maxSelections: 3
    });

    const shrinkGodState = {
      turnIndex: 12,
      pendingEffectByPlayer: {
        black: {
          type: 'BOARD_SHRINK_GOD',
          stage: 'selectTarget',
          firstTarget: { row: 0, col: 0 }
        },
        white: null
      }
    };
    const shrinkGodAction = PendingCoordinator.createPendingSelectionAction(
      'black',
      'BOARD_SHRINK_GOD',
      { shrinkTarget: { row: 0, col: 1 } },
      { cardState: shrinkGodState }
    );

    expect(shrinkGodAction.pendingSelectionState).toEqual({
      type: 'BOARD_SHRINK_GOD',
      stage: 'selectTarget',
      firstTarget: { row: 0, col: 0 }
    });
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

  test('syncPendingSelectionActionCache preserves requested players during local selection processing', () => {
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
    }, {
      preservePlayerKeys: ['white']
    })).toEqual({
      cleared: [],
      retained: ['white']
    });
    expect(PendingCoordinator.readPendingSelectionAction('white')).toEqual(expect.objectContaining({
      type: 'place',
      anchor: { row: 4, col: 4 }
    }));
  });
});
