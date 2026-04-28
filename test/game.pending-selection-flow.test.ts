import * as flow from '../game/card-effects/selection-flow.js';
import * as PendingCoordinator from '../game/turn/pending-coordinator.js';
import * as Core from '../game/logic/core.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as TurnPipelineUIAdapter from '../game/turn/pipeline_ui_adapter.js';
import * as BoardExpansionEffects from '../game/card-effects/board-expansion.js';
import * as BoardShrinkEffects from '../game/card-effects/board-shrink.js';

function attachPlaybackStateManager() {
  import * as playbackStateManager from '../ui/playback-state-manager.js';
  playbackStateManager.clearPlaybackLock();
  global.PlaybackStateManager = playbackStateManager;
  flow.setSignalBridge({
    getPlaybackStateManager: () => playbackStateManager,
    waitForPlaybackIdle: () => {
      if (typeof global.waitForPlaybackIdle === 'function') {
        return global.waitForPlaybackIdle();
      }
      return undefined;
    },
    publishSnapshot: (meta) => {
      if (!global.NetworkMatchClient || typeof global.NetworkMatchClient.publishSnapshot !== 'function') {
        return undefined;
      }
      if (typeof global.NetworkMatchClient.isActive === 'function' && !global.NetworkMatchClient.isActive()) {
        return undefined;
      }
      return global.NetworkMatchClient.publishSnapshot(meta);
    },
    isNetworkPublishActive: () => {
      if (!global.NetworkMatchClient || typeof global.NetworkMatchClient.publishSnapshot !== 'function') {
        return false;
      }
      if (typeof global.NetworkMatchClient.isActive === 'function') {
        return global.NetworkMatchClient.isActive() === true;
      }
      return true;
    },
    emitPlaybackEvents: (events, meta, cardStateValue) => {
      import * as presentationHelper from '../game/logic/presentation.js';
      return presentationHelper.emitPresentationEvent(cardStateValue || global.cardState || null, {
        type: 'PLAYBACK_EVENTS',
        events,
        meta: meta || {}
      }) === true;
    },
    emitStateChanges: () => {
      let emitted = false;
      ['emitCardStateChange', 'emitBoardUpdate', 'emitGameStateChange'].forEach((name) => {
        if (typeof global[name] === 'function') {
          global[name]();
          emitted = true;
        }
      });
      return emitted;
    },
    emitMessage: (text) => {
      if (!text || typeof global.emitLogAdded !== 'function') return false;
      global.emitLogAdded(text);
      return true;
    },
    emitBoardUpdate: () => {
      if (typeof global.emitBoardUpdate !== 'function') return false;
      global.emitBoardUpdate();
      return true;
    }
  });
  return playbackStateManager;
}

