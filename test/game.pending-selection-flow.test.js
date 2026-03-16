const flow = require('../game/card-effects/selection-flow');

describe('pending selection flow contracts', () => {
  afterEach(() => {
    delete global.ActionManager;
    delete global.cardState;
    delete global.NetworkMatchClient;
    delete global.waitForPlaybackIdle;
    delete global.isProcessing;
    delete global.isCardAnimating;
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
