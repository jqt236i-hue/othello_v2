import * as path from 'path';

const cpuDecision = require(path.resolve(__dirname, '..', 'game', 'cpu-decision.js'));

const CASES = [
  {
    label: 'SUPER_BUOYANCY_WILL',
    handlerName: 'cpuSelectSuperBuoyancyWillWithPolicy',
    pendingType: 'SUPER_BUOYANCY_WILL',
    actionField: 'superBuoyancyTarget'
  },
  {
    label: 'SUPER_GRAVITY_WILL',
    handlerName: 'cpuSelectSuperGravityWillWithPolicy',
    pendingType: 'SUPER_GRAVITY_WILL',
    actionField: 'superGravityTarget'
  }
];

describe.each(CASES)('$label CPU selection handoff', ({ handlerName, pendingType, actionField }) => {
  let runTurnMock;

  beforeEach(() => {
    jest.restoreAllMocks();

    global.BLACK = 1;
    global.WHITE = -1;
    global.cpuSmartness = { white: 1, black: 1 };
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: global.WHITE,
      turnNumber: 7,
      consecutivePasses: 0
    };
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: {
        white: { type: pendingType, stage: 'selectTarget' },
        black: null
      },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      turnIndex: 3
    };
    global.CardLogic = {
      getSelectableTargets: () => [{ row: 2, col: 3 }]
    };
    global.waitForPlaybackIdle = jest.fn(async () => {});
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
          currentPlayer: global.BLACK,
          turnNumber: 8,
          consecutivePasses: 0
        },
        playbackEvents: [{ type: 'dummy' }]
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
    global.CPU_TURN_DELAY_MS = 0;
    global.requestAnimationFrame = jest.fn();
    cpuDecision.setCpuDecisionRuntime({
      readMatchMode: () => 'cpu',
      readHumanVsHumanMode: () => false,
      processCpuTurn: global.processCpuTurn,
      readModule: (name) => global[name]
    });
  });

  afterEach(() => {
    if (typeof cpuDecision.setCpuDecisionRuntime === 'function') {
      cpuDecision.setCpuDecisionRuntime(null);
    }
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
    delete global.CPU_TURN_DELAY_MS;
    delete global.requestAnimationFrame;
  });

  test('pipeline action defers publish and completes combined handoff', async () => {
    await cpuDecision[handlerName]('white');
    await Promise.resolve();
    await Promise.resolve();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    const action = runTurnMock.mock.calls[0][3];
    expect(action[actionField]).toEqual({ row: 2, col: 3 });
    expect(action.deferNetworkPublish).toBe(true);

    expect(global.waitForPlaybackIdle).toHaveBeenCalled();
    expect(global.onTurnStart).toHaveBeenCalledWith(global.BLACK);
    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [{ type: 'dummy' }, expect.objectContaining({ type: 'turn_start_dummy' })]
    }));
    expect(global.NetworkMatchClient.publishSnapshot.mock.calls[0][0].snapshot).toBeUndefined();
  });

});
