import { JSDOM } from 'jsdom';

describe('手札破壊ボタン', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="card-detail-name"></div>
        <div id="card-detail-desc"></div>
        <div id="card-detail-actions"></div>
        <button id="destroy-card-btn">破壊</button>
        <button id="use-card-btn">使用</button>
        <button id="toggle-card-detail-btn">詳細</button>
        <button id="pass-btn">パス</button>
        <button id="cancel-card-btn" style="display:none;">キャンセル</button>
        <div id="use-card-reason"></div>
      </body></html>
    `);

    global.window = dom.window;
    global.document = dom.window.document;

    global.BLACK = 1;
    global.WHITE = -1;

    global.gameState = { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    global.cardState = {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      turnIndex: 0,
      charge: { black: 10, white: 10 },
      hands: { black: ['trash_card', 'use_card_1'], white: [] },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: { black: null, white: null },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: []
    };

    global.CardLogic = {
      getCardDef: (id) => ({ id, name: id, desc: id, cost: id === 'use_card_1' ? 4 : 0 })
    };

    global.Core = {
      getLegalMoves: () => []
    };

    global.renderCardUI = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.addLog = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };

    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) }),
        recordAction: jest.fn(),
        incrementTurnIndex: jest.fn()
      }
    };

    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn((_cs, _gs, _player, action) => {
        if (action.type === 'destroy_hand_card') {
          const hand = (global.cardState.hands.black || []).filter((id) => id !== action.destroyCardId);
          const nextCardState = {
            ...global.cardState,
            hands: { black: hand, white: [] },
            hasDestroyedCardThisTurnByPlayer: { black: true, white: false },
            discard: [...(global.cardState.discard || []), action.destroyCardId],
            selectedCardId: null,
            selectedCardOwnerKey: null
          };
          global.cardState = nextCardState;
          return { ok: true, nextCardState, nextGameState: global.gameState, playbackEvents: [] };
        }
        if (action.type === 'use_card') {
          const hand = (global.cardState.hands.black || []).filter((id) => id !== action.useCardId);
          const nextCardState = {
            ...global.cardState,
            hands: { black: hand, white: [] },
            hasUsedCardThisTurnByPlayer: { black: true, white: false },
            discard: [...(global.cardState.discard || []), action.useCardId],
            selectedCardId: null,
            selectedCardOwnerKey: null
          };
          global.cardState = nextCardState;
          return { ok: true, nextCardState, nextGameState: global.gameState, playbackEvents: [] };
        }
        return { ok: false, rejectedReason: 'UNSUPPORTED' };
      })
    };
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  test('破壊後でも同ターンにカード使用できる', () => {
    require('../cards/card-interaction.js');

    window.onCardClick('trash_card', 'black');
    global.emitBoardUpdate.mockClear();
    window.destroySelectedHandCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    const destroyAction = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(destroyAction.type).toBe('destroy_hand_card');
    expect(destroyAction.destroyCardId).toBe('trash_card');
    expect(global.cardState.hasDestroyedCardThisTurnByPlayer.black).toBe(true);
    expect(global.cardState.hands.black).toEqual(['use_card_1']);

    window.onCardClick('use_card_1', 'black');
    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(2);
    const useAction = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[1][3];
    expect(useAction.type).toBe('use_card');
    expect(useAction.useCardId).toBe('use_card_1');
  });

  test('手札破壊ボタン成功時は押下タイミングで stone_destroy を再生する', () => {
    require('../cards/card-interaction.js');

    window.onCardClick('trash_card', 'black');
    global.SoundEngine.playEffectByKey.mockClear();
    window.destroySelectedHandCard();

    expect(global.SoundEngine.init).toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('stone_destroy');
  });

  test('同一ターンに手札破壊を連続実行できる', () => {
    require('../cards/card-interaction.js');
    global.cardState.hands.black = ['trash_card', 'trash_card_2', 'use_card_1'];

    window.onCardClick('trash_card', 'black');
    window.destroySelectedHandCard();

    window.onCardClick('trash_card_2', 'black');
    window.destroySelectedHandCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(2);
    const firstDestroyAction = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    const secondDestroyAction = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[1][3];
    expect(firstDestroyAction.type).toBe('destroy_hand_card');
    expect(secondDestroyAction.type).toBe('destroy_hand_card');
    expect(global.cardState.hands.black).toEqual(['use_card_1']);
    expect(global.cardState.discard).toEqual(expect.arrayContaining(['trash_card', 'trash_card_2']));
  });

  test('hand_remove 再生中でも手札破壊後の同ターン通常配置はブロックされない', () => {
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn((_cs, _gs, _player, action) => {
      if (action.type === 'destroy_hand_card') {
        const hand = (global.cardState.hands.black || []).filter((id) => id !== action.destroyCardId);
        const nextCardState = {
          ...global.cardState,
          hands: { black: hand, white: [] },
          hasDestroyedCardThisTurnByPlayer: { black: true, white: false },
          discard: [...(global.cardState.discard || []), action.destroyCardId],
          selectedCardId: null,
          selectedCardOwnerKey: null
        };
        global.cardState = nextCardState;
        return {
          ok: true,
          nextCardState,
          nextGameState: global.gameState,
          playbackEvents: [{ type: 'hand_remove', phase: 1, targets: [{ player: 'black', count: 1 }] }]
        };
      }
      return { ok: false, rejectedReason: 'UNSUPPORTED' };
    });

    global.getActiveProtectionForPlayer = jest.fn(() => []);
    global.getFlipBlockers = jest.fn(() => []);
    global.findMoveForCell = jest.fn((player, row, col) => (
      player === 1 && row === 2 && col === 3
        ? { player, row, col, flips: [[3, 3]] }
        : null
    ));
    global.executeMove = jest.fn();
    global.playHandAnimation = jest.fn();
    global.VisualPlaybackActive = false;
    global.isProcessing = false;
    global.isCardAnimating = false;

    const turnManager = require('../game/turn-manager.js');
    turnManager.setUIImpl({
      getRuntimeRoot: () => global,
      readRuntimeValue: (key) => global[key],
      writeRuntimeValue: (key, value) => { global[key] = value; }
    });

    require('../cards/card-interaction.js');

    window.onCardClick('trash_card', 'black');
    window.destroySelectedHandCard();
    turnManager.handleCellClick(2, 3);

    expect(global.executeMove).toHaveBeenCalledWith(expect.objectContaining({
      row: 2,
      col: 3
    }));

    if (typeof turnManager.replaceUIImpl === 'function') {
      turnManager.replaceUIImpl({});
    }
    delete global.getActiveProtectionForPlayer;
    delete global.getFlipBlockers;
    delete global.findMoveForCell;
    delete global.executeMove;
    delete global.playHandAnimation;
    delete global.VisualPlaybackActive;
    delete global.isProcessing;
    delete global.isCardAnimating;
  });

  test('hand_remove 再生がある手札破壊は renderBoard 直呼びで playback flush を迂回しない', () => {
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn((_cs, _gs, _player, action) => {
      if (action.type === 'destroy_hand_card') {
        const hand = (global.cardState.hands.black || []).filter((id) => id !== action.destroyCardId);
        const nextCardState = {
          ...global.cardState,
          hands: { black: hand, white: [] },
          hasDestroyedCardThisTurnByPlayer: { black: true, white: false },
          discard: [...(global.cardState.discard || []), action.destroyCardId],
          selectedCardId: null,
          selectedCardOwnerKey: null
        };
        global.cardState = nextCardState;
        return {
          ok: true,
          nextCardState,
          nextGameState: global.gameState,
          playbackEvents: [{ type: 'hand_remove', phase: 1, targets: [{ player: 'black', count: 1, cardId: action.destroyCardId }] }]
        };
      }
      return { ok: false, rejectedReason: 'UNSUPPORTED' };
    });
    global.renderBoard = jest.fn();
    global.waitForPlaybackIdle = jest.fn(() => Promise.resolve());

    require('../cards/card-interaction.js');

    window.onCardClick('trash_card', 'black');
    global.emitBoardUpdate.mockClear();
    global.renderBoard.mockClear();
    window.destroySelectedHandCard();

    expect(global.emitBoardUpdate).toHaveBeenCalled();

    delete global.renderBoard;
    delete global.waitForPlaybackIdle;
  });

  test('hand_remove 以外の playback がある手札破壊も playback flush を迂回しない', () => {
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn((_cs, _gs, _player, action) => {
      if (action.type === 'destroy_hand_card') {
        const hand = (global.cardState.hands.black || []).filter((id) => id !== action.destroyCardId);
        const nextCardState = {
          ...global.cardState,
          hands: { black: hand, white: [] },
          hasDestroyedCardThisTurnByPlayer: { black: true, white: false },
          discard: [...(global.cardState.discard || []), action.destroyCardId],
          selectedCardId: null,
          selectedCardOwnerKey: null
        };
        global.cardState = nextCardState;
        return {
          ok: true,
          nextCardState,
          nextGameState: global.gameState,
          playbackEvents: [{ type: 'sound_effect', phase: 1, targets: [{ key: 'stone_destroy' }] }]
        };
      }
      return { ok: false, rejectedReason: 'UNSUPPORTED' };
    });
    global.renderBoard = jest.fn();

    require('../cards/card-interaction.js');

    window.onCardClick('trash_card', 'black');
    global.emitBoardUpdate.mockClear();
    global.renderBoard.mockClear();
    window.destroySelectedHandCard();

    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(global.renderBoard).not.toHaveBeenCalled();

    delete global.renderBoard;
  });

  test('idle 状態で残った hand-only playback queue は通常配置前に掃除される', () => {
    global.getActiveProtectionForPlayer = jest.fn(() => []);
    global.getFlipBlockers = jest.fn(() => []);
    global.findMoveForCell = jest.fn((player, row, col) => (
      player === 1 && row === 2 && col === 3
        ? { player, row, col, flips: [[3, 3]] }
        : null
    ));
    global.executeMove = jest.fn();
    global.playHandAnimation = jest.fn();
    global.VisualPlaybackActive = false;
    global.isProcessing = false;
    global.isCardAnimating = false;
    global.cardState.presentationEvents = [
      { type: 'PLAYBACK_EVENTS', events: [{ type: 'hand_remove', phase: 1, targets: [{ player: 'black', count: 1 }] }] }
    ];
    global.cardState._presentationEventsPersist = [
      { type: 'HAND_REMOVE', player: 'black', count: 1 },
      { type: 'PLAYBACK_EVENTS', events: [{ type: 'hand_remove', phase: 1, targets: [{ player: 'black', count: 1 }] }] }
    ];

    const turnManager = require('../game/turn-manager.js');
    turnManager.setUIImpl({
      getRuntimeRoot: () => global,
      readRuntimeValue: (key) => global[key],
      writeRuntimeValue: (key, value) => { global[key] = value; }
    });

    turnManager.handleCellClick(2, 3);

    expect(global.executeMove).toHaveBeenCalledWith(expect.objectContaining({
      row: 2,
      col: 3
    }));
    expect(global.cardState.presentationEvents).toEqual([]);
    expect(global.cardState._presentationEventsPersist).toEqual([]);

    if (typeof turnManager.replaceUIImpl === 'function') {
      turnManager.replaceUIImpl({});
    }
    delete global.getActiveProtectionForPlayer;
    delete global.getFlipBlockers;
    delete global.findMoveForCell;
    delete global.executeMove;
    delete global.playHandAnimation;
    delete global.VisualPlaybackActive;
    delete global.isProcessing;
    delete global.isCardAnimating;
  });
});
