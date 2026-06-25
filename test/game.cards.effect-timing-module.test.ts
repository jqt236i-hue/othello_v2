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

    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
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
      modules: {
        CardWorkModule: { processWorkEffects }
      }
    });

    expect(summary).toEqual({
      ribo: {
        entries: [{ id: 'ribo-1' }],
        totalRepaid: 1,
        totalDestroyed: 0,
        completedCount: 1
      },
      observerWill: {
        entries: [],
        totalRepaid: 0,
        totalDestroyed: 0,
        completedCount: 0
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

  test('onTurnStart emits STATUS_REMOVED when FREEZE duration ends', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const removeMarkersAt = jest.fn();
    const emitPresentationEvent = jest.fn();
    const markers = [
      { row: 5, col: 5, owner: 'black', data: { type: 'FREEZE', remainingOwnerTurns: 1 } }
    ];
    const cardState = {
      turnCountByPlayer: { black: 0, white: 0 },
      turnIndex: 0,
      lastTurnStartedFor: null,
      breedingSproutByOwner: { black: [], white: [] },
      _breedingSproutClearedTokenByOwner: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 },
      presentationEvents: [],
      debugNoDraw: true
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    CardEffectTiming.onTurnStart(cardState, 'black', gameState, null, {
      defaultPrng: { next: () => 0.5 },
      constants: {
        EMPTY: 0,
        DRAW_INTERVAL: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
      },
      helpers: {
        ensureHandDestroyFlags: jest.fn(),
        processRiboWillTurnStartEffects: jest.fn(() => null),
        commitDraw: jest.fn(),
        getSpecialMarkers: jest.fn(() => markers),
        removeMarkersAt,
        isFrozenCellForCard: jest.fn(() => false),
        emitPresentationEvent
      },
      modules: {}
    });

    expect(emitPresentationEvent).toHaveBeenCalledWith(cardState, expect.objectContaining({
      type: 'STATUS_REMOVED',
      row: 5,
      col: 5,
      reason: 'duration_end',
      meta: expect.objectContaining({ special: 'FREEZE', reason: 'duration_end' })
    }));
    expect(removeMarkersAt).toHaveBeenCalledWith(cardState, 5, 5, {
      kind: 'specialStone',
      type: 'FREEZE',
      owner: 'black'
    });
  });

  test('onTurnStart decrements and expires SACRIFICE markers in direct path without clearing board stone', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const emitPresentationEvent = jest.fn();
    const cardState = {
      turnCountByPlayer: { black: 0, white: 0 },
      turnIndex: 0,
      lastTurnStartedFor: null,
      breedingSproutByOwner: { black: [], white: [] },
      _breedingSproutClearedTokenByOwner: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 },
      presentationEvents: [],
      debugNoDraw: true,
      markers: [
        { kind: 'specialStone', row: 3, col: 4, owner: 'black', data: { type: 'SACRIFICE', remainingOwnerTurns: 1 } },
        { kind: 'specialStone', row: 2, col: 5, owner: 'black', data: { type: 'SACRIFICE', remainingOwnerTurns: 5 } },
        { kind: 'specialStone', row: 1, col: 1, owner: 'white', data: { type: 'SACRIFICE', remainingOwnerTurns: 1 } }
      ]
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    gameState.board[3][4] = 1;
    gameState.board[2][5] = 1;
    gameState.board[1][1] = -1;
    const removeMarkersAt = jest.fn((state, row, col, opts) => {
      state.markers = state.markers.filter((marker) => !(
        marker &&
        marker.row === row &&
        marker.col === col &&
        marker.kind === opts.kind &&
        marker.owner === opts.owner &&
        marker.data &&
        marker.data.type === opts.type
      ));
    });

    CardEffectTiming.onTurnStart(cardState, 'black', gameState, null, {
      defaultPrng: { next: () => 0.5 },
      constants: {
        EMPTY: 0,
        DRAW_INTERVAL: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
      },
      helpers: {
        ensureHandDestroyFlags: jest.fn(),
        processRiboWillTurnStartEffects: jest.fn(() => null),
        commitDraw: jest.fn(),
        getSpecialMarkers: jest.fn((state) => state.markers),
        removeMarkersAt,
        isFrozenCellForCard: jest.fn(() => false),
        emitPresentationEvent
      },
      modules: {}
    });

    expect(gameState.board[3][4]).toBe(1);
    expect(removeMarkersAt).toHaveBeenCalledWith(cardState, 3, 4, {
      kind: 'specialStone',
      type: 'SACRIFICE',
      owner: 'black'
    });
    expect(cardState.markers).not.toContainEqual(expect.objectContaining({ row: 3, col: 4 }));
    expect(cardState.markers).toContainEqual(expect.objectContaining({
      row: 2,
      col: 5,
      data: { type: 'SACRIFICE', remainingOwnerTurns: 4 }
    }));
    expect(cardState.markers).toContainEqual(expect.objectContaining({
      row: 1,
      col: 1,
      data: { type: 'SACRIFICE', remainingOwnerTurns: 1 }
    }));
    expect(emitPresentationEvent).toHaveBeenCalledWith(cardState, expect.objectContaining({
      type: 'STATUS_REMOVED',
      row: 3,
      col: 4,
      reason: 'duration_end',
      meta: expect.objectContaining({ special: 'SACRIFICE', reason: 'duration_end' })
    }));
  });

  test('onTurnStart keeps PERMA_PROTECTED markers unchanged', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const emitPresentationEvent = jest.fn();
    const markers = [
      {
        row: 2,
        col: 3,
        owner: 'black',
        data: { type: 'PERMA_PROTECTED' }
      }
    ];
    const cardState = {
      markers,
      turnCountByPlayer: { black: 0, white: 0 },
      turnIndex: 0,
      lastTurnStartedFor: null,
      breedingSproutByOwner: { black: [], white: [] },
      _breedingSproutClearedTokenByOwner: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 },
      presentationEvents: [],
      debugNoDraw: true
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    CardEffectTiming.onTurnStart(cardState, 'black', gameState, null, {
      defaultPrng: { next: () => 0.5 },
      constants: {
        EMPTY: 0,
        DRAW_INTERVAL: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
      },
      helpers: {
        ensureHandDestroyFlags: jest.fn(),
        processRiboWillTurnStartEffects: jest.fn(() => null),
        commitDraw: jest.fn(),
        getSpecialMarkers: jest.fn(() => markers),
        removeMarkersAt: jest.fn(),
        isFrozenCellForCard: jest.fn(() => false),
        emitPresentationEvent
      },
      modules: {}
    });

    expect(markers[0].data).toEqual({ type: 'PERMA_PROTECTED' });
    expect(emitPresentationEvent).not.toHaveBeenCalledWith(cardState, expect.objectContaining({
      type: 'STATUS_APPLIED',
      row: 2,
      col: 3
    }));
  });

  test('applyPlacementEffects handles last resort continuation without clearing pending effect', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const addChargeWithTotal = jest.fn();
    const cardState = {
      pendingEffectByPlayer: {
        black: { type: 'LAST_RESORT', placementsRemaining: 3 },
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

    expect(addChargeWithTotal).toHaveBeenCalledWith(cardState, 'black', 3, expect.objectContaining({
      popupKind: 'board',
      sourceType: 'placement_flip_gain',
      anchorRow: 4,
      anchorCol: 4
    }));
    expect(effects).toMatchObject({
      chargeGained: 3,
      freePlacementUsed: true,
      lastResortContinues: true
    });
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({ type: 'LAST_RESORT', placementsRemaining: 2 }));
    expect(cardState.extraPlaceRemainingByPlayer.black).toBe(1);
  });

  test('applyPlacementEffects places SACRIFICE marker with five owner turns', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const addMarker = jest.fn((cardState, kind, row, col, owner, data) => {
      if (!Array.isArray(cardState.markers)) cardState.markers = [];
      cardState.markers.push({ kind, row, col, owner, data });
    });
    const cardState = {
      markers: [],
      pendingEffectByPlayer: { black: { type: 'SACRIFICE_WILL' }, white: null },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 },
      workNextPlacementArmedByPlayer: { black: false, white: false }
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const effects = CardEffectTiming.applyPlacementEffects(cardState, gameState, 'black', 2, 5, 0, {
      constants: {
        BLACK: 1,
        WHITE: -1,
        EMPTY: 0,
        FLIP_CHARGE_MULTIPLIER_EFFECTS: {},
        DOUBLE_PLACE_EXTRA: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' },
        SACRIFICE_WILL_TURNS: 5
      },
      helpers: {
        addChargeWithTotal: jest.fn(),
        addMarker,
        workDebugLog: jest.fn(),
        workDebugError: jest.fn()
      },
      modules: {}
    });

    expect(effects).toMatchObject({ sacrificePlaced: true });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.markers).toEqual([
      expect.objectContaining({
        kind: 'specialStone',
        row: 2,
        col: 5,
        owner: 'black',
        data: { type: 'SACRIFICE', remainingOwnerTurns: 5 }
      })
    ]);
  });

  test('processTurnStartStatusMarkerAnchor expires SACRIFICE marker without clearing board stone', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const removeMarkersAt = jest.fn();
    const emitPresentationEvent = jest.fn();
    const marker = {
      kind: 'specialStone',
      row: 3,
      col: 4,
      owner: 'black',
      data: { type: 'SACRIFICE', remainingOwnerTurns: 1 }
    };
    const cardState = { markers: [marker], presentationEvents: [] };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    gameState.board[3][4] = 1;

    const result = CardEffectTiming.processTurnStartStatusMarkerAnchor(cardState, gameState, 'black', marker, {
      constants: {
        BLACK: 1,
        WHITE: -1,
        EMPTY: 0,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
      },
      helpers: {
        removeMarkersAt,
        emitPresentationEvent
      },
      modules: {}
    });

    expect(result).toMatchObject({
      processed: true,
      expired: [{ row: 3, col: 4, owner: 'black', type: 'SACRIFICE' }]
    });
    expect(gameState.board[3][4]).toBe(1);
    expect(removeMarkersAt).toHaveBeenCalledWith(cardState, 3, 4, {
      kind: 'specialStone',
      type: 'SACRIFICE',
      owner: 'black'
    });
    expect(emitPresentationEvent).toHaveBeenCalledWith(cardState, expect.objectContaining({
      type: 'STATUS_REMOVED',
      row: 3,
      col: 4,
      reason: 'duration_end',
      meta: expect.objectContaining({ special: 'SACRIFICE', reason: 'duration_end' })
    }));
  });

  test('onTurnStart uses injected CardWorkModule when available', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const processWorkEffects = jest.fn(() => ({
      gained: 2,
      row: 3,
      col: 4,
      removed: false,
      incomeStep: 1
    }));
    const emitPresentationEvent = jest.fn((cardState, event) => {
      if (!Array.isArray(cardState.presentationEvents)) cardState.presentationEvents = [];
      cardState.presentationEvents.push(event);
    });
    const cardState = {
      turnCountByPlayer: { black: 0, white: 0 },
      turnIndex: 0,
      lastTurnStartedFor: null,
      breedingSproutByOwner: { black: [], white: [] },
      _breedingSproutClearedTokenByOwner: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 },
      presentationEvents: [],
      debugNoDraw: true
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    CardEffectTiming.onTurnStart(cardState, 'black', gameState, null, {
      defaultPrng: { next: () => 0.5 },
      constants: {
        EMPTY: 0,
        DRAW_INTERVAL: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
      },
      helpers: {
        ensureHandDestroyFlags: jest.fn(),
        processRiboWillTurnStartEffects: jest.fn(() => ({
          entries: [],
          totalRepaid: 0,
          totalDestroyed: 0,
          completedCount: 0
        })),
        commitDraw: jest.fn(),
        getSpecialMarkers: jest.fn(() => []),
        removeMarkersAt: jest.fn(),
        isFrozenCellForCard: jest.fn(() => false),
        emitPresentationEvent
      },
      modules: {
        CardWorkModule: { processWorkEffects }
      }
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

  test('applyPlacementEffects uses injected CardWorkModule for armed WORK_WILL placement', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const addMarker = jest.fn((cardState, kind, row, col, owner, data) => {
      if (!Array.isArray(cardState.markers)) cardState.markers = [];
      cardState.markers.push({ kind, row, col, owner, data });
      return { placed: true };
    });
    const placeWorkStone = jest.fn((cardState, gameState, playerKey, row, col, deps) => {
      deps.addMarker(cardState, 'specialStone', row, col, playerKey, {
        type: 'WORK',
        ownerColor: playerKey,
        workStage: 0,
        remainingOwnerTurns: 5
      });
      if (!cardState.workAnchorPosByPlayer) {
        cardState.workAnchorPosByPlayer = { black: null, white: null };
      }
      cardState.workAnchorPosByPlayer[playerKey] = { row, col };
      return { placed: true };
    });
    const cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null },
      workAnchorPosByPlayer: { black: null, white: null },
      workNextPlacementArmedByPlayer: { black: true, white: false },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 }
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const effects = CardEffectTiming.applyPlacementEffects(cardState, gameState, 'black', 4, 4, 0, {
      constants: {
        BLACK: 1,
        WHITE: -1,
        EMPTY: 0,
        FLIP_CHARGE_MULTIPLIER_EFFECTS: {},
        DOUBLE_PLACE_EXTRA: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' }
      },
      helpers: {
        addChargeWithTotal: jest.fn(),
        addMarker,
        workDebugLog: jest.fn(),
        workDebugError: jest.fn()
      },
      modules: {
        CardWorkModule: { placeWorkStone }
      }
    });

    expect(placeWorkStone).toHaveBeenCalledWith(cardState, gameState, 'black', 4, 4, { addMarker });
    expect(effects).toMatchObject({ workPlaced: true });
    expect(cardState.workNextPlacementArmedByPlayer.black).toBe(false);
    expect(cardState.workAnchorPosByPlayer.black).toEqual({ row: 4, col: 4 });
    expect(cardState.markers).toEqual([
      expect.objectContaining({
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'black',
        data: expect.objectContaining({ type: 'WORK' })
      })
    ]);
  });

  test('applyPlacementEffects preserves armed WORK_WILL when injected CardWorkModule is missing', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const workDebugLog = jest.fn();
    const cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null },
      workAnchorPosByPlayer: { black: null, white: null },
      workNextPlacementArmedByPlayer: { black: true, white: false },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 }
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const effects = CardEffectTiming.applyPlacementEffects(cardState, gameState, 'black', 4, 4, 0, {
      constants: {
        BLACK: 1,
        WHITE: -1,
        EMPTY: 0,
        FLIP_CHARGE_MULTIPLIER_EFFECTS: {},
        DOUBLE_PLACE_EXTRA: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' }
      },
      helpers: {
        addChargeWithTotal: jest.fn(),
        addMarker: jest.fn(),
        workDebugLog,
        workDebugError: jest.fn()
      },
      modules: {}
    });

    expect(effects.workPlaced).toBeUndefined();
    expect(cardState.workNextPlacementArmedByPlayer.black).toBe(true);
    expect(cardState.workAnchorPosByPlayer.black).toBeNull();
    expect(cardState.markers).toEqual([]);
    expect(workDebugLog).toHaveBeenCalledWith(cardState, '[WORK_DEBUG] workMod.placeWorkStone not available, workMod:', false);
  });

  test('applyPlacementEffects preserves armed WORK_WILL when injected CardWorkModule throws', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const workDebugError = jest.fn();
    const placeWorkStone = jest.fn(() => {
      throw new Error('boom');
    });
    const cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null },
      workAnchorPosByPlayer: { black: null, white: null },
      workNextPlacementArmedByPlayer: { black: true, white: false },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 }
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const effects = CardEffectTiming.applyPlacementEffects(cardState, gameState, 'black', 4, 4, 0, {
      constants: {
        BLACK: 1,
        WHITE: -1,
        EMPTY: 0,
        FLIP_CHARGE_MULTIPLIER_EFFECTS: {},
        DOUBLE_PLACE_EXTRA: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' }
      },
      helpers: {
        addChargeWithTotal: jest.fn(),
        addMarker: jest.fn(),
        workDebugLog: jest.fn(),
        workDebugError
      },
      modules: {
        CardWorkModule: { placeWorkStone }
      }
    });

    expect(placeWorkStone).toHaveBeenCalled();
    expect(effects.workPlaced).toBeUndefined();
    expect(cardState.workNextPlacementArmedByPlayer.black).toBe(true);
    expect(cardState.markers).toEqual([]);
    expect(workDebugError).toHaveBeenCalledWith(cardState, '[WORK_DEBUG] placeWorkStone threw', 'boom');
  });

  test('applyPlacementEffects preserves armed WORK_WILL when injected CardWorkModule reports not placed', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const workDebugLog = jest.fn();
    const placeWorkStone = jest.fn(() => ({ placed: false }));
    const cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null },
      workAnchorPosByPlayer: { black: null, white: null },
      workNextPlacementArmedByPlayer: { black: true, white: false },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 }
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const effects = CardEffectTiming.applyPlacementEffects(cardState, gameState, 'black', 4, 4, 0, {
      constants: {
        BLACK: 1,
        WHITE: -1,
        EMPTY: 0,
        FLIP_CHARGE_MULTIPLIER_EFFECTS: {},
        DOUBLE_PLACE_EXTRA: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' }
      },
      helpers: {
        addChargeWithTotal: jest.fn(),
        addMarker: jest.fn(),
        workDebugLog,
        workDebugError: jest.fn()
      },
      modules: {
        CardWorkModule: { placeWorkStone }
      }
    });

    expect(placeWorkStone).toHaveBeenCalled();
    expect(effects.workPlaced).toBeUndefined();
    expect(cardState.workNextPlacementArmedByPlayer.black).toBe(true);
    expect(workDebugLog).toHaveBeenCalledWith(cardState, '[WORK_DEBUG] placeWorkStone returned not placed for', 'black', 4, 4);
  });

  test('applyPlacementEffects preserves armed WORK_WILL when injected CardWorkModule returns undefined', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const workDebugLog = jest.fn();
    const placeWorkStone = jest.fn(() => undefined);
    const cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null },
      workAnchorPosByPlayer: { black: null, white: null },
      workNextPlacementArmedByPlayer: { black: true, white: false },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 }
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const effects = CardEffectTiming.applyPlacementEffects(cardState, gameState, 'black', 4, 4, 0, {
      constants: {
        BLACK: 1,
        WHITE: -1,
        EMPTY: 0,
        FLIP_CHARGE_MULTIPLIER_EFFECTS: {},
        DOUBLE_PLACE_EXTRA: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' }
      },
      helpers: {
        addChargeWithTotal: jest.fn(),
        addMarker: jest.fn(),
        workDebugLog,
        workDebugError: jest.fn()
      },
      modules: {
        CardWorkModule: { placeWorkStone }
      }
    });

    expect(placeWorkStone).toHaveBeenCalled();
    expect(effects.workPlaced).toBeUndefined();
    expect(cardState.workNextPlacementArmedByPlayer.black).toBe(true);
    expect(cardState.markers).toEqual([]);
    expect(workDebugLog).toHaveBeenCalledWith(cardState, '[WORK_DEBUG] placeWorkStone returned not placed for', 'black', 4, 4);
  });

  test('applyPlacementEffects preserves armed WORK_WILL when injected CardWorkModule returns empty object', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const workDebugLog = jest.fn();
    const placeWorkStone = jest.fn(() => ({}));
    const cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null },
      workAnchorPosByPlayer: { black: null, white: null },
      workNextPlacementArmedByPlayer: { black: true, white: false },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 }
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const effects = CardEffectTiming.applyPlacementEffects(cardState, gameState, 'black', 4, 4, 0, {
      constants: {
        BLACK: 1,
        WHITE: -1,
        EMPTY: 0,
        FLIP_CHARGE_MULTIPLIER_EFFECTS: {},
        DOUBLE_PLACE_EXTRA: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' }
      },
      helpers: {
        addChargeWithTotal: jest.fn(),
        addMarker: jest.fn(),
        workDebugLog,
        workDebugError: jest.fn()
      },
      modules: {
        CardWorkModule: { placeWorkStone }
      }
    });

    expect(placeWorkStone).toHaveBeenCalled();
    expect(effects.workPlaced).toBeUndefined();
    expect(cardState.workNextPlacementArmedByPlayer.black).toBe(true);
    expect(cardState.markers).toEqual([]);
    expect(workDebugLog).toHaveBeenCalledWith(cardState, '[WORK_DEBUG] placeWorkStone returned not placed for', 'black', 4, 4);
  });

  test('applyPlacementEffects uses injected placement effect modules', () => {
    const CardEffectTiming = require('../game/logic/cards-internal/effect-timing.js');
    const applyProtectedNextStone = jest.fn(() => ({ applied: true }));
    const applyPermaProtectNextStone = jest.fn(() => ({ applied: true }));
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const protectedState = {
      pendingEffectByPlayer: { black: { type: 'PROTECTED_NEXT_STONE' }, white: null },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 },
      workNextPlacementArmedByPlayer: { black: false, white: false }
    };
    const protectedEffects = CardEffectTiming.applyPlacementEffects(protectedState, gameState, 'black', 2, 3, 0, {
      constants: {
        BLACK: 1,
        WHITE: -1,
        EMPTY: 0,
        FLIP_CHARGE_MULTIPLIER_EFFECTS: {},
        DOUBLE_PLACE_EXTRA: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' }
      },
      helpers: {
        addChargeWithTotal: jest.fn(),
        addMarker: jest.fn(),
        workDebugLog: jest.fn(),
        workDebugError: jest.fn()
      },
      modules: {
        ProtectedNextStoneModule: { applyProtectedNextStone }
      }
    });

    expect(applyProtectedNextStone).toHaveBeenCalledWith(protectedState, 'black', 2, 3);
    expect(protectedEffects).toMatchObject({ protected: true });

    const permaState = {
      pendingEffectByPlayer: { black: { type: 'PERMA_PROTECT_NEXT_STONE' }, white: null },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 },
      workNextPlacementArmedByPlayer: { black: false, white: false }
    };
    const permaEffects = CardEffectTiming.applyPlacementEffects(permaState, gameState, 'black', 1, 1, 0, {
      constants: {
        BLACK: 1,
        WHITE: -1,
        EMPTY: 0,
        FLIP_CHARGE_MULTIPLIER_EFFECTS: {},
        DOUBLE_PLACE_EXTRA: 1,
        MARKER_KINDS: { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' }
      },
      helpers: {
        addChargeWithTotal: jest.fn(),
        addMarker: jest.fn(),
        workDebugLog: jest.fn(),
        workDebugError: jest.fn()
      },
      modules: {
        PermaProtectNextStoneModule: { applyPermaProtectNextStone }
      }
    });

    expect(applyPermaProtectNextStone).toHaveBeenCalledWith(permaState, 'black', 1, 1);
    expect(permaEffects).toMatchObject({ permaProtected: true });
  });
});
