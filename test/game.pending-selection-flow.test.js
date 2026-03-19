const flow = require('../game/card-effects/selection-flow');

describe('pending selection flow contracts', () => {
  afterEach(() => {
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
    delete global.isProcessing;
    delete global.isCardAnimating;
    jest.clearAllMocks();
  });

  test('shared contract distinguishes end-turn and continue-turn selections', () => {
    expect(flow.shouldDeferNetworkPublishForPendingType('SACRIFICE_WILL')).toBe(true);
    expect(flow.shouldDeferNetworkPublishForPendingType('SELL_CARD_WILL')).toBe(true);
    expect(flow.isSelectionOnlyEndTurnPendingType('SACRIFICE_WILL')).toBe(false);
    expect(flow.isSelectionOnlyEndTurnPendingType('TRAP_WILL')).toBe(true);
  });

  test('createPendingSelectionAction injects defer flag for known selection actions', () => {
    global.cardState = { turnIndex: 7 };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };

    const action = flow.createPendingSelectionAction('black', 'SELL_CARD_WILL', { sellCardId: 'sell_card' }, { cardState: global.cardState });

    expect(action.type).toBe('place');
    expect(action.sellCardId).toBe('sell_card');
    expect(action.deferNetworkPublish).toBe(true);
    expect(action.turnIndex).toBe(7);
  });

  test('finalizePendingSelectionFlow waits for playback before publishing continue-turn selections', async () => {
    let releasePlayback;
    const ensureCurrentPlayerCanActOrPass = jest.fn();

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

  test('CELL_TELEPORT_WILL arms board update context before selection state sync', async () => {
    const playbackStateManager = require('../ui/playback-state-manager');
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
