import * as http from 'http';

const { createLocalMatchServer, resetRoomsForTests } = require('../scripts/local-match-server');

function requestJson(port, method, path, payload?) {
  return new Promise<any>((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 0,
            data: raw ? JSON.parse(raw) : {}
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    if (payload !== undefined) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

function openSseStream(port, path) {
  return new Promise<any>((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'GET'
    });
    const timeout = setTimeout(() => {
      req.destroy(new Error('SSE_OPEN_TIMEOUT'));
    }, 1000);

    req.on('response', (res) => {
      res.setEncoding('utf8');
      res.once('data', () => {
        clearTimeout(timeout);
        resolve({ req, res });
      });
      res.on('error', reject);
    });
    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    req.end();
  });
}

async function closeSseStream(stream) {
  if (!stream) return;
  try { stream.res.socket?.destroy(); } catch (error) { /* ignore */ }
  try { stream.res.destroy(); } catch (error) { /* ignore */ }
  try { stream.req.destroy(); } catch (error) { /* ignore */ }
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
}

async function listen(server) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return server.address().port;
}

async function closeServer(server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe('local match server lobby', () => {
  afterEach(() => {
    resetRoomsForTests();
  });

  test('パスワード付きの参加可能ルームを一覧に出し、誤パスワード参加を拒否する', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ',
        roomPassword: 'swordfish'
      });
      expect(created.status).toBe(200);

      const listed = await requestJson(port, 'GET', '/api/match/list');
      expect(listed.status).toBe(200);
      expect(listed.data.rooms).toEqual([
        expect.objectContaining({
          roomId: created.data.roomId,
          hostName: 'くろ',
          seatCount: 1,
          maxSeats: 2,
          spectatorCount: 0,
          maxSpectators: 4,
          canJoin: true,
          canSpectate: true,
          hasPassword: true
        })
      ]);
      expect(JSON.stringify(listed.data)).not.toContain('swordfish');

      const wrongJoin = await requestJson(port, 'POST', '/api/match/join', {
        roomId: created.data.roomId,
        playerName: 'しろ',
        roomPassword: 'wrong'
      });
      expect(wrongJoin.status).toBe(403);
      expect(wrongJoin.data.reason).toBe('ROOM_PASSWORD_INVALID');

      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId: created.data.roomId,
        playerName: 'しろ',
        roomPassword: 'swordfish'
      });
      expect(joined.status).toBe(200);

      const listedAfterJoin = await requestJson(port, 'GET', '/api/match/list');
      expect(listedAfterJoin.status).toBe(200);
      expect(listedAfterJoin.data.rooms).toEqual([
        expect.objectContaining({
          roomId: created.data.roomId,
          hostName: 'くろ',
          seatCount: 2,
          maxSeats: 2,
          spectatorCount: 0,
          maxSpectators: 4,
          canJoin: false,
          canSpectate: true,
          hasPassword: true
        })
      ]);
    } finally {
      await closeServer(server);
    }
  });

  test('空の名前で作成でき、空のルーム名は無名部屋として一覧に出る', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: '',
        roomName: ''
      });
      expect(created.status).toBe(200);
      expect(created.data.playerName).toMatch(/^ゲスト[A-Z0-9]{3}$/);
      expect(created.data.roomName).toBe('無名部屋');

      const listed = await requestJson(port, 'GET', '/api/match/list');
      expect(listed.status).toBe(200);
      expect(listed.data.rooms).toEqual([
        expect.objectContaining({
          roomId: created.data.roomId,
          roomName: '無名部屋',
          hostName: created.data.playerName
        })
      ]);
    } finally {
      await closeServer(server);
    }
  });

  test('部屋ごとの持ち時間を3〜1800秒で保持し未指定時は120秒にする', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const minimum = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ',
        turnTimeSeconds: 3
      });
      expect(minimum.status).toBe(200);
      expect(minimum.data.turnTimer).toEqual(expect.objectContaining({ limitSeconds: 3, active: false }));

      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId: minimum.data.roomId,
        playerName: 'しろ'
      });
      expect(joined.status).toBe(200);
      expect(joined.data.turnTimer.limitSeconds).toBe(3);
      expect(Number(joined.data.turnTimer.turnDeadlineAt) - Number(joined.data.turnTimer.turnStartedAt)).toBe(3000);

      const maximum = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ2',
        turnTimeSeconds: 9999
      });
      expect(maximum.data.turnTimer.limitSeconds).toBe(1800);

      const defaultRoom = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ3' });
      expect(defaultRoom.data.turnTimer.limitSeconds).toBe(120);
    } finally {
      await closeServer(server);
    }
  });

  test('10分以上参加されない部屋は一覧から消え参加できない', async () => {
    let nowMs = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ'
      });
      expect(created.status).toBe(200);

      nowMs += 10 * 60 * 1000 + 1;

      const listed = await requestJson(port, 'GET', '/api/match/list');
      expect(listed.status).toBe(200);
      expect(listed.data.rooms).toEqual([]);

      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId: created.data.roomId,
        playerName: 'しろ'
      });
      expect(joined.status).toBe(404);
      expect(joined.data.reason).toBe('ROOM_NOT_FOUND');
    } finally {
      nowSpy.mockRestore();
      await closeServer(server);
    }
  });

  test('streamがなくなった対局中ルームは15分後に一覧から掃除される', async () => {
    let nowMs = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
    const server = createLocalMatchServer();
    const port = await listen(server);
    let stream: any = null;

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ'
      });
      expect(created.status).toBe(200);

      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId: created.data.roomId,
        playerName: 'しろ'
      });
      expect(joined.status).toBe(200);

      stream = await openSseStream(
        port,
        '/api/match/stream?roomId=' + encodeURIComponent(created.data.roomId)
          + '&seatKey=black&seatToken=' + encodeURIComponent(created.data.seatToken)
      );
      await closeSseStream(stream);
      stream = null;

      nowMs += 15 * 60 * 1000 + 1;

      const listed = await requestJson(port, 'GET', '/api/match/list');
      expect(listed.status).toBe(200);
      expect(listed.data.rooms).toEqual([]);

      const state = await requestJson(
        port,
        'GET',
        '/api/match/state?roomId=' + encodeURIComponent(created.data.roomId)
          + '&seatKey=black&seatToken=' + encodeURIComponent(created.data.seatToken)
      );
      expect(state.status).toBe(404);
      expect(state.data.reason).toBe('ROOM_NOT_FOUND');
    } finally {
      await closeSseStream(stream);
      nowSpy.mockRestore();
      await closeServer(server);
    }
  });
});
