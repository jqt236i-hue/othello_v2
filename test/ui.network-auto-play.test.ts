const NetworkAutoPlay = require('../ui/network/auto-play');
const CardRuntimeIntegrity = require('../ui/card-runtime-integrity');
const { createCardRuntimeUnavailableError } = require('../game/logic/card-runtime-errors');

function createRoot(overrides: any = {}) {
  const publishCommand = jest.fn().mockResolvedValue({ ok: true });
  const root: any = {
    MATCH_MODE: 'network',
    BLACK: 1,
    WHITE: 2,
    isProcessing: false,
    isCardAnimating: false,
    VisualPlaybackActive: false,
    gameState: {
      currentPlayer: 1,
      turnNumber: 7
    },
    cardState: {},
    protectedStones: [],
    permaProtectedStones: [],
    TurnSubPlacementContinuation: {
      isSubPlacementTurnActive: jest.fn().mockReturnValue(false)
    },
    getLegalMoves: jest.fn().mockReturnValue([
      { row: 2, col: 3 },
      { row: 4, col: 5 }
    ]),
    selectCpuMoveWithPolicy: jest.fn().mockReturnValue({ row: 4, col: 5 }),
    NetworkMatchClient: {
      isActive: jest.fn().mockReturnValue(true),
      isSpectator: jest.fn().mockReturnValue(false),
      getNetworkAutoEnabled: jest.fn().mockReturnValue(true),
      getSeatKey: jest.fn().mockReturnValue('black'),
      getRoomId: jest.fn().mockReturnValue('ABC'),
      publishCommand
    }
  };
  return Object.assign(root, overrides);
}

function expectAutoTurnPublished(
  root: any,
  preferredActionType: string,
  preferredAction: any,
  playerKey = 'black'
) {
  expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledWith({
    playerKey,
    actionType: 'auto_turn',
    action: {
      type: 'auto_turn',
      preferredActionType,
      preferredAction
    },
    playbackEvents: []
  });
}

