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
      projectedForSeat: null,
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
      charge: { black: 10, white: 10 },
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: [],
      turnIndex: 1
    }
  };
}

function createPlaceAction(playerKey = 'black', turnIndex = 1) {
  return {
    type: 'place',
    playerKey,
    row: 2,
    col: 3,
    turnIndex
  };
}

describe('NetworkMatchClient sound dedupe', () => {
  let dom;
  let eventSources;
  let publishPayloads;
  let playbackPromises;
  let playEffectByKey;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = createSnapshot(10).gameState;
    global.cardState = createSnapshot(10).cardState;

    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();

    playEffectByKey = jest.fn();
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };

    const animationEngine = require('../ui/animation-engine.js');
    playbackPromises = [];
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
        playbackPromises.push(animationEngine.executePhase(ev.events));
      })
    };

    eventSources = [];
    publishPayloads = [];
    global.EventSource = class MockEventSource {
      constructor() {
        eventSources.push(this);
      }
      addEventListener() {}
      close() {}
    };

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/create') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 10,
          snapshot: createSnapshot(10)
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishPayloads.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          stateVersion: 11,
          snapshot: createSnapshot(11),
          playbackEvents: [{
            type: 'sound_effect',
            phase: 1,
            targets: [{ soundKey: 'card_use_button' }]
          }]
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) {
      // ignore
    }

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
    delete global.BoardOps;
    delete global.EventSource;
    delete global.fetch;
    delete global.SoundEngine;
  });

  test('publish response 適用後に同版 self SSE が来ても sound_effect は一度しか再生しない', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const publishResult = await client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    expect(publishResult.ok).toBe(true);
    expect(publishPayloads).toHaveLength(1);

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId: publishPayloads[0].operationId,
        playerKey: 'black',
        actionType: 'place',
        playbackEvents: [{
          type: 'sound_effect',
          phase: 1,
          targets: [{ soundKey: 'card_use_button' }]
        }],
        snapshot: createSnapshot(11)
      })
    });

    await Promise.all(playbackPromises);
    await Promise.resolve();

    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);
    expect(playEffectByKey).toHaveBeenCalledTimes(1);
    expect(playEffectByKey).toHaveBeenCalledWith('card_use_button');
  });
});
