const { handleBoardExpansionSelection } = require('../game/card-effects/board-expansion');

describe('BOARD_EXPANSION sound timing', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    global.isProcessing = false;
    global.isCardAnimating = false;
    global.cardState = {
      turnIndex: 3,
      pendingEffectByPlayer: {
        black: { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' },
        white: { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget', selectedCount: 1, maxSelections: 2, selectedTargets: [{ row: 0, col: 0 }] }
      }
    };
    global.gameState = { currentPlayer: 1 };

    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        rawEvents: [{ type: 'board_expansion_selected', applied: true, completed: true }],
        nextCardState: global.cardState,
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };

    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };

    global.emitLogAdded = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
  });

  afterEach(() => {
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.cardState;
    delete global.gameState;
    delete global.ActionManager;
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.SoundEngine;
    delete global.emitLogAdded;
    delete global.emitCardStateChange;
    delete global.emitBoardUpdate;
    delete global.emitGameStateChange;
    delete global.ensureCurrentPlayerCanActOrPass;
  });

  test('盤面拡張の確定後も selection handler は効果音を直接鳴らさない', async () => {
    await handleBoardExpansionSelection(3, 0, 'black');

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
  });

  test('盤面拡張神の1つ目選択では効果音を鳴らさない', async () => {
    global.TurnPipelineUIAdapter.runTurnWithAdapter.mockReturnValueOnce({
      ok: true,
      rawEvents: [{ type: 'board_expansion_first_selected', applied: true, selectedCount: 1, maxSelections: 2 }],
      nextCardState: global.cardState,
      nextGameState: global.gameState,
      playbackEvents: []
    });

    await handleBoardExpansionSelection(0, 0, 'white');

    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
  });

  test('盤面拡張神の2つ目選択でも selection handler は効果音を直接鳴らさない', async () => {
    await handleBoardExpansionSelection(7, 7, 'white');

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
  });
});
