import * as http from 'http';
import { createLocalMatchServer, resetRoomsForTests } from '../scripts/local-match-server.js';

function requestJson(port: number, method: string, path: string, payload?: unknown): Promise<{ status: number; data: any }> {
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
    if (payload !== undefined) req.write(JSON.stringify(payload));
    req.end();
  });
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

describe('local match server rated queue', () => {
  beforeEach(() => {
    resetRoomsForTests();
  });

  afterEach(() => {
    resetRoomsForTests();
  });

  test('2人がレート戦キューに入ると8x8固定AUTO無効の部屋へ自動マッチする', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);
    try {
      const blackIdentity = await requestJson(port, 'POST', '/api/player/identity/create', {});
      const whiteIdentity = await requestJson(port, 'POST', '/api/player/identity/create', {});

      const first = await requestJson(port, 'POST', '/api/match/rated/queue', {
        playerName: 'くろ',
        playerId: blackIdentity.data.playerId,
        playerToken: blackIdentity.data.playerToken
      });
      const second = await requestJson(port, 'POST', '/api/match/rated/queue', {
        playerName: 'しろ',
        playerId: whiteIdentity.data.playerId,
        playerToken: whiteIdentity.data.playerToken
      });
      const firstPoll = await requestJson(port, 'POST', '/api/match/rated/poll', {
        playerId: blackIdentity.data.playerId,
        playerToken: blackIdentity.data.playerToken
      });
      const listed = await requestJson(port, 'GET', '/api/match/list');

      expect(first.status).toBe(200);
      expect(first.data).toMatchObject({
        ok: true,
        status: 'waiting',
        remainingMs: 600000
      });
      expect(second.status).toBe(200);
      expect(firstPoll.status).toBe(200);
      expect(second.data.status).toBe('matched');
      expect(firstPoll.data.status).toBe('matched');
      expect(second.data.match.roomId).toBe(firstPoll.data.match.roomId);
      expect(second.data.match.seatKey).toBe('white');
      expect(firstPoll.data.match.seatKey).toBe('black');
      expect(second.data.match.payload).toMatchObject({
        roomName: 'レート戦',
        roomBoardConfig: { rows: 8, cols: 8, standard8x8: true },
        networkAutoEnabled: false,
        ratedMatch: {
          pool: 'card_ranked_v1',
          systemVersion: 1,
          matchId: expect.stringMatching(/^rated_/)
        },
        seatPlayerIds: {
          black: blackIdentity.data.playerId,
          white: whiteIdentity.data.playerId
        }
      });
      expect(firstPoll.data.match.payload).toMatchObject({
        roomName: 'レート戦',
        roomBoardConfig: { rows: 8, cols: 8, standard8x8: true },
        networkAutoEnabled: false,
        ratedMatch: {
          pool: 'card_ranked_v1',
          systemVersion: 1,
          matchId: expect.stringMatching(/^rated_/)
        }
      });
      expect(listed.data.rooms).toEqual([]);
    } finally {
      server.close();
    }
  });

  test('レート戦キューは10分を超えると期限切れになる', async () => {
    const originalNow = Date.now;
    let nowMs = 1_700_000_000_000;
    Date.now = jest.fn(() => nowMs) as any;
    const server = createLocalMatchServer();
    const port = await listen(server);
    try {
      const identity = await requestJson(port, 'POST', '/api/player/identity/create', {});
      const queued = await requestJson(port, 'POST', '/api/match/rated/queue', {
        playerName: 'くろ',
        playerId: identity.data.playerId,
        playerToken: identity.data.playerToken
      });

      nowMs += 600001;
      const poll = await requestJson(port, 'POST', '/api/match/rated/poll', {
        playerId: identity.data.playerId,
        playerToken: identity.data.playerToken
      });

      expect(queued.status).toBe(200);
      expect(queued.data.status).toBe('waiting');
      expect(queued.data.expiresAt).toBe(1_700_000_600_000);
      expect(poll.status).toBe(200);
      expect(poll.data).toMatchObject({
        ok: true,
        status: 'expired',
        reason: 'QUEUE_EXPIRED'
      });
    } finally {
      Date.now = originalNow;
      server.close();
    }
  });
});
