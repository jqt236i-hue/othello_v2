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

describe('NetworkMatchClient presence log', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.gameState = createSnapshot(10).gameState;
    global.cardState = createSnapshot(10).cardState;

    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();

    class MockEventSource {
      static instances = [];

      constructor(url) {
        this.url = url;
        this.handlers = {};
        this.onmessage = null;
        MockEventSource.instances.push(this);
      }

      addEventListener(name, handler) {
        this.handlers[name] = handler;
      }

      emit(name, payload) {
        const handler = this.handlers[name];
        if (typeof handler === 'function') {
          handler({ data: JSON.stringify(payload) });
        }
      }

      close() {}
    }

    global.EventSource = MockEventSource;

    global.fetch = jest.fn(async (url, init) => {
      const parsedUrl = new URL(String(url), 'http://localhost/');
      const path = parsedUrl.pathname;
      const requestBody = (init && init.body) ? JSON.parse(init.body) : {};

      if (path === '/api/match/create') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ROOM1234',
          seatKey: 'black',
          seatToken: 'seat-token',
          seats: { black: true, white: false },
          seatNames: { black: 'くろ', white: '' },
          seatHandSkins: { black: requestBody.selectedHandSkinId || '', white: '' },
          stateVersion: 10,
          snapshot: createSnapshot(10)
        });
      }

      if (path === '/api/match/hand-skin') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ROOM1234',
          seatKey: 'black',
          seats: { black: true, white: false },
          seatNames: { black: 'くろ', white: '' },
          seatHandSkins: { black: requestBody.selectedHandSkinId || '', white: '' },
          turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },
          serverTime: 1
        });
      }

      if (path === '/api/match/deck') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ROOM1234',
          seatKey: 'black',
          seats: { black: true, white: false },
          seatNames: { black: 'くろ', white: '' },
          roomDeck: {
            mode: 'perPlayer',
            deckCode: '',
            deckSize: null,
            deckCodeByPlayer: { black: requestBody.deckCode || '', white: '' },
            deckSizeByPlayer: { black: 30, white: null },
            source: 'room'
          },
          turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },
          serverTime: 1
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
    delete global.gameState;
    delete global.cardState;
    delete global.addLog;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.EventSource;
    delete global.fetch;
  });

  test('相手席の参加通知を効果ログへ表示する', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    global.addLog.mockClear();

    const stream = global.EventSource.instances[0];
    expect(stream).toBeTruthy();

    stream.emit('presence', {
      ok: true,
      type: 'join',
      seatKey: 'white',
      rejoined: false
    });

    expect(global.addLog).toHaveBeenCalledWith('ネット対戦: 白が接続しました');
  });

  test('相手席の入退室を中央ポップアップで約4秒表示する', async () => {
    jest.useFakeTimers();

    try {
      require('../ui/network-client.js');
      const client = window.NetworkMatchClient;
      expect(client).toBeTruthy();

      const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
      expect(created.ok).toBe(true);

      const stream = global.EventSource.instances[0];
      expect(stream).toBeTruthy();

      stream.emit('presence', {
        ok: true,
        type: 'join',
        seatKey: 'white',
        playerName: 'しろ',
        rejoined: false,
        seats: { black: true, white: true },
        seatNames: { black: 'くろ', white: 'しろ' }
      });

      const toast = document.getElementById('network-presence-toast');
      expect(toast).not.toBeNull();
      expect(toast.textContent.trim()).toBe('しろさんが入室しました');
      expect(toast.classList.contains('is-visible')).toBe(true);
      expect(toast.classList.contains('is-hiding')).toBe(false);
      expect(toast.getAttribute('aria-hidden')).toBe('false');

      jest.advanceTimersByTime(3999);
      expect(toast.classList.contains('is-hiding')).toBe(false);

      jest.advanceTimersByTime(1);
      expect(toast.classList.contains('is-hiding')).toBe(true);

      stream.emit('presence', {
        ok: true,
        type: 'leave',
        seatKey: 'white',
        playerName: '',
        seats: { black: true, white: false },
        seatNames: { black: 'くろ', white: '' }
      });

      expect(toast.textContent.trim()).toBe('しろさんが退出しました');
      expect(toast.classList.contains('is-visible')).toBe(true);
      expect(toast.classList.contains('is-hiding')).toBe(false);
      expect(toast.getAttribute('aria-hidden')).toBe('false');
    } finally {
      jest.useRealTimers();
    }
  });

  test('自席の参加通知は効果ログへ出さない', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    global.addLog.mockClear();

    const stream = global.EventSource.instances[0];
    expect(stream).toBeTruthy();

    stream.emit('presence', {
      ok: true,
      type: 'join',
      seatKey: 'black',
      rejoined: false
    });

    expect(global.addLog).not.toHaveBeenCalled();
    expect(document.getElementById('network-presence-toast')).toBeNull();
  });

  test('2人そろうと在室状態リスナーへ通知する', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const states = [];
    client.setRoomStateListener((nextState) => {
      states.push(nextState);
    });

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const stream = global.EventSource.instances[0];
    expect(stream).toBeTruthy();

    stream.emit('presence', {
      ok: true,
      type: 'join',
      seatKey: 'white',
      rejoined: false,
      seats: { black: true, white: true }
    });

    expect(states.length).toBeGreaterThan(0);
    expect(states[states.length - 1].hasTwoPlayers).toBe(true);
  });

  test('相手からの再戦申請を再戦申請リスナーへ渡す', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const received = [];
    client.setRematchRequestListener((payload) => {
      received.push(payload);
    });

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const stream = global.EventSource.instances[0];
    expect(stream).toBeTruthy();

    stream.emit('presence', {
      ok: true,
      type: 'rematch_request',
      requestId: 'rematch_req_1',
      seatKey: 'white',
      playerName: 'しろ',
      serverTime: 100
    });

    expect(received).toEqual([
      {
        type: 'request',
        requestId: 'rematch_req_1',
        fromSeatKey: 'white',
        fromPlayerName: 'しろ',
        serverTime: 100
      }
    ]);
  });

  test('ネット部屋作成後は常設ボタンを再戦表示へ同期する', async () => {
    document.body.innerHTML = '<button id="resetBtn">リセット</button>';
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const resetBtn = document.getElementById('resetBtn');
    expect(resetBtn?.textContent).toBe('再戦');
    expect(resetBtn?.getAttribute('aria-label')).toBe('再戦');
  });

  test('選択中の手スキンを create と update と presence で反映する', async () => {
    const storageModule = require('../ui/storage/gacha-progress.js');
    storageModule.unlockHandSkinIds(window, ['gacha__n__hand-swap']);
    window.localStorage.setItem('othello.handSkin', 'gacha__n__hand-swap');
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const states = [];
    client.setRoomStateListener((nextState) => {
      states.push(nextState);
    });

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const createCall = global.fetch.mock.calls.find(([url]) => new URL(String(url), 'http://localhost/').pathname === '/api/match/create');
    expect(JSON.parse(createCall[1].body).selectedHandSkinId).toBe('gacha__n__陽気な手');
    expect(client.getSeatHandSkins()).toEqual({
      black: 'gacha__n__陽気な手',
      white: ''
    });

    const updated = await client.updateHandSkin('gacha__n__小鬼の手');
    expect(updated.ok).toBe(true);

    const handSkinCall = global.fetch.mock.calls.find(([url]) => new URL(String(url), 'http://localhost/').pathname === '/api/match/hand-skin');
    expect(JSON.parse(handSkinCall[1].body).selectedHandSkinId).toBe('gacha__n__小鬼の手');
    expect(client.getSeatHandSkins()).toEqual({
      black: 'gacha__n__小鬼の手',
      white: ''
    });

    const stream = global.EventSource.instances[0];
    stream.emit('presence', {
      ok: true,
      type: 'hand_skin',
      seatKey: 'white',
      seats: { black: true, white: true },
      seatHandSkins: {
        black: 'gacha__n__小鬼の手',
        white: 'gacha__n__hand-swap'
      }
    });

    expect(client.getSeatHandSkins()).toEqual({
      black: 'gacha__n__小鬼の手',
      white: 'gacha__n__陽気な手'
    });
    expect(states[states.length - 1].seatHandSkins).toEqual({
      black: 'gacha__n__小鬼の手',
      white: 'gacha__n__陽気な手'
    });
  });

  test('選択中の deckCode を room へ同期して roomDeck を更新する', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const updated = await client.updateDeckSelection('D1C1:chest_01*3');
    expect(updated.ok).toBe(true);

    const deckCall = global.fetch.mock.calls.find(([url]) => new URL(String(url), 'http://localhost/').pathname === '/api/match/deck');
    expect(deckCall).toBeTruthy();
    expect(JSON.parse(deckCall[1].body)).toEqual(expect.objectContaining({
      roomId: 'ROOM1234',
      seatKey: 'black',
      seatToken: 'seat-token',
      deckCode: 'D1C1:chest_01*3'
    }));
    expect(client.getRoomDeck().deckCodeByPlayer.black).toBe('D1C1:chest_01*3');
  });

  test('chatイベントを受信してチャットリスナーへ渡す', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const received = [];
    client.setChatListener((payload) => {
      received.push(payload);
    });

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const stream = global.EventSource.instances[0];
    expect(stream).toBeTruthy();

    stream.emit('chat', {
      ok: true,
      type: 'history',
      messages: [{ id: 1, seatKey: 'black', text: 'こんにちは', serverTime: 1 }]
    });
    stream.emit('chat', {
      ok: true,
      type: 'message',
      message: { id: 2, seatKey: 'white', text: 'よろしく', serverTime: 2 }
    });

    expect(received).toHaveLength(2);
    expect(received[0].type).toBe('history');
    expect(received[0].messages[0].text).toBe('こんにちは');
    expect(received[1].type).toBe('message');
    expect(received[1].message.text).toBe('よろしく');
  });
});
