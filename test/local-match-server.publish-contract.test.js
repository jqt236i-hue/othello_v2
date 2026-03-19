const http = require('http');
const { createLocalMatchServer, resetRoomsForTests } = require('../scripts/local-match-server');

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

describe('local match server publish contract', () => {
  afterEach(() => {
    resetRoomsForTests();
  });

  test('VERSION_MISMATCH response keeps room context and shared publishMeta shape', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      const authoritativeVersion = Number(created.data.stateVersion);

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: authoritativeVersion + 1,
        operationId: 'op_vm_1',
        actionType: 'place'
      });

      expect(response.status).toBe(409);
      expect(response.data).toEqual(expect.objectContaining({
        ok: false,
        roomId,
        rejectedReason: 'VERSION_MISMATCH',
        roomDeck: null,
        networkDebugEnabled: false,
        snapshot: expect.any(Object),
        seats: expect.any(Object),
        seatNames: expect.any(Object),
        turnTimer: expect.any(Object),
        publishMeta: expect.objectContaining({
          kind: 'rejected',
          operationId: 'op_vm_1',
          actionType: 'place',
          receivedBaseVersion: authoritativeVersion + 1,
          authoritativeStateVersion: authoritativeVersion,
          rejectedReason: 'VERSION_MISMATCH'
        })
      }));
    } finally {
      await closeServer(server);
    }
  });

  test('idempotent replay response keeps shared publishMeta shape', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      const baseVersion = Number(created.data.stateVersion);
      const publishBody = {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion,
        operationId: 'op_place_1',
        actionType: 'place',
        actor: 'black',
        params: { row: 2, col: 3 },
        turnIndex: 1,
        action: {
          type: 'place',
          playerKey: 'black',
          row: 2,
          col: 3,
          turnIndex: 1
        }
      };

      const first = await requestJson(port, 'POST', '/api/match/publish', publishBody);
      expect(first.status).toBe(200);

      const replay = await requestJson(port, 'POST', '/api/match/publish', publishBody);

      expect(replay.status).toBe(200);
      expect(replay.data).toEqual(expect.objectContaining({
        ok: true,
        roomId,
        idempotentReplay: true,
        roomDeck: null,
        networkDebugEnabled: false,
        snapshot: expect.any(Object),
        seats: expect.any(Object),
        seatNames: expect.any(Object),
        turnTimer: expect.any(Object),
        publishMeta: expect.objectContaining({
          kind: 'idempotent_replay',
          operationId: 'op_place_1',
          actionType: 'place',
          receivedBaseVersion: baseVersion,
          authoritativeStateVersion: Number(first.data.stateVersion),
          replayedStateVersion: Number(first.data.stateVersion)
        })
      }));
    } finally {
      await closeServer(server);
    }
  });
});
