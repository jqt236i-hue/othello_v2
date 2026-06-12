import { JSDOM } from 'jsdom';

describe('network WORK_WILL follow-up placement', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="hand-black" class="hand-container">
          <div class="card-item visible" data-card-id="work_01">
            <span class="card-name">出稼ぎの意志</span>
          </div>
        </div>
        <div id="hand-white" class="hand-container"></div>
        <div id="board"></div>
        <div id="card-detail-name"></div>
        <div id="card-detail-desc"></div>
        <button id="use-card-btn" type="button"></button>
        <button id="destroy-card-btn" type="button"></button>
        <button id="toggle-card-detail-btn" type="button"></button>
        <button id="pass-btn" type="button"></button>
        <button id="cancel-card-btn" type="button"></button>
        <div id="use-card-reason"></div>
        <div id="card-detail-actions"></div>
        <div id="card-detail-more"></div>
      </body></html>
    `, { url: 'https://example.test/' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
    global.window.requestAnimationFrame = global.requestAnimationFrame;
    global.window.cancelAnimationFrame = global.cancelAnimationFrame;

    const playbackStateManager = require('../ui/playback-state-manager.js');
    playbackStateManager.abortPlayback();
    playbackStateManager.setBusyState({ processing: false, cardAnimating: false, playbackActive: false });
    global.PlaybackStateManager = playbackStateManager;
    global.window.PlaybackStateManager = playbackStateManager;

    global.BLACK = 1;
    global.WHITE = -1;
    global.MATCH_MODE = 'network';
    global.window.MATCH_MODE = 'network';
    global.LOCAL_PLAYER_KEY = 'black';
    global.window.LOCAL_PLAYER_KEY = 'black';
    global.gameState = { currentPlayer: 1 };
    global.cardState = {
      selectedCardId: 'work_01',
      selectedCardOwnerKey: 'black',
      turnIndex: 3,
      lastTurnStartedFor: 'black',
      charge: { black: 10, white: 10 },
      hands: { black: ['work_01'], white: [] },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: { black: null, white: null },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: [],
      presentationEvents: [],
      _presentationEventsPersist: []
    };

    const publishDeferred = {};
    publishDeferred.promise = new Promise((resolve, reject) => {
      publishDeferred.resolve = resolve;
      publishDeferred.reject = reject;
    });
    global.__publishDeferred = publishDeferred;

    global.CardLogic = {
      getCardDef: (id) => ({ id, name: '出稼ぎの意志', desc: 'd', cost: 1, type: 'WORK_WILL' }),
      getUsableCardIds: () => ['work_01']
    };
    global.Core = {
      getLegalMoves: jest.fn(() => [{ row: 2, col: 3 }])
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        skippedLocalExecution: true,
        playbackEvents: [],
        nextCardState: global.cardState,
        nextGameState: global.gameState,
        publishPromise: publishDeferred.promise
      }))
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) }),
        recordAction: jest.fn(),
        incrementTurnIndex: jest.fn()
      }
    };
    global.playCardUseHandAnimation = jest.fn(() => Promise.resolve());
    global.renderCardUI = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.addLog = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.isProcessing = false;
    global.isCardAnimating = false;
    global.VisualPlaybackActive = false;
    global.__busyStateSince = null;
    global.__playbackActiveSince = null;
    global.getActiveProtectionForPlayer = jest.fn(() => []);
    global.getFlipBlockers = jest.fn(() => []);
    global.findMoveForCell = jest.fn((player, row, col) => ({ row, col, flips: [] }));
    global.executeMove = jest.fn();
    global.playHandAnimation = jest.fn((player, row, col, cb) => cb());
    global.SoundEngine = { init: jest.fn() };
    global.BoardOps = { emitPresentationEvent: jest.fn() };
  });

  afterEach(() => {
    try {
      if (global.PlaybackStateManager && typeof global.PlaybackStateManager.abortPlayback === 'function') {
        global.PlaybackStateManager.abortPlayback();
      }
    } catch (e) { /* ignore */ }
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    delete global.__publishDeferred;
    delete global.PlaybackStateManager;
    delete global.window;
    delete global.document;
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
    delete global.MATCH_MODE;
    delete global.LOCAL_PLAYER_KEY;
    delete global.gameState;
    delete global.cardState;
    delete global.CardLogic;
    delete global.Core;
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.ActionManager;
    delete global.playCardUseHandAnimation;
    delete global.renderCardUI;
    delete global.emitBoardUpdate;
    delete global.addLog;
    delete global.ensureCurrentPlayerCanActOrPass;
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.VisualPlaybackActive;
    delete global.__busyStateSince;
    delete global.__playbackActiveSince;
    delete global.__serverAuthoredCardUseClickBuffer;
    delete global.__captureServerAuthoredCardUseBoardClick;
    delete global.handleCellClick;
    delete global.getActiveProtectionForPlayer;
    delete global.getFlipBlockers;
    delete global.findMoveForCell;
    delete global.executeMove;
    delete global.playHandAnimation;
    delete global.SoundEngine;
    delete global.BoardOps;
    jest.clearAllMocks();
  });

  test('replays early board click after server-authored WORK_WILL publish succeeds', async () => {
    require('../cards/card-interaction.js');
    const turnManager = require('../game/turn-manager.js');
    const selectionFlow = require('../game/card-effects/selection-flow');
    selectionFlow.setSignalBridge({
      playbackStateManager: global.PlaybackStateManager
    });
    turnManager.setUIImpl({
      readRuntimeValue: (key) => {
        if (typeof global[key] !== 'undefined') return global[key];
        return global.window ? global.window[key] : undefined;
      },
      writeRuntimeValue: (key, value) => {
        global[key] = value;
        if (global.window) global.window[key] = value;
      },
      runtimeRoot: global
    });
    global.handleCellClick = (row, col) => {
      global.PlaybackStateManager.setBusyState({ processing: false, cardAnimating: false });
      return turnManager.handleCellClick(row, col);
    };
    window.handleCellClick = global.handleCellClick;
    window.useSelectedCard();
    global.PlaybackStateManager.setBusyState({ processing: true, cardAnimating: true });

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(global.executeMove).not.toHaveBeenCalled();

    turnManager.handleCellClick(2, 3);

    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect((global.__serverAuthoredCardUseClickBuffer || window.__serverAuthoredCardUseClickBuffer).click)
      .toEqual({ row: 2, col: 3, playerKey: 'black' });

    global.__publishDeferred.resolve({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    expect(global.findMoveForCell).toHaveBeenCalledWith(1, 2, 3, null, [], []);
    expect(global.executeMove).toHaveBeenCalledTimes(1);
  });

  test('replays early board click after server-authored ESCAPE_WILL publish succeeds', async () => {
    global.cardState.selectedCardId = 'escape_01';
    global.cardState.hands.black = ['escape_01'];
    global.CardLogic.getCardDef = (id) => ({ id, name: '逃げる意志', desc: 'd', cost: 7, type: 'ESCAPE_WILL' });
    global.CardLogic.getUsableCardIds = () => ['escape_01'];

    require('../cards/card-interaction.js');
    const turnManager = require('../game/turn-manager.js');
    const selectionFlow = require('../game/card-effects/selection-flow');
    selectionFlow.setSignalBridge({
      playbackStateManager: global.PlaybackStateManager
    });
    turnManager.setUIImpl({
      readRuntimeValue: (key) => {
        if (typeof global[key] !== 'undefined') return global[key];
        return global.window ? global.window[key] : undefined;
      },
      writeRuntimeValue: (key, value) => {
        global[key] = value;
        if (global.window) global.window[key] = value;
      },
      runtimeRoot: global
    });
    global.handleCellClick = (row, col) => {
      global.PlaybackStateManager.setBusyState({ processing: false, cardAnimating: false });
      return turnManager.handleCellClick(row, col);
    };
    window.handleCellClick = global.handleCellClick;
    window.useSelectedCard();
    global.PlaybackStateManager.setBusyState({ processing: true, cardAnimating: true });

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(global.executeMove).not.toHaveBeenCalled();

    turnManager.handleCellClick(2, 3);

    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect((global.__serverAuthoredCardUseClickBuffer || window.__serverAuthoredCardUseClickBuffer).click)
      .toEqual({ row: 2, col: 3, playerKey: 'black' });

    global.__publishDeferred.resolve({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    expect(global.findMoveForCell).toHaveBeenCalledWith(1, 2, 3, null, [], []);
    expect(global.executeMove).toHaveBeenCalledTimes(1);
  });

  test('drops early board click when server-authored WORK_WILL publish fails', async () => {
    require('../cards/card-interaction.js');
    const turnManager = require('../game/turn-manager.js');
    const selectionFlow = require('../game/card-effects/selection-flow');
    selectionFlow.setSignalBridge({
      playbackStateManager: global.PlaybackStateManager
    });
    turnManager.setUIImpl({
      readRuntimeValue: (key) => {
        if (typeof global[key] !== 'undefined') return global[key];
        return global.window ? global.window[key] : undefined;
      },
      writeRuntimeValue: (key, value) => {
        global[key] = value;
        if (global.window) global.window[key] = value;
      },
      runtimeRoot: global
    });
    global.handleCellClick = (row, col) => {
      global.PlaybackStateManager.setBusyState({ processing: false, cardAnimating: false });
      return turnManager.handleCellClick(row, col);
    };
    window.handleCellClick = global.handleCellClick;
    window.useSelectedCard();
    global.PlaybackStateManager.setBusyState({ processing: true, cardAnimating: true });
    turnManager.handleCellClick(2, 3);

    global.__publishDeferred.resolve({ ok: false, reason: 'VERSION_MISMATCH' });
    await Promise.resolve();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
    expect(global.addLog).toHaveBeenCalledWith('カード使用に失敗しました (VERSION_MISMATCH)');
  });
});
