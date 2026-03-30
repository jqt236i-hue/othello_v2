const { JSDOM } = require('jsdom');

describe('pass fail-safe when no legal moves', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="card-detail-name"></div>
        <div id="card-detail-desc"></div>
        <div id="card-detail-more" style="display:none;"></div>
        <div id="card-detail-actions"></div>
        <button id="destroy-card-btn">破壊</button>
        <button id="use-card-btn">使用</button>
        <button id="toggle-card-detail-btn">詳細</button>
        <button id="pass-btn">パス</button>
        <button id="sell-card-btn" style="display:none;">売却</button>
        <button id="cancel-card-btn" style="display:none;">キャンセル</button>
        <div id="use-card-reason"></div>
      </body></html>
    `);

    global.window = dom.window;
    global.document = dom.window.document;

    global.BLACK = 1;
    global.WHITE = -1;
    global.window.AUTO_MODE_ACTIVE = false;
    global.window.VisualPlaybackActive = false;

    global.gameState = {
      currentPlayer: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.cardState = {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      turnIndex: 0,
      charge: { black: 99, white: 99 },
      hands: { black: [], white: [] },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: { black: null, white: null },
      markers: [],
      discard: []
    };

    global.Core = { getLegalMoves: () => [] };
    global.CardLogic = {
      getCardDef: () => null
    };

    global.isProcessing = true;
    global.isCardAnimating = false;
    global.window.isProcessing = true;
    global.window.isCardAnimating = false;

    global.renderCardUI = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.processPassTurn = jest.fn();
  });

  afterEach(() => {
    delete global.PlaybackStateManager;
    delete global.window;
    delete global.document;
  });

  test('enables pass button even when stale processing flag remains', () => {
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();

    const passBtn = document.getElementById('pass-btn');
    expect(passBtn.style.display).toBe('inline-block');
    expect(passBtn.disabled).toBe(false);
  });

  test('manual pass clears stale busy flags and proceeds', () => {
    require('../cards/card-interaction.js');

    window.passCurrentTurn();

    expect(global.processPassTurn).toHaveBeenCalledWith('black', false);
    expect(global.isProcessing).toBe(false);
    expect(global.window.isProcessing).toBe(false);
  });

  test('manual pass clears stale busy flags through PlaybackStateManager', () => {
    let processing = true;
    let cardAnimating = false;
    const playbackStateManager = {
      getProcessing: jest.fn(() => processing),
      getCardAnimating: jest.fn(() => cardAnimating),
      getPlaybackActive: jest.fn(() => false),
      getPlaybackStartedAt: jest.fn(() => null),
      setBusyState: jest.fn((config) => {
        if (Object.prototype.hasOwnProperty.call(config, 'processing')) {
          processing = config.processing === true;
          global.isProcessing = processing;
          global.window.isProcessing = processing;
        }
        if (Object.prototype.hasOwnProperty.call(config, 'cardAnimating')) {
          cardAnimating = config.cardAnimating === true;
          global.isCardAnimating = cardAnimating;
          global.window.isCardAnimating = cardAnimating;
        }
        return {
          isProcessing: processing,
          isCardAnimating: cardAnimating,
          playbackActive: false
        };
      })
    };
    global.PlaybackStateManager = playbackStateManager;
    global.window.PlaybackStateManager = playbackStateManager;

    require('../cards/card-interaction.js');

    window.passCurrentTurn();

    expect(playbackStateManager.setBusyState).toHaveBeenCalledWith(expect.objectContaining({
      processing: false,
      cardAnimating: false
    }));
    expect(global.processPassTurn).toHaveBeenCalledWith('black', false);
    expect(processing).toBe(false);
  });

  test('stale visual playback flag with idle engine allows manual pass', () => {
    global.window.VisualPlaybackActive = true;
    global.isCardAnimating = true;
    global.window.isCardAnimating = true;
    global.window.AnimationEngine = { isPlaying: false };
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    const passBtn = document.getElementById('pass-btn');
    expect(passBtn.disabled).toBe(false);

    window.passCurrentTurn();
    expect(global.processPassTurn).toHaveBeenCalledWith('black', false);
    expect(global.window.VisualPlaybackActive).toBe(false);
  });

  test('does not pass while visual playback is actively running', () => {
    global.window.VisualPlaybackActive = true;
    global.isCardAnimating = true;
    global.window.isCardAnimating = true;
    global.window.AnimationEngine = { isPlaying: true };
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    window.passCurrentTurn();

    const passBtn = document.getElementById('pass-btn');
    expect(passBtn.disabled).toBe(true);
    expect(global.processPassTurn).not.toHaveBeenCalled();
  });
});