describe('pending selection flow contracts', () => {
  afterEach(() => {
    try {
      attachPlaybackStateManager().clearPlaybackLock();
    } catch (e) { /* ignore */ }
    try {
      PendingCoordinator.clearPendingSelectionActionCache();
    } catch (e) { /* ignore */ }
    delete global.ActionManager;
    delete global.cardState;
    delete global.NetworkMatchClient;
    delete global.MATCH_MODE;
    delete global.PlaybackStateManager;
    delete global.TurnPipelineUIAdapter;
    delete global.TurnPipeline;
    delete global.emitCardStateChange;
    delete global.emitBoardUpdate;
    delete global.emitGameStateChange;
    delete global.waitForPlaybackIdle;
    delete global.ensureCurrentPlayerCanActOrPass;
    delete global.isProcessing;
    delete global.isCardAnimating;
    try {
      if (global.window) {
        delete global.window.isProcessing;
        delete global.window.isCardAnimating;
      }
    } catch (e) { /* ignore */ }
    flow.clearSignalBridge();
    jest.clearAllMocks();
  });

  test('shared contract distinguishes end-turn and continue-turn selections', () => {
    expect(flow.shouldDeferNetworkPublishForPendingType('GUARD_WILL')).toBe(true);
    expect(flow.shouldDeferNetworkPublishForPendingType('HEAVEN_BLESSING')).toBe(true);
    expect(flow.isSelectionOnlyEndTurnPendingType('GUARD_WILL')).toBe(false);
    expect(flow.isSelectionOnlyEndTurnPendingType('TRAP_WILL')).toBe(true);
  });

  test('busy fallback stays local without mutating legacy global flags when PlaybackStateManager is unavailable', async () => {
    delete global.PlaybackStateManager;
    global.isProcessing = false;
    global.isCardAnimating = false;
    if (global.window) {
      global.window.isProcessing = false;
      global.window.isCardAnimating = false;
    }

    flow.setSelectionBusy(true);
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
    if (global.window) {
      expect(global.window.isProcessing).toBe(false);
      expect(global.window.isCardAnimating).toBe(false);
    }
    await expect(flow.executePendingSelection({ row: 0, col: 0, playerKey: 'black' })).resolves.toEqual({ ok: false, reason: 'busy' });

    flow.setSelectionBusy(false);
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
    if (global.window) {
      expect(global.window.isProcessing).toBe(false);
      expect(global.window.isCardAnimating).toBe(false);
    }
  });

  test('selection entry handoff allows pending selection while card animation flag is still active', async () => {
    const playbackStateManager = attachPlaybackStateManager();
    playbackStateManager.armSelectionEntryPlaybackContext({
      playerKey: 'black',
      pendingType: 'GUARD_WILL',
      source: 'test',
      reason: 'selection_entry',
      expiresAt: Date.now() + 1000
    });
    playbackStateManager.setBusyState({ processing: false, cardAnimating: true, playbackActive: false });
    global.cardState = {
      turnIndex: 9,
      pendingEffectByPlayer: {
        black: { type: 'GUARD_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 10,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { black: null, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };
    global.emitBoardUpdate = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();

    const result = await flow.executePendingSelection({
      row: 3,
      col: 4,
      playerKey: 'black',
      pendingType: 'GUARD_WILL',
      actionPayload: {
        guardTarget: { row: 3, col: 4 }
      }
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'GUARD_WILL'
    }));
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
  });

  test('network deferred selection falls back to root NetworkMatchClient without signal bridge', async () => {
    flow.clearSignalBridge();
    global.MATCH_MODE = 'network';
    global.cardState = {
      turnIndex: 11,
      pendingEffectByPlayer: {
        black: { type: 'SUPER_GRAVITY_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 13,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn(() => Promise.resolve({ ok: true }))
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => {
        throw new Error('runTurnWithAdapter should not be called for network deferred publish-only selection');
      })
    };

    const result = await flow.executePendingSelection({
      row: 2,
      col: 4,
      playerKey: 'black',
      pendingType: 'SUPER_GRAVITY_WILL',
      actionPayload: {
        superGravityTarget: { row: 2, col: 4 }
      }
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'SUPER_GRAVITY_WILL',
      publishedByNetwork: true
    }));
    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place',
      action: expect.objectContaining({
        superGravityTarget: { row: 2, col: 4 },
        deferNetworkPublish: true,
        turnIndex: 11
      })
    }));
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
  });

  test('network deferred selection falls back to root NetworkMatchClient when signal bridge activity probe throws', async () => {
    flow.setSignalBridge({
      isNetworkPublishActive: () => {
        throw new Error('probe failed');
      }
    });
    global.MATCH_MODE = 'network';
    global.cardState = {
      turnIndex: 12,
      pendingEffectByPlayer: {
        black: { type: 'SUPER_GRAVITY_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 14,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn(() => Promise.resolve({ ok: true }))
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => {
        throw new Error('runTurnWithAdapter should not be called for network deferred publish-only selection');
      })
    };

    const result = await flow.executePendingSelection({
      row: 2,
      col: 5,
      playerKey: 'black',
      pendingType: 'SUPER_GRAVITY_WILL',
      actionPayload: {
        superGravityTarget: { row: 2, col: 5 }
      }
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'SUPER_GRAVITY_WILL',
      publishedByNetwork: true
    }));
    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place',
      action: expect.objectContaining({
        superGravityTarget: { row: 2, col: 5 },
        deferNetworkPublish: true,
        turnIndex: 12
      })
    }));
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
  });

  test('createPendingSelectionAction injects defer flag for known selection actions', () => {
    global.cardState = { turnIndex: 7 };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };

    const action = flow.createPendingSelectionAction('black', 'HEAVEN_BLESSING', { heavenBlessingCardId: 'offer_card' }, { cardState: global.cardState });

    expect(action.type).toBe('place');
    expect(action.heavenBlessingCardId).toBe('offer_card');
    expect(action.deferNetworkPublish).toBe(true);
    expect(action.turnIndex).toBe(7);
  });

  test('publish-success deferred preview does not overwrite authoritative snapshot state', async () => {
    attachPlaybackStateManager();
    global.MATCH_MODE = 'network';
    global.cardState = {
      turnIndex: 12,
      charge: { black: 10, white: 0 },
      pendingEffectByPlayer: {
        black: { type: 'SUPER_GRAVITY_WILL', stage: 'selectTarget', pendingEffectId: 'pending_12_2' },
        white: null
      },
      presentationEvents: [],
      _presentationEventsPersist: []
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 20,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn(() => {
        global.cardState = {
          ...global.cardState,
          charge: { black: 42, white: 0 },
          pendingEffectByPlayer: { black: null, white: null }
        };
        global.gameState = {
          ...global.gameState,
          turnNumber: 21
        };
        return Promise.resolve({ ok: true });
      })
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          charge: { black: 11, white: 0 },
          pendingEffectByPlayer: { black: null, white: null }
        },
        nextGameState: {
          ...global.gameState,
          turnNumber: 99
        },
        playbackEvents: []
      }))
    };

    const result = await flow.executePendingSelection({
      row: 2,
      col: 4,
      playerKey: 'black',
      pendingType: 'SUPER_GRAVITY_WILL',
      actionPayload: {
        superGravityTarget: { row: 2, col: 4 }
      }
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'SUPER_GRAVITY_WILL',
      publishedByNetwork: true
    }));
    expect(global.cardState.charge.black).toBe(42);
    expect(global.gameState.turnNumber).toBe(21);
    expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('BOARD_EXPANSION_GOD final network preview does not reapply card usage from pending card identity', async () => {
    attachPlaybackStateManager();
    global.MATCH_MODE = 'network';
    global.cardState = {
      turnIndex: 19,
      pendingEffectByPlayer: {
        black: {
          type: 'BOARD_EXPANSION_GOD',
          stage: 'selectTarget',
          cardId: 'board_expand_god_01',
          sourceHandIndex: 0,
          selectedCount: 1,
          maxSelections: 2,
          selectedTargets: [{ row: 0, col: 0 }]
        },
        white: null
      },
      hands: { black: [], white: [] },
      charge: { black: 99, white: 50 },
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: { black: 'board_expand_god_01', white: null },
      markers: [],
      discard: ['board_expand_god_01']
    };
    global.gameState = Core.createGameState();
    global.gameState.currentPlayer = Core.BLACK;
    global.gameState.turnNumber = 20;
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = TurnPipeline;
    global.TurnPipelineUIAdapter = TurnPipelineUIAdapter;
    global.NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn(() => Promise.resolve({ ok: true }))
    };

    const result = await BoardExpansionEffects.handleBoardExpansionSelection(7, 7, 'black');

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'BOARD_EXPANSION_GOD',
      publishedByNetwork: true
    }));
    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.not.objectContaining({
        useCardId: expect.anything(),
        useCardOwnerKey: expect.anything()
      })
    }));
    expect(global.cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      cardId: 'board_expand_god_01',
      selectedCount: 1,
      selectedTargets: [{ row: 0, col: 0 }]
    }));
  });

  test('BOARD_SHRINK_GOD final network preview does not reapply card usage from pending card identity', async () => {
    attachPlaybackStateManager();
    global.MATCH_MODE = 'network';
    global.cardState = {
      turnIndex: 19,
      pendingEffectByPlayer: {
        black: {
          type: 'BOARD_SHRINK_GOD',
          stage: 'selectTarget',
          cardId: 'board_shrink_god_01',
          sourceHandIndex: 0,
          firstTarget: { row: 0, col: 0 }
        },
        white: null
      },
      hands: { black: [], white: [] },
      charge: { black: 99, white: 50 },
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: { black: 'board_shrink_god_01', white: null },
      markers: [],
      discard: ['board_shrink_god_01']
    };
    global.gameState = Core.createGameState();
    global.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    for (let col = 0; col < 8; col += 1) {
      global.gameState.board[0][col] = Core.WHITE;
    }
    global.gameState.currentPlayer = Core.BLACK;
    global.gameState.turnNumber = 20;
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = TurnPipeline;
    global.TurnPipelineUIAdapter = TurnPipelineUIAdapter;
    global.NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn(() => Promise.resolve({ ok: true }))
    };

    const result = await BoardShrinkEffects.handleBoardShrinkSelection(0, 1, 'black');

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'BOARD_SHRINK_GOD',
      publishedByNetwork: true
    }));
    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.not.objectContaining({
        useCardId: expect.anything(),
        useCardOwnerKey: expect.anything()
      })
    }));
    expect(global.cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'BOARD_SHRINK_GOD',
      stage: 'selectTarget',
      cardId: 'board_shrink_god_01',
      firstTarget: { row: 0, col: 0 }
    }));
  });

  test('finalizePendingSelectionFlow waits for playback before publishing continue-turn selections', async () => {
    let releasePlayback;
    const ensureCurrentPlayerCanActOrPass = jest.fn();
    attachPlaybackStateManager();

    global.cardState = { turnIndex: 3 };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    flow.createPendingSelectionAction('white', 'DESTROY_ONE_STONE', {
      destroyTarget: { row: 1, col: 1 }
    }, { cardState: global.cardState });

    global.NetworkMatchClient = {
      isActive: () => true,
      publishSnapshot: jest.fn()
    };
    global.waitForPlaybackIdle = jest.fn(() => new Promise((resolve) => {
      releasePlayback = resolve;
    }));
    global.isProcessing = true;
    global.isCardAnimating = true;

    const finalizePromise = flow.finalizePendingSelectionFlow({
      playerKey: 'white',
      pendingType: 'DESTROY_ONE_STONE',
      playbackEvents: [{ type: 'destroy_animation', phase: 1 }],
      gameStateValue: {
        currentPlayer: -1,
        turnNumber: 7,
        board: Array.from({ length: 8 }, () => Array(8).fill(0))
      },
      cardStateValue: {
        turnIndex: 3,
        hands: { white: [], black: [] },
        pendingEffectByPlayer: { white: null, black: null }
      },
      ensureCurrentPlayerCanActOrPass
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(1);
    expect(global.NetworkMatchClient.publishSnapshot).not.toHaveBeenCalled();

    releasePlayback();
    await finalizePromise;

    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [{ type: 'destroy_animation', phase: 1 }],
      action: expect.objectContaining({
        type: 'place',
        destroyTarget: { row: 1, col: 1 },
        turnIndex: 3
      })
    }));
    expect(global.NetworkMatchClient.publishSnapshot.mock.calls[0][0].snapshot).toBeUndefined();
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
    expect(ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);

  });

  test('finalizePendingSelectionFlow skips publish for deferred multi-stage intermediate selection while pending remains active', async () => {
    const ensureCurrentPlayerCanActOrPass = jest.fn();
    attachPlaybackStateManager();

    global.MATCH_MODE = 'network';
    global.waitForPlaybackIdle = jest.fn(() => Promise.resolve());
    global.NetworkMatchClient = {
      isActive: () => true,
      publishSnapshot: jest.fn()
    };
    global.cardState = {
      turnIndex: 19,
      pendingEffectByPlayer: {
        black: {
          type: 'BOARD_EXPANSION_GOD',
          stage: 'selectTarget',
          cardId: 'board_expand_god_01',
          selectedCount: 0,
          maxSelections: 2
        },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 20,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    flow.createPendingSelectionAction('black', 'BOARD_EXPANSION_GOD', {
      expansionTarget: { row: 0, col: 0 }
    }, { cardState: global.cardState });

    global.cardState = {
      turnIndex: 19,
      pendingEffectByPlayer: {
        black: {
          type: 'BOARD_EXPANSION_GOD',
          stage: 'selectTarget',
          cardId: 'board_expand_god_01',
          selectedTargets: [{ row: 0, col: 0 }],
          selectedCount: 1,
          maxSelections: 2
        },
        white: null
      }
    };
    global.isProcessing = true;
    global.isCardAnimating = true;

    const result = await flow.finalizePendingSelectionFlow({
      playerKey: 'black',
      pendingType: 'BOARD_EXPANSION_GOD',
      playbackEvents: [],
      gameStateValue: global.gameState,
      cardStateValue: global.cardState,
      ensureCurrentPlayerCanActOrPass
    });

    expect(result).toBe(true);
    expect(global.NetworkMatchClient.publishSnapshot).not.toHaveBeenCalled();
    expect(flow.readPendingSelectionAction('black')).toEqual(expect.objectContaining({
      deferNetworkPublish: true,
      pendingSelectionState: expect.objectContaining({
        type: 'BOARD_EXPANSION_GOD'
      })
    }));
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
    expect(ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
  });

  test('finalizePendingSelectionFlow clears end-turn staged action cache on publish failure', async () => {
    const ensureCurrentPlayerCanActOrPass = jest.fn();
    attachPlaybackStateManager();

    global.MATCH_MODE = 'network';
    global.cardState = {
      turnIndex: 4,
      pendingEffectByPlayer: {
        black: { type: 'TRAP_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: 'white',
      turnNumber: 8,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.NetworkMatchClient = {
      isActive: () => true,
      publishSnapshot: jest.fn(() => Promise.resolve({ ok: false, reason: 'OUT_OF_TURN' }))
    };
    global.isProcessing = true;
    global.isCardAnimating = true;

    const action = flow.createPendingSelectionAction('black', 'TRAP_WILL', {
      trapTarget: { row: 2, col: 2 }
    }, { cardState: global.cardState });

    const result = await flow.finalizePendingSelectionFlow({
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      action,
      playbackEvents: [],
      gameStateValue: global.gameState,
      cardStateValue: global.cardState,
      ensureCurrentPlayerCanActOrPass
    });

    expect(result).toBe(false);
    expect(flow.readPendingSelectionAction('black')).toBeNull();
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
    expect(ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
  });

  test('finalizePendingSelectionFlow prunes stale cached action before fallback read', async () => {
    attachPlaybackStateManager();

    global.MATCH_MODE = 'network';
    global.cardState = { turnIndex: 4 };
    global.gameState = {
      currentPlayer: 'white',
      turnNumber: 9,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    import * as networkTurnHandoff from '../game/network-turn-handoff.js';
    const finalizeNetworkTurnHandoff = jest
      .spyOn(networkTurnHandoff, 'finalizeNetworkTurnHandoff')
      .mockResolvedValue({ ok: true });

    flow.createPendingSelectionAction('black', 'TRAP_WILL', {
      trapTarget: { row: 2, col: 2 }
    }, { cardState: global.cardState });

    global.cardState = {
      turnIndex: 5,
      pendingEffectByPlayer: {
        black: { type: 'TRAP_WILL', stage: 'selectTarget' },
        white: null
      }
    };

    const result = await flow.finalizePendingSelectionFlow({
      playerKey: 'black',
      pendingType: 'TRAP_WILL',
      playbackEvents: [],
      gameStateValue: global.gameState,
      cardStateValue: global.cardState
    });

    expect(result).toBe(true);
    try {
      expect(finalizeNetworkTurnHandoff).toHaveBeenCalledWith(expect.objectContaining({
        playerKey: 'black',
        actionType: 'place',
        action: null
      }));
      expect(flow.readPendingSelectionAction('black')).toBeNull();
    } finally {
      finalizeNetworkTurnHandoff.mockRestore();
    }
  });

  test('CELL_TELEPORT_WILL arms board update context before selection state sync', async () => {
    const playbackStateManager = attachPlaybackStateManager();
    playbackStateManager.clearBoardUpdateContext();

    global.cardState = {
      turnIndex: 4,
      pendingEffectByPlayer: {
        black: { type: 'CELL_TELEPORT_WILL', stage: 'selectTarget', cardId: 'cell_tp_01' },
        white: null
      },
      presentationEvents: [],
      _presentationEventsPersist: []
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 7,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.PlaybackStateManager = playbackStateManager;
    global.emitCardStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        rawEvents: [{
          type: 'teleport_selected',
          applied: true,
          cardType: 'CELL_TELEPORT_WILL',
          from: { row: 4, col: 4 },
          to: { row: -1, col: 0 }
        }],
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { black: null, white: null }
        },
        nextGameState: {
          ...global.gameState
        },
        playbackEvents: [{
          type: 'move',
          phase: 1,
          targets: [{
            from: { r: 4, col: 4 },
            to: { r: -1, col: 0 },
            cause: 'CELL_TELEPORT_WILL',
            reason: 'teleport_move'
          }]
        }]
      }))
    };

    const result = await flow.executePendingSelection({
      row: 4,
      col: 4,
      playerKey: 'black',
      pendingType: 'CELL_TELEPORT_WILL',
      actionPayload: {
        teleportTarget: { row: 4, col: 4 }
      },
      validateResult: () => true
    });

    expect(result && result.ok).toBe(true);
    expect(playbackStateManager.getBoardUpdateContext()).toEqual(expect.objectContaining({
      source: 'selection-flow',
      reason: 'pre_playback_state_sync',
      suppressBoardExpansionRevealSound: true
    }));
    expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
    playbackStateManager.clearBoardUpdateContext();
  });

  test('network deferred selection publishes directly and keeps busy until authoritative ack', async () => {
    let resolvePublish = null;
    attachPlaybackStateManager();

    global.MATCH_MODE = 'network';
    global.cardState = {
      turnIndex: 4,
      pendingEffectByPlayer: {
        black: { type: 'SUPER_GRAVITY_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 8,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn(() => new Promise((resolve) => {
        resolvePublish = resolve;
      }))
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => {
        throw new Error('runTurnWithAdapter should not be called for network deferred publish-only selection');
      })
    };
    global.isProcessing = false;
    global.isCardAnimating = false;

    const pendingPromise = flow.executePendingSelection({
      row: 2,
      col: 4,
      playerKey: 'black',
      pendingType: 'SUPER_GRAVITY_WILL',
      actionPayload: {
        superGravityTarget: { row: 2, col: 4 }
      },
      invalidMessage: '下へ移動させる石を選んでください'
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(typeof resolvePublish).toBe('function');
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: expect.objectContaining({
        type: 'place',
        player: 'black',
        superGravityTarget: { row: 2, col: 4 },
        deferNetworkPublish: true,
        turnIndex: 4
      })
    }));
    expect(global.isProcessing).toBe(true);
    expect(global.isCardAnimating).toBe(true);

    resolvePublish({ ok: true });
    const result = await pendingPromise;

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'SUPER_GRAVITY_WILL',
      publishedByNetwork: true,
      playbackEvents: []
    }));
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
  });

  test('network deferred selection wakes current player on publish failure', async () => {
    attachPlaybackStateManager();
    global.MATCH_MODE = 'network';
    global.cardState = {
      turnIndex: 4,
      pendingEffectByPlayer: {
        black: { type: 'SUPER_GRAVITY_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 8,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn(() => Promise.resolve({ ok: false, reason: 'OUT_OF_TURN' }))
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => {
        throw new Error('runTurnWithAdapter should not be called for network deferred publish-only selection');
      })
    };
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.isProcessing = false;
    global.isCardAnimating = false;

    const result = await flow.executePendingSelection({
      row: 2,
      col: 4,
      playerKey: 'black',
      pendingType: 'SUPER_GRAVITY_WILL',
      actionPayload: {
        superGravityTarget: { row: 2, col: 4 }
      }
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reason: 'network_publish_failed'
    }));
    expect(flow.readPendingSelectionAction('black')).toBeNull();
    expect(global.ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
  });

  test('selection_not_applied clears staged pending action cache', async () => {
    attachPlaybackStateManager();
    global.cardState = {
      turnIndex: 6,
      pendingEffectByPlayer: {
        black: { type: 'GUARD_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 10,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: { ...global.cardState },
        nextGameState: { ...global.gameState },
        playbackEvents: []
      }))
    };

    const result = await flow.executePendingSelection({
      row: 3,
      col: 3,
      playerKey: 'black',
      pendingType: 'GUARD_WILL',
      actionPayload: {
        guardTarget: { row: 3, col: 3 }
      },
      validateResult: () => false
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reason: 'selection_not_applied'
    }));
    expect(flow.readPendingSelectionAction('black')).toBeNull();
  });

  test('selection_not_applied keeps authoritative pending state so deferred selection can retry', async () => {
    attachPlaybackStateManager();
    global.MATCH_MODE = 'network';
    global.cardState = {
      turnIndex: 6,
      pendingEffectByPlayer: {
        black: {
          type: 'TEMPT_WILL',
          stage: 'selectTarget',
          cardId: 'tempt_01'
        },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 10,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: { ...global.cardState },
        nextGameState: { ...global.gameState },
        playbackEvents: []
      }))
    };

    const result = await flow.executePendingSelection({
      row: 3,
      col: 3,
      playerKey: 'black',
      pendingType: 'TEMPT_WILL',
      actionPayload: {
        temptTarget: { row: 3, col: 3 }
      },
      validateResult: () => false
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reason: 'selection_not_applied'
    }));
    expect(flow.readPendingSelectionAction('black')).toBeNull();
    expect(global.cardState.pendingEffectByPlayer.black).toEqual({
      type: 'TEMPT_WILL',
      stage: 'selectTarget',
      cardId: 'tempt_01'
    });
  });

  test('selection_not_applied keeps authoritative pending state on injected cardState', async () => {
    attachPlaybackStateManager();
    global.MATCH_MODE = 'network';
    const suppliedCardState = {
      turnIndex: 6,
      pendingEffectByPlayer: {
        black: {
          type: 'TEMPT_WILL',
          stage: 'selectTarget',
          cardId: 'tempt_01'
        },
        white: null
      }
    };
    const suppliedGameState = {
      currentPlayer: 1,
      turnNumber: 10,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.cardState = {
      turnIndex: 1,
      pendingEffectByPlayer: { black: null, white: null }
    };
    global.gameState = {
      currentPlayer: -1,
      turnNumber: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: { ...suppliedCardState },
        nextGameState: { ...suppliedGameState },
        playbackEvents: []
      }))
    };

    const result = await flow.executePendingSelection({
      row: 3,
      col: 3,
      playerKey: 'black',
      pendingType: 'TEMPT_WILL',
      cardState: suppliedCardState,
      gameState: suppliedGameState,
      actionPayload: {
        temptTarget: { row: 3, col: 3 }
      },
      validateResult: () => false
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reason: 'selection_not_applied'
    }));
    expect(flow.readPendingSelectionAction('black')).toBeNull();
    expect(suppliedCardState.pendingEffectByPlayer.black).toEqual({
      type: 'TEMPT_WILL',
      stage: 'selectTarget',
      cardId: 'tempt_01'
    });
    expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('executePendingSelection reads pending effect through coordinator when raw pending state is stale', async () => {
    attachPlaybackStateManager();
    const originalReadPendingEffect = PendingCoordinator.readPendingEffect;
    PendingCoordinator.readPendingEffect = jest.fn((cardState, playerKey) => {
      if (playerKey === 'black') {
        return { type: 'GUARD_WILL', stage: 'selectTarget' };
      }
      return null;
    });

    try {
      global.cardState = {
        turnIndex: 6,
        pendingEffectByPlayer: {
          black: null,
          white: null
        }
      };
      global.gameState = {
        currentPlayer: 1,
        turnNumber: 10,
        board: Array.from({ length: 8 }, () => Array(8).fill(0))
      };
      global.ActionManager = {
        ActionManager: {
          createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
        }
      };
      global.TurnPipeline = {};
      global.TurnPipelineUIAdapter = {
        runTurnWithAdapter: jest.fn(() => ({
          ok: true,
          nextCardState: { ...global.cardState },
          nextGameState: { ...global.gameState },
          playbackEvents: []
        }))
      };

      const result = await flow.executePendingSelection({
        row: 3,
        col: 3,
        playerKey: 'black',
        pendingType: 'GUARD_WILL',
        actionPayload: {
          guardTarget: { row: 3, col: 3 }
        },
        validateResult: () => false
      });

      expect(PendingCoordinator.readPendingEffect).toHaveBeenCalledWith(global.cardState, 'black');
      expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.objectContaining({
        ok: false,
        reason: 'selection_not_applied'
      }));
    } finally {
      PendingCoordinator.readPendingEffect = originalReadPendingEffect;
    }
  });

  test('executePendingSelection prefers injected cardState/gameState over stale globals', async () => {
    attachPlaybackStateManager();
    const suppliedCardState = {
      turnIndex: 8,
      charge: { black: 10, white: 10 },
      pendingEffectByPlayer: {
        black: { type: 'GUARD_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    const suppliedGameState = {
      currentPlayer: 1,
      turnNumber: 10,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.cardState = {
      turnIndex: 1,
      charge: { black: 1, white: 1 },
      pendingEffectByPlayer: {
        black: null,
        white: null
      }
    };
    global.gameState = {
      currentPlayer: -1,
      turnNumber: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.emitCardStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...suppliedCardState,
          charge: { black: 7, white: 10 },
          pendingEffectByPlayer: { black: null, white: null }
        },
        nextGameState: {
          ...suppliedGameState,
          turnNumber: 11
        },
        playbackEvents: []
      }))
    };

    const result = await flow.executePendingSelection({
      row: 4,
      col: 4,
      playerKey: 'black',
      pendingType: 'GUARD_WILL',
      cardState: suppliedCardState,
      gameState: suppliedGameState,
      actionPayload: {
        guardTarget: { row: 4, col: 4 }
      }
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'GUARD_WILL'
    }));
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledWith(
      suppliedCardState,
      suppliedGameState,
      'black',
      expect.objectContaining({
        type: 'place',
        player: 'black',
        guardTarget: { row: 4, col: 4 },
        turnIndex: 8
      }),
      global.TurnPipeline
    );
    expect(suppliedCardState.charge.black).toBe(7);
    expect(suppliedGameState.turnNumber).toBe(11);
    expect(global.cardState).toBe(suppliedCardState);
    expect(global.gameState).toBe(suppliedGameState);
  });

  test('network continue-turn deferred selection skips local playback wait and publishes immediately', async () => {
    attachPlaybackStateManager();
    global.MATCH_MODE = 'network';
    global.cardState = {
      turnIndex: 5,
      pendingEffectByPlayer: {
        black: { type: 'GUARD_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 9,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn(() => Promise.resolve({ ok: true }))
    };
    global.waitForPlaybackIdle = jest.fn(() => new Promise(() => {}));
    global.emitCardStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitLogAdded = jest.fn();
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { black: null, white: null }
        },
        nextGameState: { ...global.gameState },
        playbackEvents: [{ type: 'hand_remove', phase: 1 }]
      }))
    };
    global.isProcessing = false;
    global.isCardAnimating = false;

    const result = await flow.executePendingSelection({
      row: 3,
      col: 3,
      playerKey: 'black',
      pendingType: 'GUARD_WILL',
      actionPayload: {
        guardTarget: { row: 3, col: 3 }
      }
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType: 'GUARD_WILL',
      playbackEvents: []
    }));
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(global.waitForPlaybackIdle).not.toHaveBeenCalled();
    expect(global.emitCardStateChange).not.toHaveBeenCalled();
    expect(global.emitBoardUpdate).not.toHaveBeenCalled();
    expect(global.emitGameStateChange).not.toHaveBeenCalled();
    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: expect.objectContaining({
        type: 'place',
        player: 'black',
        guardTarget: { row: 3, col: 3 },
        deferNetworkPublish: true,
        turnIndex: 5
      })
    }));
    const previewAction = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(previewAction.__suppressUiLogs).toBe(true);
  });

  test('network multi-stage deferred selection wakes current player on publish failure', async () => {
    attachPlaybackStateManager();
    global.MATCH_MODE = 'network';
    global.cardState = {
      turnIndex: 5,
      pendingEffectByPlayer: {
        black: { type: 'POSITION_SWAP_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: 1,
      turnNumber: 9,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn(() => Promise.resolve({ ok: false, reason: 'OUT_OF_TURN' }))
    };
    global.waitForPlaybackIdle = jest.fn(() => new Promise(() => {}));
    global.emitCardStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitLogAdded = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { black: null, white: null }
        },
        nextGameState: { ...global.gameState },
        playbackEvents: [{ type: 'hand_remove', phase: 1 }]
      }))
    };
    global.isProcessing = false;
    global.isCardAnimating = false;

    const result = await flow.executePendingSelection({
      row: 3,
      col: 3,
      playerKey: 'black',
      pendingType: 'POSITION_SWAP_WILL',
      actionPayload: {
        firstTarget: { row: 3, col: 3 }
      }
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reason: 'network_publish_failed'
    }));
    expect(flow.readPendingSelectionAction('black')).toBeNull();
    expect(global.ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
  });

  test('syncPendingSelectionActionCache prunes stale cache while keeping matching multi-stage pending type', () => {
    global.cardState = { turnIndex: 9 };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };

    flow.createPendingSelectionAction('black', 'POSITION_SWAP_WILL', { firstTarget: { row: 2, col: 3 } }, { cardState: global.cardState });
    flow.createPendingSelectionAction('white', 'BOARD_EXPANSION_GOD', { anchor: { row: 4, col: 4 } }, { cardState: global.cardState });

    const summary = flow.syncPendingSelectionActionCache({
      black: null,
      white: { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget' }
    });

    expect(summary).toEqual({
      cleared: ['black'],
      retained: ['white']
    });
    expect(flow.readPendingSelectionAction('black')).toBeNull();
    expect(flow.readPendingSelectionAction('white')).toEqual(expect.objectContaining({
      type: 'place',
      anchor: { row: 4, col: 4 },
      deferNetworkPublish: true,
      turnIndex: 9
    }));
  });
});
