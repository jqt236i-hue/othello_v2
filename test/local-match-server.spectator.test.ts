import * as http from 'http';

const {
  createLocalMatchServer,
  resetRoomsForTests,
  patchRoomSnapshotForTests
} = require('../scripts/local-match-server.js');

function requestJson(port, method, path, payload?) {
  return new Promise<any>((resolve, reject) => {
    const body = payload !== undefined ? JSON.stringify(payload) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      } : {}
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
    if (body) req.write(body);
    req.end();
  });
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

describe('local match server spectator API', () => {
  afterEach(() => {
    resetRoomsForTests();
  });

  test('spectate returns spectator credentials and spectator-safe snapshot', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const create = await requestJson(port, 'POST', '/api/match/create', { playerName: '黒' });
      expect(create.status).toBe(200);
      const roomId = create.data.roomId;
      patchRoomSnapshotForTests(roomId, (room) => {
        room.snapshot.gameState.board = [[0]];
        room.snapshot.gameState.currentPlayer = 1;
        room.snapshot.cardState.hands = {
          black: ['meteor_will'],
          white: ['guard_will']
        };
      });

      const spectate = await requestJson(port, 'POST', '/api/match/spectate', {
        roomId,
        spectatorName: '観戦'
      });

      expect(spectate.status).toBe(200);
      expect(spectate.data).toEqual(expect.objectContaining({
        ok: true,
        viewerRole: 'spectator',
        spectatorId: expect.stringMatching(/^spec_/),
        spectatorToken: expect.any(String),
        spectatorName: '観戦',
        spectatorCount: 1,
        maxSpectators: 4
      }));
      expect(spectate.data.snapshot._meta).toEqual(expect.objectContaining({
        authority: 'server',
        projectedForSeat: null,
        viewerRole: 'spectator'
      }));
      expect(spectate.data.snapshot.cardState.hands.black).toEqual(['meteor_will']);
      expect(spectate.data.snapshot.cardState.hands.white).toEqual(['guard_will']);
    } finally {
      await closeServer(server);
    }
  });

  test('spectator token cannot publish', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const create = await requestJson(port, 'POST', '/api/match/create', { playerName: '黒' });
      expect(create.status).toBe(200);
      const spectate = await requestJson(port, 'POST', '/api/match/spectate', {
        roomId: create.data.roomId,
        spectatorName: '観戦'
      });
      expect(spectate.status).toBe(200);

      const publish = await requestJson(port, 'POST', '/api/match/publish', {
        roomId: create.data.roomId,
        viewerRole: 'spectator',
        spectatorId: spectate.data.spectatorId,
        spectatorToken: spectate.data.spectatorToken,
        action: { type: 'place', row: 0, col: 0 }
      });

      expect(publish.status).toBe(403);
    } finally {
      await closeServer(server);
    }
  });
});
