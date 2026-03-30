const http = require('http');

const { createLocalMatchServer, resetRoomsForTests, patchRoomSnapshotForTests } = require('../scripts/local-match-server');

function requestJson(port, method, path, payload) {
  return new Promise((resolve, reject) => {
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

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return server.address().port;
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(() => resolve()));
}

function openStream(port, roomId, seatKey, seatToken, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: `/api/match/stream?roomId=${encodeURIComponent(roomId)}&seatKey=${encodeURIComponent(seatKey)}&seatToken=${encodeURIComponent(seatToken)}`,
      method: 'GET',
      headers: headers || {}
    }, (res) => {
      let firstChunk = '';
      const onData = (chunk) => {
        firstChunk += String(chunk || '');
        if (!firstChunk.includes('\n\n')) return;
        res.off('data', onData);
        resolve({ req, res, firstChunk });
      };
      res.setEncoding('utf8');
      res.on('data', onData);
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

describe('local match server leave contract', () => {
  afterEach(() => {
    resetRoomsForTests();
  });

  test('leave rotates seat token, rejects old token, and closes leaving stream', async () => {
    const server = createLocalMatchServer();
    let stream = null;
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      expect(created.status).toBe(200);

      const roomId = created.data.roomId;
      const oldSeatToken = created.data.seatToken;

      const joinedWhite = await requestJson(port, 'POST', '/api/match/join', {
        roomId,
        seatKey: 'white',
        playerName: 'しろ'
      });
      expect(joinedWhite.status).toBe(200);

      stream = await openStream(port, roomId, 'black', oldSeatToken);
      expect(stream.firstChunk).toContain('event: snapshot');

      const left = await requestJson(port, 'POST', '/api/match/leave', {
        roomId,
        seatKey: 'black',
        seatToken: oldSeatToken
      });
      expect(left.status).toBe(200);

      const staleState = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(oldSeatToken)}`
      );
      expect(staleState.status).toBe(403);
      expect(staleState.data.reason).toBe('SEAT_TOKEN_MISMATCH');

      const rejoined = await requestJson(port, 'POST', '/api/match/join', {
        roomId,
        seatKey: 'black',
        playerName: 'くろ2'
      });
      expect(rejoined.status).toBe(200);
      expect(rejoined.data.seatToken).not.toBe(oldSeatToken);
    } finally {
      try {
        if (stream && stream.req) stream.req.destroy();
      } catch (e) {}
      await closeServer(server);
    }
  });

  test('stream rejects missing and stale seat token', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      expect(created.status).toBe(200);

      const roomId = created.data.roomId;

      const missingToken = await requestJson(
        port,
        'GET',
        `/api/match/stream?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=`
      );
      expect(missingToken.status).toBe(403);
      expect(missingToken.data.reason).toBe('SEAT_TOKEN_REQUIRED');

      const staleToken = await requestJson(
        port,
        'GET',
        `/api/match/stream?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent('stale-token')}`
      );
      expect(staleToken.status).toBe(403);
      expect(staleToken.data.reason).toBe('SEAT_TOKEN_MISMATCH');
    } finally {
      await closeServer(server);
    }
  });

  test('stream replays buffered snapshot from Last-Event-ID for the authenticated seat', async () => {
    const server = createLocalMatchServer();
    let stream = null;
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      expect(created.status).toBe(200);

      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;

      const joinedWhite = await requestJson(port, 'POST', '/api/match/join', {
        roomId,
        seatKey: 'white',
        playerName: 'しろ'
      });
      expect(joinedWhite.status).toBe(200);

      const patched = patchRoomSnapshotForTests(roomId, (room) => {
        room.sseEventBuffer = [
          {
            id: `${roomId}_1_1`,
            event: 'heartbeat',
            payload: { ok: true, roomId, stateVersion: 1 }
          },
          {
            id: `${roomId}_2_2`,
            event: 'snapshot',
            payloadByViewer: {
              black: {
                ok: true,
                roomId,
                stateVersion: 2,
                playbackEvents: [{ type: 'observer_bubble', phase: 2, targets: [{ player: 'black', text: 'resume' }] }],
                effectLogs: ['白がカードを使用: 交換'],
                snapshot: {
                  stateVersion: 2,
                  _meta: {
                    authority: 'server',
                    version: 2,
                    projectedForSeat: 'black',
                    turnStartReconciled: true
                  },
                  gameState: {
                    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
                    currentPlayer: -1,
                    turnNumber: 2,
                    consecutivePasses: 0
                  },
                  cardState: {
                    hands: { black: ['b1'], white: ['__hidden_hand__:white:0'] },
                    charge: { black: 0, white: 0 },
                    pendingEffectByPlayer: { black: null, white: null },
                    hasUsedCardThisTurnByPlayer: { black: false, white: false },
                    lastUsedCardByPlayer: { black: null, white: null },
                    markers: [],
                    discard: [],
                    turnIndex: 2
                  }
                }
              },
              white: {
                ok: true,
                roomId,
                stateVersion: 2,
                playbackEvents: [],
                effectLogs: ['白がカードを使用: 交換'],
                snapshot: {
                  stateVersion: 2,
                  _meta: {
                    authority: 'server',
                    version: 2,
                    projectedForSeat: 'white',
                    turnStartReconciled: true
                  },
                  gameState: {
                    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
                    currentPlayer: -1,
                    turnNumber: 2,
                    consecutivePasses: 0
                  },
                  cardState: {
                    hands: { black: ['__hidden_hand__:black:0'], white: ['w1'] },
                    charge: { black: 0, white: 0 },
                    pendingEffectByPlayer: { black: null, white: null },
                    hasUsedCardThisTurnByPlayer: { black: false, white: false },
                    lastUsedCardByPlayer: { black: null, white: null },
                    markers: [],
                    discard: [],
                    turnIndex: 2
                  }
                }
              }
            }
          }
        ];
      });
      expect(patched).toBe(true);

      stream = await openStream(port, roomId, 'black', seatToken, { 'Last-Event-ID': `${roomId}_1_1` });
      expect(stream.firstChunk).toContain('event: snapshot');
      expect(stream.firstChunk).toContain(`id: ${roomId}_2_2`);
      expect(stream.firstChunk).toContain('"observer_bubble"');
      expect(stream.firstChunk).toContain('"__hidden_hand__:white:0"');
      expect(stream.firstChunk).not.toContain('"type":"history"');
    } finally {
      try {
        if (stream && stream.req) stream.req.destroy();
      } catch (e) {}
      await closeServer(server);
    }
  });
});
