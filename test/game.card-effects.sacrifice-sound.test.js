const { handleSacrificeSelection } = require('../game/card-effects/sacrifice');

describe('SACRIFICE_WILL sound timing', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    global.isProcessing = false;
    global.isCardAnimating = false;
    global.cardState = {
      turnIndex: 3,
      pendingEffectByPlayer: {
        black: { type: 'SACRIFICE_WILL', stage: 'selectTarget', selectedCount: 0, maxSelections: 3 },
        white: null
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
        rawEvents: [{ type: 'sacrifice_selected', applied: true, gained: 5, completed: false }],
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
    global.posToNotation = jest.fn(() => 'D4');
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
    delete global.posToNotation;
  });

  test('自分の石クリックで生贄選択が成功した時に効果音を鳴らす', async () => {
    await handleSacrificeSelection(3, 3, 'black');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
  });

  test('生贄選択が不成立なら効果音を鳴らさない', async () => {
    global.TurnPipelineUIAdapter.runTurnWithAdapter.mockReturnValueOnce({
      ok: true,
      rawEvents: [{ type: 'sacrifice_selected', applied: false }],
      nextCardState: global.cardState,
      nextGameState: global.gameState,
      playbackEvents: []
    });

    await handleSacrificeSelection(3, 3, 'black');

    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
  });
});
