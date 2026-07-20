describe('DESTROY_ONE_STONE CPU selection deferred publish', () => {
  const cpuDecisionModuleId = require.resolve('../game/cpu-decision');
  const pendingCoordinatorModuleId = require.resolve('../game/turn/pending-coordinator');

  let cpuDecision;
  let PendingCoordinator;
  let runTurnMock;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();

    cpuDecision = require(cpuDecisionModuleId);
    PendingCoordinator = require(pendingCoordinatorModuleId);

    global.BLACK = 1;
    global.WHITE = -1;
    global.cpuSmartness = { white: 1, black: 1 };
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: global.WHITE,
      turnNumber: 7,
      consecutivePasses: 0
    };
    global.gameState.board[2][3] = global.BLACK;
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: {
        white: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' },
        black: null
      },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      turnIndex: 3
    };
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 2, col: 3 }]
    };
    global.waitForPlaybackIdle = jest.fn(() => Promise.resolve());
    global.onTurnStart = jest.fn(async () => ({ playbackEvents: [{ type: 'turn_start_dummy' }] }));
    global.NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn()
    };
    global.TurnPipeline = {};
    runTurnMock = jest.fn(() => ({
      ok: true,
      nextCardState: {
        ...global.cardState,
        pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
      },
      nextGameState: {
        ...global.gameState,
        currentPlayer: global.WHITE,
        turnNumber: 7,
        consecutivePasses: 0
      },
      playbackEvents: [{ type: 'dummy', phase: 1 }]
    }));
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: runTurnMock
    };
    global.emitCardStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.getActiveProtectionForPlayer = () => [];
    global.getLegalMoves = () => [];
    global.DEBUG_HUMAN_VS_HUMAN = false;
    global.MATCH_MODE = 'cpu';
    global.processCpuTurn = jest.fn();
    global.requestAnimationFrame = jest.fn();
    cpuDecision.setCpuDecisionRuntime({
      readMatchMode: () => 'cpu',
      readHumanVsHumanMode: () => false,
      processCpuTurn: global.processCpuTurn,
      readCpuSmartness: () => ({ white: 4, black: 1 }),
      readModule: (name) => global[name]
    });
    PendingCoordinator.clearPendingSelectionActionCache();
  });

  afterEach(() => {
    PendingCoordinator.clearPendingSelectionActionCache();
    delete global.BLACK;
    delete global.WHITE;
    delete global.cpuSmartness;
    delete global.gameState;
    delete global.cardState;
    delete global.CardLogic;
    delete global.waitForPlaybackIdle;
    delete global.onTurnStart;
    delete global.NetworkMatchClient;
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.emitCardStateChange;
    delete global.emitBoardUpdate;
    delete global.emitGameStateChange;
    delete global.getActiveProtectionForPlayer;
    delete global.getLegalMoves;
    delete global.DEBUG_HUMAN_VS_HUMAN;
    delete global.MATCH_MODE;
    delete global.processCpuTurn;
    delete global.requestAnimationFrame;
  });

  test('CPU continue-turn selection picks a destroy target and does not hand off the turn', async () => {
    PendingCoordinator.storePendingSelectionAction(
      'white',
      { type: 'pending_selection', cardId: 'destroy-card', turnIndex: 3 },
      'DESTROY_ONE_STONE'
    );

    await cpuDecision.cpuSelectDestroyWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    const action = runTurnMock.mock.calls[0][3];
    expect(action.type).toBe('place');
    expect(action.destroyTarget).toEqual({ row: 2, col: 3 });

    expect(global.cardState.pendingEffectByPlayer.white).toBeNull();
    expect(PendingCoordinator.readPendingSelectionAction('white')).toBeNull();
    expect(global.onTurnStart).not.toHaveBeenCalled();
    expect(global.processCpuTurn).not.toHaveBeenCalled();
  });

  test('CPU continue-turn selection still resolves when only injected smartness is available', async () => {
    delete global.cpuSmartness;
    PendingCoordinator.storePendingSelectionAction(
      'white',
      { type: 'pending_selection', cardId: 'destroy-card', turnIndex: 3 },
      'DESTROY_ONE_STONE'
    );

    await cpuDecision.cpuSelectDestroyWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    const action = runTurnMock.mock.calls[0][3];
    expect(action.destroyTarget).toEqual({ row: 2, col: 3 });
    expect(global.cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('CPU destroy selection does not fall back to protected board stones when destroy targets are empty', async () => {
    global.CardLogic = {
      getSelectableTargets: () => [],
      getDestroyTargets: () => []
    };

    await cpuDecision.cpuSelectDestroyWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
    expect(global.cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('CPU destroy selection does not fall back after pending pipeline success', async () => {
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 2, col: 3 }],
      applyDestroyEffect: jest.fn(() => true)
    };

    await cpuDecision.cpuSelectDestroyWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(global.CardLogic.applyDestroyEffect).not.toHaveBeenCalled();
    expect(global.cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('CPU destroy selection falls back to direct apply when pending pipeline rejects', async () => {
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 2, col: 3 }],
      applyDestroyEffect: jest.fn(() => {
        global.cardState.pendingEffectByPlayer.white = null;
        return true;
      })
    };
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: false,
      reason: 'stale_turn'
    }));

    await cpuDecision.cpuSelectDestroyWithPolicy('white');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    expect(global.CardLogic.applyDestroyEffect).toHaveBeenCalledWith(
      global.cardState,
      global.gameState,
      'white',
      2,
      3
    );
    expect(global.cardState.pendingEffectByPlayer.white).toBeNull();
  });

});
