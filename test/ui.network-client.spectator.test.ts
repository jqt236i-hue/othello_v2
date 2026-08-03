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
      viewerRole: 'spectator',
      boardContractVersion: 2,
      turnStartReconciled: true
    },
    gameState: {
      currentPlayer: 1,
      turnNumber: 1,
      board: Array.from({ length: 4 }, () => Array(4).fill(0)),
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      boardExpansion: { cells: [] }
    },
    cardState: {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      hands: {
        black: ['__hidden_hand__:black:0'],
        white: ['__hidden_hand__:white:0']
      },
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

describe('NetworkMatchClient spectator session', () => {
  let dom;
  let eventSources;
  let statusWriter;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = createSnapshot(3).gameState;
    global.cardState = createSnapshot(3).cardState;
    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.GameEvents = { gameEvents: { on: jest.fn() } };

    eventSources = [];
    global.EventSource = class MockEventSource {
      constructor(url) {
        this.url = url;
        this.handlers = {};
        eventSources.push(this);
      }

      addEventListener(name, handler) {
        this.handlers[name] = handler;
      }

      close() {}
    };

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;
      const body = init.body ? JSON.parse(init.body) : {};

      if (path === '/api/match/spectate') {
        return jsonResponse(200, {
          ok: true,
          roomId: body.roomId,
          viewerRole: 'spectator',
          spectatorId: 'spec_12345678',
          spectatorToken: 'spectator-token',
          spectatorName: body.spectatorName,
          stateVersion: 3,
          presentationCursor: { visualSeq: 0, stateVersion: 3 },
          snapshot: createSnapshot(3)
        });
      }

      if (path === '/api/match/state') {
        return jsonResponse(200, {
          ok: true,
          roomId: parsedUrl.searchParams.get('roomId'),
          viewerRole: parsedUrl.searchParams.get('viewerRole') || 'seat',
          spectatorId: parsedUrl.searchParams.get('spectatorId') || '',
          spectatorName: '観戦',
          stateVersion: 4,
          presentationCursor: { visualSeq: 0, stateVersion: 4 },
          snapshot: createSnapshot(4)
        });
      }

      return jsonResponse(500, { ok: false, reason: 'UNEXPECTED_REQUEST' });
    });

    statusWriter = jest.fn();
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
    delete global.GameEvents;
    delete global.EventSource;
    delete global.fetch;
  });

  test('spectateRoom opens read-only spectator session', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    client.setStatusWriter(statusWriter);

    const result = await client.spectateRoom('spc', {
      serverUrl: 'http://localhost:8787',
      playerName: ' 観戦 '
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      roomId: 'SPC',
      viewerRole: 'spectator',
      spectatorId: 'spec_12345678',
      spectatorName: '観戦'
    }));
    expect(client.isSpectator()).toBe(true);
    expect(eventSources).toHaveLength(1);
    expect(eventSources[0].url).toBe(
      'http://localhost:8787/api/match/stream?roomId=SPC&viewerRole=spectator&spectatorId=spec_12345678&spectatorToken=spectator-token&presentationEnvelopeVersion=2'
    );

    global.fetch.mockClear();
    const publishResult = await client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      action: { type: 'place', playerKey: 'black', row: 2, col: 3 },
      playbackEvents: []
    });
    const chatResult = await client.sendChatMessage('hello');
    const skinResult = await client.updateHandSkin('default');

    expect(publishResult).toEqual({ ok: false, reason: 'SPECTATOR_READ_ONLY' });
    expect(chatResult).toEqual({ ok: false, reason: 'SPECTATOR_READ_ONLY' });
    expect(skinResult).toEqual({ ok: false, reason: 'SPECTATOR_READ_ONLY' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(statusWriter).toHaveBeenCalledWith('観測中は操作できません', true);
    expect(statusWriter).toHaveBeenCalledWith('観測中はチャット送信できません', true);
  });

  test('restoreStoredSession resumes spectator session after reload', async () => {
    global.localStorage.setItem('network_match_last_session', JSON.stringify({
      version: 1,
      roomId: 'SPC',
      viewerRole: 'spectator',
      spectatorId: 'spec_12345678',
      spectatorToken: 'spectator-token',
      spectatorName: '観戦',
      serverUrl: 'http://localhost:8787'
    }));

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    client.setStatusWriter(statusWriter);

    const result = await client.restoreStoredSession();

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      restored: true,
      roomId: 'SPC',
      viewerRole: 'spectator',
      spectatorId: 'spec_12345678',
      spectatorName: '観戦'
    }));
    expect(client.isSpectator()).toBe(true);
    expect(eventSources).toHaveLength(1);
    expect(eventSources[0].url).toBe(
      'http://localhost:8787/api/match/stream?roomId=SPC&viewerRole=spectator&spectatorId=spec_12345678&spectatorToken=spectator-token&presentationEnvelopeVersion=2'
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8787/api/match/state?roomId=SPC&viewerRole=spectator&spectatorId=spec_12345678&spectatorToken=spectator-token',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
