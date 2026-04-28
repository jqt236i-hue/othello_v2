import { JSDOM } from 'jsdom';

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

function createSnapshot(stateVersion) {
  return {
    stateVersion,
    _meta: {
      authority: 'server',
      version: stateVersion,
      projectedForSeat: 'black',
      turnStartReconciled: true
    },
    gameState: {
      currentPlayer: 1,
      turnNumber: 1
    },
    cardState: {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      hands: { black: [], white: [] },
      charge: { black: 0, white: 0 },
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: [],
      turnIndex: 1
    }
  };
}

describe('NetworkMatchClient leaveRoom cleanup', () => {
  let dom;
  let eventSources;
  let leaveStatus;
  let leavePayload;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;
    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = createSnapshot(1).gameState;
    global.cardState = createSnapshot(1).cardState;
    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.showResult = jest.fn();
    global.isGameOver = jest.fn(() => false);
    global.emitStatus = jest.fn();
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    eventSources = [];
    leaveStatus = 200;
    leavePayload = { ok: true, seats: { black: false, white: false }, seatNames: { black: '', white: '' } };

    global.EventSource = class MockEventSource {
      constructor() {
        this.close = jest.fn();
        eventSources.push(this);
      }
      addEventListener() {}
    };

    global.fetch = jest.fn(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === '/api/match/create') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 1,
          snapshot: createSnapshot(1)
        });
      }
      if (path === '/api/match/leave') {
        return jsonResponse(leaveStatus, leavePayload);
      }
      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) {}

    delete global.window;
    delete global.document;
    delete global.location;
    delete global.localStorage;
    delete global.BLACK;
    delete global.WHITE;
    delete global.gameState;
    delete global.cardState;
    delete global.addLog;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.showResult;
    delete global.isGameOver;
    delete global.emitStatus;
    delete global.BoardOps;
    delete global.EventSource;
    delete global.fetch;
  });

  test('leave failure keeps local session and stored claim', async () => {
    leaveStatus = 403;
    leavePayload = { ok: false, reason: 'SEAT_TOKEN_MISMATCH' };

    import * as playbackState from '../ui/playback-state-manager.js';
    const abortSpy = jest.spyOn(playbackState, 'abortPlayback');
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(localStorage.getItem('network_match_seat_ABC')).not.toBeNull();

    const left = await client.leaveRoom();

    expect(left).toEqual(expect.objectContaining({
      ok: false,
      reason: 'SEAT_TOKEN_MISMATCH',
      status: 403
    }));
    expect(client.getState()).toEqual(expect.objectContaining({
      active: true,
      roomId: 'ABC',
      seatKey: 'black'
    }));
    expect(localStorage.getItem('network_match_seat_ABC')).not.toBeNull();
    expect(eventSources).toHaveLength(1);
    expect(eventSources[0].close).not.toHaveBeenCalled();
    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(global.addLog).toHaveBeenCalledWith(expect.stringContaining('退出に失敗'));
  });

  test('successful leave clears session, stored claim, and stream', async () => {
    import * as playbackState from '../ui/playback-state-manager.js';
    const abortSpy = jest.spyOn(playbackState, 'abortPlayback');
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(localStorage.getItem('network_match_seat_ABC')).not.toBeNull();

    const left = await client.leaveRoom();

    expect(left).toEqual(expect.objectContaining({ ok: true }));
    expect(client.getState()).toEqual(expect.objectContaining({
      active: false,
      roomId: ''
    }));
    expect(localStorage.getItem('network_match_seat_ABC')).toBeNull();
    expect(eventSources).toHaveLength(1);
    expect(eventSources[0].close).toHaveBeenCalledTimes(1);
    expect(abortSpy).toHaveBeenCalledTimes(1);
  });
});
