const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function createEventBus() {
  const listeners = new Map();
  return {
    on(eventName, handler) {
      const bucket = listeners.get(eventName) || [];
      bucket.push(handler);
      listeners.set(eventName, bucket);
    },
    emit(eventName, payload) {
      const bucket = listeners.get(eventName) || [];
      bucket.forEach((handler) => handler(payload));
    }
  };
}

describe('ui card sync scheduler', () => {
  let dom;
  let windowRef;
  let rafQueue;
  let gameEvents;

  const uiCode = fs.readFileSync(path.resolve(__dirname, '../ui.js'), 'utf8');

  async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
  }

  function flushRafQueue() {
    const queued = rafQueue.splice(0);
    queued.forEach((callback) => callback());
  }

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body><div id="occ-black"></div><div id="occ-white"></div></body></html>', {
      runScripts: 'outside-only',
      url: 'https://example.com/'
    });
    windowRef = dom.window;
    rafQueue = [];

    windowRef.requestAnimationFrame = (callback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    };
    windowRef.cancelAnimationFrame = jest.fn();
    windowRef.renderCardUI = jest.fn();
    windowRef.countDiscs = jest.fn(() => ({ black: 0, white: 0 }));
    windowRef.addLog = jest.fn();
    windowRef.updateStatus = jest.fn();
    windowRef.CommentaryBroker = {
      initBroker: jest.fn(),
      requestCommentaryAndShow: jest.fn(),
      resetState: jest.fn()
    };
    windowRef.BLACK = 1;
    windowRef.WHITE = -1;
    windowRef.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      charge: { black: 0, white: 0 },
      hands: { black: [], white: [] },
      decks: { black: [], white: [] },
      discard: [],
      activeEffectsByPlayer: { black: [], white: [] },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false }
    };
    windowRef.gameState = {
      currentPlayer: 1,
      board: [[0]]
    };

    gameEvents = createEventBus();
    windowRef.GameEvents = {
      EVENT_TYPES: {
        BOARD_UPDATED: 'BOARD_UPDATED',
        GAME_STATE_CHANGED: 'GAME_STATE_CHANGED',
        CARD_STATE_CHANGED: 'CARD_STATE_CHANGED',
        STATUS_UPDATED: 'STATUS_UPDATED',
        GAME_RESET: 'GAME_RESET',
        LOG_ADDED: 'LOG_ADDED'
      },
      gameEvents
    };

    windowRef.eval(uiCode);
    windowRef.renderBoard = jest.fn();
  });

  afterEach(() => {
    if (dom && dom.window) dom.window.close();
  });

  test('coalesces repeated CARD_STATE_CHANGED notifications while idle', async () => {
    gameEvents.emit(windowRef.GameEvents.EVENT_TYPES.CARD_STATE_CHANGED);
    gameEvents.emit(windowRef.GameEvents.EVENT_TYPES.CARD_STATE_CHANGED);

    expect(windowRef.renderCardUI).not.toHaveBeenCalled();

    await flushMicrotasks();

    expect(windowRef.renderCardUI).toHaveBeenCalledTimes(1);
  });

  test('defers repeated CARD_STATE_CHANGED notifications until playback ends', async () => {
    windowRef.VisualPlaybackActive = true;

    gameEvents.emit(windowRef.GameEvents.EVENT_TYPES.CARD_STATE_CHANGED);
    gameEvents.emit(windowRef.GameEvents.EVENT_TYPES.CARD_STATE_CHANGED);

    await flushMicrotasks();

    expect(windowRef.renderCardUI).not.toHaveBeenCalled();
    expect(rafQueue.length).toBeGreaterThan(0);

    flushRafQueue();
    expect(windowRef.renderCardUI).not.toHaveBeenCalled();

    windowRef.VisualPlaybackActive = false;
    flushRafQueue();
    await flushMicrotasks();

    expect(windowRef.renderCardUI).toHaveBeenCalledTimes(1);
  });

  test('replays deferred board refresh work after playback ends', async () => {
    windowRef.VisualPlaybackActive = true;
    windowRef.gameState = {
      currentPlayer: 1,
      turnNumber: 3,
      board: [
        [1, 1, 1],
        [1, -1, -1],
        [0, 0, 0]
      ]
    };

    gameEvents.emit(windowRef.GameEvents.EVENT_TYPES.BOARD_UPDATED);

    await flushMicrotasks();

    expect(windowRef.renderBoard).not.toHaveBeenCalled();
    expect(windowRef.CommentaryBroker.requestCommentaryAndShow).not.toHaveBeenCalled();
    expect(rafQueue.length).toBeGreaterThan(0);

    windowRef.VisualPlaybackActive = false;
    flushRafQueue();
    await flushMicrotasks();

    expect(windowRef.renderBoard).toHaveBeenCalledTimes(1);
    expect(windowRef.CommentaryBroker.requestCommentaryAndShow).toHaveBeenCalledTimes(1);
  });
});