describe('NetworkAutoPlay', () => {
  beforeEach(() => {
    CardRuntimeIntegrity.resetCardRuntimeIntegrityState();
  });

  afterEach(() => {
    CardRuntimeIntegrity.resetCardRuntimeIntegrityState();
  });

  test('publishes a Lv1-style selected move for the local network seat', async () => {
    const root = createRoot();
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.handled).toBe(true);
    expect(result.published).toBe(true);
    expect(root.selectCpuMoveWithPolicy).toHaveBeenCalledWith(expect.any(Array), 'black');
    expectAutoTurnPublished(root, 'place', { type: 'place', row: 4, col: 5 });
  });

  test('publishes the action returned by the injected CPU network planner', async () => {
    const plannedAction = {
      type: 'use_card',
      playerKey: 'black',
      useCardId: 'work_01',
      useCardOwnerKey: 'black'
    };
    const root = createRoot({
      CpuNetworkCommandPlanner: {
        planCpuNetworkCommand: jest.fn().mockReturnValue({
          action: plannedAction,
          actionType: 'use_card'
        })
      }
    });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.handled).toBe(true);
    expect(result.published).toBe(true);
    expect(root.CpuNetworkCommandPlanner.planCpuNetworkCommand).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'black',
      gameState: root.gameState,
      cardState: root.cardState,
      SubPlacementContinuation: root.TurnSubPlacementContinuation
    }));
    expectAutoTurnPublished(root, 'use_card', plannedAction);
  });

  test('latches a tagged planner failure and never retries or publishes another network action', async () => {
    const unavailable = createCardRuntimeUnavailableError('state.availability', 'state');
    const planner = {
      planCpuNetworkCommand: jest.fn(() => { throw unavailable; })
    };
    const root = createRoot({ CpuNetworkCommandPlanner: planner });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    await expect(controller.tick()).resolves.toEqual({
      handled: true,
      published: false,
      reason: 'RUNTIME_UNAVAILABLE'
    });
    await expect(controller.tick()).resolves.toEqual({
      handled: true,
      published: false,
      reason: 'RUNTIME_UNAVAILABLE'
    });

    expect(planner.planCpuNetworkCommand).toHaveBeenCalledTimes(1);
    expect(root.NetworkMatchClient.publishCommand).not.toHaveBeenCalled();
    expect(CardRuntimeIntegrity.getCardRuntimeIntegrityState()).toMatchObject({
      blocked: true,
      source: 'network-auto-play',
      capability: 'state.availability',
      cohort: 'state'
    });
  });

  test('real planner propagates a tagged CardLogic query failure without publishing a pass', async () => {
    const planner = require('../game/cpu-network-command-planner');
    const unavailable = createCardRuntimeUnavailableError('state.availability', 'state');
    const root = createRoot({
      CpuNetworkCommandPlanner: planner,
      CardLogic: {
        hasUsableCard: jest.fn(() => { throw unavailable; })
      }
    });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    await expect(controller.tick()).resolves.toEqual({
      handled: true,
      published: false,
      reason: 'RUNTIME_UNAVAILABLE'
    });

    expect(root.NetworkMatchClient.publishCommand).not.toHaveBeenCalled();
    expect(root.getLegalMoves).not.toHaveBeenCalled();
    expect(CardRuntimeIntegrity.getCardRuntimeIntegrityState()).toMatchObject({
      blocked: true,
      source: 'network-auto-play'
    });
  });

  test('does not publish when the room does not allow network auto', async () => {
    const root = createRoot();
    root.NetworkMatchClient.getNetworkAutoEnabled.mockReturnValue(false);
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.handled).toBe(true);
    expect(result.reason).toBe('ROOM_AUTO_DISABLED');
    expect(root.NetworkMatchClient.publishCommand).not.toHaveBeenCalled();
  });

  test('injects sub-placement continuation through the browser root require boundary', async () => {
    const SubPlacementContinuation = {
      isSubPlacementTurnActive: jest.fn().mockReturnValue(false)
    };
    const planner = {
      planCpuNetworkCommand: jest.fn().mockReturnValue({
        actionType: 'place',
        action: { type: 'place', row: 2, col: 3 }
      })
    };
    const root = createRoot({
      TurnSubPlacementContinuation: undefined,
      CpuNetworkCommandPlanner: planner,
      require: jest.fn((id: string) => (
        id === 'game/turn/sub-placement-continuation'
          ? SubPlacementContinuation
          : null
      ))
    });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.published).toBe(true);
    expect(root.require).toHaveBeenCalledWith('game/turn/sub-placement-continuation');
    expect(planner.planCpuNetworkCommand).toHaveBeenCalledWith(
      expect.objectContaining({ SubPlacementContinuation })
    );
  });

  test('does not publish for spectators', async () => {
    const root = createRoot();
    root.NetworkMatchClient.isSpectator.mockReturnValue(true);
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.handled).toBe(true);
    expect(result.reason).toBe('SPECTATOR');
    expect(root.NetworkMatchClient.publishCommand).not.toHaveBeenCalled();
  });

  test('does not publish when it is the opponent turn', async () => {
    const root = createRoot({
      gameState: {
        currentPlayer: 2,
        turnNumber: 8
      }
    });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.handled).toBe(true);
    expect(result.reason).toBe('NOT_OWN_TURN');
    expect(root.NetworkMatchClient.publishCommand).not.toHaveBeenCalled();
  });

  test('FATE_WILL controller publishes AUTO for the controlled turn owner', async () => {
    const plannedAction = { type: 'place', row: 2, col: 3 };
    const root = createRoot({
      gameState: {
        currentPlayer: 2,
        turnNumber: 8
      },
      cardState: {
        fateWillControllerByTurnOwner: { black: null, white: 'black' }
      },
      CpuNetworkCommandPlanner: {
        planCpuNetworkCommand: jest.fn().mockReturnValue({
          actionType: 'place',
          action: plannedAction
        })
      }
    });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.published).toBe(true);
    expect(root.CpuNetworkCommandPlanner.planCpuNetworkCommand).toHaveBeenCalledWith(
      expect.objectContaining({ playerKey: 'white' })
    );
    expectAutoTurnPublished(root, 'place', plannedAction, 'white');
  });

  test('FATE_WILL controlled seat cannot publish AUTO for its own controlled turn', async () => {
    const root = createRoot({
      gameState: {
        currentPlayer: 2,
        turnNumber: 8
      },
      cardState: {
        fateWillControllerByTurnOwner: { black: null, white: 'black' }
      }
    });
    root.NetworkMatchClient.getSeatKey.mockReturnValue('white');
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.reason).toBe('NOT_OWN_TURN');
    expect(root.NetworkMatchClient.publishCommand).not.toHaveBeenCalled();
  });

  test('does not publish after the canonical game is over', async () => {
    const root = createRoot({
      gameState: {
        currentPlayer: 1,
        turnNumber: 80,
        consecutivePasses: 2
      }
    });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.reason).toBe('GAME_ALREADY_OVER');
    expect(root.NetworkMatchClient.publishCommand).not.toHaveBeenCalled();
  });

  test('publishes only autoNoActionPass when no move and no usable card exist', async () => {
    const root = createRoot({
      getLegalMoves: jest.fn().mockReturnValue([]),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(false)
      }
    });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.handled).toBe(true);
    expect(result.published).toBe(true);
    expectAutoTurnPublished(root, 'pass', {
      type: 'pass',
      playerKey: 'black',
      autoNoActionPass: true
    });
  });

  test('does not keep pass duplicate-latched after the network state version advances', async () => {
    let stateVersion = 7;
    const root = createRoot({
      getLegalMoves: jest.fn().mockReturnValue([]),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(false)
      }
    });
    root.NetworkMatchClient.getStateVersion = jest.fn(() => stateVersion);
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const first = await controller.tick();
    stateVersion = 8;
    const second = await controller.tick();

    expect(first.published).toBe(true);
    expect(second.reason).not.toBe('DUPLICATE_TICK');
    expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledTimes(2);
  });

  test('does not flood the same rejected command until the network state version advances', async () => {
    let stateVersion = 7;
    const root = createRoot();
    root.NetworkMatchClient.getStateVersion = jest.fn(() => stateVersion);
    root.NetworkMatchClient.publishCommand.mockResolvedValue({
      ok: false,
      reason: 'CARD_USE_FAILED'
    });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const first = await controller.tick();
    const duplicate = await controller.tick();
    stateVersion = 8;
    const afterAdvance = await controller.tick();

    expect(first).toEqual(expect.objectContaining({
      handled: true,
      published: false,
      reason: 'CARD_USE_FAILED'
    }));
    expect(duplicate.reason).toBe('DUPLICATE_TICK');
    expect(afterAdvance.reason).not.toBe('DUPLICATE_TICK');
    expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledTimes(2);
  });

  test('retries a transport-level publish failure at the same network state version', async () => {
    const root = createRoot();
    root.NetworkMatchClient.getStateVersion = jest.fn().mockReturnValue(7);
    root.NetworkMatchClient.publishCommand
      .mockResolvedValueOnce({ ok: false, reason: 'PUBLISH_ERROR' })
      .mockResolvedValueOnce({ ok: true });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const first = await controller.tick();
    const retry = await controller.tick();

    expect(first).toEqual(expect.objectContaining({
      handled: true,
      published: false,
      reason: 'PUBLISH_ERROR'
    }));
    expect(retry.published).toBe(true);
    expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledTimes(2);
  });

  test('publishes a CPU-selected card when cards are still usable', async () => {
    const root = createRoot({
      getLegalMoves: jest.fn().mockReturnValue([]),
      computeCpuAction: jest.fn().mockReturnValue({
        type: 'useCard',
        cardId: 'work_01',
        cardDef: { type: 'WORK_WILL', name: '労働' }
      }),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(true)
      }
    });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.handled).toBe(true);
    expect(result.published).toBe(true);
    expect(root.computeCpuAction).toHaveBeenCalledWith('black');
    expectAutoTurnPublished(root, 'use_card', {
      type: 'use_card',
      playerKey: 'black',
      useCardId: 'work_01',
      useCardOwnerKey: 'black'
    });
  });

  test('publishes a CPU-selected card before placing when legal moves exist', async () => {
    const root = createRoot({
      selectCardToUse: jest.fn().mockReturnValue({
        cardId: 'work_01',
        cardDef: { type: 'WORK_WILL', name: '労働' }
      }),
      computeCpuAction: jest.fn().mockReturnValue({
        type: 'move',
        move: { row: 4, col: 5 }
      }),
      CardLogic: {
        hasUsableCard: jest.fn().mockReturnValue(true)
      }
    });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.handled).toBe(true);
    expect(result.published).toBe(true);
    expect(root.selectCardToUse).toHaveBeenCalledWith('black');
    expect(root.selectCpuMoveWithPolicy).not.toHaveBeenCalled();
    expectAutoTurnPublished(root, 'use_card', {
      type: 'use_card',
      playerKey: 'black',
      useCardId: 'work_01',
      useCardOwnerKey: 'black'
    });
  });

  test('publishes a pending target selection instead of stalling', async () => {
    const root = createRoot({
      cardState: {
        turnIndex: 9,
        pendingEffectByPlayer: {
          black: {
            type: 'TIME_BOMB',
            stage: 'selectTarget',
            cardId: 'time_bomb_01',
            pendingEffectId: 'pending_9_1'
          }
        }
      },
      getLegalMoves: jest.fn().mockReturnValue([]),
      CardLogic: {
        getTimeBombTargets: jest.fn().mockReturnValue([
          { row: 3, col: 4 },
          { row: 5, col: 6 }
        ])
      },
      PendingCoordinator: {
        resolvePendingSelectionActionField: jest.fn().mockReturnValue('bombTarget')
      }
    });
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.handled).toBe(true);
    expect(result.published).toBe(true);
    expectAutoTurnPublished(root, 'place', {
      type: 'place',
      player: 'black',
      row: 3,
      col: 4,
      bombTarget: { row: 3, col: 4 },
      pendingSelectionState: {
        type: 'TIME_BOMB',
        stage: 'selectTarget',
        cardId: 'time_bomb_01',
        pendingEffectId: 'pending_9_1'
      },
      turnIndex: 9
    });
  });
});
