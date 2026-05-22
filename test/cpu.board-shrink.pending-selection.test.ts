import * as path from 'path';

const cpuDecision = require(path.resolve(__dirname, '..', 'game', 'cpu-decision.js'));
const PendingCoordinator = require(path.resolve(__dirname, '..', 'game', 'turn', 'pending-coordinator.js'));

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

describe('cpu board shrink pending selection', () => {
  beforeEach(() => {
    jest.restoreAllMocks();

    global.BLACK = 1;
    global.WHITE = -1;
    global.cpuSmartness = { white: 6, black: 1 };
    global.gameState = {
      board: createBoard(),
      currentPlayer: -1
    };
    global.cardState = {
      turnIndex: 9,
      hands: { white: [], black: [] },
      charge: { white: 20, black: 10 },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      lastUsedCardByPlayer: { white: null, black: null },
      markers: []
    };
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitLogAdded = jest.fn();
    global.waitForPlaybackIdle = jest.fn(async () => {});
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
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };
    global.CpuPolicyOnnxRuntime = {
      choosePendingTarget: jest.fn(async (targets) => targets[0])
    };
    global.CardLogic = {
      getSelectableTargets: jest.fn(() => [])
    };
    cpuDecision.setCpuDecisionRuntime({
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
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.emitLogAdded;
    delete global.waitForPlaybackIdle;
    delete global.ActionManager;
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.CpuPolicyOnnxRuntime;
    delete global.CardLogic;
    cpuDecision.setCpuDecisionRuntime(null);
  });

  test('BOARD_SHRINK_WILL publishes shrinkTarget with carried selectedTargets state', async () => {
    global.cardState.pendingEffectByPlayer.white = {
      type: 'BOARD_SHRINK_WILL',
      stage: 'selectTarget',
      selectedTargets: [{ row: 0, col: 0 }, { row: 0, col: 7 }],
      selectedCount: 2,
      maxSelections: 3
    };
    global.CardLogic.getSelectableTargets.mockReturnValue([{ row: 3, col: -1 }]);

    await cpuDecision.cpuSelectBoardShrinkWithPolicy('white');

    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action).toEqual(expect.objectContaining({
      type: 'place',
      player: 'white',
      shrinkTarget: { row: 3, col: -1 },
      deferNetworkPublish: true,
      pendingSelectionState: {
        type: 'BOARD_SHRINK_WILL',
        stage: 'selectTarget',
        selectedTargets: [{ row: 0, col: 0 }, { row: 0, col: 7 }],
        selectedCount: 2,
        maxSelections: 3
      }
    }));
  });

  test('BOARD_SHRINK_GOD publishes shrinkTarget with carried firstTarget state', async () => {
    global.cardState.pendingEffectByPlayer.white = {
      type: 'BOARD_SHRINK_GOD',
      stage: 'selectTarget',
      firstTarget: { row: 0, col: 0 }
    };
    global.CardLogic.getSelectableTargets.mockReturnValue([{ row: 0, col: 1 }]);

    await cpuDecision.cpuSelectBoardShrinkWithPolicy('white');

    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action).toEqual(expect.objectContaining({
      type: 'place',
      player: 'white',
      shrinkTarget: { row: 0, col: 1 },
      deferNetworkPublish: true,
      pendingSelectionState: {
        type: 'BOARD_SHRINK_GOD',
        stage: 'selectTarget',
        firstTarget: { row: 0, col: 0 }
      }
    }));
  });
});
