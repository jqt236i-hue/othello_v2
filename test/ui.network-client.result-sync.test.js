const { JSDOM } = require('jsdom');

describe('NetworkMatchClient result sync', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.gameState = { currentPlayer: 1, turnNumber: 1 };
    global.cardState = { markers: [] };

    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();

    global.isGameOver = jest.fn(() => true);
    global.showResult = jest.fn();
  });

  afterEach(() => {
    try { if (dom && dom.window && typeof dom.window.close === 'function') dom.window.close(); } catch (e) {}

    delete global.window;
    delete global.document;
    delete global.location;
    delete global.localStorage;
    delete global.gameState;
    delete global.cardState;
    delete global.addLog;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.isGameOver;
    delete global.showResult;
  });

  test('終局スナップショット受信で結果表示を一度だけ行う', () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const terminalSnapshot = {
      stateVersion: 7,
      gameState: { currentPlayer: -1, turnNumber: 40, __resultShown: true },
      cardState: { markers: [] }
    };

    const first = client.applySnapshot(terminalSnapshot, { force: true });
    const second = client.applySnapshot(terminalSnapshot, { force: true });

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(global.showResult).toHaveBeenCalledTimes(1);
  });

  test('skipResultOverlay 指定時は結果表示を行わない', () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const terminalSnapshot = {
      stateVersion: 8,
      gameState: { currentPlayer: -1, turnNumber: 41, __resultShown: true },
      cardState: { markers: [] }
    };

    client.applySnapshot(terminalSnapshot, { force: true, skipResultOverlay: true });

    expect(global.showResult).not.toHaveBeenCalled();
  });

  test('playbackEventsがあるスナップショット反映では即時renderCardUIしない', () => {
    global.cardState = { markers: [], presentationEvents: [] };
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const snapshot = {
      stateVersion: 9,
      gameState: { currentPlayer: 1, turnNumber: 42, __resultShown: false },
      cardState: { markers: [], presentationEvents: [] }
    };

    client.applySnapshot(snapshot, {
      force: true,
      skipResultOverlay: true,
      playbackEvents: [{ type: 'hand_remove', phase: 1, targets: [{ player: 'white', count: 1 }] }]
    });

    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.renderCardUI).not.toHaveBeenCalled();
  });
});
