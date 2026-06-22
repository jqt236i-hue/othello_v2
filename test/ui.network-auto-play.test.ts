const NetworkAutoPlay = require('../ui/network/auto-play');

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

describe('NetworkAutoPlay', () => {
  test('publishes a Lv1-style selected move for the local network seat', async () => {
    const root = createRoot();
    const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

    const result = await controller.tick();

    expect(result.handled).toBe(true);
    expect(result.published).toBe(true);
    expect(root.selectCpuMoveWithPolicy).toHaveBeenCalledWith(expect.any(Array), 'black');
    expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledWith({
      playerKey: 'black',
      actionType: 'place',
      action: { type: 'place', row: 4, col: 5 },
      playbackEvents: []
    });
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
      cardState: root.cardState
    }));
    expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledWith({
      playerKey: 'black',
      actionType: 'use_card',
      action: plannedAction,
      playbackEvents: []
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
    expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledWith({
      playerKey: 'black',
      actionType: 'pass',
      action: {
        type: 'pass',
        playerKey: 'black',
        autoNoActionPass: true
      },
      playbackEvents: []
    });
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
    expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledWith({
      playerKey: 'black',
      actionType: 'use_card',
      action: {
        type: 'use_card',
        playerKey: 'black',
        useCardId: 'work_01',
        useCardOwnerKey: 'black'
      },
      playbackEvents: []
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
    expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledWith({
      playerKey: 'black',
      actionType: 'use_card',
      action: {
        type: 'use_card',
        playerKey: 'black',
        useCardId: 'work_01',
        useCardOwnerKey: 'black'
      },
      playbackEvents: []
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
    expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledWith({
      playerKey: 'black',
      actionType: 'place',
      action: {
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
      },
      playbackEvents: []
    });
  });
});
