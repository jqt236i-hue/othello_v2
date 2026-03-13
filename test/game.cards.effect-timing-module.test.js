describe('CardEffectTiming module', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock('../game/logic/cards/work_will');
    jest.resetModules();
  });

  test('onTurnStart resets flags, processes ribo, and emits work income', () => {
    const processWorkEffects = jest.fn(() => ({
      gained: 2,
      row: 3,
      col: 4,
      removed: false,
      incomeStep: 1
    }));

    jest.doMock('../game/logic/cards/work_will', () => ({
      processWorkEffects
    }));

    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing');
    const processRiboWillTurnStartEffects = jest.fn(() => ({
      entries: [{ id: 'ribo-1' }],
      totalRepaid: 1,
      totalDestroyed: 0,
      completedCount: 1
    }));
    const commitDraw = jest.fn();
    const removeMarkersAt = jest.fn();
    const emitPresentationEvent = jest.fn((cardState, event) => {
      if (!Array.isArray(cardState.presentationEvents)) cardState.presentationEvents = [];
      cardState.presentationEvents.push(event);
    });

    const markers = [
      { row: 1, col: 2, owner: 'black', data: { type: 'GUARD', remainingOwnerTurns: 1 } },
      { row: 5, col: 5, owner: 'white', data: { type: 'FREEZE', remainingOwnerTurns: 2 } }
    ];
    const cardState = {
      turnCountByPlayer: { black: 0, white: 0 },
      turnIndex: 0,
      lastTurnStartedFor: null,
      breedingSproutByOwner: { black: [{ row: 7, col: 7 }], white: [] },
      _breedingSproutClearedTokenByOwner: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: true, white: false },
      extraPlaceRemainingByPlayer: { black: 2, white: 0 },
      presentationEvents: [],
      debugNoDraw: false
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const summary = CardEffectTiming.onTurnStart(cardState, 'black', gameState, null, {
      defaultPrng: { next: () => 0.5 },
      constants: {
        EMPTY: 0,
        DRAW_INTERVAL: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
      },
      helpers: {
        ensureHandDestroyFlags: jest.fn(),
        processRiboWillTurnStartEffects,
        commitDraw,
        getSpecialMarkers: jest.fn(() => markers),
        removeMarkersAt,
        isFrozenCellForCard: jest.fn(() => false),
        emitPresentationEvent
      },
      modules: {}
    });

    expect(summary).toEqual({
      ribo: {
        entries: [{ id: 'ribo-1' }],
        totalRepaid: 1,
        totalDestroyed: 0,
        completedCount: 1
      }
    });
    expect(cardState.turnCountByPlayer.black).toBe(1);
    expect(cardState.turnIndex).toBe(1);
    expect(cardState.lastTurnStartedFor).toBe('black');
    expect(cardState.hasUsedCardThisTurnByPlayer.black).toBe(false);
    expect(cardState.hasDestroyedCardThisTurnByPlayer.black).toBe(false);
    expect(cardState.extraPlaceRemainingByPlayer.black).toBe(0);
    expect(cardState.breedingSproutByOwner.black).toEqual([]);
    expect(commitDraw).toHaveBeenCalledWith(cardState, 'black', expect.any(Object));
    expect(processRiboWillTurnStartEffects).toHaveBeenCalledWith(cardState, gameState, 'black', expect.any(Object));
    expect(removeMarkersAt).toHaveBeenCalledWith(cardState, 1, 2, {
      kind: 'specialStone',
      type: 'GUARD',
      owner: 'black'
    });
    expect(processWorkEffects).toHaveBeenCalledWith(cardState, gameState, 'black');
    expect(emitPresentationEvent).toHaveBeenCalledWith(cardState, expect.objectContaining({
      type: 'WORK_INCOME',
      player: 'black',
      row: 3,
      col: 4,
      gained: 2
    }));
  });

  test('applyPlacementEffects handles last resort continuation without clearing pending effect', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing');
    const addChargeWithTotal = jest.fn();
    const cardState = {
      pendingEffectByPlayer: {
        black: { type: 'LAST_RESORT', placementsRemaining: 2 },
        white: null
      },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 },
      workNextPlacementArmedByPlayer: { black: false, white: false }
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const effects = CardEffectTiming.applyPlacementEffects(cardState, gameState, 'black', 4, 4, 3, {
      constants: {
        BLACK: 1,
        WHITE: -1,
        EMPTY: 0,
        FLIP_CHARGE_MULTIPLIER_EFFECTS: {},
        DOUBLE_PLACE_EXTRA: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' }
      },
      helpers: {
        addChargeWithTotal,
        workDebugLog: jest.fn(),
        workDebugError: jest.fn()
      },
      modules: {}
    });

    expect(addChargeWithTotal).toHaveBeenCalledWith(cardState, 'black', 3);
    expect(effects).toMatchObject({
      chargeGained: 3,
      freePlacementUsed: true,
      lastResortContinues: true
    });
    expect(cardState.pendingEffectByPlayer.black).toEqual({ type: 'LAST_RESORT', placementsRemaining: 1 });
    expect(cardState.extraPlaceRemainingByPlayer.black).toBe(1);
  });
});